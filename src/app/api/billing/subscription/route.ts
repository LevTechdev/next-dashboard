import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { requirePermission, requireAuth } from "@/lib/api-guard";
import { getStripe, stripeConfigured } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { response } = await requirePermission("read", "billing", req);
  if (response) return response;

  const { session } = await requireAuth(req);

  // Try to find subscription by mock user ID, fall back to first admin subscription
  let subscription = await prisma.subscription.findUnique({
    where: { userId: session.user.id },
    include: { plan: true },
  });

  if (!subscription) {
    subscription = await prisma.subscription.findFirst({
      where: { user: { role: "ADMIN" } },
      include: { plan: true },
    });
  }

  return NextResponse.json({ subscription });
}

export async function POST(req: Request) {
  const { response: permResponse } = await requirePermission("create", "billing", req);
  if (permResponse) return permResponse;

  const body = await req.json();
  const { planId } = body;

  if (!planId) {
    return NextResponse.json({ error: "Plan ID is required" }, { status: 400 });
  }

  const plan = await prisma.plan.findUnique({ where: { id: planId } });
  if (!plan) {
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  }

  // Plan gating: paid plans require Stripe Checkout (/api/billing/checkout).
  // Only the Free plan (price 0) can be switched directly.
  if (plan.price > 0) {
    return NextResponse.json({ error: "Paid plans require Stripe checkout" }, { status: 400 });
  }

  // Resolve real admin user ID for DB relations
  const adminUser = await prisma.user.findFirst({
    where: { role: "ADMIN" },
    orderBy: { createdAt: "asc" },
    select: { id: true, tenantId: true },
  });

  if (!adminUser) {
    return NextResponse.json({ error: "No admin user found" }, { status: 500 });
  }

  const userId = adminUser.id;
  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  // Upsert subscription
  const subscription = await prisma.subscription.upsert({
    where: { userId },
    update: {
      planId,
      status: "ACTIVE",
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: false,
    },
    create: {
      userId,
      planId,
      status: "ACTIVE",
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
    },
    include: { plan: true },
  });

  // Create invoice for the new subscription period
  await prisma.invoice.create({
    data: {
      invoiceNumber: `INV-${Date.now()}`,
      planId: plan.id,
      userId,
      subscriptionId: subscription.id,
      amount: plan.price,
      currency: "USD",
      status: "PENDING",
      description: `${plan.name} Plan - ${now.toLocaleString("default", { month: "long", year: "numeric" })}`,
      periodStart: now,
      periodEnd,
    },
  });

  await prisma.auditLog.create({
    data: {
      action: "UPDATE_SUBSCRIPTION",
      entity: "Subscription",
      entityId: subscription.id,
      details: `Changed subscription to ${plan.name} plan`,
      tenantId: adminUser.tenantId,
    },
  });

  return NextResponse.json(subscription);
}

export async function PUT(req: Request) {
  const { response: permResponse } = await requirePermission("update", "billing", req);
  if (permResponse) return permResponse;

  const body = await req.json();
  const { action } = body;

  // Resolve real admin user ID for DB relations
  const adminUser = await prisma.user.findFirst({
    where: { role: "ADMIN" },
    orderBy: { createdAt: "asc" },
    select: { id: true, tenantId: true },
  });

  if (!adminUser) {
    return NextResponse.json({ error: "No admin user found" }, { status: 500 });
  }

  const userId = adminUser.id;

  const subscription = await prisma.subscription.findUnique({
    where: { userId },
    include: { plan: true },
  });

  if (!subscription) {
    return NextResponse.json({ error: "No active subscription" }, { status: 404 });
  }

  if (action === "cancel") {
    // When the subscription is backed by Stripe, cancel at period end there too
    // so the customer stops being billed. Free plans are local-only.
    if (subscription.stripeSubscriptionId && stripeConfigured()) {
      await getStripe().subscriptions.update(subscription.stripeSubscriptionId, {
        cancel_at_period_end: true,
      });
    }

    const updated = await prisma.subscription.update({
      where: { userId },
      data: { cancelAtPeriodEnd: true },
      include: { plan: true },
    });

    await prisma.auditLog.create({
      data: {
        action: "CANCEL_SUBSCRIPTION",
        entity: "Subscription",
        entityId: subscription.id,
        details: `Scheduled cancellation of ${subscription.plan.name} plan at period end`,
        tenantId: adminUser.tenantId,
      },
    });

    return NextResponse.json(updated);
  }

  if (action === "reactivate") {
    if (subscription.stripeSubscriptionId && stripeConfigured()) {
      await getStripe().subscriptions.update(subscription.stripeSubscriptionId, {
        cancel_at_period_end: false,
      });
    }

    const updated = await prisma.subscription.update({
      where: { userId },
      data: { cancelAtPeriodEnd: false },
      include: { plan: true },
    });

    return NextResponse.json(updated);
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
