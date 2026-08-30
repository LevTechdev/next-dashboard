import crypto from "crypto";

/**
 * Midtrans — local (Indonesia) payment gateway supporting DANA, GoPay, QRIS,
 * bank transfer (VA), and cards. Used for subscription checkout as an
 * alternative to Stripe; the hosted Snap flow returns a redirect_url that the
 * billing UI follows, and payment results arrive via the notification webhook
 * (see /api/billing/midtrans/webhook).
 *
 * Env:
 * - MIDTRANS_SERVER_KEY  — required; enables midtransConfigured()
 * - MIDTRANS_ENV         — "production" for the live endpoints, anything else
 *                          (default) uses the sandbox environment
 */

/** USD → IDR conversion for plan prices (plans are priced in USD, Midtrans settles IDR). */
export const MIDTRANS_USD_RATE = 15_800;

/** Snap payment channels surfaced in the billing UI. */
export const MIDTRANS_CHANNELS = ["dana", "gopay", "qris", "bank_transfer", "credit_card"] as const;

export type MidtransChannel = (typeof MIDTRANS_CHANNELS)[number];

export function midtransConfigured(): boolean {
  return Boolean(process.env.MIDTRANS_SERVER_KEY);
}

/** Sandbox by default; set MIDTRANS_ENV=production for live keys. */
export function midtransIsSandbox(): boolean {
  return process.env.MIDTRANS_ENV !== "production";
}

export function getMidtransBaseUrl(): string {
  return midtransIsSandbox() ? "https://app.sandbox.midtrans.com" : "https://app.midtrans.com";
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
 * Create a Midtrans Snap (hosted checkout) transaction. Uses Basic auth with
 * the server key; amounts are integers in IDR.
 */
export async function createSnapTransaction({
  orderId,
  grossAmountIdr,
  items,
  customer,
  enabledPayments,
  notificationUrl,
}: CreateSnapTransactionParams): Promise<SnapTransactionResult> {
  const serverKey = process.env.MIDTRANS_SERVER_KEY;
  if (!serverKey) {
    throw new Error("MIDTRANS_SERVER_KEY is not configured");
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
  const serverKey = process.env.MIDTRANS_SERVER_KEY;
  if (!serverKey || !input.signatureKey) return false;
  const expected = crypto
    .createHash("sha512")
    .update(`${input.orderId}${input.statusCode}${input.grossAmount}${serverKey}`)
    .digest("hex");
  return expected === input.signatureKey;
}
