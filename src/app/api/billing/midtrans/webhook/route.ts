import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { buildInvoiceSnapshot } from "@/lib/invoice-snapshot";
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

  const status = body.transaction_status;

  // Order no longer on a subscription row — either not ours, or the pending
  // checkout was abandoned (the row's midtransOrderId was cleared). The
  // INV-<orderId> ledger invoice created at checkout still knows what the
  // order was for, so a VA/QRIS payment that settles after the popup closed
  // is reconciled instead of being orphaned. Acknowledge otherwise.
  const ledger = await prisma.invoice.findFirst({
    where: { invoiceNumber: `INV-${orderId}` },
    include: { plan: true },
  });
  if (!subscription) {
    if (ledger && ledger.userId && ledger.planId && ledger.status !== "PAID") {
      if (status === "settlement" || status === "capture") {
        const now = new Date();
        const periodEnd = new Date(now);
        periodEnd.setMonth(periodEnd.getMonth() + 1);

        await prisma.subscription.upsert({
          where: { userId: ledger.userId },
          update: {
            planId: ledger.planId,
            status: "ACTIVE",
            gateway: "midtrans",
            midtransOrderId: orderId,
            cancelAtPeriodEnd: false,
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
          },
          create: {
            userId: ledger.userId,
            planId: ledger.planId,
            status: "ACTIVE",
            gateway: "midtrans",
            midtransOrderId: orderId,
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
          },
        });

        await prisma.invoice.update({
          where: { id: ledger.id },
          data: {
            status: "PAID",
            paidAt: now,
            paymentMethod: body.payment_type ?? "midtrans",
            amount: Number(grossAmount) || ledger.amount,
          },
        });

        // Late-settled checkout: the checkout route already wrote a snapshot
        // with the planned amount. Re-freeze it so the PDF renders the amount
        // actually paid (Midtrans may round/fee-adjust gross_amount).
        const { buildInvoiceSnapshot } = await import("@/lib/invoice-snapshot");
        await prisma.invoice.update({
          where: { id: ledger.id },
          data: {
            snapshotJson: buildInvoiceSnapshot({
              plan: ledger.plan,
              amount: Number(grossAmount) || ledger.amount,
              currency: ledger.currency || "IDR",
              description: ledger.description,
              periodStart: ledger.periodStart,
              periodEnd: ledger.periodEnd,
            }),
          },
        });

        await prisma.auditLog.create({
          data: {
            action: "RECONCILE_LATE_MIDTRANS_PAYMENT",
            entity: "Subscription",
            entityId: ledger.id,
            details: `Late settlement of abandoned Midtrans order ${orderId} reconciled to plan ${ledger.planId}`,
            userId: ledger.userId,
          },
        });

        return NextResponse.json({ received: true, reconciled: true, status: "ACTIVE" });
      }

      if (status === "deny" || status === "cancel" || status === "expire") {
        // Abandoned checkout finally expired — close out the ledger line.
        await prisma.invoice.update({
          where: { id: ledger.id },
          data: { status: "CANCELLED" },
        });
        return NextResponse.json({ received: true, ledger: "cancelled" });
      }
    }
    return NextResponse.json({ received: true });
  }

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
          snapshotJson: buildInvoiceSnapshot({
            plan: subscription.plan ?? null,
            amount,
            currency: "IDR",
            description: `${subscription.plan?.name ?? "Plan"} - Midtrans ${status}`,
            periodStart: now,
            periodEnd,
          }),
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
