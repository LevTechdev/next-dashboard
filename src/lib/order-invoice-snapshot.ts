import "server-only";

import type { Prisma } from "@prisma/client";

/**
 * Issue-time snapshots for ORDER invoices — mirrors lib/invoice-snapshot.ts
 * (the billing counterpart).
 *
 * `Order.invoiceSnapshot` is written once, when the invoice PDF is first
 * issued for an order, capturing the line items and totals actually shown.
 * The route renders from this snapshot on every later call, so a product
 * price change, FX refresh, or branding tweak can never rewrite history —
 * reprints are byte-identical to the original issue.
 */

export interface OrderInvoiceLineSnapshot {
  name: string;
  sku: string;
  quantity: number;
  /** Unit price at issue time, in the order's base USD amounts. */
  unitPrice: number;
  /** Line total at issue time (unitPrice × quantity), base USD. */
  lineTotal: number;
}

export interface OrderInvoiceSnapshot {
  /** Snapshot schema version for forward-compatible reads. */
  version: 1;
  /** Issue timestamp (ISO) the snapshot was frozen at. */
  issuedAt: string;
  /** Invoice number minted at issue time (ORD-…). */
  invoiceNumber: string;
  lines: OrderInvoiceLineSnapshot[];
  /** All amounts in the order's base currency (USD) at issue time. */
  subtotal: number;
  discount: number;
  tax: number;
  shipping: number;
  grandTotal: number;
  /** Customer identity frozen at issue (name may be edited later). */
  customerName: string;
  customerEmail: string;
}

/**
 * Build the snapshot from the order as currently rendered. `invoiceNumber`
 * is the number minted for this issue (the order number).
 */
export function buildOrderInvoiceSnapshot(input: {
  invoiceNumber: string;
  lines: OrderInvoiceLineSnapshot[];
  subtotal: number;
  discount: number;
  tax: number;
  shipping: number;
  grandTotal: number;
  customerName: string;
  customerEmail: string;
}): Prisma.InputJsonValue {
  const snapshot: OrderInvoiceSnapshot = {
    version: 1,
    issuedAt: new Date().toISOString(),
    invoiceNumber: input.invoiceNumber,
    lines: input.lines,
    subtotal: input.subtotal,
    discount: input.discount,
    tax: input.tax,
    shipping: input.shipping,
    grandTotal: input.grandTotal,
    customerName: input.customerName,
    customerEmail: input.customerEmail,
  };
  return snapshot as unknown as Prisma.InputJsonValue;
}

/**
 * Parse a stored snapshot defensively — a corrupt/legacy row yields null so
 * the route falls back to computing from live rows (pre-snapshot behavior).
 */
export function parseOrderInvoiceSnapshot(
  value: Prisma.JsonValue | null | undefined,
): OrderInvoiceSnapshot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const s = value as Record<string, unknown>;
  if (s.version !== 1) return null;
  if (typeof s.invoiceNumber !== "string") return null;
  if (!Array.isArray(s.lines)) return null;
  if (typeof s.grandTotal !== "number") return null;
  if (!s.customerName || typeof s.customerName !== "string") return null;
  return value as unknown as OrderInvoiceSnapshot;
}
