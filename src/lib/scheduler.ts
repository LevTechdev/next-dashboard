/**
 * In-app scheduler — runs periodic jobs without external cron infra.
 *
 * Started once from instrumentation.ts register(). Jobs:
 *  - "usage-digest": daily quota digest at 02:00 server time (skipped if
 *    already sent today — the CRON_SECRET endpoint remains available for
 *    external schedulers).
 *  - "auto-payout": monthly affiliate auto-payout evaluation, idempotent
 *    per calendar cycle via data/auto-payout-cycle.json.
 *  - "webhook-retry": frequent sweep of due DLQ retries (5 min backoff base).
 *  - "email-outbox": frequent delivery sweep for queued mail whose send was
 *    killed mid-flight or failed transiently (1 min backoff base).
 *  - "recovery-drift": daily capture of every account's recovery-readiness
 *    verdict; alerts the owner the day it drops a rung.
 *  - "leaf-orphans-digest": daily ops digest (02:00) — mails every active
 *    admin through the durable outbox while the leaf-sync orphan report
 *    still NAMES rows nobody has acknowledged ("Needs reconciliation");
 *    deduped per UTC day via data/leaf-orphans-digest-sent.json.
 *
 * Jobs are skipped in development unless SCHEDULER_ENABLED=1 so `npm run dev`
 * doesn't email anyone or move money; set the env to exercise them locally.
 *
 * "supabase-sync" refreshes the remote Supabase mirror from the local
 * Postgres once per day (03:30, idempotent per calendar day). It runs only
 * when a remote URL is configured — plain local dev never touches Supabase.
 */

import { join } from "node:path";

import { runCliSync } from "@/lib/run-cli";

const TICK_MS = 5 * 60_000; // 5-minute heartbeat
const DIGEST_HOUR = 2;
/** Hour (server time) the nightly Supabase mirror refresh runs. */
const SYNC_HOUR = 3;
const SYNC_MINUTE = 30;

const timer: { current: NodeJS.Timeout | null } = { current: null };

export function schedulerEnabled(): boolean {
  return process.env.SCHEDULER_ENABLED === "1" || process.env.NODE_ENV === "production";
}

/** Interval between in-app auto-payout evaluations. */
const PAYOUT_CHECK_MS = 60 * 60_000; // hourly

/** Interval between incremental leaf-table mirror top-ups. */
const LEAF_SYNC_INTERVAL_MS = 30 * 60_000; // 30 minutes

const lastDigestRun: { day: string | null } = { day: null };
const lastSyncRun: { day: string | null } = { day: null };
const lastLeafSyncRun: { at: number | null } = { at: null };
const lastSweepRun: { day: string | null } = { day: null };
const lastReportsRun: { day: string | null } = { day: null };
const lastDriftRun: { day: string | null } = { day: null };
const lastFxRun: { day: string | null } = { day: null };
const lastOrphanDigestRun: { day: string | null } = { day: null };

/** Last execution per job — surfaced by GET /api/scheduler/status. */
export interface JobRunInfo {
  at: string;
  ok: boolean;
  result?: unknown;
  error?: string;
}

/**
 * JSON-backed run ledger (same pattern as the webhook DLQ / auto-payout
 * stores): instrumentation.ts and route bundles get separate module
 * instances in Next.js, so in-memory Maps would never cross the boundary.
 */
const RUNS_PATH = "data/scheduler-runs.json";

function readRuns(): Record<string, JobRunInfo> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require("node:fs") as typeof import("node:fs");
    if (!fs.existsSync(RUNS_PATH)) return {};
    return JSON.parse(fs.readFileSync(RUNS_PATH, "utf-8")) as Record<string, JobRunInfo>;
  } catch {
    return {};
  }
}

function writeRun(name: string, info: JobRunInfo): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require("node:fs") as typeof import("node:fs");
    const all = readRuns();
    all[name] = info;
    fs.writeFileSync(RUNS_PATH, JSON.stringify(all, null, 2));
  } catch {
    // Best-effort persistence.
  }
}

export type SchedulerJobName =
  | "usage-digest"
  | "auto-payout"
  | "webhook-retry"
  | "auto-reorder"
  | "supabase-sync"
  | "supabase-leaf-sync"
  | "trial-sweep"
  | "scheduled-reports"
  | "backup-verify"
  | "recovery-drift"
  | "fx-snapshot"
  | "leaf-orphans-digest"
  | "email-outbox";

/**
 * Record a run triggered outside the in-app loop (e.g. the Vercel cron hit on
 * /api/usage/digest). Same ledger, so the Settings card shows one truth.
 */
export function recordExternalJobRun(
  name: SchedulerJobName,
  result?: unknown,
  error?: string,
): void {
  writeRun(name, {
    at: new Date().toISOString(),
    ok: !error,
    ...(error ? { error } : { result }),
  });
}

export function schedulerStatus(): {
  enabled: boolean;
  tickMs: number;
  jobs: Record<string, JobRunInfo | null>;
} {
  const runs = readRuns();
  return {
    enabled: schedulerEnabled(),
    tickMs: TICK_MS,
    jobs: {
      "usage-digest": runs["usage-digest"] ?? null,
      "auto-payout": runs["auto-payout"] ?? null,
      "webhook-retry": runs["webhook-retry"] ?? null,
      "auto-reorder": runs["auto-reorder"] ?? null,
      "supabase-sync": runs["supabase-sync"] ?? null,
      "supabase-leaf-sync": runs["supabase-leaf-sync"] ?? null,
      "trial-sweep": runs["trial-sweep"] ?? null,
      "scheduled-reports": runs["scheduled-reports"] ?? null,
      "backup-verify": runs["backup-verify"] ?? null,
      "recovery-drift": runs["recovery-drift"] ?? null,
      "fx-snapshot": runs["fx-snapshot"] ?? null,
      "leaf-orphans-digest": runs["leaf-orphans-digest"] ?? null,
      "email-outbox": runs["email-outbox"] ?? null,
    },
  };
}

async function runJob(name: SchedulerJobName): Promise<unknown> {
  try {
    const result = await runJobInner(name);
    writeRun(name, { at: new Date().toISOString(), ok: true, result });
    return result;
  } catch (err) {
    writeRun(name, {
      at: new Date().toISOString(),
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

async function runJobInner(name: SchedulerJobName): Promise<unknown> {
  switch (name) {
    case "usage-digest": {
      const { runQuotaDigest } = await import("@/lib/usage-digest");
      const result = await runQuotaDigest(true);
      return { job: name, owners: result.owners, sent: result.sent };
    }
    case "auto-payout": {
      const { runAutoPayout } = await import("@/lib/affiliate-auto-payout");
      return { job: name, ...(await runAutoPayout()) };
    }
    case "webhook-retry": {
      const { processDueRetries } = await import("@/lib/webhook-retry");
      const { dispatchWebhookRetry } = await import("@/lib/webhook-dispatch");
      const result = await processDueRetries(dispatchWebhookRetry);
      return { job: name, ...result };
    }
    case "auto-reorder": {
      const { runAutoReorder } = await import("@/lib/inventory-auto-reorder");
      return { job: name, ...(await runAutoReorder()) };
    }
    case "trial-sweep": {
      const { runTrialSweep } = await import("@/lib/trial-sweep");
      const result = await runTrialSweep({ send: true });
      return { job: name, expired: result.expired, warned: result.warned };
    }
    case "scheduled-reports": {
      const { runScheduledReports } = await import("@/lib/scheduled-reports");
      const result = await runScheduledReports();
      return {
        job: name,
        sent: result.sent,
        ...(result.skipped ? { skipped: true, reason: result.reason } : {}),
      };
    }
    case "backup-verify": {
      const { runBackupVerify } = await import("@/lib/backup-verify");
      const result = await runBackupVerify();
      return { job: name, ...result };
    }
    case "recovery-drift": {
      const { runRecoveryDriftSweep } = await import("@/lib/recovery-drift");
      const result = await runRecoveryDriftSweep();
      return { job: name, ...result };
    }
    case "fx-snapshot": {
      const { captureFxSnapshot } = await import("@/lib/fx-history");
      const result = await captureFxSnapshot();
      return { job: name, ...result };
    }
    case "leaf-orphans-digest": {
      const { runLeafOrphansDigest } = await import("@/lib/leaf-orphans-digest");
      return { job: name, ...(await runLeafOrphansDigest()) };
    }
    case "email-outbox": {
      // Mail that a killed request left behind: the row is durable, so the
      // sweep is what turns "the user got nothing" into "the user got it a
      // minute later". See lib/email-outbox.
      const { drainEmailOutbox } = await import("@/lib/email-outbox");
      return { job: name, ...(await drainEmailOutbox()) };
    }
    case "supabase-leaf-sync": {
      if (!supabaseSyncConfigured()) {
        return { job: name, skipped: true, reason: "no remote URL configured" };
      }
      const { execFileSync } = await import("node:child_process");
      // Incremental top-up of the five leaf tables (Session, RefreshToken,
      // SecurityEvent, RecoveryReadinessSnapshot, FxRateSnapshot) — seconds,
      // not the full sync's 30-minute truncate/restore, so it can run between
      // nightly refreshes without holding a pooler connection for half an hour.
      const out = runCliSync(execFileSync, [leafSyncScriptPath()], {
        encoding: "utf-8",
        timeout: 12 * 60_000,
        cwd: process.cwd(),
      });
      // The script persists an operator-facing orphan report in its clean-run
      // state file (data/leaf-sync-watermark.json, gitignored): local rows
      // that can never sync because their FK targets (dev-seed users/tenants)
      // don't exist remotely. Surfacing it here is what makes the tally
      // actionable — samples name the exact refs to reconcile. readLeafOrphanReport
      // projects it through the acknowledged-orphan ledger (raw file + ack
      // subtraction in one place).
      const orphanReport = await readLeafOrphanReport();
      return {
        job: name,
        output: out.trim().split("\n").slice(-1)[0] ?? "",
        ...(orphanReport ? { orphanReport } : {}),
      };
    }
    case "supabase-sync": {
      if (!supabaseSyncConfigured()) {
        return { job: name, skipped: true, reason: "no remote URL configured" };
      }
      const { execFileSync } = await import("node:child_process");
      // The script reads credentials from env files itself and never prints
      // them; execFileSync hides argv from process listings.
      const out = runCliSync(execFileSync, [supabaseMirrorScriptPath()], {
        encoding: "utf-8",
        timeout: 10 * 60_000,
        cwd: process.cwd(),
      });
      return { job: name, output: out.trim().split("\n").slice(-1)[0] ?? "" };
    }
  }
}

/**
 * Read the raw leaf-sync orphan report from the state file and project it
 * through the acknowledged-orphan ledger, so refs an operator retired with
 * scripts/ack-leaf-orphans.mjs stop demanding attention everywhere the report
 * is surfaced. The file keeps the RAW report (the sync script owns it); every
 * consumer applies the ledger — see scripts/lib/leaf-orphans.mjs.
 */
export async function readLeafOrphanReport(): Promise<unknown> {
  try {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const raw = fs.readFileSync(
      path.join(process.cwd(), "data", "leaf-sync-watermark.json"),
      "utf-8",
    );
    const parsed = JSON.parse(raw) as { orphanReport?: unknown };
    if (!parsed.orphanReport || typeof parsed.orphanReport !== "object") return undefined;
    const { applyAckLedger, readAckLedger } = await import("../../scripts/lib/leaf-orphans.mjs");
    const ackEntries = readAckLedger(process.cwd()).entries;
    return applyAckLedger(parsed.orphanReport as Record<string, unknown>, ackEntries);
  } catch {
    // No state file / no report / no ledger — callers just show nothing.
    return undefined;
  }
}

/**
 * Absolute path to the Supabase mirror CLI (scripts/sync-supabase-mirror.mjs),
 * resolved against the working directory when the job runs.
 *
 * Always spawn it through `runCliSync` (see src/lib/run-cli.ts): the bundler's
 * static analysis of `child_process` arguments would otherwise try to resolve
 * this path as a module and fail the production build.
 */
export function supabaseMirrorScriptPath(): string {
  return join(process.cwd(), "scripts", "sync-supabase-mirror.mjs");
}

/** Absolute path to the incremental leaf-sync CLI (scripts/sync-supabase-leaves.mjs). */
export function leafSyncScriptPath(): string {
  return join(process.cwd(), "scripts", "sync-supabase-leaves.mjs");
}

/** True when a remote Supabase URL is available to sync into. */
function supabaseSyncConfigured(): boolean {
  if (process.env.REMOTE_SUPABASE_DATABASE_URL) return true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require("node:fs") as typeof import("node:fs");
    const bak = join(process.cwd(), ".env.remote-supabase.bak");
    return fs.existsSync(bak) && fs.readFileSync(bak, "utf-8").includes("DATABASE_URL=");
  } catch {
    return false;
  }
}

/** Manual/test entry — runs one job immediately, bypassing schedules. */
export async function runSchedulerJob(name: SchedulerJobName): Promise<unknown> {
  return runJob(name);
}

export async function startScheduler(): Promise<void> {
  if (timer.current || !schedulerEnabled()) return;

  timer.current = setInterval(async () => {
    try {
      const now = new Date();
      const today = now.toISOString().slice(0, 10);

      // Daily digest at DIGEST_HOUR, once per day.
      if (now.getHours() === DIGEST_HOUR && lastDigestRun.day !== today) {
        lastDigestRun.day = today;
        console.log("[scheduler] usage-digest", await runJob("usage-digest"));
      }

      // Trial expiry sweep — same daily hour as the digest (staffed hours,
      // and gated on the hour so a server restart never fires it off-schedule
      // and mails owners outside the daily window).
      if (now.getHours() === DIGEST_HOUR && lastSweepRun.day !== today) {
        lastSweepRun.day = today;
        console.log("[scheduler] trial-sweep", await runJob("trial-sweep"));
      }

      // Scheduled executive reports — evaluated daily; the job itself
      // checks its persisted frequency vs lastSentAt before sending.
      if (now.getHours() === DIGEST_HOUR && lastReportsRun.day !== today) {
        lastReportsRun.day = today;
        console.log("[scheduler] scheduled-reports", await runJob("scheduled-reports"));
      }

      // Nightly recovery-readiness capture. Runs at 03:00 — an hour after the
      // digest, so its "your recovery got weaker" alert is not competing with
      // the daily report for the same inbox moment.
      if (now.getHours() === SYNC_HOUR && lastDriftRun.day !== today) {
        lastDriftRun.day = today;
        console.log("[scheduler] recovery-drift", await runJob("recovery-drift"));
      }

      // Daily FX rate snapshot — one row per pair per day, alerting on a
      // >2% day-over-day move. Runs alongside recovery-drift in the same
      // quiet hour; the alert dedupes per day, so co-scheduling is safe.
      if (now.getHours() === SYNC_HOUR && lastFxRun.day !== today) {
        lastFxRun.day = today;
        console.log("[scheduler] fx-snapshot", await runJob("fx-snapshot"));
      }

      // Daily leaf-orphans ops digest at the same staffed hour as the quota
      // digest: mails admins only while the report names rows nobody has
      // acknowledged (the job itself dedupes per UTC day, so a restart within
      // the day cannot double-mail).
      if (now.getHours() === DIGEST_HOUR && lastOrphanDigestRun.day !== today) {
        lastOrphanDigestRun.day = today;
        console.log("[scheduler] leaf-orphans-digest", await runJob("leaf-orphans-digest"));
      }

      // Hourly auto-payout evaluation (monthly-idempotent inside the job).
      if (now.getTime() % PAYOUT_CHECK_MS < TICK_MS) {
        console.log("[scheduler] auto-payout", await runJob("auto-payout"));
        // Same hourly slot: draft POs for products at/below reorder point
        // (cooldown-guarded per product; drafts await human issue).
        console.log("[scheduler] auto-reorder", await runJob("auto-reorder"));
      }

      // Nightly Supabase mirror refresh at 03:30, once per day.
      if (
        now.getHours() === SYNC_HOUR &&
        now.getMinutes() >= SYNC_MINUTE &&
        lastSyncRun.day !== today &&
        supabaseSyncConfigured()
      ) {
        lastSyncRun.day = today;
        console.log("[scheduler] supabase-sync", await runJob("supabase-sync"));
        // Prove the pre-sync rollback snapshot it just produced is actually
        // restorable — verify into a scratch DB minutes after creation.
        console.log("[scheduler] backup-verify", await runJob("backup-verify"));
      }

      // Incremental leaf-table top-up between nightly refreshes — every
      // 30 minutes so production's analytics on sessions/tokens/security
      // events lag minutes, not up to 24 hours. Skipped in the sync hour
      // window to never race the full refresh.
      if (
        supabaseSyncConfigured() &&
        now.getHours() !== SYNC_HOUR &&
        (lastLeafSyncRun.at === null || now.getTime() - lastLeafSyncRun.at >= LEAF_SYNC_INTERVAL_MS)
      ) {
        lastLeafSyncRun.at = now.getTime();
        console.log("[scheduler] supabase-leaf-sync", await runJob("supabase-leaf-sync"));
      }

      // Webhook retry sweep runs every tick.
      await runJob("webhook-retry");

      // Queued mail sweep runs every tick: the fast path attempts delivery
      // right after the response, and this is the durable half that makes a
      // killed or failed attempt eventually arrive.
      await runJob("email-outbox");
    } catch (err) {
      console.error("[scheduler] job error:", err);
    }
  }, TICK_MS);
  timer.current.unref?.();

  console.log(
    "[scheduler] started (tick=5m, digest=02:00, payouts=hourly, webhook-retry=every tick, email-outbox=every tick, supabase-sync=03:30, leaf-sync=30m, recovery-drift=03:00, fx-snapshot=03:00, leaf-orphans-digest=02:00)",
  );
}

export function stopScheduler(): void {
  if (timer.current) {
    clearInterval(timer.current);
    timer.current = null;
  }
}
