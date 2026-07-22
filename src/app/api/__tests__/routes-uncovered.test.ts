import { describe, it, expect, vi, beforeEach } from "vitest";

// ═══════════════════════════════════════════════════════════════════════════
// Hoisted mocks
// ═══════════════════════════════════════════════════════════════════════════

const {
  mockGetSession,
  mockPrisma,
  mockRequirePermission,
  mockRequireAuth,
  mockFormatDateTime,
} = vi.hoisted(() => {
  /** Proxy-based model helper: returns overrides or default vi.fn */
  const model = <T extends Record<string, unknown>>(
    overrides: Partial<T> = {}
  ) =>
    new Proxy<T>({} as T, {
      get(_, prop) {
        const key = String(prop);
        return (
          (overrides as any)[key] ??
          vi.fn().mockImplementation(() => Promise.resolve(null))
        );
      },
    });

  /** Create a base subscription object shared across findUnique, upsert, and update mocks */
  const createMockSubscription = (
    overrides: Record<string, unknown> = {}
  ): Record<string, unknown> => ({
    id: "sub-1",
    userId: "u-1",
    planId: "plan-1",
    status: "ACTIVE",
    cancelAtPeriodEnd: false,
    plan: { id: "plan-1", name: "Starter", price: 29 },
    ...overrides,
  });

  /** Create a base webhook endpoint object shared across findMany, findUnique, create, and update mocks */
  const createMockWebhookEndpoint = (
    overrides: Record<string, unknown> = {}
  ): Record<string, unknown> => ({
    id: "wh-1",
    name: "Order Notifier",
    url: "https://example.com/webhook",
    status: "ACTIVE",
    subscribedEvents: ["order.created", "order.updated"],
    secret: "sec-123",
    ...overrides,
  });

  /** Create a base notification object shared across findMany, create, and update mocks */
  const createMockNotification = (
    overrides: Record<string, unknown> = {}
  ): Record<string, unknown> => ({
    id: "notif-1",
    type: "order",
    title: "New Order",
    read: false,
    ...overrides,
  });

  /** Create a base role setting object shared across findMany, update, and upsert mocks */
  const createMockRoleSetting = (
    overrides: Record<string, unknown> = {}
  ): Record<string, unknown> => ({
    id: "rs-1",
    role: "ADMIN",
    resource: "dashboard",
    action: "access",
    allowed: true,
    ...overrides,
  });

  /** Create a base invoice object shared across findMany items */
  const createMockInvoice = (
    overrides: Record<string, unknown> = {}
  ): Record<string, unknown> => ({
    id: "inv-1",
    invoiceNumber: "INV-001",
    amount: 29,
    status: "PAID",
    currency: "USD",
    plan: { name: "Starter" },
    createdAt: new Date("2024-06-01"),
    ...overrides,
  });

  /** Create a base webhook delivery object shared across findMany and create mocks */
  const createMockWebhookDelivery = (
    overrides: Record<string, unknown> = {}
  ): Record<string, unknown> => ({
    id: "wd-1",
    endpointId: "wh-1",
    event: "order.created",
    status: "DELIVERED",
    statusCode: 200,
    durationMs: 150,
    ...overrides,
  });

  /** Create a base notification preference object shared across findUnique and upsert mocks */
  const createMockNotificationPreference = (
    overrides: Record<string, unknown> = {}
  ): Record<string, unknown> => ({
    id: "np-1",
    userId: "u-1",
    emailOnOrder: true,
    emailOnCustomer: true,
    emailOnProduct: true,
    emailOnRevenue: true,
    emailOnInventory: true,
    emailOnDiscount: true,
    emailOnCampaign: true,
    emailOnAlert: true,
    lowStockThreshold: 10,
    pendingOrderThreshold: 5,
    campaignBudgetPercent: 80,
    inAppOnOrder: true,
    inAppOnCustomer: true,
    inAppOnProduct: true,
    inAppOnRevenue: true,
    inAppOnInventory: true,
    inAppOnDiscount: true,
    inAppOnCampaign: true,
    inAppOnAlert: true,
    ...overrides,
  });

  /** Deep model helper (for models with nested relation access) */
  const deepModel = <T extends Record<string, unknown>>(
    overrides: Partial<T> = {}
  ) =>
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
      upsert: vi.fn().mockResolvedValue({}),
      groupBy: vi.fn().mockResolvedValue([]),
      aggregate: vi.fn().mockResolvedValue({
        _sum: { grandTotal: 0, amount: 0 },
        _count: 0,
      }),
      ...overrides,
    });

  return {
    mockGetSession: vi.fn<() => Promise<unknown>>(),

    mockRequirePermission: vi.fn<
      (
        action: string,
        resource: string
      ) => Promise<{ role: string | null; response: Response | null }>
    >(),

    mockRequireAuth: vi.fn<(req?: Request) => Promise<{ session: { user: { id: string; sub: string; name: string; email: string; role: string } }; response: Response | null }>>(),

    mockFormatDateTime: vi.fn<(d: Date) => string>(),

    mockPrisma: {
      apiKey: deepModel({
        findMany: vi.fn().mockResolvedValue([
          {
            id: "ak-1",
            name: "Production Key",
            prefix: "dash_a1b2c3...",
            permissions: "read",
            status: "ACTIVE",
            lastUsedAt: null,
            expiresAt: null,
            createdAt: new Date("2024-01-01"),
          },
        ]),
        create: vi.fn().mockResolvedValue({
          id: "ak-new",
          name: "New Key",
          prefix: "dash_new12...",
          permissions: "read",
          status: "ACTIVE",
          expiresAt: null,
          createdAt: new Date(),
        }),
        findUnique: vi.fn().mockResolvedValue({
          id: "ak-1",
          name: "Production Key",
          prefix: "dash_a1b2c3...",
        }),
        update: vi.fn().mockResolvedValue({
          id: "ak-1",
          name: "Production Key",
          status: "REVOKED",
        }),
        delete: vi.fn().mockResolvedValue({ id: "ak-1" }),
      }),

      plan: deepModel({
        findMany: vi.fn().mockResolvedValue([
          {
            id: "plan-1",
            name: "Starter",
            price: 29,
            yearlyPrice: 290,
            interval: "MONTHLY",
            features: ["api_access"],
            isActive: true,
            popular: false,
            sortOrder: 0,
            maxOrders: 100,
            maxTeamMembers: 3,
            hasAnalytics: false,
            hasReports: false,
            hasMultiChannel: false,
            hasApiAccess: true,
            hasRoleBasedAccess: false,
            supportLevel: "email",
          },
          {
            id: "plan-2",
            name: "Pro",
            price: 99,
            yearlyPrice: 990,
            interval: "MONTHLY",
            features: ["api_access", "analytics", "reports"],
            isActive: true,
            popular: true,
            sortOrder: 1,
            maxOrders: 1000,
            maxTeamMembers: 10,
            hasAnalytics: true,
            hasReports: true,
            hasMultiChannel: true,
            hasApiAccess: true,
            hasRoleBasedAccess: true,
            supportLevel: "priority",
          },
        ]),
        findUnique: vi.fn().mockResolvedValue({
          id: "plan-1",
          name: "Starter",
          price: 29,
          yearlyPrice: 290,
        }),
      }),

      subscription: deepModel({
        findUnique: vi.fn().mockResolvedValue({
          ...createMockSubscription(),
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 86400000),
        }),
        findFirst: vi.fn().mockResolvedValue(null),
        upsert: vi.fn().mockImplementation(({ create, update }) =>
          Promise.resolve({
            ...createMockSubscription({ id: create?.userId ? "sub-new" : "sub-1" }),
            currentPeriodStart: new Date(),
            currentPeriodEnd: new Date(Date.now() + 30 * 86400000),
            ...(update as Record<string, unknown>),
          })
        ),
        update: vi.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            ...createMockSubscription({ cancelAtPeriodEnd: true }),
            ...(data as Record<string, unknown>),
          })
        ),
      }),

      invoice: deepModel({
        findMany: vi.fn().mockResolvedValue([
          createMockInvoice(),
          createMockInvoice({
            id: "inv-2",
            invoiceNumber: "INV-002",
            amount: 99,
            status: "PENDING",
            plan: { name: "Pro" },
            createdAt: new Date("2024-07-01"),
          }),
        ]),
        aggregate: vi.fn().mockResolvedValue({
          _sum: { amount: 128 },
          _count: 2,
        }),
      }),

      notification: deepModel({
        findMany: vi.fn().mockResolvedValue([
          {
            ...createMockNotification(),
            description: "Order ORD-005 created",
            readAt: null,
            link: "/orders/ord-005",
            createdAt: new Date("2024-06-01"),
          },
        ]),
        count: vi.fn().mockResolvedValue(1),
        create: vi.fn().mockResolvedValue(
          createMockNotification({
            id: "notif-new",
            title: "Test Notification",
            description: "Test",
          })
        ),
        update: vi.fn().mockResolvedValue(
          createMockNotification({ read: true, readAt: new Date() })
        ),
        delete: vi.fn().mockResolvedValue({ id: "notif-1" }),
        groupBy: vi.fn().mockResolvedValue([
          { type: "order", read: false, _count: 1 },
        ]),
        updateMany: vi.fn().mockResolvedValue({ count: 3 }),
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      }),

      notificationPreference: deepModel({
        findUnique: vi.fn().mockResolvedValue(createMockNotificationPreference()),
        upsert: vi.fn().mockResolvedValue(
          createMockNotificationPreference({ emailOnOrder: false })
        ),
      }),

      roleSetting: deepModel({
        findMany: vi.fn().mockResolvedValue([
          createMockRoleSetting(),
          createMockRoleSetting({ id: "rs-2", role: "MANAGER" }),
        ]),
        update: vi.fn().mockResolvedValue(
          createMockRoleSetting({ allowed: false })
        ),
        upsert: vi.fn().mockResolvedValue(
          createMockRoleSetting({
            id: "rs-3",
            role: "STAFF",
            resource: "reports",
          })
        ),
        delete: vi.fn().mockResolvedValue({ id: "rs-1" }),
      }),

      user: deepModel({
        findMany: vi.fn().mockResolvedValue([
          {
            id: "u-1",
            name: "Admin",
            email: "admin@test.com",
            role: "ADMIN",
            isActive: true,
          },
        ]),
      }),

      webhookEndpoint: deepModel({
        findMany: vi.fn().mockResolvedValue([
          {
            ...createMockWebhookEndpoint(),
            _count: { deliveries: 5 },
          },
        ]),
        findUnique: vi.fn().mockResolvedValue(createMockWebhookEndpoint()),
        create: vi.fn().mockResolvedValue(
          createMockWebhookEndpoint({
            id: "wh-new",
            name: "New Webhook",
            url: "https://example.com/new-webhook",
            subscribedEvents: ["order.created"],
            secret: "new-secret-456",
          })
        ),
        update: vi.fn().mockImplementation(({ where, data }) =>
          Promise.resolve({
            ...createMockWebhookEndpoint({
              name: "Order Notifier Updated",
              status: "PAUSED",
            }),
            ...(data as Record<string, unknown>),
          })
        ),
        delete: vi.fn().mockResolvedValue({ id: "wh-1" }),
      }),

      webhookDelivery: deepModel({
        findMany: vi.fn().mockResolvedValue([
          {
            ...createMockWebhookDelivery(),
            response: "OK",
            endpoint: {
              name: "Order Notifier",
              url: "https://example.com/webhook",
            },
            createdAt: new Date(),
          },
        ]),
        create: vi.fn().mockResolvedValue(
          createMockWebhookDelivery({
            id: "wd-new",
            event: "test.ping",
            durationMs: 100,
          })
        ),
      }),

      auditLog: deepModel({
        create: vi.fn().mockResolvedValue({ id: "audit-new" }),
      }),

      activityLog: deepModel({
        create: vi.fn().mockResolvedValue({ id: "log-new" }),
      }),

      product: deepModel({
        count: vi.fn().mockResolvedValue(42),
        findMany: vi.fn().mockResolvedValue([]),
      }),

      order: deepModel({
        aggregate: vi.fn().mockResolvedValue({ _sum: { grandTotal: 50000 } }),
        count: vi.fn().mockResolvedValue(100),
        findMany: vi.fn().mockResolvedValue([]),
      }),

      customer: deepModel({
        count: vi.fn().mockResolvedValue(50),
      }),

      campaign: deepModel({
        count: vi.fn().mockResolvedValue(3),
        findMany: vi.fn().mockResolvedValue([]),
      }),

      discount: deepModel({
        count: vi.fn().mockResolvedValue(5),
        findMany: vi.fn().mockResolvedValue([]),
      }),

      salesChannel: deepModel({
        findMany: vi.fn().mockResolvedValue([]),
      }),
    },
  };
});

// ═══════════════════════════════════════════════════════════════════════════
// Module mocks
// ═══════════════════════════════════════════════════════════════════════════

vi.mock("@/lib/api-guard", () => ({
  requirePermission: mockRequirePermission,
  requireAuth: mockRequireAuth,
}));

vi.mock("@/lib/auth0", () => ({
  auth0: { getSession: mockGetSession },
}));

vi.mock("@/lib/db", () => ({
  prisma: mockPrisma,
}));

vi.mock("@/lib/utils", () => ({
  formatDateTime: mockFormatDateTime,
}));

// Crypto mock — used by api-keys and webhooks routes
// Mock returns the exports directly (vitest handles CJS→ESM default export wrapping)
vi.mock("crypto", () => {
  const hashUpdate = vi.fn().mockReturnThis();
  const hashDigest = vi.fn().mockReturnValue("hashed-key-output");
  const hmacUpdate = vi.fn().mockReturnThis();
  const hmacDigest = vi.fn().mockReturnValue("hmac-signature-output");

  const createHash = vi.fn(() => ({
    update: hashUpdate,
    digest: hashDigest,
  }));

  const createHmac = vi.fn(() => ({
    update: hmacUpdate,
    digest: hmacDigest,
  }));

  const randomBytes = vi.fn((size: number) =>
    Buffer.from("a".repeat(size))
  );

  return {
    default: { randomBytes, createHash, createHmac },
    randomBytes,
    createHash,
    createHmac,
  };
});

// ═══════════════════════════════════════════════════════════════════════════
// Imports under test
// ═══════════════════════════════════════════════════════════════════════════

import * as apiKeysRoutes from "../api-keys/route";
import * as billingInvoicesRoutes from "../billing/invoices/route";
import * as billingPlansRoutes from "../billing/plans/route";
import * as billingSubscriptionRoutes from "../billing/subscription/route";
import * as notificationsRoutes from "../notifications/route";
import * as notificationsBatchRoutes from "../notifications/batch/route";
import * as notificationsPreferencesRoutes from "../notifications/preferences/route";
import * as rolesRoutes from "../roles/route";
import * as webhooksRoutes from "../webhooks/route";
import * as webhookDeliveriesRoutes from "../webhooks/deliveries/route";
import * as webhookTestRoutes from "../webhooks/test/route";

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest } from "next/server";

function mockRequest(body?: unknown, queryString = ""): NextRequest {
  return {
    json: () => Promise.resolve(body ?? {}),
    url: `http://localhost:3000/api/test${queryString ? `?${queryString}` : ""}`,
  } as NextRequest;
}

function permissionDenied(): {
  role: null;
  response: Response;
} {
  return {
    role: null,
    response: new Response(
      JSON.stringify({ error: "Forbidden: insufficient permissions" }),
      { status: 403 }
    ),
  };
}

function permissionGranted(role = "ADMIN"): {
  role: string;
  response: null;
} {
  return { role, response: null };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSession.mockResolvedValue({
    user: {
      sub: "u-1",
      id: "u-1",
      name: "Test User",
      email: "test@example.com",
      role: "ADMIN",
    },
  });
  // Override user.findFirst — needed by billing subscription routes which
  // resolve the real admin user via prisma.user.findFirst({ where: { role: "ADMIN" } })
  mockPrisma.user.findFirst.mockResolvedValue({ id: "admin-1" });
  mockRequirePermission.mockResolvedValue(permissionGranted());
  mockRequireAuth.mockResolvedValue({
    session: {
      user: { id: "mock-admin-user", sub: "mock-admin-user", name: "Admin", email: "admin@dashboard.com", role: "ADMIN" },
    },
    response: null,
  });
  mockFormatDateTime.mockReturnValue("June 1, 2024, 12:00 PM");
});

// ═══════════════════════════════════════════════════════════════════════════
// API Keys (ADMIN-only via requirePermission("integrations"))
// ═══════════════════════════════════════════════════════════════════════════

describe("API Keys", () => {
  describe("authorization", () => {
    it("GET returns 403 when requirePermission denies", async () => {
      mockRequirePermission.mockResolvedValue(permissionDenied());
      const res = await apiKeysRoutes.GET(mockRequest());
      expect(res.status).toBe(403);
      expect(mockRequirePermission).toHaveBeenCalledWith("read", "integrations", expect.anything());
    });

    it("POST returns 403 when requirePermission denies", async () => {
      mockRequirePermission.mockResolvedValue(permissionDenied());
      const res = await apiKeysRoutes.POST(mockRequest({ name: "Key" }));
      expect(res.status).toBe(403);
    });

    it("PUT returns 403 when requirePermission denies", async () => {
      mockRequirePermission.mockResolvedValue(permissionDenied());
      const res = await apiKeysRoutes.PUT(mockRequest({ id: "ak-1", status: "REVOKED" }));
      expect(res.status).toBe(403);
    });

    it("DELETE returns 403 when requirePermission denies", async () => {
      mockRequirePermission.mockResolvedValue(permissionDenied());
      const res = await apiKeysRoutes.DELETE(mockRequest({ id: "ak-1" }));
      expect(res.status).toBe(403);
    });
  });

  describe("GET", () => {
    it("returns all API keys with selected fields", async () => {
      const res = await apiKeysRoutes.GET(mockRequest());
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toHaveLength(1);
      expect(body[0].name).toBe("Production Key");
      expect(body[0].prefix).toBe("dash_a1b2c3...");
      // Sensitive field should not be included in list
      expect(body[0].key).toBeUndefined();
    });
  });

  describe("POST", () => {
    it("returns 400 when name is missing", async () => {
      const res = await apiKeysRoutes.POST(mockRequest({}));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("required");
    });

    it("creates an API key and returns the raw key on creation", async () => {
      const res = await apiKeysRoutes.POST(
        mockRequest({ name: "My Key", permissions: "read" })
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.name).toBe("New Key");
      expect(body.key).toBeDefined(); // raw key returned on creation
      expect(mockPrisma.apiKey.create).toHaveBeenCalled();
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: "CREATE_API_KEY" }),
        })
      );
    });

    it("creates with default permissions when not specified", async () => {
      await apiKeysRoutes.POST(mockRequest({ name: "Read Only" }));
      expect(mockPrisma.apiKey.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ permissions: "read" }),
        })
      );
    });
  });

  describe("PUT", () => {
    it("returns 400 when id or status missing", async () => {
      const res = await apiKeysRoutes.PUT(mockRequest({ id: "ak-1" }));
      expect(res.status).toBe(400);
    });

    it("revokes an API key", async () => {
      const res = await apiKeysRoutes.PUT(
        mockRequest({ id: "ak-1", status: "REVOKED" })
      );
      expect(res.status).toBe(200);
      expect(mockPrisma.apiKey.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "ak-1" },
          data: { status: "REVOKED" },
        })
      );
      expect(mockPrisma.auditLog.create).toHaveBeenCalled();
    });
  });

  describe("DELETE", () => {
    it("returns 400 when id missing", async () => {
      const res = await apiKeysRoutes.DELETE(mockRequest({}));
      expect(res.status).toBe(400);
    });

    it("returns 404 when key not found", async () => {
      mockPrisma.apiKey.findUnique.mockResolvedValueOnce(null);
      const res = await apiKeysRoutes.DELETE(mockRequest({ id: "ak-unknown" }));
      expect(res.status).toBe(404);
    });

    it("deletes an API key and logs audit", async () => {
      const res = await apiKeysRoutes.DELETE(mockRequest({ id: "ak-1" }));
      expect(res.status).toBe(200);
      expect(mockPrisma.apiKey.delete).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "ak-1" } })
      );
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: "DELETE_API_KEY" }),
        })
      );
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Billing Plans (public, no auth)
// ═══════════════════════════════════════════════════════════════════════════

describe("Billing Plans (public, no auth guard)", () => {    it("returns active plans sorted by sortOrder", async () => {
      const res = await billingPlansRoutes.GET();
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toHaveLength(2);
      // Plan 1: Starter
      expect(body[0].id).toBe("plan-1");
      expect(body[0].name).toBe("Starter");
      expect(body[0].price).toBe(29);
      expect(body[0].yearlyPrice).toBe(290);
      expect(body[0].interval).toBe("MONTHLY");
      expect(body[0].sortOrder).toBe(0);
      expect(body[0].features).toEqual(["api_access"]);
      expect(body[0].supportLevel).toBe("email");
      expect(body[0].maxOrders).toBe(100);
      expect(body[0].maxTeamMembers).toBe(3);
      expect(body[0].hasAnalytics).toBe(false);
      expect(body[0].hasApiAccess).toBe(true);
      // Plan 2: Pro
      expect(body[1].id).toBe("plan-2");
      expect(body[1].name).toBe("Pro");
      expect(body[1].price).toBe(99);
      expect(body[1].yearlyPrice).toBe(990);
      expect(body[1].interval).toBe("MONTHLY");
      expect(body[1].sortOrder).toBe(1);
      expect(body[1].features).toEqual(["api_access", "analytics", "reports"]);
      expect(body[1].supportLevel).toBe("priority");
      expect(body[1].maxOrders).toBe(1000);
      expect(body[1].maxTeamMembers).toBe(10);
      expect(body[1].hasReports).toBe(true);
      expect(body[1].popular).toBe(true);
      // Does NOT call requirePermission
      expect(mockRequirePermission).not.toHaveBeenCalled();
    });

  it("only queries active plans", async () => {
    await billingPlansRoutes.GET();
    expect(mockPrisma.plan.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isActive: true },
      })
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Billing Invoices (requirePermission("billing"))
// ═══════════════════════════════════════════════════════════════════════════

describe("Billing Invoices", () => {
  it("returns 403 when requirePermission denies", async () => {
    mockRequirePermission.mockResolvedValue(permissionDenied());
    const res = await billingInvoicesRoutes.GET(mockRequest());
    expect(res.status).toBe(403);
    expect(mockRequirePermission).toHaveBeenCalledWith("read", "billing", expect.anything());
  });    it("returns invoices with totals", async () => {
      const res = await billingInvoicesRoutes.GET(mockRequest());
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.invoices).toHaveLength(2);
      // Invoice 1
      expect(body.invoices[0].id).toBe("inv-1");
      expect(body.invoices[0].invoiceNumber).toBe("INV-001");
      expect(body.invoices[0].amount).toBe(29);
      expect(body.invoices[0].status).toBe("PAID");
      expect(body.invoices[0].currency).toBe("USD");
      expect(body.invoices[0].plan.name).toBe("Starter");
      expect(body.invoices[0].createdAt).toBeDefined();
      // Invoice 2
      expect(body.invoices[1].id).toBe("inv-2");
      expect(body.invoices[1].invoiceNumber).toBe("INV-002");
      expect(body.invoices[1].amount).toBe(99);
      expect(body.invoices[1].status).toBe("PENDING");
      expect(body.invoices[1].currency).toBe("USD");
      expect(body.invoices[1].plan.name).toBe("Pro");
      expect(body.invoices[1].createdAt).toBeDefined();
      // Totals
      expect(body.totals.totalPaid).toBe(128);
      expect(body.totals.totalInvoices).toBe(2);
    });

  it("respects limit query param up to 100", async () => {
    await billingInvoicesRoutes.GET(mockRequest(undefined, "limit=10"));
    expect(mockPrisma.invoice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 10 })
    );
  });

  it("clamps limit to max 100", async () => {
    await billingInvoicesRoutes.GET(mockRequest(undefined, "limit=999"));
    expect(mockPrisma.invoice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 100 })
    );
  });    it("filters by userId when session user is available", async () => {
      await billingInvoicesRoutes.GET(mockRequest());
      expect(mockPrisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: "mock-admin-user" },
        })
      );
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// Billing Subscription (requirePermission("billing"))
// ═══════════════════════════════════════════════════════════════════════════

describe("Billing Subscription", () => {
  describe("authorization", () => {
    it("GET returns 403 when requirePermission denies", async () => {
      mockRequirePermission.mockResolvedValue(permissionDenied());
      const res = await billingSubscriptionRoutes.GET(mockRequest());
      expect(res.status).toBe(403);
    });

    it("POST returns 403 when requirePermission denies", async () => {
      mockRequirePermission.mockResolvedValue(permissionDenied());
      const res = await billingSubscriptionRoutes.POST(
        mockRequest({ planId: "plan-1" })
      );
      expect(res.status).toBe(403);
    });

    it("PUT returns 403 when requirePermission denies", async () => {
      mockRequirePermission.mockResolvedValue(permissionDenied());
      const res = await billingSubscriptionRoutes.PUT(
        mockRequest({ action: "cancel" })
      );
      expect(res.status).toBe(403);
    });
  });

  describe("GET", () => {
    it("returns subscription with plan data", async () => {
      const res = await billingSubscriptionRoutes.GET(mockRequest());
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.subscription).not.toBeNull();
      expect(body.subscription.id).toBe("sub-1");
      expect(body.subscription.userId).toBe("u-1");
      expect(body.subscription.planId).toBe("plan-1");
      expect(body.subscription.status).toBe("ACTIVE");
      expect(body.subscription.cancelAtPeriodEnd).toBe(false);
      expect(body.subscription.plan.id).toBe("plan-1");
      expect(body.subscription.plan.name).toBe("Starter");
      expect(body.subscription.plan.price).toBe(29);
      expect(body.subscription.currentPeriodStart).toBeDefined();
      expect(body.subscription.currentPeriodEnd).toBeDefined();
    });

    it("falls back to admin subscription when user subscription not found", async () => {
      mockPrisma.subscription.findUnique.mockResolvedValueOnce(null);
      mockPrisma.subscription.findFirst.mockResolvedValueOnce({
        id: "sub-admin",
        userId: "u-admin",
        planId: "plan-2",
        status: "ACTIVE",
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 86400000),
        cancelAtPeriodEnd: false,
        plan: { id: "plan-2", name: "Pro", price: 99 },
      });
      const res = await billingSubscriptionRoutes.GET(mockRequest());
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.subscription.id).toBe("sub-admin");
      expect(body.subscription.userId).toBe("u-admin");
      expect(body.subscription.planId).toBe("plan-2");
      expect(body.subscription.status).toBe("ACTIVE");
      expect(body.subscription.cancelAtPeriodEnd).toBe(false);
      expect(body.subscription.plan.id).toBe("plan-2");
      expect(body.subscription.plan.name).toBe("Pro");
      expect(body.subscription.plan.price).toBe(99);
      expect(body.subscription.currentPeriodStart).toBeDefined();
      expect(body.subscription.currentPeriodEnd).toBeDefined();
    });

    it("returns success even when no subscription exists", async () => {
      mockPrisma.subscription.findUnique.mockResolvedValueOnce(null);
      mockPrisma.subscription.findFirst.mockResolvedValueOnce(null);
      const res = await billingSubscriptionRoutes.GET(mockRequest());
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.subscription).toBeNull();
    });
  });

  describe("POST", () => {
    it("returns 400 when planId missing", async () => {
      const res = await billingSubscriptionRoutes.POST(mockRequest({}));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("Plan ID");
    });

    it("returns 404 when plan not found", async () => {
      mockPrisma.plan.findUnique.mockResolvedValueOnce(null);
      const res = await billingSubscriptionRoutes.POST(
        mockRequest({ planId: "plan-unknown" })
      );
      expect(res.status).toBe(404);
      expect(mockPrisma.plan.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "plan-unknown" } })
      );
    });

    it("creates or updates subscription and generates invoice", async () => {
      const res = await billingSubscriptionRoutes.POST(
        mockRequest({ planId: "plan-1" })
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      // Response is the upserted subscription with plan included
      expect(body.id).toBe("sub-new"); // from create.userId being truthy
      expect(body.status).toBe("ACTIVE");
      expect(body.planId).toBe("plan-1");
      expect(body.cancelAtPeriodEnd).toBe(false);
      expect(body.plan).toBeDefined();
      expect(body.plan.id).toBe("plan-1");
      expect(body.plan.name).toBe("Starter");
      expect(body.plan.price).toBe(29);
      expect(body.currentPeriodStart).toBeDefined();
      expect(body.currentPeriodEnd).toBeDefined();
      expect(mockPrisma.subscription.upsert).toHaveBeenCalled();
      expect(mockPrisma.invoice.create).toHaveBeenCalled();
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: "UPDATE_SUBSCRIPTION" }),
        })
      );
    });
  });

  describe("PUT", () => {
    it("returns 400 when action is missing or invalid", async () => {
      const res = await billingSubscriptionRoutes.PUT(mockRequest({}));
      expect(res.status).toBe(400);
    });

    it("returns 400 for invalid action", async () => {
      const res = await billingSubscriptionRoutes.PUT(
        mockRequest({ action: "invalid" })
      );
      expect(res.status).toBe(400);
    });

    it("returns 404 when no subscription found", async () => {
      mockPrisma.subscription.findUnique.mockResolvedValueOnce(null);
      const res = await billingSubscriptionRoutes.PUT(
        mockRequest({ action: "cancel" })
      );
      expect(res.status).toBe(404);
    });

    it("cancels subscription at period end", async () => {
      const res = await billingSubscriptionRoutes.PUT(
        mockRequest({ action: "cancel" })
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.id).toBe("sub-1");
      expect(body.cancelAtPeriodEnd).toBe(true);
      expect(body.status).toBe("ACTIVE");
      expect(body.plan).toBeDefined();
      expect(body.plan.name).toBe("Starter");
      expect(body.plan.price).toBe(29);
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: "CANCEL_SUBSCRIPTION" }),
        })
      );
    });

    it("reactivates cancelled subscription", async () => {
      const res = await billingSubscriptionRoutes.PUT(
        mockRequest({ action: "reactivate" })
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.id).toBe("sub-1");
      expect(body.cancelAtPeriodEnd).toBe(false);
      expect(body.status).toBe("ACTIVE");
      expect(body.plan).toBeDefined();
      expect(body.plan.name).toBe("Starter");
      expect(body.plan.price).toBe(29);
      expect(mockPrisma.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: "admin-1" },
          data: { cancelAtPeriodEnd: false },
        })
      );
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Notifications
// ═══════════════════════════════════════════════════════════════════════════

describe("Notifications API", () => {
  describe("authorization", () => {
    it("GET returns 403 when requirePermission denies", async () => {
      mockRequirePermission.mockResolvedValue(permissionDenied());
      const res = await notificationsRoutes.GET(mockRequest());
      expect(res.status).toBe(403);
      expect(mockRequirePermission).toHaveBeenCalledWith("read", "notifications", expect.anything());
    });

    it("POST returns 403 when requirePermission denies", async () => {
      mockRequirePermission.mockResolvedValue(permissionDenied());
      const res = await notificationsRoutes.POST(
        mockRequest({ type: "order", title: "Test" })
      );
      expect(res.status).toBe(403);
    });

    it("PUT returns 403 when requirePermission denies", async () => {
      mockRequirePermission.mockResolvedValue(permissionDenied());
      const res = await notificationsRoutes.PUT(
        mockRequest({ id: "notif-1", action: "mark-read" })
      );
      expect(res.status).toBe(403);
    });

    it("DELETE returns 403 when requirePermission denies", async () => {
      mockRequirePermission.mockResolvedValue(permissionDenied());
      const res = await notificationsRoutes.DELETE(mockRequest({ id: "notif-1" }));
      expect(res.status).toBe(403);
    });
  });

  describe("GET", () => {
    it("returns notifications with unread count and type counts", async () => {
      const res = await notificationsRoutes.GET(mockRequest());
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.notifications).toHaveLength(1);
      expect(body.notifications[0].title).toBe("New Order");
      expect(body.unreadCount).toBe(1);
      expect(body.typeCounts.order).toBeDefined();
      expect(body.typeCounts.order.unread).toBe(1);
    });

    it("filters by type when query param provided", async () => {
      await notificationsRoutes.GET(mockRequest(undefined, "type=order"));
      expect(mockPrisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ type: "order" }),
        })
      );
    });

    it("filters by read status", async () => {
      await notificationsRoutes.GET(mockRequest(undefined, "read=false"));
      expect(mockPrisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ read: false }),
        })
      );
    });
  });

  describe("POST", () => {
    it("returns 400 when type or title missing", async () => {
      const res = await notificationsRoutes.POST(mockRequest({ title: "Test" }));
      expect(res.status).toBe(400);
    });

    it("creates a notification with all fields", async () => {
      const res = await notificationsRoutes.POST(
        mockRequest({
          type: "order",
          title: "New Order #123",
          description: "Order received",
          link: "/orders/123",
        })
      );
      expect(res.status).toBe(200);
      expect(mockPrisma.notification.create).toHaveBeenCalled();
    });
  });

  describe("PUT", () => {
    it("returns 400 when id or action missing", async () => {
      const res = await notificationsRoutes.PUT(mockRequest({ id: "n-1" }));
      expect(res.status).toBe(400);
    });

    it("returns 400 for invalid action", async () => {
      const res = await notificationsRoutes.PUT(
        mockRequest({ id: "notif-1", action: "invalid" })
      );
      expect(res.status).toBe(400);
    });

    it("marks notification as read", async () => {
      const res = await notificationsRoutes.PUT(
        mockRequest({ id: "notif-1", action: "mark-read" })
      );
      expect(res.status).toBe(200);
      expect(mockPrisma.notification.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "notif-1" },
          data: expect.objectContaining({ read: true }),
        })
      );
    });

    it("marks notification as unread", async () => {
      const res = await notificationsRoutes.PUT(
        mockRequest({ id: "notif-1", action: "mark-unread" })
      );
      expect(res.status).toBe(200);
      expect(mockPrisma.notification.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "notif-1" },
          data: expect.objectContaining({ read: false, readAt: null }),
        })
      );
    });
  });

  describe("DELETE", () => {
    it("returns 400 when id missing and action not clear-all", async () => {
      const res = await notificationsRoutes.DELETE(mockRequest({}));
      expect(res.status).toBe(400);
    });

    it("deletes a single notification by id", async () => {
      const res = await notificationsRoutes.DELETE(
        mockRequest({ id: "notif-1" })
      );
      expect(res.status).toBe(200);
      expect(mockPrisma.notification.delete).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "notif-1" } })
      );
    });

    it("clears all notifications when action is clear-all", async () => {
      const res = await notificationsRoutes.DELETE(
        mockRequest({ action: "clear-all" })
      );
      expect(res.status).toBe(200);
      expect(mockPrisma.notification.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: "mock-admin-user" },
        })
      );
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Notifications Batch
// ═══════════════════════════════════════════════════════════════════════════

describe("Notifications Batch API", () => {
  it("returns 403 when requirePermission denies", async () => {
    mockRequirePermission.mockResolvedValue(permissionDenied());
    const res = await notificationsBatchRoutes.POST(
      mockRequest({ action: "mark-all-read" })
    );
    expect(res.status).toBe(403);
    expect(mockRequirePermission).toHaveBeenCalledWith("update", "notifications", expect.anything());
  });

  it("returns 400 for invalid action", async () => {
    const res = await notificationsBatchRoutes.POST(
      mockRequest({ action: "invalid" })
    );
    expect(res.status).toBe(400);
  });

  it("marks all notifications as read", async () => {
    const res = await notificationsBatchRoutes.POST(
      mockRequest({ action: "mark-all-read" })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.action).toBe("mark-all-read");
    expect(mockPrisma.notification.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "mock-admin-user", read: false },
      })
    );
  });

  it("deletes all read notifications", async () => {
    const res = await notificationsBatchRoutes.POST(
      mockRequest({ action: "delete-all-read" })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.action).toBe("delete-all-read");
    expect(mockPrisma.notification.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "mock-admin-user", read: true },
      })
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Notifications Preferences
// ═══════════════════════════════════════════════════════════════════════════

describe("Notifications Preferences API", () => {
  describe("authorization", () => {
    it("GET returns 403 when requirePermission denies", async () => {
      mockRequirePermission.mockResolvedValue(permissionDenied());
      const res = await notificationsPreferencesRoutes.GET(mockRequest());
      expect(res.status).toBe(403);
      expect(mockRequirePermission).toHaveBeenCalledWith("read", "notifications", expect.anything());
    });

    it("PUT returns 403 when requirePermission denies", async () => {
      mockRequirePermission.mockResolvedValue(permissionDenied());
      const res = await notificationsPreferencesRoutes.PUT(
        mockRequest({ emailOnOrder: false })
      );
      expect(res.status).toBe(403);
    });
  });

  describe("GET", () => {
    it("returns user notification preferences", async () => {
      const res = await notificationsPreferencesRoutes.GET(mockRequest());
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.preferences).not.toBeNull();
      expect(body.preferences.emailOnOrder).toBe(true);
    });

    it("returns null preferences when no user session", async () => {
      mockGetSession.mockResolvedValueOnce(null);
      mockPrisma.notificationPreference.findUnique.mockResolvedValueOnce(null);
      const res = await notificationsPreferencesRoutes.GET(mockRequest());
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.preferences).toBeNull();
    });
  });

  describe("PUT", () => {
    it("upserts notification preferences", async () => {
      const res = await notificationsPreferencesRoutes.PUT(
        mockRequest({ emailOnOrder: false })
      );
      expect(res.status).toBe(200);
      expect(mockPrisma.notificationPreference.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: "mock-admin-user" },
          update: { emailOnOrder: false },
        })
      );
    });

    it("returns 200 when no user session (auth is always granted)", async () => {
      mockGetSession.mockResolvedValueOnce(null);
      const res = await notificationsPreferencesRoutes.PUT(
        mockRequest({ emailOnOrder: false })
      );
      expect(res.status).toBe(200);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Roles (ADMIN-only via requirePermission("roles"))
// ═══════════════════════════════════════════════════════════════════════════

describe("Roles API", () => {
  describe("authorization", () => {
    it("GET returns 403 when requirePermission denies", async () => {
      mockRequirePermission.mockResolvedValue(permissionDenied());
      const res = await rolesRoutes.GET(mockRequest());
      expect(res.status).toBe(403);
      expect(mockRequirePermission).toHaveBeenCalledWith("read", "roles", expect.anything());
    });

    it("PUT returns 403 when requirePermission denies", async () => {
      mockRequirePermission.mockResolvedValue(permissionDenied());
      const res = await rolesRoutes.PUT(
        mockRequest({ id: "rs-1", allowed: false })
      );
      expect(res.status).toBe(403);
    });

    it("POST returns 403 when requirePermission denies", async () => {
      mockRequirePermission.mockResolvedValue(permissionDenied());
      const res = await rolesRoutes.POST(
        mockRequest({ role: "STAFF", resource: "reports", action: "access" })
      );
      expect(res.status).toBe(403);
    });

    it("DELETE returns 403 when requirePermission denies", async () => {
      mockRequirePermission.mockResolvedValue(permissionDenied());
      const res = await rolesRoutes.DELETE(mockRequest({ id: "rs-1" }));
      expect(res.status).toBe(403);
    });
  });

  describe("GET", () => {
    it("returns role settings and users list", async () => {
      const res = await rolesRoutes.GET(mockRequest());
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.roleSettings).toHaveLength(2);
      expect(body.users).toHaveLength(1);
      expect(body.users[0].name).toBe("Admin");
    });

    it("sorts role settings by role, resource, action", async () => {
      await rolesRoutes.GET(mockRequest());
      expect(mockPrisma.roleSetting.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ role: "asc" }, { resource: "asc" }, { action: "asc" }],
        })
      );
    });
  });

  describe("PUT", () => {
    it("returns 400 when id or allowed missing", async () => {
      const res = await rolesRoutes.PUT(mockRequest({ id: "rs-1" }));
      expect(res.status).toBe(400);
    });

    it("updates permission and logs audit", async () => {
      const res = await rolesRoutes.PUT(
        mockRequest({ id: "rs-1", allowed: false })
      );
      expect(res.status).toBe(200);
      expect(mockPrisma.roleSetting.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "rs-1" },
          data: { allowed: false },
        })
      );
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: "UPDATE_ROLE_PERMISSION" }),
        })
      );
    });
  });

  describe("POST", () => {
    it("returns 400 when required fields missing", async () => {
      const res = await rolesRoutes.POST(mockRequest({ role: "STAFF" }));
      expect(res.status).toBe(400);
    });

    it("creates or upserts a role permission setting", async () => {
      const res = await rolesRoutes.POST(
        mockRequest({
          role: "STAFF",
          resource: "reports",
          action: "access",
          allowed: true,
        })
      );
      expect(res.status).toBe(200);
      expect(mockPrisma.roleSetting.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            role_resource_action: {
              role: "STAFF",
              resource: "reports",
              action: "access",
            },
          },
        })
      );
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: "CREATE_ROLE_PERMISSION" }),
        })
      );
    });
  });

  describe("DELETE", () => {
    it("returns 400 when id missing", async () => {
      const res = await rolesRoutes.DELETE(mockRequest({}));
      expect(res.status).toBe(400);
    });

    it("deletes role setting and logs audit", async () => {
      const res = await rolesRoutes.DELETE(mockRequest({ id: "rs-1" }));
      expect(res.status).toBe(200);
      expect(mockPrisma.roleSetting.delete).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "rs-1" } })
      );
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: "DELETE_ROLE_PERMISSION" }),
        })
      );
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Webhooks (ADMIN-only via requirePermission("integrations"))
// ═══════════════════════════════════════════════════════════════════════════

describe("Webhooks API", () => {
  describe("authorization", () => {
    it("GET returns 403 when requirePermission denies", async () => {
      mockRequirePermission.mockResolvedValue(permissionDenied());
      const res = await webhooksRoutes.GET(mockRequest());
      expect(res.status).toBe(403);
      expect(mockRequirePermission).toHaveBeenCalledWith("read", "integrations", expect.anything());
    });

    it("POST returns 403 when requirePermission denies", async () => {
      mockRequirePermission.mockResolvedValue(permissionDenied());
      const res = await webhooksRoutes.POST(
        mockRequest({ name: "Webhook", url: "https://example.com", events: ["order.created"] })
      );
      expect(res.status).toBe(403);
    });

    it("PUT returns 403 when requirePermission denies", async () => {
      mockRequirePermission.mockResolvedValue(permissionDenied());
      const res = await webhooksRoutes.PUT(
        mockRequest({ id: "wh-1", name: "Updated" })
      );
      expect(res.status).toBe(403);
    });

    it("DELETE returns 403 when requirePermission denies", async () => {
      mockRequirePermission.mockResolvedValue(permissionDenied());
      const res = await webhooksRoutes.DELETE(mockRequest({ id: "wh-1" }));
      expect(res.status).toBe(403);
    });
  });

  describe("GET", () => {
    it("returns webhook endpoints with delivery counts", async () => {
      const res = await webhooksRoutes.GET(mockRequest());
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toHaveLength(1);
      expect(body[0].id).toBe("wh-1");
      expect(body[0].name).toBe("Order Notifier");
      expect(body[0].url).toBe("https://example.com/webhook");
      expect(body[0].status).toBe("ACTIVE");
      expect(body[0].subscribedEvents).toEqual([
        "order.created",
        "order.updated",
      ]);
      expect(body[0]._count.deliveries).toBe(5);
    });
  });

  describe("POST", () => {
    it("returns 400 when name is missing", async () => {
      const res = await webhooksRoutes.POST(
        mockRequest({ url: "https://example.com", events: ["order.created"] })
      );
      expect(res.status).toBe(400);
    });

    it("returns 400 when url is missing", async () => {
      const res = await webhooksRoutes.POST(
        mockRequest({ name: "Webhook", events: ["order.created"] })
      );
      expect(res.status).toBe(400);
    });

    it("returns 400 when no events provided", async () => {
      const res = await webhooksRoutes.POST(
        mockRequest({ name: "Webhook", url: "https://example.com" })
      );
      expect(res.status).toBe(400);
    });

    it("returns 400 when events contain invalid values", async () => {
      const res = await webhooksRoutes.POST(
        mockRequest({
          name: "Webhook",
          url: "https://example.com",
          events: ["invalid.event"],
        })
      );
      expect(res.status).toBe(400);
    });

    it("creates a webhook endpoint with generated secret and logs audit", async () => {
      const res = await webhooksRoutes.POST(
        mockRequest({
          name: "Test Webhook",
          url: "https://hooks.example.com/push",
          events: ["order.created", "order.updated"],
          description: "For testing",
        })
      );
      expect(res.status).toBe(200);
      expect(mockPrisma.webhookEndpoint.create).toHaveBeenCalled();
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: "CREATE_WEBHOOK" }),
        })
      );
    });
  });

  describe("PUT", () => {
    it("returns 400 when id missing", async () => {
      const res = await webhooksRoutes.PUT(mockRequest({ name: "Updated" }));
      expect(res.status).toBe(400);
    });

    it("returns 404 when webhook not found", async () => {
      mockPrisma.webhookEndpoint.findUnique.mockResolvedValueOnce(null);
      const res = await webhooksRoutes.PUT(
        mockRequest({ id: "wh-unknown", name: "Updated" })
      );
      expect(res.status).toBe(404);
    });

    it("returns 400 when events contain invalid values", async () => {
      const res = await webhooksRoutes.PUT(
        mockRequest({ id: "wh-1", events: ["bad.event"] })
      );
      expect(res.status).toBe(400);
    });

    it("updates webhook fields and logs audit", async () => {
      const res = await webhooksRoutes.PUT(
        mockRequest({ id: "wh-1", name: "Updated Name", status: "PAUSED" })
      );
      expect(res.status).toBe(200);
      expect(mockPrisma.webhookEndpoint.update).toHaveBeenCalled();
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: "UPDATE_WEBHOOK" }),
        })
      );
    });
  });

  describe("DELETE", () => {
    it("returns 400 when id missing", async () => {
      const res = await webhooksRoutes.DELETE(mockRequest({}));
      expect(res.status).toBe(400);
    });

    it("returns 404 when webhook not found", async () => {
      mockPrisma.webhookEndpoint.findUnique.mockResolvedValueOnce(null);
      const res = await webhooksRoutes.DELETE(mockRequest({ id: "wh-unknown" }));
      expect(res.status).toBe(404);
    });

    it("deletes webhook and logs audit", async () => {
      const res = await webhooksRoutes.DELETE(mockRequest({ id: "wh-1" }));
      expect(res.status).toBe(200);
      expect(mockPrisma.webhookEndpoint.delete).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "wh-1" } })
      );
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: "DELETE_WEBHOOK" }),
        })
      );
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Webhook Deliveries
// ═══════════════════════════════════════════════════════════════════════════

describe("Webhook Deliveries API", () => {
  it("returns 403 when requirePermission denies", async () => {
    mockRequirePermission.mockResolvedValue(permissionDenied());
    const res = await webhookDeliveriesRoutes.GET(mockRequest());
    expect(res.status).toBe(403);
    expect(mockRequirePermission).toHaveBeenCalledWith("read", "integrations");
  });    it("returns delivery history", async () => {
      const res = await webhookDeliveriesRoutes.GET(mockRequest());
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toHaveLength(1);
      expect(body[0].id).toBe("wd-1");
      expect(body[0].endpointId).toBe("wh-1");
      expect(body[0].event).toBe("order.created");
      expect(body[0].status).toBe("DELIVERED");
      expect(body[0].statusCode).toBe(200);
      expect(body[0].response).toBe("OK");
      expect(body[0].durationMs).toBe(150);
      expect(body[0].endpoint.name).toBe("Order Notifier");
      expect(body[0].endpoint.url).toBe("https://example.com/webhook");
    });

  it("filters by endpointId when provided", async () => {
    await webhookDeliveriesRoutes.GET(
      mockRequest(undefined, "endpointId=wh-1")
    );
    expect(mockPrisma.webhookDelivery.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { endpointId: "wh-1" },
      })
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Webhook Test (requirePermission("update", "integrations"))
// ═══════════════════════════════════════════════════════════════════════════

describe("Webhook Test API", () => {
  it("returns 403 when requirePermission denies", async () => {
    mockRequirePermission.mockResolvedValue(permissionDenied());
    const res = await webhookTestRoutes.POST(
      mockRequest({ endpointId: "wh-1" })
    );
    expect(res.status).toBe(403);
    expect(mockRequirePermission).toHaveBeenCalledWith("update", "integrations");
  });

  it("returns 400 when endpointId missing", async () => {
    const res = await webhookTestRoutes.POST(mockRequest({}));
    expect(res.status).toBe(400);
  });

  it("returns 404 when webhook not found", async () => {
    mockPrisma.webhookEndpoint.findUnique.mockResolvedValueOnce(null);
    const res = await webhookTestRoutes.POST(
      mockRequest({ endpointId: "wh-unknown" })
    );
    expect(res.status).toBe(404);
  });    it("attempts to send test ping and records delivery", async () => {
      const res = await webhookTestRoutes.POST(
        mockRequest({ endpointId: "wh-1" })
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      // Route returns a custom response object (not the raw delivery)
      expect(body.id).toBe("wd-new");
      expect(body.status).toBeDefined();
      expect(body.statusCode).toBeDefined();
      expect(body.durationMs).toBeGreaterThanOrEqual(0);
      expect(body.request).toBeDefined();
      expect(body.request.url).toBe("https://example.com/webhook");
      expect(body.request.payload).toContain("test.ping");
      expect(mockPrisma.webhookDelivery.create).toHaveBeenCalled();
      expect(mockPrisma.webhookEndpoint.update).toHaveBeenCalled();
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: "TEST_WEBHOOK" }),
        })
      );
    });

    it("returns FAILED status when fetch to webhook URL throws", async () => {
      vi.spyOn(global, "fetch").mockRejectedValueOnce(
        new Error("Connection refused by target server")
      );

      const res = await webhookTestRoutes.POST(
        mockRequest({ endpointId: "wh-1" })
      );
      expect(res.status).toBe(200);
      const body = await res.json();

      // Response body reflects the FAILED fetch
      expect(body.status).toBe("FAILED");
      expect(body.statusCode).toBe(0);
      expect(body.durationMs).toBeGreaterThanOrEqual(0);
      expect(body.request.url).toBe("https://example.com/webhook");
      expect(body.response).toContain("Connection refused");

      // Delivery was recorded with FAILED status
      expect(mockPrisma.webhookDelivery.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: "FAILED",
            statusCode: 0,
            response: expect.stringContaining("Connection refused"),
          }),
        })
      );

      // Endpoint was updated with failed status
      expect(mockPrisma.webhookEndpoint.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ lastStatus: "failed" }),
        })
      );

      // Audit log still created
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: "TEST_WEBHOOK" }),
        })
      );
    });

    it("returns DELIVERED status when fetch returns 200", async () => {
      vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response("{\"ok\":true}", {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );

      const res = await webhookTestRoutes.POST(
        mockRequest({ endpointId: "wh-1" })
      );
      expect(res.status).toBe(200);
      const body = await res.json();

      // Response body reflects the successful fetch
      expect(body.status).toBe("DELIVERED");
      expect(body.statusCode).toBe(200);
      expect(body.durationMs).toBeGreaterThanOrEqual(0);
      expect(body.request.url).toBe("https://example.com/webhook");
      expect(body.response).toContain('{"ok":true}');

      // Delivery was recorded with DELIVERED status
      expect(mockPrisma.webhookDelivery.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: "DELIVERED",
            statusCode: 200,
          }),
        })
      );

      // Endpoint was updated with success status
      expect(mockPrisma.webhookEndpoint.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ lastStatus: "success" }),
        })
      );

      // Audit log still created
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: "TEST_WEBHOOK" }),
        })
      );
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// Realtime API (SSE stream + activity log POST)
// ═══════════════════════════════════════════════════════════════════════════

describe("Realtime API", () => {
  describe("POST", () => {
    it("creates an activity log entry", async () => {
      // Dynamic import because NextRequest shapes differ from Request
      const { POST } = await import("../realtime/route");
      const res = await POST(
        new Request("http://localhost/api/realtime", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "TEST_ACTION",
            entity: "Test",
            entityId: "test-1",
            details: "Test activity",
          }),
        }) as unknown as NextRequest
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(mockPrisma.activityLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: "TEST_ACTION",
            entity: "Test",
          }),
        })
      );
    });

    it("returns 400 for invalid request body", async () => {
      const { POST } = await import("../realtime/route");
      const res = await POST(
        new Request("http://localhost/api/realtime", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{invalid json}",
        }) as unknown as NextRequest
      );
      // Should handle parse errors gracefully
      expect(res.status).toBe(400);
    });
  });

  describe("GET", () => {
    it("returns SSE stream response with correct headers", async () => {
      const { GET } = await import("../realtime/route");
      const req = new Request("http://localhost/api/realtime", {
        method: "GET",
        signal: AbortSignal.timeout(100),
      }) as unknown as NextRequest;
      const res = await GET(req);
      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toBe("text/event-stream");
      expect(res.headers.get("Cache-Control")).toBe("no-cache, no-transform");
      expect(res.headers.get("Connection")).toBe("keep-alive");
    });
  });
});
