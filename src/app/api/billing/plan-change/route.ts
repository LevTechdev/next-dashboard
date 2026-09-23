import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, requirePermission } from "@/lib/api-guard";
import { getStripe, stripeConfigured } from "@/lib/stripe";
import { buildInvoiceSnapshot } from "@/lib/invoice-snapshot";
import { getTenantId } from "@/lib/tenancy";
import {
  nextPeriodEndFrom,
  previewPlanChange,
  type BillingInterval,
  type ProrationPlan,
} from "@/lib/plan-change";

export const dynamic = "force-dynamic";

/**
 * Self-serve plan changes — the pricing page's upgrade / downgrade / period
 * switch, with proration.
 *
 * Distinct from /api/billing/checkout (a NEW subscription through the gateway)
 * and from /api/billing/subscription (the free-plan switch): this endpoint is
 * what an ALREADY-subscribed workspace uses to move between plans or between
 * monthly and yearly billing.
 *
 *   GET  ?planId=&billingInterval=   → proration preview for the confirm dialog
 *   POST { planId, billingInterval, confirm: true } → apply
 *
 * The change always acts on the SESSION's workspace. (The older subscription
 * route resolves the first admin in the database — fine for a single-tenant
 * demo, wrong for self-serve; spreading that pattern is how one workspace ends
 * up changing another's plan.)
 *
 * Money: the pure engine in src/lib/plan-change.ts owns the arithmetic. When
 * the workspace is Stripe-backed the price swap is sent to Stripe with
 * `proration_behavior: "create_prorations"` so the gateway raises the real
 * proration invoice by its own rules; the local row then mirrors the change.
 * Otherwise (dev / no gateway subscription) the switch is local and only a
 * net-positive amount is recorded as a PENDING invoice — nothing is captured
 * here.
 */
const INTERVALS = ["MONTHLY", "YEARLY"] as const;

function parseInterval(raw: unknown, fallback: BillingInterval): BillingInterval {
  return raw === "MONTHLY" || raw === "YEARLY" ? raw : fallback;
}

/** Narrow a Prisma plan to the engine's shape. */
function toProrationPlan(plan: {
  id: string;
  name: string;
  price: number;
  yearlyPrice: number | null;
  sortOrder: number;
}): ProrationPlan {
  return {
    id: plan.id,
    name: plan.name,
    price: plan.price,
    yearlyPrice: plan.yearlyPrice,
    sortOrder: plan.sortOrder,
  };
}

export async function GET(req: Request) {
  const { session, response } = await requireAuth(req);
  if (response) return response;

  const url = new URL(req.url);
  const planId = url.searchParams.get("planId");
  if (!planId) {
    return NextResponse.json({ error: "planId is required" }, { status: 400 });
  }

  const subscription = await prisma.subscription.findUnique({
    where: { userId: session.user.id },
    include: { plan: true },
  });
  if (!subscription) {
    return NextResponse.json({ error: "No subscription to change" }, { status: 404 });
  }

  const nextPlan = await prisma.plan.findUnique({ where: { id: planId } });
  if (!nextPlan) {
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  }

  const nextInterval = parseInterval(
    url.searchParams.get("billingInterval"),
    subscription.billingInterval as BillingInterval,
  );

  const preview = previewPlanChange({
    currentPlan: toProrationPlan(subscription.plan),
    nextPlan: toProrationPlan(nextPlan),
    currentInterval: subscription.billingInterval as BillingInterval,
    nextInterval,
    periodStart: subscription.currentPeriodStart,
    periodEnd: subscription.currentPeriodEnd,
    now: new Date(),
  });

  return NextResponse.json({
    preview,
    current: {
      planId: subscription.planId,
      planName: subscription.plan.name,
      billingInterval: subscription.billingInterval,
      status: subscription.status,
      currentPeriodEnd: subscription.currentPeriodEnd,
    },
    next: { planId: nextPlan.id, planName: nextPlan.name, billingInterval: nextInterval },
  });
}

export async function POST(req: Request) {
  const { response: permResponse } = await requirePermission("update", "billing", req);
  if (permResponse) return permResponse;

  const { session, response } = await requireAuth(req);
  if (response) return response;

  const body = await req.json().catch(() => ({}));
  const { planId, billingInterval, confirm } = body as {
    planId?: string;
    billingInterval?: string;
    confirm?: boolean;
  };

  if (!planId) {
    return NextResponse.json({ error: "planId is required" }, { status: 400 });
  }
  if (!confirm) {
    // The dialog must show the proration it is agreeing to; a silent switch is
    // exactly what the confirmation step exists to prevent.
    return NextResponse.json({ error: "Confirmation is required" }, { status: 400 });
  }

  const userId = session.user.id;
  const subscription = await prisma.subscription.findUnique({
    where: { userId },
    include: { plan: true },
  });
  if (!subscription) {
    return NextResponse.json({ error: "No subscription to change" }, { status: 404 });
  }

  const nextPlan = await prisma.plan.findUnique({ where: { id: planId } });
  if (!nextPlan) {
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  }

  const nextInterval = parseInterval(
    billingInterval,
    subscription.billingInterval as BillingInterval,
  );
  if (nextPlan.id === subscription.planId && nextInterval === subscription.billingInterval) {
    return NextResponse.json({ error: "Already on this plan" }, { status: 400 });
  }

  const now = new Date();
  const preview = previewPlanChange({
    currentPlan: toProrationPlan(subscription.plan),
    nextPlan: toProrationPlan(nextPlan),
    currentInterval: subscription.billingInterval as BillingInterval,
    nextInterval,
    periodStart: subscription.currentPeriodStart,
    periodEnd: subscription.currentPeriodEnd,
    now,
  });

  const tenantId = getTenantId(session);

  // ── Gateway-backed subscriptions: swap the price and let Stripe prorate ──
  let gateway: "stripe" | "local" = "local";
  if (subscription.stripeSubscriptionId && stripeConfigured()) {
    const priceId =
      nextInterval === "YEARLY" ? nextPlan.stripeYearlyPriceId : nextPlan.stripePriceId;
    if (!priceId) {
      return NextResponse.json(
        {
          error: "This plan has no Stripe price configured for the selected billing period",
        },
        { status: 503 },
      );
    }

    const stripe = getStripe();
    const stripeSubscription = await stripe.subscriptions.retrieve(
      subscription.stripeSubscriptionId,
    );
    const itemId = stripeSubscription.items.data[0]?.id;
    if (!itemId) {
      return NextResponse.json(
        { error: "Stripe subscription has no items to change" },
        { status: 502 },
      );
    }

    await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
      items: [{ id: itemId, price: priceId }],
      // Let Stripe compute the credit for unused time and invoice the
      // difference — the engine above only PREDICTS it for the dialog.
      proration_behavior: "create_prorations",
      metadata: {
        planId: nextPlan.id,
        billingInterval: nextInterval,
        tenantId: tenantId ?? "",
      },
    });
    gateway = "stripe";
  }

  // ── Local mirror: always the source of truth for tier resolution ──────────
  const nextPeriodEnd = nextPeriodEndFrom(now, nextInterval);
  const updated = await prisma.subscription.update({
    where: { userId },
    data: {
      planId: nextPlan.id,
      billingInterval: nextInterval,
      status: "ACTIVE",
      currentPeriodStart: now,
      currentPeriodEnd: nextPeriodEnd,
      cancelAtPeriodEnd: false,
    },
    include: { plan: true },
  });

  // A net-positive amount on a locally-billed workspace is recorded, never
  // captured: the gateway owns collection. Negative nets are credit notes and
  // produce no invoice row at all.
  let invoiceId: string | null = null;
  if (gateway === "local" && preview.dueToday > 0) {
    const description = `Plan change to ${nextPlan.name} (${nextInterval === "YEARLY" ? "yearly" : "monthly"}) — prorated`;
    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber: `INV-PC-${Date.now()}`,
        planId: nextPlan.id,
        userId,
        subscriptionId: updated.id,
        amount: preview.dueToday,
        currency: "USD",
        status: "PENDING",
        description,
        periodStart: now,
        periodEnd: nextPeriodEnd,
        snapshotJson: buildInvoiceSnapshot({
          plan: nextPlan,
          amount: preview.dueToday,
          currency: "USD",
          description,
          periodStart: now,
          periodEnd: nextPeriodEnd,
        }),
      },
    });
    invoiceId = invoice.id;
  }

  await prisma.auditLog.create({
    data: {
      action: "UPDATE_SUBSCRIPTION",
      entity: "Subscription",
      entityId: updated.id,
      details:
        `Changed subscription from ${subscription.plan.name}/${subscription.billingInterval}` +
        ` to ${nextPlan.name}/${nextInterval} (${preview.kind})` +
        ` — credit $${preview.credit.toFixed(2)}, charge $${preview.charge.toFixed(2)},` +
        ` due today $${preview.dueToday.toFixed(2)} via ${gateway}`,
      tenantId,
    },
  });

  return NextResponse.json({
    ok: true,
    gateway,
    invoiceId,
    proration: preview,
    subscription: {
      planId: updated.planId,
      planName: updated.plan.name,
      billingInterval: updated.billingInterval,
      status: updated.status,
      currentPeriodEnd: updated.currentPeriodEnd,
    },
  });
}
