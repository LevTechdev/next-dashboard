import Stripe from "stripe";

let stripeClient: Stripe | null = null;

/**
 * True when a Stripe secret key is configured. Billing routes use this to
 * degrade gracefully (503) instead of throwing in environments without Stripe.
 */
export function stripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

/**
 * Lazily-initialized Stripe client. Throws when STRIPE_SECRET_KEY is missing —
 * call stripeConfigured() first.
 */
export function getStripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }
  if (!stripeClient) {
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return stripeClient;
}
