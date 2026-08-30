import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, requirePermission } from "@/lib/api-guard";
import { getStripe, stripeConfigured } from "@/lib/stripe";

export const dynamic = "force-dynamic";

/**
 * Create a Stripe Customer Portal session so the workspace can manage payment
 * methods, invoices, and the subscription directly in Stripe's hosted portal.
 * Returns { url }.
 */
export async function POST(req: Request) {
  const { response: permResponse } = await requirePermission("update", "billing", req);
  if (permResponse) return permResponse;

  const { session, response } = await requireAuth(req);
  if (response) return response;

  if (!stripeConfigured()) {
    return NextResponse.json({ error: "Stripe is not configured on this server" }, { status: 503 });
  }

  const subscription = await prisma.subscription.findUnique({
    where: { userId: session.user.id },
    select: { stripeCustomerId: true },
  });

  if (!subscription?.stripeCustomerId) {
    return NextResponse.json(
      { error: "No Stripe customer is linked to this account yet" },
      { status: 400 },
    );
  }

  const { locale } = await req.json().catch(() => ({}));
  const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
  const lang = locale && /^[a-z]{2}$/.test(locale) ? locale : "en";

  const portal = await getStripe().billingPortal.sessions.create({
    customer: subscription.stripeCustomerId,
    return_url: `${origin}/${lang}/billing`,
  });

  return NextResponse.json({ url: portal.url });
}
