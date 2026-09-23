import "server-only";

import type { Prisma } from "@prisma/client";

/**
 * Issue-time invoice snapshots.
 *
 * A `snapshotJson` blob is written once, at invoice creation, capturing the
 * plan price/interval and the amounts/currency actually billed. The invoice
 * PDF route renders from this snapshot when present, so a later plan price
 * change or FX refresh can never rewrite history — old invoices keep the
 * numbers they were issued with and stay byte-identical across reprints.
 */

export interface InvoiceSnapshot {
  /** Snapshot schema version for forward-compatible reads. */
  version: 1;
  /** Issue timestamp (ISO) the snapshot was frozen at. */
  issuedAt: string;
  plan: {
    name: string | null;
    interval: string | null;
    /** Billed unit price in the invoice currency at issue time. */
    price: number | null;
    /** Yearly price when the plan was billed annually, else null. */
    yearlyPrice: number | null;
  };
  amount: number;
  currency: string;
  /** Amounts recomputed from the frozen amount (89/11 split used by PDFs). */
  subtotal: number;
  tax: number;
  description: string | null;
  periodStart: string | null;
  periodEnd: string | null;
}

const TAX_SPLIT = 0.89; // subtotal share; tax = amount − subtotal (11% VAT)

/**
 * Build the snapshot from the plan row (when the invoice references one) and
 * the amounts actually written to the invoice. Safe to call with a null plan.
 */
export function buildInvoiceSnapshot(input: {
  plan?: {
    name: string;
    interval: string;
    price: number;
    yearlyPrice: number | null;
  } | null;
  amount: number;
  currency: string;
  description?: string | null;
  periodStart?: Date | string | null;
  periodEnd?: Date | string | null;
}): Prisma.InputJsonValue {
  const iso = (d: Date | string | null | undefined): string | null => {
    if (!d) return null;
    return (d instanceof Date ? d : new Date(d)).toISOString();
  };

  const snapshot: InvoiceSnapshot = {
    version: 1,
    issuedAt: new Date().toISOString(),
    plan: input.plan
      ? {
          name: input.plan.name,
          interval: input.plan.interval,
          price: input.plan.price,
          yearlyPrice: input.plan.yearlyPrice ?? null,
        }
      : { name: null, interval: null, price: null, yearlyPrice: null },
    amount: input.amount,
    currency: input.currency,
    subtotal: Number((input.amount * TAX_SPLIT).toFixed(2)),
    tax: Number((input.amount - input.amount * TAX_SPLIT).toFixed(2)),
    description: input.description ?? null,
    periodStart: iso(input.periodStart ?? null),
    periodEnd: iso(input.periodEnd ?? null),
  };

  return snapshot as unknown as Prisma.InputJsonValue;
}

/**
 * Parse a stored snapshot defensively — a corrupt/legacy row yields null so
 * callers fall back to their pre-snapshot rendering path.
 */
export function parseInvoiceSnapshot(
  value: Prisma.JsonValue | null | undefined,
): InvoiceSnapshot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const s = value as Record<string, unknown>;
  if (s.version !== 1) return null;
  if (typeof s.amount !== "number" || typeof s.currency !== "string") return null;
  if (!s.plan || typeof s.plan !== "object") return null;
  return value as unknown as InvoiceSnapshot;
}
