import { describe, it, expect, vi, beforeEach } from "vitest";

// ═══════════════════════════════════════════════════════════════════════════
// Hoisted mocks (same pattern as stripe-billing.test.ts)
// ═══════════════════════════════════════════════════════════════════════════

const {
  mockPrisma,
  mockRequirePermission,
  mockRequireAuth,
  mockMidtransConfigured,
  mockCreateSnapTransaction,
  mockVerifyMidtransSignature,
} = vi.hoisted(() => {
  const model = <T extends Record<string, unknown>>(overrides: Partial<T> = {}) =>
    new Proxy<T>({} as T, {
      get(_, prop) {
        const key = String(prop);
        return (overrides as any)[key] ?? vi.fn().mockImplementation(() => Promise.resolve(null));
      },
    });

  const paidPlan = {
    id: "plan-pro",
    name: "Pro",
    price: 29,
    stripePriceId: "price_pro",
  };

  const pendingSubscription = {
    id: "sub-1",
    userId: "u-1",
    planId: "plan-pro",
    plan: paidPlan,
    status: "PENDING",
    gateway: "midtrans",
    midtransOrderId: "MT-123",
  };

  const prisma = {
    plan: model({
      findUnique: vi.fn().mockResolvedValue(paidPlan),
    }),
    subscription: model({
      findFirst: vi.fn().mockResolvedValue(pendingSubscription),
      upsert: vi
        .fn()
        .mockImplementation(({ create }) =>
          Promise.resolve({ id: "sub-1", ...(create as Record<string, unknown>) }),
        ),
      update: vi
        .fn()
        .mockImplementation(({ data }) =>
          Promise.resolve({ id: "sub-1", ...(data as Record<string, unknown>) }),
        ),
    }),
    invoice: model({
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: "inv-1" }),
    }),
    auditLog: model({
      create: vi.fn().mockResolvedValue({ id: "audit-1" }),
    }),
  };

  return {
    mockPrisma: prisma,
    mockRequirePermission: vi.fn().mockResolvedValue({ response: null, role: "ADMIN" }),
    mockRequireAuth: vi.fn().mockResolvedValue({
      session: {
        user: { id: "u-1", name: "Admin", email: "nextdashboards@gmail.com", role: "ADMIN" },
      },
      response: null,
    }),
    mockMidtransConfigured: vi.fn(() => true),
    mockCreateSnapTransaction: vi.fn().mockResolvedValue({
      token: "snap-token",
      redirect_url: "https://app.sandbox.midtrans.com/snap/v2/vtweb/xyz",
    }),
    mockVerifyMidtransSignature: vi.fn(() => true),
  };
});

vi.mock("@/lib/api-guard", () => ({
  requirePermission: mockRequirePermission,
  requireAuth: mockRequireAuth,
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));

vi.mock("@/lib/midtrans", () => ({
  midtransConfigured: mockMidtransConfigured,
  createSnapTransaction: mockCreateSnapTransaction,
  verifyMidtransSignature: mockVerifyMidtransSignature,
  MIDTRANS_CHANNELS: ["dana", "gopay", "qris", "bank_transfer", "credit_card"],
  MIDTRANS_USD_RATE: 15_800,
}));

// The checkout route imports these at module load; they are not exercised by
// the midtrans path but must resolve.
vi.mock("@/lib/stripe", () => ({
  getStripe: vi.fn(() => ({})),
  stripeConfigured: vi.fn(() => true),
}));

vi.mock("@/lib/tenancy", () => ({ getTenantId: vi.fn(() => "tenant-1") }));

// ═══════════════════════════════════════════════════════════════════════════
// Imports under test
// ═══════════════════════════════════════════════════════════════════════════

import * as checkoutRoutes from "../billing/checkout/route";
import * as midtransWebhookRoutes from "../billing/midtrans/webhook/route";

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

beforeEach(() => {
  vi.clearAllMocks();
  mockMidtransConfigured.mockReturnValue(true);
  mockVerifyMidtransSignature.mockReturnValue(true);
  mockCreateSnapTransaction.mockResolvedValue({
    token: "snap-token",
    redirect_url: "https://app.sandbox.midtrans.com/snap/v2/vtweb/xyz",
  });
  mockRequirePermission.mockResolvedValue({ response: null, role: "ADMIN" });
  mockRequireAuth.mockResolvedValue({
    session: {
      user: { id: "u-1", name: "Admin", email: "nextdashboards@gmail.com", role: "ADMIN" },
    },
    response: null,
  });
  mockPrisma.plan.findUnique.mockResolvedValue({
    id: "plan-pro",
    name: "Pro",
    price: 29,
    stripePriceId: "price_pro",
  });
  mockPrisma.subscription.findFirst.mockResolvedValue({
    id: "sub-1",
    userId: "u-1",
    planId: "plan-pro",
    plan: { id: "plan-pro", name: "Pro", price: 29 },
    status: "PENDING",
    gateway: "midtrans",
    midtransOrderId: "MT-123",
  });
  mockPrisma.invoice.findFirst.mockResolvedValue(null);
});

// ── POST /api/billing/checkout — Midtrans path ─────────────────────────────
describe("POST /api/billing/checkout (gateway=midtrans)", () => {
  it("creates a Snap transaction restricted to the chosen channel and returns the redirect url", async () => {
    const res = await checkoutRoutes.POST(
      jsonRequest({ planId: "plan-pro", locale: "id", gateway: "midtrans", channel: "dana" }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.gateway).toBe("midtrans");
    expect(body.url).toBe("https://app.sandbox.midtrans.com/snap/v2/vtweb/xyz");
    expect(body.orderId).toMatch(/^MT-/);

    expect(mockCreateSnapTransaction).toHaveBeenCalledTimes(1);
    const snapArgs = mockCreateSnapTransaction.mock.calls[0][0];
    expect(snapArgs.enabledPayments).toEqual(["dana"]);
    expect(snapArgs.grossAmountIdr).toBe(29 * 15_800);
    expect(snapArgs.items[0].name).toBe("Pro Plan (monthly)");
    expect(snapArgs.notificationUrl).toContain("/api/billing/midtrans/webhook");

    // The pending transaction is stashed on the subscription (PENDING).
    const upsertCall = mockPrisma.subscription.upsert.mock.calls[0][0];
    expect(upsertCall.update).toMatchObject({
      planId: "plan-pro",
      status: "PENDING",
      gateway: "midtrans",
    });
    expect(upsertCall.update.midtransOrderId).toBe(body.orderId);
  });

  it("leaves enabled_payments unrestricted when no channel is given", async () => {
    await checkoutRoutes.POST(jsonRequest({ planId: "plan-pro", gateway: "midtrans" }));
    const snapArgs = mockCreateSnapTransaction.mock.calls[0][0];
    expect(snapArgs.enabledPayments).toBeUndefined();
  });

  it("rejects an invalid channel", async () => {
    const res = await checkoutRoutes.POST(
      jsonRequest({ planId: "plan-pro", gateway: "midtrans", channel: "bitcoin" }),
    );
    expect(res.status).toBe(400);
    expect(mockCreateSnapTransaction).not.toHaveBeenCalled();
  });

  it("rejects an invalid gateway", async () => {
    const res = await checkoutRoutes.POST(jsonRequest({ planId: "plan-pro", gateway: "paypal" }));
    expect(res.status).toBe(400);
  });

  it("returns 503 when Midtrans is not configured", async () => {
    mockMidtransConfigured.mockReturnValue(false);
    const res = await checkoutRoutes.POST(jsonRequest({ planId: "plan-pro", gateway: "midtrans" }));
    expect(res.status).toBe(503);
    expect(mockCreateSnapTransaction).not.toHaveBeenCalled();
  });

  it("rejects the free plan", async () => {
    mockPrisma.plan.findUnique.mockResolvedValue({ id: "plan-free", name: "Free", price: 0 });
    const res = await checkoutRoutes.POST(
      jsonRequest({ planId: "plan-free", gateway: "midtrans" }),
    );
    expect(res.status).toBe(400);
  });
});

// ── POST /api/billing/midtrans/webhook ─────────────────────────────────────
const signedBody = (overrides: Record<string, unknown> = {}) => ({
  order_id: "MT-123",
  status_code: "200",
  gross_amount: "458200.00",
  signature_key: "sig",
  transaction_status: "settlement",
  payment_type: "dana",
  ...overrides,
});

describe("POST /api/billing/midtrans/webhook", () => {
  it("rejects a payload with an invalid signature", async () => {
    mockVerifyMidtransSignature.mockReturnValue(false);
    const res = await midtransWebhookRoutes.POST(jsonRequest(signedBody()));
    expect(res.status).toBe(400);
    expect(mockPrisma.subscription.findFirst).not.toHaveBeenCalled();
  });

  it("rejects an incomplete payload", async () => {
    const res = await midtransWebhookRoutes.POST(jsonRequest({ order_id: "MT-123" }));
    expect(res.status).toBe(400);
  });

  it("activates the subscription and creates a PAID invoice on settlement", async () => {
    const res = await midtransWebhookRoutes.POST(
      jsonRequest(signedBody({ payment_type: "gopay" })),
    );
    expect(res.status).toBe(200);

    expect(mockPrisma.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "sub-1" },
        data: expect.objectContaining({ status: "ACTIVE", gateway: "midtrans" }),
      }),
    );

    expect(mockPrisma.invoice.create).toHaveBeenCalledTimes(1);
    const invoiceData = mockPrisma.invoice.create.mock.calls[0][0].data;
    expect(invoiceData).toMatchObject({
      amount: 458200,
      currency: "IDR",
      status: "PAID",
      paymentMethod: "gopay",
      planId: "plan-pro",
    });
    expect(invoiceData.paidAt).toBeTruthy();

    expect(mockPrisma.auditLog.create).toHaveBeenCalled();
  });

  it("does not create a second invoice when the settlement is retried", async () => {
    mockPrisma.invoice.findFirst.mockResolvedValue({ id: "inv-existing", status: "PAID" });
    await midtransWebhookRoutes.POST(jsonRequest(signedBody()));
    expect(mockPrisma.invoice.create).not.toHaveBeenCalled();
    // The subscription is still re-synced (idempotent state flip).
    expect(mockPrisma.subscription.update).toHaveBeenCalled();
  });

  it("marks the checkout INCOMPLETE and clears the order on deny/expire", async () => {
    const res = await midtransWebhookRoutes.POST(
      jsonRequest(signedBody({ transaction_status: "expire" })),
    );
    expect(res.status).toBe(200);
    expect(mockPrisma.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "sub-1" },
        data: expect.objectContaining({ status: "INCOMPLETE", midtransOrderId: null }),
      }),
    );
    expect(mockPrisma.invoice.create).not.toHaveBeenCalled();
  });

  it("acknowledges unknown orders without local changes", async () => {
    mockPrisma.subscription.findFirst.mockResolvedValue(null);
    const res = await midtransWebhookRoutes.POST(jsonRequest(signedBody()));
    expect(res.status).toBe(200);
    expect(mockPrisma.subscription.update).not.toHaveBeenCalled();
    expect(mockPrisma.invoice.create).not.toHaveBeenCalled();
  });

  it("returns 503 when Midtrans is not configured", async () => {
    mockMidtransConfigured.mockReturnValue(false);
    const res = await midtransWebhookRoutes.POST(jsonRequest(signedBody()));
    expect(res.status).toBe(503);
  });
});
