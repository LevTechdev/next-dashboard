import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, requirePermission } from "@/lib/api-guard";
import { getStripe, stripeConfigured } from "@/lib/stripe";
import {
  createSnapTransaction,
  midtransConfigured,
  MIDTRANS_CHANNELS,
  MIDTRANS_USD_RATE,
  type MidtransChannel,
} from "@/lib/midtrans";
import { getTenantId } from "@/lib/tenancy";

export const dynamic = "force-dynamic";

const VALID_GATEWAYS = new Set(["stripe", "midtrans"]);

/**
 * Create a hosted checkout session for a paid plan. The Free plan never hits
 * this route — it is switched directly via POST /api/billing/subscription.
 * Returns { url } pointing at the provider's hosted checkout page.
 *
 * gateway=stripe (default) → Stripe Checkout (card).
 * gateway=midtrans → Midtrans Snap (local payments: DANA, GoPay, QRIS, VA,
 * card); an optional channel restricts Snap to one of those methods.
 */
export async function POST(req: Request) {
  const { response: permResponse } = await requirePermission("create", "billing", req);
  if (permResponse) return permResponse;

  const { session, response } = await requireAuth(req);
  if (response) return response;

  const { planId, locale, gateway = "stripe", channel } = await req.json().catch(() => ({}));
  if (!planId) {
    return NextResponse.json({ error: "Plan ID is required" }, { status: 400 });
  }
  if (!VALID_GATEWAYS.has(gateway)) {
    return NextResponse.json({ error: "Unsupported payment gateway" }, { status: 400 });
  }
  if (channel && !(MIDTRANS_CHANNELS as readonly string[]).includes(channel)) {
    return NextResponse.json({ error: "Unsupported payment channel" }, { status: 400 });
  }

  const plan = await prisma.plan.findUnique({ where: { id: planId } });
  if (!plan) {
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  }
  if (plan.price <= 0) {
    return NextResponse.json({ error: "The free plan does not require checkout" }, { status: 400 });
  }

  // ── Midtrans (local) checkout ──────────────────────────────────────────
  if (gateway === "midtrans") {
    if (!midtransConfigured()) {
      return NextResponse.json(
        { error: "Midtrans is not configured on this server" },
        { status: 503 },
      );
    }

    const orderId = `MT-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const grossAmountIdr = Math.round(plan.price * MIDTRANS_USD_RATE);
    const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
    const notificationUrl = `${origin}/api/billing/midtrans/webhook`;

    const snap = await createSnapTransaction({
      orderId,
      grossAmountIdr,
      items: [
        {
          id: plan.id,
          name: `${plan.name} Plan (monthly)`,
          price: grossAmountIdr,
          quantity: 1,
        },
      ],
      customer: { firstName: session.user.name, email: session.user.email },
      enabledPayments: channel ? ([channel] as MidtransChannel[]) : undefined,
      notificationUrl,
    });

    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    // Stash the pending transaction on the subscription so the webhook can
    // resolve it; the plan activates (status ACTIVE) once Midtrans settles.
    await prisma.subscription.upsert({
      where: { userId: session.user.id },
      update: {
        planId: plan.id,
        status: "PENDING",
        gateway: "midtrans",
        midtransOrderId: orderId,
        cancelAtPeriodEnd: false,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
      },
      create: {
        userId: session.user.id,
        planId: plan.id,
        status: "PENDING",
        gateway: "midtrans",
        midtransOrderId: orderId,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
      },
    });

    return NextResponse.json({ url: snap.redirect_url, orderId, gateway: "midtrans" });
  }

  // ── Stripe checkout (default) ──────────────────────────────────────────
  if (!stripeConfigured()) {
    return NextResponse.json({ error: "Stripe is not configured on this server" }, { status: 503 });
  }
  if (!plan.stripePriceId) {
    return NextResponse.json(
      { error: "This plan has no Stripe price configured" },
      { status: 503 },
    );
  }

  const tenantId = getTenantId(session);
  const stripe = getStripe();

  // Reuse the workspace's Stripe customer when one exists, otherwise create it.
  const existing = await prisma.subscription.findUnique({
    where: { userId: session.user.id },
    select: { stripeCustomerId: true },
  });
  let customerId = existing?.stripeCustomerId ?? null;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: session.user.email,
      name: session.user.name,
      metadata: { userId: session.user.id, tenantId: tenantId ?? "" },
    });
    customerId = customer.id;
  } else {
    // Refresh the stored customer id in case the row predates it.
    await prisma.subscription.update({
      where: { userId: session.user.id },
      data: { stripeCustomerId: customerId },
    });
  }

  const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
  const lang = locale && /^[a-z]{2}$/.test(locale) ? locale : "en";

  const checkout = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: plan.stripePriceId, quantity: 1 }],
    // metadata rides on the session AND the subscription object so both
    // checkout.session.completed and customer.subscription.* webhooks can
    // resolve the local workspace.
    metadata: { userId: session.user.id, planId: plan.id, tenantId: tenantId ?? "" },
    subscription_data: {
      metadata: { userId: session.user.id, planId: plan.id, tenantId: tenantId ?? "" },
    },
    success_url: `${origin}/${lang}/checkout/success`,
    cancel_url: `${origin}/${lang}/billing?checkout=cancelled`,
  });

  return NextResponse.json({ url: checkout.url });
}
