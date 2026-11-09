import "server-only";

import { prisma } from "@/lib/db";
import {
  QrisLedger,
  setQrisLedgerPersistHook,
  type QrisLedgerState,
  type QrisTransaction,
  type WithdrawalDisbursement,
} from "./qris-engine";

/**
 * Server-only persistence for the QRIS income ledger, one ledger per
 * workspace.
 *
 * The engine itself stays Prisma-free because client components import its pure
 * QR helpers, so this store hydrates a `QrisLedger` instance from Prisma and
 * registers a persist hook at server startup; every engine mutation then
 * writes the workspace's ledger back. Previously this was a single global
 * data/qris-ledger.json file, which leaked balances across tenants.
 */

const ledgers = new Map<string, QrisLedger>();
const loading = new Map<string, Promise<QrisLedger>>();

function isValidLedgerState(value: unknown): value is QrisLedgerState {
  if (!value || typeof value !== "object") return false;
  const s = value as Record<string, unknown>;
  return (
    Array.isArray(s.transactions) &&
    Array.isArray(s.disbursements) &&
    typeof s.availableBalance === "number" &&
    typeof s.pendingBalance === "number" &&
    typeof s.totalWithdrawn === "number"
  );
}

/** Persist a full ledger snapshot for one workspace (idempotent upserts). */
export async function persistQrisLedger(tenantId: string, state: QrisLedgerState): Promise<void> {
  if (!isValidLedgerState(state)) return;

  await prisma.$transaction(async (tx) => {
    await tx.qrisLedgerBalance.upsert({
      where: { tenantId },
      create: {
        tenantId,
        availableBalance: state.availableBalance,
        pendingBalance: state.pendingBalance,
        totalWithdrawn: state.totalWithdrawn,
        totalInbound: state.totalInbound,
      },
      update: {
        availableBalance: state.availableBalance,
        pendingBalance: state.pendingBalance,
        totalWithdrawn: state.totalWithdrawn,
        totalInbound: state.totalInbound,
      },
    });

    for (const entry of state.transactions) {
      await tx.qrisTransaction.upsert({
        where: { id: entry.id },
        create: {
          id: entry.id,
          tenantId,
          invoiceNumber: entry.invoiceNumber,
          amount: entry.amount,
          currency: entry.currency,
          customerName: entry.customerName,
          sourceBank: entry.sourceBank,
          status: entry.status,
          qrisPayload: entry.qrisPayload,
          createdAt: new Date(entry.createdAt),
          paidAt: entry.paidAt ? new Date(entry.paidAt) : null,
          rrn: entry.rrn,
        },
        update: {
          status: entry.status,
          sourceBank: entry.sourceBank,
          paidAt: entry.paidAt ? new Date(entry.paidAt) : null,
        },
      });
    }

    for (const entry of state.disbursements) {
      await tx.qrisDisbursement.upsert({
        where: { id: entry.id },
        create: {
          id: entry.id,
          tenantId,
          disbursementNumber: entry.disbursementNumber,
          method: entry.method,
          destinationName: entry.destinationName,
          destinationAccount: entry.destinationAccount,
          bankCode: entry.bankCode,
          cardType: entry.cardType,
          grossAmount: entry.grossAmount,
          fee: entry.fee,
          netAmount: entry.netAmount,
          status: entry.status,
          referenceNumber: entry.referenceNumber,
          timestamp: new Date(entry.timestamp),
          notes: entry.notes,
          destinationCurrency: entry.destinationCurrency,
          fxRate: entry.fxRate,
          destinationAmount: entry.destinationAmount,
        },
        update: {
          status: entry.status,
          notes: entry.notes,
        },
      });
    }
  });
}

function hydrateFromRows(
  tenantId: string,
  balance: {
    availableBalance: number;
    pendingBalance: number;
    totalWithdrawn: number;
    totalInbound: number;
  },
  transactions: Array<{
    id: string;
    invoiceNumber: string;
    amount: number;
    currency: string;
    customerName: string;
    sourceBank: string;
    status: string;
    qrisPayload: string;
    createdAt: Date;
    paidAt: Date | null;
    rrn: string;
  }>,
  disbursements: Array<{
    id: string;
    disbursementNumber: string;
    method: string;
    destinationName: string;
    destinationAccount: string;
    bankCode: string | null;
    cardType: string | null;
    grossAmount: number;
    fee: number;
    netAmount: number;
    status: string;
    referenceNumber: string;
    timestamp: Date;
    notes: string | null;
    destinationCurrency: string | null;
    fxRate: number | null;
    destinationAmount: number | null;
  }>,
): QrisLedger {
  const ledger = new QrisLedger(tenantId);
  ledger.hydrate({
    availableBalance: balance.availableBalance,
    pendingBalance: balance.pendingBalance,
    totalWithdrawn: balance.totalWithdrawn,
    totalInbound: balance.totalInbound,
    transactions: transactions.map((row): QrisTransaction => ({
      id: row.id,
      invoiceNumber: row.invoiceNumber,
      amount: row.amount,
      currency: "IDR",
      customerName: row.customerName,
      sourceBank: row.sourceBank,
      status: row.status as QrisTransaction["status"],
      qrisPayload: row.qrisPayload,
      createdAt: row.createdAt.toISOString(),
      paidAt: row.paidAt?.toISOString(),
      rrn: row.rrn,
    })),
    disbursements: disbursements.map((row): WithdrawalDisbursement => ({
      id: row.id,
      disbursementNumber: row.disbursementNumber,
      method: row.method as WithdrawalDisbursement["method"],
      destinationName: row.destinationName,
      destinationAccount: row.destinationAccount,
      bankCode: row.bankCode ?? undefined,
      cardType: (row.cardType as WithdrawalDisbursement["cardType"]) ?? undefined,
      grossAmount: row.grossAmount,
      fee: row.fee,
      netAmount: row.netAmount,
      status: row.status as WithdrawalDisbursement["status"],
      referenceNumber: row.referenceNumber,
      timestamp: row.timestamp.toISOString(),
      notes: row.notes ?? undefined,
      destinationCurrency:
        (row.destinationCurrency as WithdrawalDisbursement["destinationCurrency"]) ?? undefined,
      fxRate: row.fxRate ?? undefined,
      destinationAmount: row.destinationAmount ?? undefined,
    })),
  });
  return ledger;
}

/** Load (and cache) the workspace's ledger, seeding demo state on first use. */
export async function loadQrisLedger(tenantId: string): Promise<QrisLedger> {
  const cached = ledgers.get(tenantId);
  if (cached) return cached;

  const pending = loading.get(tenantId);
  if (pending) return pending;

  const promise = (async () => {
    const [balance, transactions, disbursements] = await Promise.all([
      prisma.qrisLedgerBalance.findUnique({ where: { tenantId } }),
      prisma.qrisTransaction.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" } }),
      prisma.qrisDisbursement.findMany({ where: { tenantId }, orderBy: { timestamp: "desc" } }),
    ]);

    if (!balance) {
      // First visit: persist the engine's seeded demo ledger for this workspace
      // so subsequent loads (and other instances) share the same state.
      const seeded = new QrisLedger(tenantId);
      await persistQrisLedger(tenantId, seeded.getState());
      ledgers.set(tenantId, seeded);
      return seeded;
    }

    const ledger = hydrateFromRows(tenantId, balance, transactions, disbursements);
    ledgers.set(tenantId, ledger);
    return ledger;
  })().finally(() => loading.delete(tenantId));

  loading.set(tenantId, promise);
  return promise;
}

/**
 * Attach the engine persist hook at server startup. The hook is fire-and-forget
 * because engine mutators are synchronous; failures are logged rather than
 * thrown into the request that mutated the in-memory ledger.
 */
export function registerQrisLedgerPersistence(): void {
  setQrisLedgerPersistHook((state, tenantId) => {
    if (!tenantId) return;
    void persistQrisLedger(tenantId, state).catch((err) => {
      console.error("Failed to persist QRIS ledger:", err);
    });
  });
}
