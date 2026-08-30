// ═══════════════════════════════════════════════════════════════════════════
// GET/PATCH /api/orders/[id] — detail read + fulfillment state machine.
//
// The transition rules themselves are unit-tested in src/lib/order-status.test.ts;
// here we verify the route enforces them: valid forward transitions stamp the
// entry timestamp, invalid/unknown transitions are rejected with 400, refunds
// flip paymentStatus, and tenant isolation holds.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockRequirePermission,
  mockGetTenantId,
  mockSameTenant,
  mockWithDecryptedCustomer,
  mockOrderFindUnique,
  mockOrderUpdate,
  mockActivityLogCreate,
} = vi.hoisted(() => ({
  mockRequirePermission: vi.fn(),
  mockGetTenantId: vi.fn(),
  mockSameTenant: vi.fn(),
  mockWithDecryptedCustomer: vi.fn((row: unknown) => row),
  mockOrderFindUnique: vi.fn(),
  mockOrderUpdate: vi.fn(),
  mockActivityLogCreate: vi.fn(),
}));

vi.mock("@/lib/api-guard", () => ({
  requirePermission: mockRequirePermission,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    order: { findUnique: mockOrderFindUnique, update: mockOrderUpdate },
    activityLog: { create: mockActivityLogCreate },
  },
}));

vi.mock("@/lib/tenancy", () => ({
  getTenantId: mockGetTenantId,
  sameTenant: mockSameTenant,
}));

vi.mock("@/lib/pii", () => ({
  withDecryptedCustomer: mockWithDecryptedCustomer,
}));

import { GET, PATCH } from "../orders/[id]/route";

function mockRequest(body?: unknown): Request {
  return {
    json: () => Promise.resolve(body ?? {}),
    url: "http://localhost:3010/api/orders/order-1",
  } as Request;
}

// Next.js passes `{ params }` to route handlers — the second argument is the
// context object, not the params promise itself.
const routeContext = { params: Promise.resolve({ id: "order-1" }) };

const baseOrder = {
  id: "order-1",
  orderNumber: "ORD-001",
  status: "PENDING",
  paymentStatus: "UNPAID",
  tenantId: "tenant-1",
  totalAmount: 100,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockRequirePermission.mockResolvedValue({
    session: { user: { id: "user-1" } },
    response: undefined,
  });
  mockGetTenantId.mockReturnValue("tenant-1");
  mockSameTenant.mockImplementation(
    (tenantId: string, row: { tenantId?: string | null }) => row?.tenantId === tenantId,
  );
  mockOrderUpdate.mockImplementation(async (_: unknown, args: { data: unknown }) => ({
    ...baseOrder,
    ...(args?.data ?? {}),
  }));
  mockActivityLogCreate.mockResolvedValue({});
});

describe("GET /api/orders/[id]", () => {
  it("returns the order when found and tenant matches", async () => {
    mockOrderFindUnique.mockResolvedValue(baseOrder);

    const res = await GET(mockRequest(), routeContext);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.orderNumber).toBe("ORD-001");
    expect(mockWithDecryptedCustomer).toHaveBeenCalledWith(baseOrder);
  });

  it("returns 404 when the order does not exist", async () => {
    mockOrderFindUnique.mockResolvedValue(null);

    const res = await GET(mockRequest(), routeContext);

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Order not found" });
  });

  it("returns 404 for an order from another tenant", async () => {
    mockOrderFindUnique.mockResolvedValue(baseOrder);
    mockSameTenant.mockReturnValue(false);

    const res = await GET(mockRequest(), routeContext);

    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/orders/[id] status transitions", () => {
  it("stamps the entry timestamp on a valid forward transition", async () => {
    mockOrderFindUnique.mockResolvedValue({ tenantId: "tenant-1", status: "PENDING" });

    const res = await PATCH(mockRequest({ status: "PROCESSING" }), routeContext);

    expect(res.status).toBe(200);
    expect(mockOrderUpdate).toHaveBeenCalledWith({
      where: { id: "order-1" },
      data: expect.objectContaining({
        status: "PROCESSING",
        processingAt: expect.any(Date),
      }),
    });
    expect(mockActivityLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "UPDATE_ORDER_PROCESSING",
          details: "Order ORD-001 status changed to PROCESSING",
        }),
      }),
    );
  });

  it("stamps shippedAt/deliveredAt on later forward transitions", async () => {
    mockOrderFindUnique.mockResolvedValue({ tenantId: "tenant-1", status: "SHIPPED" });

    const res = await PATCH(mockRequest({ status: "DELIVERED" }), routeContext);

    expect(res.status).toBe(200);
    expect(mockOrderUpdate).toHaveBeenCalledWith({
      where: { id: "order-1" },
      data: expect.objectContaining({ status: "DELIVERED", deliveredAt: expect.any(Date) }),
    });
  });

  it("rejects backward transitions with a 400 and does not update", async () => {
    mockOrderFindUnique.mockResolvedValue({ tenantId: "tenant-1", status: "SHIPPED" });

    const res = await PATCH(mockRequest({ status: "PROCESSING" }), routeContext);

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "Cannot transition order from SHIPPED to PROCESSING",
    });
    expect(mockOrderUpdate).not.toHaveBeenCalled();
  });

  it("rejects unknown statuses with a 400", async () => {
    mockOrderFindUnique.mockResolvedValue({ tenantId: "tenant-1", status: "PENDING" });

    const res = await PATCH(mockRequest({ status: "VOID" }), routeContext);

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Unknown order status: VOID" });
  });

  it("refunding stamps refundedAt and flips paymentStatus to REFUNDED", async () => {
    mockOrderFindUnique.mockResolvedValue({ tenantId: "tenant-1", status: "DELIVERED" });

    const res = await PATCH(mockRequest({ status: "REFUNDED" }), routeContext);

    expect(res.status).toBe(200);
    expect(mockOrderUpdate).toHaveBeenCalledWith({
      where: { id: "order-1" },
      data: expect.objectContaining({
        status: "REFUNDED",
        refundedAt: expect.any(Date),
        paymentStatus: "REFUNDED",
      }),
    });
  });
});

describe("PATCH /api/orders/[id] fulfillment tracking", () => {
  it("updates tracking number and carrier without touching status", async () => {
    mockOrderFindUnique.mockResolvedValue({ tenantId: "tenant-1", status: "SHIPPED" });

    const res = await PATCH(
      mockRequest({ trackingNumber: "JNE00938827142", carrier: "JNE" }),
      routeContext,
    );

    expect(res.status).toBe(200);
    expect(mockOrderUpdate).toHaveBeenCalledWith({
      where: { id: "order-1" },
      data: expect.objectContaining({
        trackingNumber: "JNE00938827142",
        carrier: "JNE",
      }),
    });
    expect(mockActivityLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "UPDATE_ORDER" }),
      }),
    );
  });
});

describe("PATCH /api/orders/[id] tenant isolation", () => {
  it("returns 404 when the order belongs to another tenant", async () => {
    mockOrderFindUnique.mockResolvedValue({ tenantId: "tenant-2", status: "PENDING" });

    const res = await PATCH(mockRequest({ status: "PROCESSING" }), routeContext);

    expect(res.status).toBe(404);
    expect(mockOrderUpdate).not.toHaveBeenCalled();
  });
});
