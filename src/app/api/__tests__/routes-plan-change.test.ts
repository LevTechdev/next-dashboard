import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * /api/billing/plan-change — the self-serve switch behind the pricing page.
 *
 * These tests pin the contract the pricing-page dialog depends on:
 *   · GET returns the proration preview for the SESSION's workspace;
 *   · POST refuses to act without `confirm: true` (no silent switches);
 *   · the change is written to the SESSION user's row — never to whichever
 *     admin happens to sort first (the bug the older subscription route has);
 *   · a net-positive amount on a locally-billed plan becomes a PENDING invoice,
 *     a net-negative one does not;
 *   · a Stripe-backed workspace gets a real gateway price swap with
 *     proration_behavior create_prorations, and refuses (503) when the plan has
 *     no price configured for the requested interval.
 */

const { mockRequireAuth, mockRequirePermission, mockPrisma, mockStripeUpdate, mockStripeRetrieve } =
  vi.hoisted(() => ({
    mockRequireAuth: vi.fn(),
    mockRequirePermission: vi.fn(),
    mockPrisma: {
      subscription: { findUnique: vi.fn(), update: vi.fn() },
      plan: { findUnique: vi.fn() },
      invoice: { create: vi.fn() },
      auditLog: { create: vi.fn() },
    },
    mockStripeUpdate: vi.fn(),
    mockStripeRetrieve: vi.fn(),
  }));

vi.mock("@/lib/api-guard", () => ({
  requireAuth: mockRequireAuth,
  requirePermission: mockRequirePermission,
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));

vi.mock("@/lib/stripe", () => ({
  stripeConfigured: () => true,
  getStripe: () => ({
    subscriptions: { update: mockStripeUpdate, retrieve: mockStripeRetrieve },
  }),
}));

vi.mock("@/lib/invoice-snapshot", () => ({
  buildInvoiceSnapshot: () => "{}",
}));

import { GET, POST } from "../billing/plan-change/route";

const STARTER = {
  id: "plan-starter",
  name: "Starter",
  price: 29,
  yearlyPrice: 276,
  sortOrder: 0,
  stripePriceId: "price_starter_m",
  stripeYearlyPriceId: "price_starter_y",
};
const PRO = {
  id: "plan-pro",
  name: "Professional",
  price: 79,
  yearlyPrice: 756,
  sortOrder: 1,
  stripePriceId: "price_pro_m",
  stripeYearlyPriceId: "price_pro_y",
};

/**
 * A month-long period, exactly half spent, with the clock frozen at the
 * midpoint — so "half of the rate" is the proration the route must produce and
 * the assertions are arithmetic rather than approximations.
 */
const PERIOD_START = new Date("2026-09-01T00:00:00Z");
const PERIOD_END = new Date("2026-10-01T00:00:00Z");
const MIDPOINT = new Date("2026-09-16T00:00:00Z");

function subscription(overrides: Record<string, unknown> = {}) {
  return {
    id: "sub-1",
    userId: "u-1",
    planId: STARTER.id,
    plan: STARTER,
    billingInterval: "MONTHLY",
    status: "ACTIVE",
    currentPeriodStart: PERIOD_START,
    currentPeriodEnd: PERIOD_END,
    stripeSubscriptionId: null,
    ...overrides,
  };
}

describe("/api/billing/plan-change", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(MIDPOINT);
    mockRequireAuth.mockResolvedValue({
      session: { user: { id: "u-1", email: "owner@example.com", role: "ADMIN", tenantId: "t-1" } },
      response: null,
    });
    mockRequirePermission.mockResolvedValue({
      role: "ADMIN",
      session: { user: { id: "u-1", email: "owner@example.com", role: "ADMIN", tenantId: "t-1" } },
      response: null,
    });
    mockPrisma.plan.findUnique.mockResolvedValue(PRO);
    mockPrisma.invoice.create.mockResolvedValue({ id: "inv-1" });
    mockPrisma.auditLog.create.mockResolvedValue({});
    mockPrisma.subscription.update.mockResolvedValue({
      id: "sub-1",
      planId: PRO.id,
      plan: PRO,
      billingInterval: "MONTHLY",
      status: "ACTIVE",
      currentPeriodEnd: new Date("2026-10-23T00:00:00Z"),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("GET returns a proration preview for the session workspace", async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue(subscription());

    const res = await GET(
      new Request(
        "http://localhost/api/billing/plan-change?planId=plan-pro&billingInterval=YEARLY",
      ),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.preview.kind).toBe("UPGRADE");
    expect(body.preview.charge).toBe(378); // half of the $756 yearly rate
    expect(body.current.planName).toBe("Starter");
    expect(body.next.planName).toBe("Professional");
    // Scoped to the session user, not "first admin".
    expect(mockPrisma.subscription.findUnique).toHaveBeenCalledWith({
      where: { userId: "u-1" },
      include: { plan: true },
    });
  });

  it("refuses to apply without an explicit confirmation", async () => {
    const res = await POST(
      new Request("http://localhost/api/billing/plan-change", {
        method: "POST",
        body: JSON.stringify({ planId: PRO.id, billingInterval: "MONTHLY" }),
      }),
    );
    expect(res.status).toBe(400);
    expect(mockPrisma.subscription.update).not.toHaveBeenCalled();
  });

  it("applies an upgrade to the session workspace and records the prorated invoice", async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue(subscription());

    const res = await POST(
      new Request("http://localhost/api/billing/plan-change", {
        method: "POST",
        body: JSON.stringify({ planId: PRO.id, billingInterval: "MONTHLY", confirm: true }),
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.gateway).toBe("local");
    expect(body.invoiceId).toBe("inv-1");

    // Prorated net for the remaining half period: $39.50 − $14.50 = $25.00.
    const invoice = mockPrisma.invoice.create.mock.calls[0][0].data;
    expect(invoice.amount).toBe(25);
    expect(invoice.status).toBe("PENDING");
    expect(invoice.userId).toBe("u-1");

    // The change lands on the session user's subscription row.
    expect(mockPrisma.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "u-1" },
        data: expect.objectContaining({ planId: PRO.id, billingInterval: "MONTHLY" }),
      }),
    );
    // …and is audited.
    expect(mockPrisma.auditLog.create).toHaveBeenCalled();
  });

  it("records no invoice when the change costs nothing (downgrade covered by credit)", async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue(
      subscription({ plan: PRO, planId: PRO.id }),
    );
    mockPrisma.plan.findUnique.mockResolvedValue(STARTER);

    const res = await POST(
      new Request("http://localhost/api/billing/plan-change", {
        method: "POST",
        body: JSON.stringify({ planId: STARTER.id, billingInterval: "MONTHLY", confirm: true }),
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.proration.dueToday).toBeLessThan(0);
    expect(body.invoiceId).toBeNull();
    expect(mockPrisma.invoice.create).not.toHaveBeenCalled();
  });

  it("swaps the Stripe price with create_prorations for a gateway-backed workspace", async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue(
      subscription({ stripeSubscriptionId: "sub_stripe_1" }),
    );
    mockStripeRetrieve.mockResolvedValue({ items: { data: [{ id: "si_1" }] } });
    mockStripeUpdate.mockResolvedValue({});

    const res = await POST(
      new Request("http://localhost/api/billing/plan-change", {
        method: "POST",
        body: JSON.stringify({ planId: PRO.id, billingInterval: "YEARLY", confirm: true }),
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.gateway).toBe("stripe");
    expect(mockStripeUpdate).toHaveBeenCalledWith(
      "sub_stripe_1",
      expect.objectContaining({
        items: [{ id: "si_1", price: "price_pro_y" }],
        proration_behavior: "create_prorations",
      }),
    );
    // The gateway bills it, so no local invoice is minted.
    expect(mockPrisma.invoice.create).not.toHaveBeenCalled();
  });

  it("refuses when the target plan has no Stripe price for that interval", async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue(
      subscription({ stripeSubscriptionId: "sub_stripe_1" }),
    );
    mockPrisma.plan.findUnique.mockResolvedValue({ ...PRO, stripeYearlyPriceId: null });

    const res = await POST(
      new Request("http://localhost/api/billing/plan-change", {
        method: "POST",
        body: JSON.stringify({ planId: PRO.id, billingInterval: "YEARLY", confirm: true }),
      }),
    );

    expect(res.status).toBe(503);
    expect(mockStripeUpdate).not.toHaveBeenCalled();
    expect(mockPrisma.subscription.update).not.toHaveBeenCalled();
  });

  it("rejects a no-op change to the plan already held", async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue(subscription());
    mockPrisma.plan.findUnique.mockResolvedValue(STARTER);

    const res = await POST(
      new Request("http://localhost/api/billing/plan-change", {
        method: "POST",
        body: JSON.stringify({ planId: STARTER.id, billingInterval: "MONTHLY", confirm: true }),
      }),
    );

    expect(res.status).toBe(400);
    expect(mockPrisma.subscription.update).not.toHaveBeenCalled();
  });
});
