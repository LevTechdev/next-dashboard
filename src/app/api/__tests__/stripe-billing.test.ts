import { describe, it, expect, vi, beforeEach } from "vitest";

// ═══════════════════════════════════════════════════════════════════════════
// Hoisted mocks
// ═══════════════════════════════════════════════════════════════════════════

const { mockStripe, mockGetStripe, mockStripeConfigured, mockPrisma, mockRequirePermission, mockRequireAuth, mockGetTenantId } =
  vi.hoisted(() => {
    const stripe = {
      customers: { create: vi.fn() },
      checkout: { sessions: { create: vi.fn() } },
      billingPortal: { sessions: { create: vi.fn() } },
      subscriptions: { update: vi.fn() },
      webhooks: { constructEvent: vi.fn() },
    };

    const model = <T extends Record<string, unknown>>(overrides: Partial<T> = {}) =>
      new Proxy<T>({} as T, {
        get(_, prop) {
          const key = String(prop);
          return (overrides as any)[key] ?? vi.fn().mockImplementation(() => Promise.resolve(null));
        },
      });

    const prisma = {
      plan: model({
        findUnique: vi.fn().mockResolvedValue({
          id: "plan-pro",
          name: "Pro",
          price: 29,
          stripePriceId: "price_pro",
        }),
      }),
      subscription: model({
        findUnique: vi.fn().mockResolvedValue(null),
        findFirst: vi.fn().mockResolvedValue(null),
        upsert: vi.fn().mockImplementation(({ create }) =>
          Promise.resolve({ id: "sub-new", ...(create as Record<string, unknown>) }),
        ),
        update: vi.fn().mockImplementation(({ data }) =>
          Promise.resolve({ id: "sub-1", ...(data as Record<string, unknown>) }),
        ),
      }),
      invoice: model({
        create: vi.fn().mockResolvedValue({ id: "inv-new" }),
      }),
      auditLog: model({
        create: vi.fn().mockResolvedValue({ id: "audit-new" }),
      }),
    };

    return {
      mockStripe: stripe,
      mockGetStripe: vi.fn(() => stripe),
      mockStripeConfigured: vi.fn(() => true),
      mockPrisma: prisma,
      mockRequirePermission: vi.fn().mockResolvedValue({ response: null, role: "ADMIN" }),
      mockRequireAuth: vi.fn().mockResolvedValue({
        session: {
          user: {
            id: "u-1",
            name: "Admin",
            email: "nextdashboards@gmail.com",
            role: "ADMIN",
          },
        },
        response: null,
      }),
      mockGetTenantId: vi.fn(() => "tenant-1"),
    };
  });

vi.mock("@/lib/api-guard", () => ({
  requirePermission: mockRequirePermission,
  requireAuth: mockRequireAuth,
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));

vi.mock("@/lib/stripe", () => ({
  getStripe: mockGetStripe,
  stripeConfigured: mockStripeConfigured,
}));

vi.mock("@/lib/tenancy", () => ({ getTenantId: mockGetTenantId }));

// ═══════════════════════════════════════════════════════════════════════════
// Imports under test
// ═══════════════════════════════════════════════════════════════════════════

import * as checkoutRoutes from "../billing/checkout/route";
import * as portalRoutes from "../billing/portal/route";
import * as webhookRoutes from "../billing/webhook/route";

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

function jsonRequest(body?: unknown): Request {
  return {
    json: () => Promise.resolve(body ?? {}),
    text: () => Promise.resolve(""),
    url: "http://localhost:3010/api/billing/x",
    headers: new Headers(),
  } as unknown as Request;
}

function webhookRequest(payload: unknown, signature = "sig_1"): Request {
  const headers = new Headers();
  if (signature) headers.set("stripe-signature", signature);
  return {
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(JSON.stringify(payload)),
    url: "http://localhost:3010/api/billing/webhook",
    headers,
  } as unknown as Request;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockStripeConfigured.mockReturnValue(true);
  mockRequirePermission.mockResolvedValue({ response: null, role: "ADMIN" });
  mockRequireAuth.mockResolvedValue({
    session: {
      user: { id: "u-1", name: "Admin", email: "nextdashboards@gmail.com", role: "ADMIN" },
    },
    response: null,
  });
  mockGetTenantId.mockReturnValue("tenant-1");
  mockPrisma.plan.findUnique.mockResolvedValue({
    id: "plan-pro",
    name: "Pro",
    price: 29,
    stripePriceId: "price_pro",
  });
  mockPrisma.subscription.findUnique.mockResolvedValue(null);
});

// ═══════════════════════════════════════════════════════════════════════════
// Checkout
// ═══════════════════════════════════════════════════════════════════════════

describe("Billing Checkout", () => {
  it("returns 403 when requirePermission denies", async () => {
    mockRequirePermission.mockResolvedValueOnce({ response: new Response("denied", { status: 403 }) });
    const res = await checkoutRoutes.POST(jsonRequest({ planId: "plan-pro" }));
    expect(res.status).toBe(403);
  });

  it("returns 400 when planId is missing", async () => {
    const res = await checkoutRoutes.POST(jsonRequest({}));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("Plan ID");
  });

  it("returns 404 when plan not found", async () => {
    mockPrisma.plan.findUnique.mockResolvedValueOnce(null);
    const res = await checkoutRoutes.POST(jsonRequest({ planId: "plan-x" }));
    expect(res.status).toBe(404);
  });

  it("returns 400 for the free plan (no checkout needed)", async () => {
    mockPrisma.plan.findUnique.mockResolvedValueOnce({ id: "plan-free", name: "Free", price: 0 });
    const res = await checkoutRoutes.POST(jsonRequest({ planId: "plan-free" }));
    expect(res.status).toBe(400);
  });

  it("returns 503 when Stripe is not configured", async () => {
    mockStripeConfigured.mockReturnValueOnce(false);
    const res = await checkoutRoutes.POST(jsonRequest({ planId: "plan-pro" }));
    expect(res.status).toBe(503);
  });

  it("returns 503 when the plan has no Stripe price", async () => {
    mockPrisma.plan.findUnique.mockResolvedValueOnce({
      id: "plan-pro",
      name: "Pro",
      price: 29,
      stripePriceId: null,
    });
    const res = await checkoutRoutes.POST(jsonRequest({ planId: "plan-pro" }));
    expect(res.status).toBe(503);
  });

  it("creates a Stripe customer and checkout session, returns url", async () => {
    mockStripe.customers.create.mockResolvedValueOnce({ id: "cus_123" });
    mockStripe.checkout.sessions.create.mockResolvedValueOnce({ url: "https://checkout.stripe.com/c/pay_x" });

    const res = await checkoutRoutes.POST(jsonRequest({ planId: "plan-pro", locale: "id" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.url).toBe("https://checkout.stripe.com/c/pay_x");

    expect(mockStripe.customers.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "nextdashboards@gmail.com",
        metadata: { userId: "u-1", tenantId: "tenant-1" },
      }),
    );
    expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "subscription",
        customer: "cus_123",
        line_items: [{ price: "price_pro", quantity: 1 }],
        metadata: { userId: "u-1", planId: "plan-pro", tenantId: "tenant-1" },
        success_url: expect.stringContaining("/id/billing?checkout=success"),
        cancel_url: expect.stringContaining("/id/billing?checkout=cancelled"),
      }),
    );
  });

  it("reuses an existing Stripe customer without creating a new one", async () => {
    mockPrisma.subscription.findUnique.mockResolvedValueOnce({ stripeCustomerId: "cus_existing" });
    mockStripe.checkout.sessions.create.mockResolvedValueOnce({ url: "https://checkout.stripe.com/c/pay_y" });

    const res = await checkoutRoutes.POST(jsonRequest({ planId: "plan-pro" }));
    expect(res.status).toBe(200);
    expect(mockStripe.customers.create).not.toHaveBeenCalled();
    expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({ customer: "cus_existing" }),
    );
    expect(mockPrisma.subscription.update).toHaveBeenCalledWith({
      where: { userId: "u-1" },
      data: { stripeCustomerId: "cus_existing" },
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Portal
// ═══════════════════════════════════════════════════════════════════════════

describe("Billing Portal", () => {
  it("returns 403 when requirePermission denies", async () => {
    mockRequirePermission.mockResolvedValueOnce({ response: new Response("denied", { status: 403 }) });
    const res = await portalRoutes.POST(jsonRequest({}));
    expect(res.status).toBe(403);
  });

  it("returns 503 when Stripe is not configured", async () => {
    mockStripeConfigured.mockReturnValueOnce(false);
    const res = await portalRoutes.POST(jsonRequest({}));
    expect(res.status).toBe(503);
  });

  it("returns 400 when no Stripe customer is linked", async () => {
    const res = await portalRoutes.POST(jsonRequest({}));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("Stripe customer");
  });

  it("creates a billing portal session and returns url", async () => {
    mockPrisma.subscription.findUnique.mockResolvedValueOnce({ stripeCustomerId: "cus_123" });
    mockStripe.billingPortal.sessions.create.mockResolvedValueOnce({
      url: "https://billing.stripe.com/p/session_x",
    });

    const res = await portalRoutes.POST(jsonRequest({ locale: "ja" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.url).toBe("https://billing.stripe.com/p/session_x");
    expect(mockStripe.billingPortal.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: "cus_123",
        return_url: expect.stringContaining("/ja/billing"),
      }),
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Webhook
// ═══════════════════════════════════════════════════════════════════════════

describe("Billing Webhook", () => {
  it("returns 400 when stripe-signature header is missing", async () => {
    const res = await webhookRoutes.POST(webhookRequest({}, ""));
    expect(res.status).toBe(400);
  });

  it("returns 503 when Stripe is not configured", async () => {
    mockStripeConfigured.mockReturnValueOnce(false);
    const res = await webhookRoutes.POST(webhookRequest({}, "sig_1"));
    expect(res.status).toBe(503);
  });

  it("returns 503 when webhook secret is missing", async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const res = await webhookRoutes.POST(webhookRequest({}, "sig_1"));
    expect(res.status).toBe(503);
  });

  it("returns 400 on invalid signature", async () => {
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
    mockStripe.webhooks.constructEvent.mockImplementationOnce(() => {
      throw new Error("bad signature");
    });
    const res = await webhookRoutes.POST(webhookRequest({}, "sig_bad"));
    expect(res.status).toBe(400);
  });

  it("activates the plan and creates an invoice on checkout.session.completed", async () => {
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
    mockStripe.webhooks.constructEvent.mockReturnValueOnce({
      type: "checkout.session.completed",
      data: {
        object: {
          customer: "cus_123",
          subscription: "sub_123",
          amount_total: 2900,
          currency: "usd",
          payment_status: "paid",
          metadata: { userId: "u-1", planId: "plan-pro", tenantId: "tenant-1" },
        },
      },
    });

    const res = await webhookRoutes.POST(webhookRequest({}));
    expect(res.status).toBe(200);

    expect(mockPrisma.subscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "u-1" },
        update: expect.objectContaining({
          planId: "plan-pro",
          status: "ACTIVE",
          stripeCustomerId: "cus_123",
          stripeSubscriptionId: "sub_123",
        }),
        create: expect.objectContaining({
          userId: "u-1",
          planId: "plan-pro",
          stripeCustomerId: "cus_123",
          stripeSubscriptionId: "sub_123",
        }),
      }),
    );
    expect(mockPrisma.invoice.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          amount: 29,
          currency: "USD",
          status: "PAID",
        }),
      }),
    );
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "UPDATE_SUBSCRIPTION",
          tenantId: "tenant-1",
        }),
      }),
    );
  });

  it("syncs status on customer.subscription.updated", async () => {
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
    mockStripe.webhooks.constructEvent.mockReturnValueOnce({
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_123",
          status: "past_due",
          cancel_at_period_end: false,
          items: { data: [{ current_period_start: 1700000000, current_period_end: 1702592000 }] },
          metadata: {},
        },
      },
    });
    mockPrisma.subscription.findFirst.mockResolvedValueOnce({ id: "sub-1", userId: "u-1" });

    const res = await webhookRoutes.POST(webhookRequest({}));
    expect(res.status).toBe(200);
    expect(mockPrisma.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "sub-1" },
        data: expect.objectContaining({
          status: "PAST_DUE",
          cancelAtPeriodEnd: false,
        }),
      }),
    );
  });

  it("cancels the subscription on customer.subscription.deleted", async () => {
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
    mockStripe.webhooks.constructEvent.mockReturnValueOnce({
      type: "customer.subscription.deleted",
      data: {
        object: {
          id: "sub_123",
          status: "canceled",
          cancel_at_period_end: true,
          items: { data: [{ current_period_start: 1700000000, current_period_end: 1702592000 }] },
          metadata: {},
        },
      },
    });
    mockPrisma.subscription.findFirst.mockResolvedValueOnce({ id: "sub-1", userId: "u-1" });

    const res = await webhookRoutes.POST(webhookRequest({}));
    expect(res.status).toBe(200);
    expect(mockPrisma.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "sub-1" },
        data: expect.objectContaining({ status: "CANCELED" }),
      }),
    );
  });
});
