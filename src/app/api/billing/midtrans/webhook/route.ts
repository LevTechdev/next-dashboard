import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { midtransConfigured, verifyMidtransSignature } from "@/lib/midtrans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface MidtransNotification {
  order_id?: string;
  status_code?: string;
  gross_amount?: string;
  signature_key?: string;
  transaction_status?: string;
  payment_type?: string;
  fraud_status?: string;
  transaction_time?: string;
}

/**
 * Midtrans notification webhook. Verifies the signature
 * (sha512(order_id + status_code + gross_amount + server_key)), then syncs the
 * local Subscription/Invoice rows:
 * - settlement / capture → activate the pending plan, create a PAID invoice.
 * - deny / cancel / expire → mark the pending checkout INCOMPLETE.
 * Anything else (pending, authorize, refund, ...) is acknowledged.
 *
 * The checkout route stashes the intended plan + Midtrans order id on the
 * user's subscription (status PENDING), so the webhook only flips states.
 */
export async function POST(req: Request) {
  if (!midtransConfigured()) {
    return NextResponse.json({ error: "Midtrans is not configured" }, { status: 503 });
  }

  const body = (await req.json().catch(() => ({}))) as MidtransNotification;
  const { order_id: orderId, status_code: statusCode, gross_amount: grossAmount } = body;

  if (!orderId || !statusCode || !grossAmount || !body.signature_key) {
    return NextResponse.json({ error: "Incomplete notification payload" }, { status: 400 });
  }

  const valid = verifyMidtransSignature({
    orderId,
    statusCode,
    grossAmount,
    signatureKey: body.signature_key,
  });
  if (!valid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const subscription = await prisma.subscription.findFirst({
    where: { midtransOrderId: orderId },
    include: { plan: true },
  });
  // Unknown order (not ours / already cleared) — acknowledge to stop retries.
  if (!subscription) {
    return NextResponse.json({ received: true });
  }

  const status = body.transaction_status;

  if (status === "settlement" || status === "capture") {
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    const updated = await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: "ACTIVE",
        gateway: "midtrans",
        cancelAtPeriodEnd: false,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
      },
    });

    // Midtrans retries notifications; don't double-create invoices.
    const existingPaid = await prisma.invoice.findFirst({
      where: { subscriptionId: subscription.id, status: "PAID" },
    });
    if (!existingPaid) {
      const amount = Number(grossAmount) || 0;
      await prisma.invoice.create({
        data: {
          invoiceNumber: `INV-${Date.now()}`,
          planId: subscription.planId,
          userId: subscription.userId,
          subscriptionId: subscription.id,
          amount,
          currency: "IDR",
          status: "PAID",
          description: `${subscription.plan?.name ?? "Plan"} - Midtrans ${status}`,
          periodStart: now,
          periodEnd,
          paidAt: now,
          paymentMethod: body.payment_type ?? "midtrans",
        },
      });
    }

    await prisma.auditLog.create({
      data: {
        action: "UPDATE_SUBSCRIPTION",
        entity: "Subscription",
        entityId: subscription.id,
        details: `Payment settled via Midtrans (${body.payment_type ?? "unknown"}): ${subscription.plan?.name ?? "Plan"} plan`,
        userId: subscription.userId,
      },
    });

    return NextResponse.json({ received: true, status: updated.status });
  }

  if (status === "deny" || status === "cancel" || status === "expire") {
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: { status: "INCOMPLETE", midtransOrderId: null },
    });
    await prisma.auditLog.create({
      data: {
        action: "UPDATE_SUBSCRIPTION",
        entity: "Subscription",
        entityId: subscription.id,
        details: `Midtrans payment ${status}: ${subscription.plan?.name ?? "Plan"} plan checkout not completed`,
        userId: subscription.userId,
      },
    });
    return NextResponse.json({ received: true, status: "INCOMPLETE" });
  }

  // pending / authorize / refund / other → acknowledged without local changes.
  return NextResponse.json({ received: true });
}
