import Stripe from "stripe";

export const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" as any })
  : null;

export async function createStripeCheckoutSession(
  planId: string,
  customerId: string,
  returnUrl: string,
) {
  if (!stripe) {
    console.warn("Missing STRIPE_SECRET_KEY. Mocking checkout session.");
    return `${returnUrl}?session_id=mock_stripe_123&status=success`;
  }

  // Real implementation
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    mode: "subscription",
    line_items: [{ price: planId, quantity: 1 }],
    client_reference_id: customerId,
    success_url: `${returnUrl}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: returnUrl,
  });

  return session.url;
}

export async function createStripePortalSession(stripeCustomerId: string, returnUrl: string) {
  if (!stripe) {
    console.warn("Missing STRIPE_SECRET_KEY. Mocking portal session.");
    return returnUrl;
  }

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: returnUrl,
  });

  return portalSession.url;
}
