import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { prisma } from "@/lib/db";
import { getStripe, stripeConfigured } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stripeStatus = (status: string): string => {
  switch (status) {
    case "active":
      return "ACTIVE";
    case "past_due":
      return "PAST_DUE";
    case "trialing":
      return "TRIALING";
    case "canceled":
    case "incomplete_expired":
      return "CANCELED";
    default:
      return "INCOMPLETE";
  }
};

const customerIdOf = (
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null,
): string | null => {
  if (!customer) return null;
  return typeof customer === "string" ? customer : customer.id;
};

const subscriptionIdOf = (sub: string | Stripe.Subscription | null): string | null => {
  if (!sub) return null;
  return typeof sub === "string" ? sub : sub.id;
};

/**
 * Stripe webhook receiver. Verifies the signature against STRIPE_WEBHOOK_SECRET,
 * then keeps the local Subscription/Invoice rows in sync:
 * - checkout.session.completed  → activate the workspace plan, store the Stripe
 *   customer + subscription ids, and create a PAID invoice.
 * - customer.subscription.updated/deleted → sync status + billing period.
 */
export async function POST(req: Request) {
  const payload = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }
  if (!stripeConfigured()) {
    return NextResponse.json({ error: "Stripe is not configured" }, { status: 503 });
  }
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "STRIPE_WEBHOOK_SECRET is not configured" }, { status: 503 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(payload, signature, secret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const checkout = event.data.object as Stripe.Checkout.Session;
      const userId = checkout.metadata?.userId;
      const planId = checkout.metadata?.planId;
      const tenantId = checkout.metadata?.tenantId ?? null;

      if (!userId || !planId) {
        return NextResponse.json({ received: true });
      }

      const plan = await prisma.plan.findUnique({ where: { id: planId } });
      if (!plan) {
        return NextResponse.json({ received: true });
      }

      const now = new Date();
      const periodEnd = new Date(now);
      periodEnd.setMonth(periodEnd.getMonth() + 1);

      const subscription = await prisma.subscription.upsert({
        where: { userId },
        update: {
          planId: plan.id,
          status: "ACTIVE",
          cancelAtPeriodEnd: false,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          stripeCustomerId: customerIdOf(checkout.customer),
          stripeSubscriptionId: subscriptionIdOf(checkout.subscription),
        },
        create: {
          userId,
          planId: plan.id,
          status: "ACTIVE",
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          stripeCustomerId: customerIdOf(checkout.customer),
          stripeSubscriptionId: subscriptionIdOf(checkout.subscription),
        },
      });

      if (checkout.amount_total != null) {
        const paid = checkout.payment_status === "paid";
        await prisma.invoice.create({
          data: {
            invoiceNumber: `INV-${Date.now()}`,
            planId: plan.id,
            userId,
            subscriptionId: subscription.id,
            amount: checkout.amount_total / 100,
            currency: (checkout.currency || "usd").toUpperCase(),
            status: paid ? "PAID" : "PENDING",
            description: `${plan.name} Plan`,
            periodStart: now,
            periodEnd,
            paidAt: paid ? now : null,
          },
        });
      }

      await prisma.auditLog.create({
        data: {
          action: "UPDATE_SUBSCRIPTION",
          entity: "Subscription",
          entityId: subscription.id,
          details: `Checkout completed for ${plan.name} plan`,
          tenantId,
        },
      });
      break;
    }

    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const deleted = event.type === "customer.subscription.deleted";

      let local = await prisma.subscription.findFirst({
        where: { stripeSubscriptionId: sub.id },
      });
      if (!local && sub.metadata?.userId) {
        local = await prisma.subscription.findUnique({
          where: { userId: sub.metadata.userId },
        });
      }
      if (!local) {
        return NextResponse.json({ received: true });
      }

      // Stripe v22 removed the top-level period fields from the Subscription
      // object — they live on the subscription's line items instead.
      const firstItem = sub.items.data[0];
      const periodStart = firstItem?.current_period_start
        ? new Date(firstItem.current_period_start * 1000)
        : local.currentPeriodStart;
      const periodEnd = firstItem?.current_period_end
        ? new Date(firstItem.current_period_end * 1000)
        : local.currentPeriodEnd;

      await prisma.subscription.update({
        where: { id: local.id },
        data: {
          status: deleted ? "CANCELED" : stripeStatus(sub.status),
          cancelAtPeriodEnd: deleted ? false : sub.cancel_at_period_end,
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
          stripeSubscriptionId: sub.id,
        },
      });

      await prisma.auditLog.create({
        data: {
          action: deleted ? "CANCEL_SUBSCRIPTION" : "UPDATE_SUBSCRIPTION",
          entity: "Subscription",
          entityId: local.id,
          details: deleted
            ? "Subscription ended via Stripe"
            : `Subscription synced from Stripe (${stripeStatus(sub.status)})`,
          tenantId: sub.metadata?.tenantId ?? null,
        },
      });
      break;
    }

    default:
      // Acknowledge anything else (payment_intent.*, invoice.*, etc.)
      break;
  }

  return NextResponse.json({ received: true });
}
