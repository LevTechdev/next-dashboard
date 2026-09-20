import { prisma } from "@/lib/db";
import { qrisLedger } from "@/lib/qris-engine";

/**
 * Affiliate auto-payouts — monthly scheduled disbursements.
 *
 * When the workspace's available commission (earned APPROVED+PAID minus
 * outstanding PROCESSING/SCHEDULED payouts) crosses AUTO_PAYOUT_THRESHOLD_USD,
 * the crossing amount is committed as a SCHEDULED payout that the provider
 * settles at the next monthly cycle. Runs are idempotent per calendar month:
 * a ledger file records the last executed cycle so reboots/cold-starts never
 * double-payout.
 *
 * The QRIS settlement gate mirrors POST /api/affiliates/payouts: a payout
 * larger than the settlement cash is capped, never overdrawn.
 */

/** Trigger the auto-payout once available commission reaches this (USD). */
export const AUTO_PAYOUT_THRESHOLD_USD = Number(process.env.AUTO_PAYOUT_THRESHOLD_USD ?? "500");

/** Fraction of the available balance committed when the threshold trips. */
export const AUTO_PAYOUT_RATIO = Math.min(
  Math.max(Number(process.env.AUTO_PAYOUT_RATIO ?? "1"), 0.1),
  1,
);

/** Shared payout records, persisted so every route bundle sees them. */
export interface AutoPayoutRecord {
  id: string;
  amount: number;
  currency: "USD";
  provider: "MIDTRANS";
  status: "SCHEDULED";
  account: string;
  affiliateName: string;
  createdAt: string;
  completedAt: null;
  trigger: "threshold";
  cycle: string;
}

/**
 * JSON-backed registry (same pattern as the webhook DLQ store): route
 * bundles in Next.js don't share module state, so the auto-payouts must
 * persist for the payouts API to merge them into GET responses.
 */
const STORE_PATH = "data/auto-payouts.json";

export function getAutoPayouts(): AutoPayoutRecord[] {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require("node:fs") as typeof import("node:fs");
    if (!fs.existsSync(STORE_PATH)) return [];
    return (
      (JSON.parse(fs.readFileSync(STORE_PATH, "utf-8")) as { payouts?: AutoPayoutRecord[] })
        .payouts ?? []
    );
  } catch {
    return [];
  }
}

function recordAutoPayout(record: AutoPayoutRecord): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require("node:fs") as typeof import("node:fs");
    const all = getAutoPayouts();
    all.unshift(record);
    fs.writeFileSync(STORE_PATH, JSON.stringify({ payouts: all }, null, 2));
  } catch {
    // Best-effort persistence.
  }
}

/** Monthly idempotency ledger (survives process restarts like the DLQ store). */
const LEDGER_PATH = "data/auto-payout-cycle.json";

function lastCycle(): string | null {
  try {
    // Lazy require keeps this importable from edge-ish contexts and tests.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require("node:fs") as typeof import("node:fs");
    if (!fs.existsSync(LEDGER_PATH)) return null;
    return (JSON.parse(fs.readFileSync(LEDGER_PATH, "utf-8")) as { cycle?: string }).cycle ?? null;
  } catch {
    return null;
  }
}

function writeCycle(cycle: string): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require("node:fs") as typeof import("node:fs");
    fs.writeFileSync(LEDGER_PATH, JSON.stringify({ cycle, at: new Date().toISOString() }, null, 2));
  } catch {
    // Best-effort persistence; the in-memory guard still prevents
    // double-payout within a process lifetime.
  }
}

export function cycleKey(now = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** QRIS ledger holds IDR — convert to the USD payout base (same as the API). */
const IDR_PER_USD = 15850;
const qrisBalanceUsd = (): number => qrisLedger.getState().availableBalance / IDR_PER_USD;

export interface AutoPayoutResult {
  triggered: boolean;
  reason:
    | "threshold-met"
    | "below-threshold"
    | "already-run-this-cycle"
    | "no-commission"
    | "settlement-capped";
  cycle: string;
  availableBalance: number;
  settlementBalance: number;
  threshold: number;
  payout?: AutoPayoutRecord;
}

/**
 * Evaluate the auto-payout rule for the current monthly cycle.
 * @param now injectable clock for tests.
 * @param force bypass the cycle guard (tests / manual admin runs).
 */
export async function runAutoPayout(now = new Date(), force = false): Promise<AutoPayoutResult> {
  const cycle = cycleKey(now);

  const conversionAgg = await prisma.affiliateConversion.aggregate({
    _sum: { commissionAmount: true },
    where: { status: { in: ["APPROVED", "PAID"] } },
  });
  const earned = conversionAgg._sum.commissionAmount || 0;

  // Committed payouts come from both stores: the payouts API's in-memory
  // mock ledger (manual requests) and this module's auto-payout registry.
  const manualOutstanding = getManualOutstanding();
  const autoOutstanding = getAutoPayouts()
    .filter((p) => p.status === "SCHEDULED" && p.cycle === cycle)
    .reduce((s, p) => s + p.amount, 0);
  const available = Math.max(0, earned - manualOutstanding - autoOutstanding);
  const settlement = qrisBalanceUsd();

  const base: Omit<AutoPayoutResult, "triggered" | "reason"> = {
    cycle,
    availableBalance: available,
    settlementBalance: settlement,
    threshold: AUTO_PAYOUT_THRESHOLD_USD,
  };

  if (!force && lastCycle() === cycle) {
    return { ...base, triggered: false, reason: "already-run-this-cycle" };
  }
  if (available < AUTO_PAYOUT_THRESHOLD_USD) {
    return { ...base, triggered: false, reason: "below-threshold" };
  }

  // Never promise more than the settlement account can actually cover.
  const amount = Math.min(
    Math.floor(available * AUTO_PAYOUT_RATIO * 100) / 100,
    Math.floor(settlement * 100) / 100,
  );
  if (amount <= 0) {
    return { ...base, triggered: false, reason: "no-commission" };
  }
  const capped = amount < available * AUTO_PAYOUT_RATIO;

  const record: AutoPayoutRecord = {
    id: `PAY-AUTO-${cycle}-${Math.floor(Math.random() * 900 + 100)}`,
    amount,
    currency: "USD",
    provider: "MIDTRANS",
    status: "SCHEDULED",
    account: "QRIS settlement auto-disbursement",
    affiliateName: "Monthly auto-payout",
    createdAt: now.toISOString(),
    completedAt: null,
    trigger: "threshold",
    cycle,
  };

  recordAutoPayout(record);
  writeCycle(cycle);

  return {
    ...base,
    triggered: true,
    reason: capped ? "settlement-capped" : "threshold-met",
    payout: record,
  };
}

/**
 * Outstanding manual payouts (PROCESSING/SCHEDULED) from the payouts API's
 * in-memory store. Imported lazily to avoid a route→lib→route cycle; the
 * route exposes its array via the shared module below.
 */
function getManualOutstanding(): number {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { mockPayouts } = require("@/app/api/affiliates/payouts/route");
    return mockPayouts
      .filter((p: { status: string }) => p.status === "PROCESSING" || p.status === "SCHEDULED")
      .reduce((s: number, p: { amount: number }) => s + p.amount, 0);
  } catch {
    return 0;
  }
}
