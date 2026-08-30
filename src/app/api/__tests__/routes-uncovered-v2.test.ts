import { describe, it, expect, vi, beforeEach } from "vitest";

// ═══════════════════════════════════════════════════════════════════════════
// Hoisted mocks
// ═══════════════════════════════════════════════════════════════════════════

const { mockRequireAuth, mockRequirePermission, mockGetSession, mockPrisma, mockVerifyApiKey } =
  vi.hoisted(() => {
    const model = <T extends Record<string, unknown>>(overrides: Partial<T> = {}) =>
      new Proxy<T>({} as T, {
        get(_, prop) {
          const key = String(prop);
          return (overrides as any)[key] ?? vi.fn().mockImplementation(() => Promise.resolve(null));
        },
      });

    const deepModel = <T extends Record<string, unknown>>(overrides: Partial<T> = {}) =>
      model({
        findMany: vi.fn().mockResolvedValue([]),
        findUnique: vi.fn().mockResolvedValue(null),
        findFirst: vi.fn().mockResolvedValue(null),
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn().mockResolvedValue({}),
        update: vi.fn().mockResolvedValue({}),
        delete: vi.fn().mockResolvedValue({}),
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        aggregate: vi.fn().mockResolvedValue({ _sum: { grandTotal: 0 }, _count: 0 }),
        ...overrides,
      });

    return {
      mockGetSession: vi.fn<() => Promise<unknown>>(),
      mockRequireAuth: vi.fn<() => Promise<unknown>>(),
      mockRequirePermission: vi.fn<() => Promise<unknown>>(),
      mockVerifyApiKey: vi.fn<
        (
          req: Request,
          scope?: string,
        ) => Promise<{
          ok: boolean;
          userId?: string | null;
          permissions?: string;
          keyId?: string;
          status?: number;
          error?: string;
        }>
      >(),
      mockPrisma: {
        customer: deepModel({
          findUnique: vi.fn().mockResolvedValue({
            id: "c-1",
            name: "John Doe",
            email: "john@test.com",
            phone: "555-1000",
            city: "NYC",
            country: "US",
            segment: "VIP",
            notes: "Good customer",
            isActive: true,
            tenantId: "tenant-1",
            orders: [
              {
                id: "o-1",
                orderNumber: "ORD-001",
                createdAt: new Date("2024-06-01"),
                channel: { name: "Online Store" },
                items: [{ id: "oi-1", name: "Widget", quantity: 2 }],
              },
            ],
          }),
          create: vi.fn().mockImplementation(({ data }) =>
            Promise.resolve({
              id: "c-new",
              name: data.name,
              email: data.email,
              phone: data.phone,
              city: data.city,
              country: data.country,
              segment: data.segment,
              notes: data.notes,
              isActive: true,
            }),
          ),
          update: vi.fn().mockImplementation(({ where, data }) =>
            Promise.resolve({
              id: where?.id || "c-1",
              name: data?.name ?? "John Doe",
              email: data?.email ?? "john@test.com",
              phone: data?.phone ?? "555-1000",
              city: data?.city ?? "NYC",
              country: data?.country ?? "US",
              segment: data?.segment ?? "VIP",
              notes: data?.notes ?? "Good customer",
              isActive: data?.isActive ?? true,
              tenantId: "tenant-1",
            }),
          ),
          count: vi.fn().mockResolvedValue(50),
        }),

        product: deepModel({
          findUnique: vi.fn().mockResolvedValue({
            id: "p-1",
            name: "Widget",
            description: "A fine widget",
            price: 29.99,
            costPrice: 10,
            stock: 50,
            sku: "WGT-001",
            isActive: true,
            tenantId: "tenant-1",
            categoryId: "cat-1",
            category: { id: "cat-1", name: "Electronics" },
            inventoryItems: [],
            orderItems: [
              {
                id: "oi-1",
                order: { orderNumber: "ORD-001", createdAt: new Date(), status: "PENDING" },
              },
            ],
          }),
          create: vi.fn().mockImplementation(({ data }) =>
            Promise.resolve({
              id: "p-new",
              name: data.name,
              price: data.price,
              stock: data.stock,
              sku: data.sku,
            }),
          ),
          update: vi.fn().mockImplementation(({ where, data }) =>
            Promise.resolve({
              id: where?.id || "p-1",
              name: data?.name ?? "Widget",
              price: data?.price ?? 29.99,
              stock: data?.stock ?? 50,
              isActive: data?.isActive ?? true,
              tenantId: "tenant-1",
            }),
          ),
          delete: vi.fn().mockResolvedValue({ id: "p-1" }),
          deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
          updateMany: vi.fn().mockResolvedValue({ count: 2 }),
        }),

        productCategory: deepModel({
          findMany: vi
            .fn()
            .mockResolvedValue([{ id: "cat-1", name: "Electronics", slug: "electronics" }]),
          create: vi
            .fn()
            .mockImplementation(({ data }) =>
              Promise.resolve({ id: "cat-new", name: data.name, slug: data.slug }),
            ),
        }),

        orderItem: deepModel({
          findMany: vi.fn().mockResolvedValue([{ productId: "p-1" }]),
        }),

        securityEvent: deepModel({
          findMany: vi.fn().mockResolvedValue([
            {
              id: "se-1",
              seq: 1,
              userId: "u-1",
              type: "LOGIN_SUCCESS",
              ip: "127.0.0.1",
              userAgent: "Mozilla/5.0",
              metadata: null,
              hash: "abc123",
              prevHash: null,
              createdAt: new Date("2024-06-01"),
            },
          ]),
        }),

        invoice: deepModel({
          findUnique: vi.fn().mockResolvedValue({
            id: "inv-1",
            invoiceNumber: "INV-001",
            amount: 29,
            status: "PAID",
            currency: "USD",
            userId: "user-1",
            paidAt: new Date("2024-06-15"),
            createdAt: new Date("2024-06-01"),
            periodStart: new Date("2024-06-01"),
            periodEnd: new Date("2024-06-30"),
            paymentMethod: "stripe",
            description: null,
            plan: { name: "Starter", interval: "MONTHLY" },
            user: { name: "Test User", email: "test@example.com" },
          }),
        }),

        apiKey: deepModel({}),

        user: deepModel({
          findUnique: vi.fn().mockResolvedValue({
            id: "user-1",
            name: "Test User",
            email: "test@example.com",
            role: "ADMIN",
          }),
        }),

        activityLog: deepModel({}),
        auditLog: deepModel({}),
        tenant: deepModel({}),
      },
    };
  });

// ═══════════════════════════════════════════════════════════════════════════
// Module mocks
// ═══════════════════════════════════════════════════════════════════════════

vi.mock("@/lib/auth0", () => ({ auth0: { getSession: mockGetSession } }));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));

vi.mock("@/lib/api-guard", () => ({
  requirePermission: mockRequirePermission,
  requireAuth: mockRequireAuth,
}));

vi.mock("@/lib/api-keys", () => ({ verifyApiKey: mockVerifyApiKey }));

vi.mock("@/lib/tenancy", () => ({
  getTenantId: (session: any) => session?.user?.tenantId ?? null,
  sameTenant: (tenantId: string | null, row: any) => (row?.tenantId ?? null) === tenantId,
  tenantWhere: (tenantId: string | null) => ({ tenantId }),
  effectiveTenantId: async (session: any) => session?.user?.tenantId ?? null,
}));

vi.mock("@/lib/pii", () => ({
  encryptPII: (v: string | null | undefined) => (v == null ? null : `enc:${v}`),
  decryptPII: (v: string | null | undefined) => {
    if (v == null) return null;
    return v.startsWith("enc:") ? v.slice(4) : v;
  },
  encryptCustomerPII: (data: any) => ({
    ...data,
    email: data.email ? `enc:${data.email}` : data.email,
    phone: data.phone ? `enc:${data.phone}` : data.phone,
  }),
  decryptCustomerPII: (row: any) => {
    if (!row) return row;
    return {
      ...row,
      email: row.email?.startsWith?.("enc:") ? row.email.slice(4) : row.email,
      phone: row.phone?.startsWith?.("enc:") ? row.phone.slice(4) : row.phone,
    };
  },
}));

vi.mock("@/lib/siem", () => ({
  toCEF: (e: any) =>
    `CEF:0|Test|Test|1.0|${e.type}|${e.type}|3|rt=${new Date(e.createdAt).getTime()}`,
  toSiemJSON: (e: any) => ({
    id: e.id,
    seq: e.seq ?? null,
    timestamp: new Date(e.createdAt).toISOString(),
    eventType: e.type,
    severity: 3,
    userId: e.userId,
    sourceIp: e.ip,
    userAgent: e.userAgent,
    metadata: e.metadata ?? null,
  }),
}));

vi.mock("@/lib/audit-chain", () => ({
  verifyAuditChain: vi.fn().mockResolvedValue({
    ok: true,
    total: 1,
    verified: 1,
    firstBreakSeq: null,
    breaks: [],
  }),
}));

vi.mock("@/lib/request-meta", () => ({
  getClientIp: () => "127.0.0.1",
  parseUserAgent: () => ({ browser: "Chrome", device: "Windows" }),
  getRequestMeta: () => ({
    ip: "127.0.0.1",
    userAgent: "Mozilla/5.0",
    browser: "Chrome",
    device: "Windows",
  }),
}));

// ═══════════════════════════════════════════════════════════════════════════
// Imports under test
// ═══════════════════════════════════════════════════════════════════════════

import * as customerByIdRoutes from "../customers/[id]/route";
import * as customerImportRoutes from "../customers/import/route";
import * as productByIdRoutes from "../products/[id]/route";
import * as productBulkRoutes from "../products/bulk/route";
import * as productImportRoutes from "../products/import/route";
import * as securityAuditExportRoutes from "../security/audit/export/route";
import * as securityAuditVerifyRoutes from "../security/audit/verify/route";
import * as invoiceDownloadRoutes from "../billing/invoices/[id]/download/route";
import * as whoamiRoutes from "../v1/whoami/route";

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

function mockRequest(body?: unknown, queryString = "", headers?: Record<string, string>): Request {
  return {
    json: () => Promise.resolve(body ?? {}),
    url: `http://localhost:3000/api/test${queryString ? `?${queryString}` : ""}`,
    headers: {
      get: (name: string) => headers?.[name] ?? null,
      entries: () => Object.entries(headers ?? {}),
    } as any,
  } as unknown as Request;
}

function permissionDenied() {
  return {
    role: null,
    response: new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 }),
  };
}

function permissionGranted(role = "ADMIN") {
  return {
    role,
    session: {
      user: {
        id: "user-1",
        sub: "user-1",
        name: "Test User",
        email: "test@example.com",
        role,
        tenantId: "tenant-1",
      },
    },
    response: null,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSession.mockResolvedValue({
    user: {
      id: "user-1",
      sub: "user-1",
      name: "Test User",
      email: "test@example.com",
      role: "ADMIN",
      tenantId: "tenant-1",
    },
  });
  mockRequireAuth.mockResolvedValue({
    session: {
      user: {
        id: "user-1",
        sub: "user-1",
        name: "Test User",
        email: "test@example.com",
        role: "ADMIN",
        tenantId: "tenant-1",
      },
    },
    response: null,
  });
  mockRequirePermission.mockResolvedValue(permissionGranted());
});

// ═══════════════════════════════════════════════════════════════════════════
// Customers [id]
// ═══════════════════════════════════════════════════════════════════════════

describe("Customers [id]", () => {
  const params = { params: Promise.resolve({ id: "c-1" }) };

  describe("authorization", () => {
    it("GET returns 403 when permission denied", async () => {
      mockRequirePermission.mockResolvedValue(permissionDenied());
      const res = await customerByIdRoutes.GET(mockRequest(), params);
      expect(res.status).toBe(403);
    });

    it("PUT returns 403 when permission denied", async () => {
      mockRequirePermission.mockResolvedValue(permissionDenied());
      const res = await customerByIdRoutes.PUT(mockRequest({ name: "Updated" }), params);
      expect(res.status).toBe(403);
    });

    it("DELETE returns 403 when permission denied", async () => {
      mockRequirePermission.mockResolvedValue(permissionDenied());
      const res = await customerByIdRoutes.DELETE(mockRequest(), params);
      expect(res.status).toBe(403);
    });
  });

  describe("GET", () => {
    it("returns customer with decrypted PII and orders", async () => {
      const res = await customerByIdRoutes.GET(mockRequest(), params);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.id).toBe("c-1");
      expect(body.name).toBe("John Doe");
      expect(body.email).toBe("john@test.com"); // decrypted
      expect(body.phone).toBe("555-1000"); // decrypted
      expect(body.city).toBe("NYC");
      expect(body.segment).toBe("VIP");
      expect(body.orders).toHaveLength(1);
      expect(body.orders[0].orderNumber).toBe("ORD-001");
    });

    it("returns 404 when customer not found", async () => {
      mockPrisma.customer.findUnique.mockResolvedValueOnce(null);
      const res = await customerByIdRoutes.GET(mockRequest(), params);
      expect(res.status).toBe(404);
    });

    it("returns 404 when customer belongs to different tenant", async () => {
      mockPrisma.customer.findUnique.mockResolvedValueOnce({
        id: "c-other",
        name: "Other",
        tenantId: "tenant-999",
      });
      const res = await customerByIdRoutes.GET(mockRequest(), params);
      expect(res.status).toBe(404);
    });
  });

  describe("PUT", () => {
    it("updates customer and creates activity log", async () => {
      const res = await customerByIdRoutes.PUT(
        mockRequest({ name: "Updated Name", email: "new@test.com", phone: "555-9999", city: "LA" }),
        params,
      );
      expect(res.status).toBe(200);
      expect(mockPrisma.customer.update).toHaveBeenCalled();
      expect(mockPrisma.activityLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: "UPDATE_CUSTOMER" }),
        }),
      );
    });

    it("returns 404 when customer not found for update", async () => {
      mockPrisma.customer.findUnique.mockResolvedValueOnce(null);
      const res = await customerByIdRoutes.PUT(mockRequest({ name: "X" }), params);
      expect(res.status).toBe(404);
    });
  });

  describe("DELETE", () => {
    it("soft-deletes customer and creates activity log", async () => {
      const res = await customerByIdRoutes.DELETE(mockRequest(), params);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(mockPrisma.customer.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isActive: false }),
        }),
      );
      expect(mockPrisma.activityLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: "DELETE_CUSTOMER" }),
        }),
      );
    });

    it("returns 404 when customer not found for delete", async () => {
      mockPrisma.customer.findUnique.mockResolvedValueOnce(null);
      const res = await customerByIdRoutes.DELETE(mockRequest(), params);
      expect(res.status).toBe(404);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Customers Import
// ═══════════════════════════════════════════════════════════════════════════

describe("Customers Import", () => {
  describe("authorization", () => {
    it("returns 403 when permission denied", async () => {
      mockRequirePermission.mockResolvedValue(permissionDenied());
      const res = await customerImportRoutes.POST(mockRequest({ rows: [{ name: "A" }] }));
      expect(res.status).toBe(403);
    });
  });

  describe("POST", () => {
    it("returns 400 when no rows provided", async () => {
      const res = await customerImportRoutes.POST(mockRequest({}));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("No rows");
    });

    it("returns 400 when rows exceed 500", async () => {
      const rows = Array.from({ length: 501 }, (_, i) => ({ name: `C${i}` }));
      const res = await customerImportRoutes.POST(mockRequest({ rows }));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("500");
    });

    it("skips rows without a name", async () => {
      const res = await customerImportRoutes.POST(
        mockRequest({ rows: [{ name: "Valid" }, { name: "" }, { email: "no-name@test.com" }] }),
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.imported).toBe(1);
      expect(body.skipped).toHaveLength(2);
      expect(body.skipped[0].reason).toBe("Missing name");
    });

    it("creates customers with valid segments", async () => {
      const res = await customerImportRoutes.POST(
        mockRequest({
          rows: [
            { name: "VIP User", email: "vip@test.com", segment: "VIP" },
            { name: "Regular User", segment: "REGULAR" },
            { name: "Unknown Segment", segment: "UNKNOWN" },
          ],
        }),
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.imported).toBe(3);
      expect(mockPrisma.customer.create).toHaveBeenCalledTimes(3);
    });

    it("creates activity log after import", async () => {
      await customerImportRoutes.POST(mockRequest({ rows: [{ name: "A" }, { name: "B" }] }));
      expect(mockPrisma.activityLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: "IMPORT_CUSTOMERS" }),
        }),
      );
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Products [id]
// ═══════════════════════════════════════════════════════════════════════════

describe("Products [id]", () => {
  const params = { params: Promise.resolve({ id: "p-1" }) };

  describe("authorization", () => {
    it("GET returns 403 when permission denied", async () => {
      mockRequirePermission.mockResolvedValue(permissionDenied());
      const res = await productByIdRoutes.GET(mockRequest(), params);
      expect(res.status).toBe(403);
    });

    it("PUT returns 403 when permission denied", async () => {
      mockRequirePermission.mockResolvedValue(permissionDenied());
      const res = await productByIdRoutes.PUT(mockRequest({ name: "X" }), params);
      expect(res.status).toBe(403);
    });

    it("DELETE returns 403 when permission denied", async () => {
      mockRequirePermission.mockResolvedValue(permissionDenied());
      const res = await productByIdRoutes.DELETE(mockRequest(), params);
      expect(res.status).toBe(403);
    });
  });

  describe("GET", () => {
    it("returns product with category, inventory, and order items", async () => {
      const res = await productByIdRoutes.GET(mockRequest(), params);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.id).toBe("p-1");
      expect(body.name).toBe("Widget");
      expect(body.price).toBe(29.99);
      expect(body.category.name).toBe("Electronics");
      expect(body.orderItems).toHaveLength(1);
    });

    it("returns 404 when product not found", async () => {
      mockPrisma.product.findUnique.mockResolvedValueOnce(null);
      const res = await productByIdRoutes.GET(mockRequest(), params);
      expect(res.status).toBe(404);
    });

    it("returns 404 when product belongs to different tenant", async () => {
      mockPrisma.product.findUnique.mockResolvedValueOnce({
        id: "p-other",
        tenantId: "tenant-999",
      });
      const res = await productByIdRoutes.GET(mockRequest(), params);
      expect(res.status).toBe(404);
    });
  });

  describe("PUT", () => {
    it("updates product fields and creates activity log", async () => {
      const res = await productByIdRoutes.PUT(
        mockRequest({ name: "New Widget", price: "39.99", stock: "100", sku: "NW-001" }),
        params,
      );
      expect(res.status).toBe(200);
      expect(mockPrisma.product.update).toHaveBeenCalled();
      expect(mockPrisma.activityLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: "UPDATE_PRODUCT" }),
        }),
      );
    });

    it("returns 404 when product not found for update", async () => {
      mockPrisma.product.findUnique.mockResolvedValueOnce(null);
      const res = await productByIdRoutes.PUT(mockRequest({ name: "X" }), params);
      expect(res.status).toBe(404);
    });
  });

  describe("DELETE", () => {
    it("soft-deletes product and creates activity log", async () => {
      const res = await productByIdRoutes.DELETE(mockRequest(), params);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(mockPrisma.product.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isActive: false }),
        }),
      );
      expect(mockPrisma.activityLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: "DELETE_PRODUCT" }),
        }),
      );
    });

    it("returns 404 when product not found for delete", async () => {
      mockPrisma.product.findUnique.mockResolvedValueOnce(null);
      const res = await productByIdRoutes.DELETE(mockRequest(), params);
      expect(res.status).toBe(404);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Products Bulk
// ═══════════════════════════════════════════════════════════════════════════

describe("Products Bulk", () => {
  describe("authorization", () => {
    it("returns 403 when permission denied", async () => {
      mockRequirePermission.mockResolvedValue(permissionDenied());
      const res = await productBulkRoutes.POST(mockRequest({ action: "delete", ids: ["p-1"] }));
      expect(res.status).toBe(403);
    });
  });

  describe("POST", () => {
    it("returns 400 when no ids provided", async () => {
      const res = await productBulkRoutes.POST(mockRequest({ action: "delete" }));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("No ids");
    });

    it("returns 400 for invalid action", async () => {
      const res = await productBulkRoutes.POST(mockRequest({ action: "invalid", ids: ["p-1"] }));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("Invalid action");
    });

    it("bulk activates products", async () => {
      mockPrisma.product.updateMany.mockResolvedValueOnce({ count: 2 });
      const res = await productBulkRoutes.POST(
        mockRequest({ action: "activate", ids: ["p-1", "p-2"] }),
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.affected).toBe(2);
      expect(mockPrisma.product.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { isActive: true },
        }),
      );
    });

    it("bulk deactivates products", async () => {
      mockPrisma.product.updateMany.mockResolvedValueOnce({ count: 1 });
      const res = await productBulkRoutes.POST(mockRequest({ action: "deactivate", ids: ["p-1"] }));
      expect(res.status).toBe(200);
      expect(mockPrisma.product.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { isActive: false },
        }),
      );
    });

    it("bulk delete: soft-deletes referenced products, hard-deletes unreferenced", async () => {
      // p-1 has order references → soft delete, p-2 doesn't → hard delete
      mockPrisma.orderItem.findMany.mockResolvedValueOnce([{ productId: "p-1" }]);
      mockPrisma.product.deleteMany.mockResolvedValueOnce({ count: 1 });
      mockPrisma.product.updateMany.mockResolvedValueOnce({ count: 1 });

      const res = await productBulkRoutes.POST(
        mockRequest({ action: "delete", ids: ["p-1", "p-2"] }),
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.affected).toBe(2);
    });

    it("creates activity log after bulk action", async () => {
      mockPrisma.product.updateMany.mockResolvedValueOnce({ count: 1 });
      await productBulkRoutes.POST(mockRequest({ action: "activate", ids: ["p-1"] }));
      expect(mockPrisma.activityLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: "BULK_ACTIVATE_PRODUCTS" }),
        }),
      );
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Products Import
// ═══════════════════════════════════════════════════════════════════════════

describe("Products Import", () => {
  describe("authorization", () => {
    it("returns 403 when permission denied", async () => {
      mockRequirePermission.mockResolvedValue(permissionDenied());
      const res = await productImportRoutes.POST(
        mockRequest({ rows: [{ name: "X", price: "10" }] }),
      );
      expect(res.status).toBe(403);
    });
  });

  describe("POST", () => {
    it("returns 400 when no rows provided", async () => {
      const res = await productImportRoutes.POST(mockRequest({}));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("No rows");
    });

    it("returns 400 when rows exceed 500", async () => {
      const rows = Array.from({ length: 501 }, (_, i) => ({ name: `P${i}`, price: "10" }));
      const res = await productImportRoutes.POST(mockRequest({ rows }));
      expect(res.status).toBe(400);
    });

    it("skips rows without name or invalid price", async () => {
      const res = await productImportRoutes.POST(
        mockRequest({
          rows: [
            { name: "Valid", price: "19.99" },
            { name: "", price: "10" }, // missing name
            { name: "NoPrice" }, // missing price
          ],
        }),
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.imported).toBe(1);
      expect(body.skipped).toHaveLength(2);
    });

    it("creates products with existing categories", async () => {
      const res = await productImportRoutes.POST(
        mockRequest({
          rows: [
            { name: "Widget", price: "29.99", stock: "50", sku: "W-1", category: "Electronics" },
          ],
        }),
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.imported).toBe(1);
      expect(mockPrisma.product.create).toHaveBeenCalled();
    });

    it("creates new category when category doesn't exist", async () => {
      mockPrisma.productCategory.findMany.mockResolvedValueOnce([]);
      mockPrisma.productCategory.create.mockResolvedValueOnce({
        id: "cat-new",
        name: "NewCat",
        slug: "newcat",
      });

      const res = await productImportRoutes.POST(
        mockRequest({
          rows: [{ name: "Gadget", price: "49.99", category: "NewCat" }],
        }),
      );
      expect(res.status).toBe(200);
      expect(mockPrisma.productCategory.create).toHaveBeenCalled();
    });

    it("creates activity log after import", async () => {
      await productImportRoutes.POST(mockRequest({ rows: [{ name: "A", price: "10" }] }));
      expect(mockPrisma.activityLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: "IMPORT_PRODUCTS" }),
        }),
      );
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Security Audit Export
// ═══════════════════════════════════════════════════════════════════════════

describe("Security Audit Export", () => {
  describe("authorization", () => {
    it("returns 403 when permission denied", async () => {
      mockRequirePermission.mockResolvedValue(permissionDenied());
      const res = await securityAuditExportRoutes.GET(mockRequest());
      expect(res.status).toBe(403);
      expect(mockRequirePermission).toHaveBeenCalledWith("read", "settings", expect.anything());
    });
  });

  describe("GET", () => {
    it("returns JSON format by default", async () => {
      const res = await securityAuditExportRoutes.GET(mockRequest());
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.count).toBe(1);
      expect(body.events).toHaveLength(1);
      expect(body.events[0].eventType).toBe("LOGIN_SUCCESS");
    });

    it("returns NDJSON format when format=ndjson", async () => {
      const res = await securityAuditExportRoutes.GET(mockRequest(undefined, "format=ndjson"));
      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toContain("LOGIN_SUCCESS");
      expect(res.headers.get("content-type")).toContain("ndjson");
    });

    it("returns CEF format when format=cef", async () => {
      const res = await securityAuditExportRoutes.GET(mockRequest(undefined, "format=cef"));
      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toContain("CEF:0");
      expect(text).toContain("LOGIN_SUCCESS");
      expect(res.headers.get("content-type")).toContain("text/plain");
    });

    it("respects limit query param", async () => {
      await securityAuditExportRoutes.GET(mockRequest(undefined, "limit=500"));
      expect(mockPrisma.securityEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 500 }),
      );
    });

    it("clamps limit to max 5000", async () => {
      await securityAuditExportRoutes.GET(mockRequest(undefined, "limit=99999"));
      expect(mockPrisma.securityEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 5000 }),
      );
    });

    it("returns empty events array when no events exist", async () => {
      mockPrisma.securityEvent.findMany.mockResolvedValueOnce([]);
      const res = await securityAuditExportRoutes.GET(mockRequest());
      const body = await res.json();
      expect(body.count).toBe(0);
      expect(body.events).toEqual([]);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Security Audit Verify
// ═══════════════════════════════════════════════════════════════════════════

describe("Security Audit Verify", () => {
  describe("authorization", () => {
    it("returns 403 when permission denied", async () => {
      mockRequirePermission.mockResolvedValue(permissionDenied());
      const res = await securityAuditVerifyRoutes.GET(mockRequest());
      expect(res.status).toBe(403);
    });
  });

  describe("GET", () => {
    it("returns 200 when chain is intact", async () => {
      const { verifyAuditChain } = await import("@/lib/audit-chain");
      (verifyAuditChain as any).mockResolvedValueOnce({
        ok: true,
        total: 10,
        verified: 10,
        firstBreakSeq: null,
        breaks: [],
      });
      const res = await securityAuditVerifyRoutes.GET(mockRequest());
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);
      expect(body.total).toBe(10);
      expect(body.verified).toBe(10);
    });

    it("returns 409 when chain has breaks", async () => {
      const { verifyAuditChain } = await import("@/lib/audit-chain");
      (verifyAuditChain as any).mockResolvedValueOnce({
        ok: false,
        total: 10,
        verified: 8,
        firstBreakSeq: 9,
        breaks: [{ seq: 9, id: "se-9", reason: "content hash mismatch" }],
      });
      const res = await securityAuditVerifyRoutes.GET(mockRequest());
      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.ok).toBe(false);
      expect(body.breaks).toHaveLength(1);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Billing Invoices [id] Download
// ═══════════════════════════════════════════════════════════════════════════

describe("Billing Invoices [id] Download", () => {
  const params = { params: Promise.resolve({ id: "inv-1" }) };

  describe("authorization", () => {
    it("returns 401 when not authenticated", async () => {
      mockRequireAuth.mockResolvedValueOnce({
        session: null,
        response: new Response("Unauthorized", { status: 401 }),
      });
      const res = await invoiceDownloadRoutes.GET(mockRequest(), params);
      expect(res.status).toBe(401);
    });
  });

  describe("GET", () => {
    it("returns HTML invoice for valid invoice", async () => {
      const res = await invoiceDownloadRoutes.GET(mockRequest(), params);
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain("INV-001");
      expect(html).toContain("Starter");
      expect(html).toContain("INVOICE");
      expect(html).toContain("Next");
      expect(html).toContain("Dashboard");
      expect(res.headers.get("content-type")).toContain("text/html");
    });

    it("returns 404 when invoice not found", async () => {
      mockPrisma.invoice.findUnique.mockResolvedValueOnce(null);
      const res = await invoiceDownloadRoutes.GET(mockRequest(), params);
      expect(res.status).toBe(404);
    });

    it("returns 404 when invoice belongs to different user", async () => {
      mockPrisma.invoice.findUnique.mockResolvedValueOnce({
        id: "inv-other",
        userId: "other-user",
        invoiceNumber: "INV-999",
        amount: 100,
        status: "PAID",
        currency: "USD",
        createdAt: new Date(),
        paidAt: null,
        periodStart: null,
        periodEnd: null,
        paymentMethod: null,
        description: null,
        plan: { name: "Pro", interval: "MONTHLY" },
        user: { name: "Other", email: "other@test.com" },
      });
      const res = await invoiceDownloadRoutes.GET(mockRequest(), params);
      expect(res.status).toBe(404);
    });

    it("includes correct status color for PAID invoices", async () => {
      const res = await invoiceDownloadRoutes.GET(mockRequest(), params);
      const html = await res.text();
      expect(html).toContain("#059669"); // green for PAID
    });

    it("includes OVERDUE color for overdue invoices", async () => {
      mockPrisma.invoice.findUnique.mockResolvedValueOnce({
        id: "inv-overdue",
        userId: "user-1",
        invoiceNumber: "INV-OV",
        amount: 50,
        status: "OVERDUE",
        currency: "USD",
        createdAt: new Date(),
        paidAt: null,
        periodStart: null,
        periodEnd: null,
        paymentMethod: null,
        description: null,
        plan: { name: "Pro", interval: "MONTHLY" },
        user: { name: "Test", email: "test@test.com" },
      });
      const res = await invoiceDownloadRoutes.GET(mockRequest(), {
        params: Promise.resolve({ id: "inv-overdue" }),
      });
      const html = await res.text();
      expect(html).toContain("#dc2626"); // red for OVERDUE
    });

    it("includes payment method when available", async () => {
      const res = await invoiceDownloadRoutes.GET(mockRequest(), params);
      const html = await res.text();
      expect(html).toContain("Payment Method");
      expect(html).toContain("stripe");
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// v1/whoami
// ═══════════════════════════════════════════════════════════════════════════

describe("v1/whoami", () => {
  describe("GET", () => {
    it("returns 401 when API key is missing", async () => {
      mockVerifyApiKey.mockResolvedValueOnce({ ok: false, status: 401, error: "Missing API key" });
      const res = await whoamiRoutes.GET(mockRequest());
      expect(res.status).toBe(401);
    });

    it("returns 401 when API key is invalid", async () => {
      mockVerifyApiKey.mockResolvedValueOnce({ ok: false, status: 401, error: "Invalid API key" });
      const res = await whoamiRoutes.GET(mockRequest());
      expect(res.status).toBe(401);
    });

    it("returns 403 when API key is revoked", async () => {
      mockVerifyApiKey.mockResolvedValueOnce({ ok: false, status: 403, error: "API key revoked" });
      const res = await whoamiRoutes.GET(mockRequest());
      expect(res.status).toBe(403);
    });

    it("returns authenticated user info with valid API key", async () => {
      mockVerifyApiKey.mockResolvedValueOnce({
        ok: true,
        userId: "user-1",
        permissions: "read",
        keyId: "ak-1",
      });
      const res = await whoamiRoutes.GET(mockRequest());
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.authenticated).toBe(true);
      expect(body.keyId).toBe("ak-1");
      expect(body.scopes).toBe("read");
      expect(body.user.name).toBe("Test User");
      expect(body.user.email).toBe("test@example.com");
      expect(body.user.role).toBe("ADMIN");
    });

    it("returns null user when userId is null (system key)", async () => {
      mockVerifyApiKey.mockResolvedValueOnce({
        ok: true,
        userId: null,
        permissions: "read",
        keyId: "ak-system",
      });
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);

      const res = await whoamiRoutes.GET(mockRequest());
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.authenticated).toBe(true);
      expect(body.user).toBeNull();
    });

    it("calls verifyApiKey with 'read' scope", async () => {
      mockVerifyApiKey.mockResolvedValueOnce({ ok: false, status: 401, error: "Missing API key" });
      await whoamiRoutes.GET(mockRequest());
      expect(mockVerifyApiKey).toHaveBeenCalledWith(expect.anything(), "read");
    });
  });
});
