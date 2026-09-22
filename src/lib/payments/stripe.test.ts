import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * stripe.ts is env-gated at module scope: `stripe` is a real SDK client only
 * when STRIPE_SECRET_KEY is set. Each test resets the module registry and
 * imports fresh so the module-level ternary re-evaluates under that test's
 * env — no network is ever touched (the "real" path mocks the SDK itself).
 */

const ORIGINAL_KEY = process.env.STRIPE_SECRET_KEY;

afterEach(() => {
  if (ORIGINAL_KEY === undefined) delete process.env.STRIPE_SECRET_KEY;
  else process.env.STRIPE_SECRET_KEY = ORIGINAL_KEY;
  vi.doUnmock("stripe");
  vi.restoreAllMocks();
});

describe("stripe payments helper", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("exposes no client and returns the mock checkout URL without a secret key", async () => {
    delete process.env.STRIPE_SECRET_KEY;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const mod = await import("./stripe");

    expect(mod.stripe).toBeNull();
    const url = await mod.createStripeCheckoutSession(
      "plan_pro",
      "cus_1",
      "https://app.test/return",
    );
    expect(url).toBe("https://app.test/return?session_id=mock_stripe_123&status=success");
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("Mocking checkout session"));
  });

  it("returns the return URL unchanged for a mocked portal session", async () => {
    delete process.env.STRIPE_SECRET_KEY;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const mod = await import("./stripe");

    const url = await mod.createStripePortalSession("cus_1", "https://app.test/billing");
    expect(url).toBe("https://app.test/billing");
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("Mocking portal session"));
  });

  it("drives the real SDK client when a secret key is configured", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_coverage";
    const createCheckout = vi
      .fn()
      .mockResolvedValue({ url: "https://checkout.stripe.com/session_abc" });
    const createPortal = vi
      .fn()
      .mockResolvedValue({ url: "https://billing.stripe.com/portal_abc" });
    const ctorArgs: Array<unknown[]> = [];
    vi.doMock("stripe", () => {
      // A class, not an arrow function — `new Stripe(...)` needs a constructor.
      class Stripe {
        checkout = { sessions: { create: createCheckout } };
        billingPortal = { sessions: { create: createPortal } };
        constructor(...args: unknown[]) {
          ctorArgs.push(args);
        }
      }
      return { default: Stripe };
    });

    const mod = await import("./stripe");

    expect(mod.stripe).not.toBeNull();
    const checkoutUrl = await mod.createStripeCheckoutSession(
      "plan_pro",
      "cus_9",
      "https://app.test/return",
    );
    expect(checkoutUrl).toBe("https://checkout.stripe.com/session_abc");
    expect(createCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "subscription",
        line_items: [{ price: "plan_pro", quantity: 1 }],
        client_reference_id: "cus_9",
      }),
    );

    const portalUrl = await mod.createStripePortalSession("cus_9", "https://app.test/billing");
    expect(portalUrl).toBe("https://billing.stripe.com/portal_abc");
    expect(createPortal).toHaveBeenCalledWith({
      customer: "cus_9",
      return_url: "https://app.test/billing",
    });
    expect(ctorArgs[0]).toEqual([
      "sk_test_coverage",
      expect.objectContaining({ apiVersion: "2024-06-20" }),
    ]);
  });
});
