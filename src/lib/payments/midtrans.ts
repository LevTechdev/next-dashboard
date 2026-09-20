// midtrans-client ships no type declarations and there is no @types package for
// it, so the default import is untyped on purpose (TS7016). @ts-expect-error
// rather than @ts-ignore: the day the package grows types, this line fails
// loudly instead of silently suppressing a real type error.
// @ts-expect-error -- untyped third-party package
import midtransClient from "midtrans-client";

export const snap = process.env.MIDTRANS_SERVER_KEY
  ? new midtransClient.Snap({
      isProduction: false,
      serverKey: process.env.MIDTRANS_SERVER_KEY,
      clientKey: process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY || "",
    })
  : null;

export async function createMidtransTransaction(
  orderId: string,
  amount: number,
  customerDetails: any,
) {
  if (!snap) {
    console.warn("Missing MIDTRANS_SERVER_KEY. Mocking transaction.");
    return { token: "mock_snap_token_123", redirect_url: "/dashboard/billing?status=success" };
  }

  const parameters = {
    transaction_details: { order_id: orderId, gross_amount: amount },
    customer_details: customerDetails,
  };

  const transaction = await snap.createTransaction(parameters);
  return transaction;
}
