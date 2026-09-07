import crypto from "crypto";

/**
 * Midtrans — local (Indonesia) payment gateway supporting DANA, GoPay, QRIS,
 * bank transfer (VA), and cards. Used for subscription checkout as an
 * alternative to Stripe. Checkout issues a Snap transaction whose token the
 * billing UI spends through the embedded snap.js popup (client key); the
 * hosted redirect_url is kept as a no-JS fallback. Payment results arrive via
 * the notification webhook (see /api/billing/midtrans/webhook).
 *
 * Env:
 * - MIDTRANS_ENV              — "production" for the live endpoints; anything
 *                               else (default) uses the sandbox environment
 * - MIDTRANS_SERVER_KEY       — server key for the production environment
 * - MIDTRANS_CLIENT_KEY       — public client key for the production env
 * - MIDTRANS_SANDBOX_SERVER_KEY / MIDTRANS_SANDBOX_CLIENT_KEY — used when
 *   MIDTRANS_ENV is not production, so both key sets can live in one env file
 *   and flipping MIDTRANS_ENV switches environments without editing keys.
 *   Falls back to the non-suffixed vars for single-key setups.
 */

/** USD → IDR conversion for plan prices (plans are priced in USD, Midtrans settles IDR). */
export const MIDTRANS_USD_RATE = 15_800;

/** Snap payment channels surfaced in the billing UI. */
export const MIDTRANS_CHANNELS = ["dana", "gopay", "qris", "bank_transfer", "credit_card"] as const;

export type MidtransChannel = (typeof MIDTRANS_CHANNELS)[number];

/** Server key for the configured environment (sandbox keys win in sandbox). */
export function getMidtransServerKey(): string {
  if (midtransIsSandbox()) {
    return process.env.MIDTRANS_SANDBOX_SERVER_KEY ?? process.env.MIDTRANS_SERVER_KEY ?? "";
  }
  return process.env.MIDTRANS_SERVER_KEY ?? "";
}

export function midtransConfigured(): boolean {
  return Boolean(getMidtransServerKey());
}

/** Sandbox by default; set MIDTRANS_ENV=production for live keys. */
export function midtransIsSandbox(): boolean {
  return process.env.MIDTRANS_ENV !== "production";
}

export function getMidtransBaseUrl(): string {
  return midtransIsSandbox() ? "https://app.sandbox.midtrans.com" : "https://app.midtrans.com";
}

/** Public client key for the configured env; safe to ship to the browser. */
export function getMidtransClientKey(): string {
  if (midtransIsSandbox()) {
    return process.env.MIDTRANS_SANDBOX_CLIENT_KEY ?? process.env.MIDTRANS_CLIENT_KEY ?? "";
  }
  return process.env.MIDTRANS_CLIENT_KEY ?? "";
}

/**
 * snap.js loader URL for the embedded (popup) checkout. The client key must
 * accompany the script, so both are handed to the browser together after a
 * transaction token is created.
 */
export function getMidtransSnapScriptUrl(): string {
  return midtransIsSandbox()
    ? "https://app.sandbox.midtrans.com/snap/snap.js"
    : "https://app.midtrans.com/snap/snap.js";
}

export interface MidtransItemDetail {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

export interface CreateSnapTransactionParams {
  orderId: string;
  grossAmountIdr: number;
  items: MidtransItemDetail[];
  customer?: { firstName?: string; email?: string };
  /** Restrict Snap to specific channels (e.g. ["dana"]); omit for all. */
  enabledPayments?: MidtransChannel[];
  notificationUrl?: string;
}

export interface SnapTransactionResult {
  token: string;
  redirect_url: string;
}

/**
 * Create a Midtrans Snap transaction (spent via the embedded popup or the
 * hosted redirect_url). Uses Basic auth with the server key; amounts are
 * integers in IDR.
 */
export async function createSnapTransaction({
  orderId,
  grossAmountIdr,
  items,
  customer,
  enabledPayments,
  notificationUrl,
}: CreateSnapTransactionParams): Promise<SnapTransactionResult> {
  const serverKey = getMidtransServerKey();
  if (!serverKey) {
    throw new Error("Midtrans server key is not configured for this environment");
  }

  const body: Record<string, unknown> = {
    transaction_details: {
      order_id: orderId,
      gross_amount: grossAmountIdr,
    },
    item_details: items,
    customer_details: customer ?? {},
  };
  if (enabledPayments && enabledPayments.length > 0) {
    body.enabled_payments = enabledPayments;
  }
  if (notificationUrl) {
    body.notification_url = notificationUrl;
  }

  const res = await fetch(`${getMidtransBaseUrl()}/snap/v1/transactions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Basic ${Buffer.from(`${serverKey}:`).toString("base64")}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Midtrans Snap error ${res.status}: ${detail.slice(0, 300)}`);
  }
  return (await res.json()) as SnapTransactionResult;
}

/**
 * Verify a Midtrans notification. The signature is
 * sha512(order_id + status_code + gross_amount + server_key) hex.
 */
export function verifyMidtransSignature(input: {
  orderId: string;
  statusCode: string;
  grossAmount: string;
  signatureKey: string;
}): boolean {
  const serverKey = getMidtransServerKey();
  if (!serverKey || !input.signatureKey) return false;
  const expected = crypto
    .createHash("sha512")
    .update(`${input.orderId}${input.statusCode}${input.grossAmount}${serverKey}`)
    .digest("hex");
  return expected === input.signatureKey;
}
