import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, requirePermission } from "@/lib/api-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Clean up a Midtrans checkout the user abandoned by closing the embedded Snap
 * popup. The checkout route stashes the intended plan on the user's
 * subscription row (status PENDING, gateway midtrans). If payment never
 * settles, that row would otherwise sit PENDING until Midtrans expires the
 * transaction — blocking the UI from showing the user's real plan.
 *
 * On abandon the row is reverted to what the user is actually entitled to:
 * - the most recent plan with a PAID invoice (upgrade/downgrade of an active
 *   paid subscription), or
 * - the Free plan when nothing has ever been paid (a fresh checkout).
 *
 * The order id is cleared so a later `expire`/`deny` webhook for the abandoned
 * transaction can't clobber the restored row. Because Snap tokens can't be
 * cancelled server-side, a VA/QRIS payment completed *after* the popup was
 * closed would still settle — the checkout/abandon flow assumes abandonment
 * means the payer walked away (see the webhook, which only activates pending
 * rows that still reference the order id).
 *
 * Idempotent: returns ok:false without changes when the subscription is no
 * longer the pending checkout for `orderId` (already settled, re-checked-out,
 * or cleaned up).
 */
export async function POST(req: Request) {
  const { response: permResponse } = await requirePermission("update", "billing", req);
  if (permResponse) return permResponse;

  const { session, response } = await requireAuth(req);
  if (response) return response;

  const { orderId } = await req.json().catch(() => ({}));
  if (!orderId || typeof orderId !== "string") {
    return NextResponse.json({ error: "Order ID is required" }, { status: 400 });
  }

  const subscription = await prisma.subscription.findUnique({
    where: { userId: session.user.id },
    include: { plan: true },
  });

  const isPendingCheckout =
    subscription &&
    subscription.gateway === "midtrans" &&
    subscription.status === "PENDING" &&
    subscription.midtransOrderId === orderId;

  if (!isPendingCheckout) {
    return NextResponse.json({ ok: false, reason: "no_pending_checkout" });
  }

  const lastPaid = await prisma.invoice.findFirst({
    where: { userId: session.user.id, status: "PAID" },
    orderBy: { paidAt: "desc" },
    select: { planId: true },
  });

  let restored: { id: string; planId: string } | null = null;

  if (lastPaid?.planId) {
    // Upgrade/downgrade of a paid plan → back to the last plan actually paid.
    restored = await prisma.subscription.update({
      where: { userId: session.user.id },
      data: {
        planId: lastPaid.planId,
        status: "ACTIVE",
        midtransOrderId: null,
        cancelAtPeriodEnd: false,
      },
    });
  } else {
    // Nothing paid yet → back to the Free plan (drop the row if none exists).
    const freePlan = await prisma.plan.findFirst({
      where: { price: 0 },
      orderBy: { sortOrder: "asc" },
    });
    if (freePlan) {
      restored = await prisma.subscription.update({
        where: { userId: session.user.id },
        data: {
          planId: freePlan.id,
          status: "ACTIVE",
          midtransOrderId: null,
          cancelAtPeriodEnd: false,
        },
      });
    } else {
      await prisma.subscription.delete({ where: { userId: session.user.id } });
    }
  }

  await prisma.auditLog.create({
    data: {
      action: "CANCEL_PENDING_CHECKOUT",
      entity: "Subscription",
      entityId: subscription.id,
      details: `Midtrans checkout ${orderId} abandoned in the Snap popup; reverted to ${
        restored ? restored.planId : "no plan"
      }`,
      userId: session.user.id,
    },
  });

  return NextResponse.json({ ok: true, subscription: restored });
}
