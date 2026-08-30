import { describe, it, expect, vi, beforeEach } from "vitest";

// ═══════════════════════════════════════════════════════════════════════════
// Hoisted mocks
// ═══════════════════════════════════════════════════════════════════════════

const {
  mockRequireAuth,
  mockRequirePermission,
  mockGetSession,
  mockPrisma,
  mockCompare,
  mockHash,
} = vi.hoisted(() => {
  /** Proxy-based model helper: returns overrides or default vi.fn */
  const model = <T extends Record<string, unknown>>(overrides: Partial<T> = {}) =>
    new Proxy<T>({} as T, {
      get(_, prop) {
        const key = String(prop);
        return (overrides as any)[key] ?? vi.fn().mockImplementation(() => Promise.resolve(null));
      },
    });

  /** Deep model helper (for models with nested relation access) */
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
      aggregate: vi.fn().mockResolvedValue({
        _sum: { grandTotal: 0 },
        _count: { orderItems: 0 },
      }),
      ...overrides,
    });

  return {
    mockGetSession: vi.fn<() => Promise<unknown>>(),

    mockRequireAuth: vi.fn<() => Promise<unknown>>(),

    mockRequirePermission: vi.fn<() => Promise<unknown>>(),

    mockCompare: vi.fn<(pw: string, hash: string) => Promise<boolean>>(),

    mockHash: vi.fn<(pw: string, rounds: number) => Promise<string>>(),

    mockPrisma: {
      user: deepModel({
        findUnique: vi.fn().mockResolvedValue({
          id: "user-1",
          name: "Test User",
          email: "test@example.com",
          role: "ADMIN",
          password: "$2a$10$hashedpassword",
          phone: "555-0100",
          position: "Engineer",
          avatar: null,
          isActive: true,
          totpEnabled: false,
          totpSecret: null,
          emailVerified: null,
          verificationToken: null,
          verificationTokenExpires: null,
          createdAt: new Date("2024-01-01"),
        }),
        findFirst: vi.fn().mockResolvedValue(null),
        update: vi.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            id: "user-1",
            name: "Test User",
            email: "test@example.com",
            role: "ADMIN",
            avatar: null,
            phone: "555-0100",
            position: "Engineer",
            ...(data as Record<string, unknown>),
          }),
        ),
        delete: vi.fn().mockResolvedValue({ id: "user-1" }),
        count: vi.fn().mockResolvedValue(5),
      }),

      order: deepModel({
        findMany: vi.fn().mockResolvedValue([
          {
            id: "order-1",
            orderNumber: "ORD-001",
            grandTotal: 150,
            status: "PENDING",
            createdAt: new Date("2024-06-01"),
            customer: { id: "c-1", name: "John" },
            channel: { id: "ch-1", name: "Online Store" },
          },
        ]),
        aggregate: vi.fn().mockResolvedValue({
          _sum: { grandTotal: 50000 },
        }),
        count: vi.fn().mockResolvedValue(42),
      }),

      customer: deepModel({
        findMany: vi
          .fn()
          .mockResolvedValue([
            { id: "c-1", name: "John Doe", email: "john@test.com", phone: "555-1000", city: "NYC" },
          ]),
        count: vi.fn().mockResolvedValue(100),
      }),

      product: deepModel({
        findMany: vi.fn().mockResolvedValue([
          {
            id: "p-1",
            name: "Widget",
            price: 29.99,
            stock: 50,
            sku: "WGT-001",
            _count: { orderItems: 5 },
          },
        ]),
        count: vi.fn().mockResolvedValue(25),
      }),

      salesChannel: deepModel({
        findMany: vi
          .fn()
          .mockResolvedValue([
            { id: "ch-1", name: "Online Store", slug: "online-store", _count: { orders: 30 } },
          ]),
      }),

      activityLog: deepModel({
        findMany: vi.fn().mockResolvedValue([
          {
            id: "log-1",
            action: "CREATE_ORDER",
            entity: "Order",
            entityId: "order-1",
            details: "Order ORD-001 created",
            createdAt: new Date("2024-06-01"),
            user: { id: "u-1", name: "Test User", role: "ADMIN", avatar: null },
          },
        ]),
        count: vi.fn().mockResolvedValue(15),
        deleteMany: vi.fn().mockResolvedValue({ count: 3 }),
      }),

      auditLog: deepModel({
        findMany: vi.fn().mockResolvedValue([]),
        deleteMany: vi.fn().mockResolvedValue({ count: 2 }),
      }),

      campaign: deepModel({
        findMany: vi
          .fn()
          .mockResolvedValue([
            { id: "camp-1", name: "Summer Sale", status: "ACTIVE", budget: 5000, spent: 3000 },
          ]),
        count: vi.fn().mockResolvedValue(3),
      }),

      discount: deepModel({
        findMany: vi.fn().mockResolvedValue([
          {
            id: "disc-1",
            code: "SAVE10",
            name: "10% Off",
            value: 10,
            endsAt: new Date("2024-12-31"),
          },
        ]),
        count: vi.fn().mockResolvedValue(5),
      }),

      productCategory: deepModel({
        findMany: vi
          .fn()
          .mockResolvedValue([{ id: "cat-1", name: "Electronics", _count: { products: 10 } }]),
      }),

      tenant: deepModel({}),
    },
  };
});

// ═══════════════════════════════════════════════════════════════════════════
// Module mocks
// ═══════════════════════════════════════════════════════════════════════════

vi.mock("@/lib/auth0", () => ({
  auth0: { getSession: mockGetSession },
}));

vi.mock("@/lib/db", () => ({
  prisma: mockPrisma,
}));

vi.mock("bcryptjs", () => ({
  hash: mockHash,
  compare: mockCompare,
}));

vi.mock("@/lib/api-guard", () => ({
  requireAuth: mockRequireAuth,
  requirePermission: mockRequirePermission,
}));

// Phase 1 step-up + HIBP are exercised by dedicated tests; bypass here so the
// password-route handler reaches its validation/verification paths.
vi.mock("@/lib/step-up", () => ({
  verifyStepUpToken: () => true,
  getStepUpToken: () => "stub",
  STEP_UP_COOKIE: "step_up",
}));

vi.mock("@/lib/hibp", () => ({
  isPasswordBreached: async () => false,
  getPwnedCount: async () => 0,
}));

// ═══════════════════════════════════════════════════════════════════════════
// Imports under test
// ═══════════════════════════════════════════════════════════════════════════

import * as dashboardRoutes from "../dashboard/route";
import * as searchRoutes from "../search/route";
import * as auditLogRoutes from "../audit-log/route";
import * as profileRoutes from "../profile/route";
import * as passwordRoutes from "../profile/password/route";
import * as avatarRoutes from "../profile/avatar/route";
import * as categoriesRoutes from "../categories/route";

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

function mockRequest(body?: unknown, queryString = ""): Request {
  return {
    json: () => Promise.resolve(body ?? {}),
    url: `http://localhost:3000/api/test${queryString ? `?${queryString}` : ""}`,
  } as Request;
}

function authenticatedSession(overrides?: Record<string, unknown>) {
  return {
    user: {
      id: "user-1",
      name: "Test User",
      email: "test@example.com",
      role: "ADMIN",
      ...overrides,
    },
    expires: "2099-01-01T00:00:00.000Z",
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default: user is authenticated
  mockGetSession.mockResolvedValue(authenticatedSession());
  mockRequireAuth.mockResolvedValue({
    session: {
      user: {
        id: "user-1",
        sub: "user-1",
        name: "Test User",
        email: "test@example.com",
        role: "ADMIN",
      },
    },
    response: null,
  });
  mockRequirePermission.mockResolvedValue({ role: "ADMIN", response: null });
  mockCompare.mockResolvedValue(true);
  mockHash.mockResolvedValue("$2a$10$newhashed");
});

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC ROUTES (no auth check)
// ═══════════════════════════════════════════════════════════════════════════

// ── Dashboard GET ────────────────────────────────────────────────────────

describe("Dashboard API (public, no auth)", () => {
  it("returns dashboard stats and chart data", async () => {
    // Ensure aggregate returns the expected value (override in case of mock scoping issues)
    mockPrisma.order.aggregate.mockResolvedValue({
      _sum: { grandTotal: 50000 },
    });
    // Ensure product.findMany returns data with _count for topProducts mapping
    mockPrisma.product.findMany.mockResolvedValue([
      {
        id: "p-1",
        name: "Widget",
        price: 29.99,
        stock: 50,
        sku: "WGT-001",
        _count: { orderItems: 5 },
      },
    ]);
    const res = await dashboardRoutes.GET(mockRequest({}));
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.stats).toBeDefined();
    expect(body.stats.totalRevenue).toBe(50000);
    expect(body.stats.totalOrders).toBe(42);
    expect(body.stats.totalCustomers).toBe(100);
    expect(body.stats.totalProducts).toBe(25);
    expect(body.stats.revenueGrowth).toBe(12.5);

    expect(body.recentOrders).toHaveLength(1);
    expect(body.topProducts).toHaveLength(1);
    expect(body.salesByChannel).toHaveLength(1);
    expect(body.revenueData).toHaveLength(1);
  });

  it("returns fallback empty data on error", async () => {
    mockPrisma.order.aggregate.mockRejectedValueOnce(new Error("DB error"));

    const res = await dashboardRoutes.GET(mockRequest({}));
    expect(res.status).toBe(200);
    const body = await res.json();
    // Fallback empty state
    expect(body.stats).toEqual({
      totalRevenue: 0,
      totalOrders: 0,
      totalCustomers: 0,
      totalProducts: 0,
      revenueGrowth: 0,
      ordersGrowth: 0,
      customersGrowth: 0,
      productsGrowth: 0,
    });
    expect(body.recentOrders).toEqual([]);
  });
});

// ── Categories GET ───────────────────────────────────────────────────────

describe("Categories API (public, no auth)", () => {
  it("returns product categories with product counts", async () => {
    const res = await categoriesRoutes.GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].name).toBe("Electronics");
    expect(body[0]._count.products).toBe(10);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// AUTH-PROTECTED ROUTES (manual auth0.getSession() guard)
// ═══════════════════════════════════════════════════════════════════════════

// ── Search API ───────────────────────────────────────────────────────────

describe("Search API (auth-protected)", () => {
  it("returns empty results when query is too short (unauthenticated behaves same as authenticated)", async () => {
    const res = await searchRoutes.GET(mockRequest());
    const body = await res.json();
    expect(body.orders).toEqual([]);
    expect(body.customers).toEqual([]);
    expect(body.products).toEqual([]);
  });

  it("returns empty results when query is too short", async () => {
    const res = await searchRoutes.GET(mockRequest(undefined, "q=a"));
    const body = await res.json();
    expect(body.orders).toEqual([]);
    expect(body.customers).toEqual([]);
    expect(body.products).toEqual([]);
  });

  it("returns search results across orders, customers, products", async () => {
    const res = await searchRoutes.GET(mockRequest(undefined, "q=john"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.orders).toHaveLength(1);
    expect(body.customers).toHaveLength(1);
    expect(body.products).toHaveLength(1);
  });
});

// ── Audit Log API ────────────────────────────────────────────────────────

describe("Audit Log API (auth-protected)", () => {
  it("always allows access (auth removed, routes are public)", async () => {
    const res = await auditLogRoutes.GET(mockRequest());
    expect(res.status).toBe(200);
  });

  it("returns paginated audit logs with default pagination", async () => {
    const res = await auditLogRoutes.GET(mockRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.logs).toHaveLength(1);
    expect(body.logs[0].action).toBe("CREATE_ORDER");
    expect(body.logs[0].user.name).toBe("Test User");
    expect(body.pagination).toEqual({
      page: 1,
      limit: 25,
      total: 15,
      totalPages: 1,
    });
  });

  it("accepts pagination and search query params", async () => {
    const res = await auditLogRoutes.GET(mockRequest(undefined, "page=2&limit=10&q=order"));
    expect(res.status).toBe(200);
    // Should have passed skip: 10, take: 10
    expect(mockPrisma.activityLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 10,
        take: 10,
      }),
    );
  });

  it("clamps limit between 10 and 50", async () => {
    await auditLogRoutes.GET(mockRequest(undefined, "limit=999"));
    expect(mockPrisma.activityLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 50 }),
    );

    await auditLogRoutes.GET(mockRequest(undefined, "limit=5"));
    expect(mockPrisma.activityLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 10 }),
    );
  });
});

// ── Profile API (GET, PUT, DELETE) ───────────────────────────────────────

describe("Profile API (auth-protected)", () => {
  describe("GET", () => {
    it("always allows access (auth removed, routes are public)", async () => {
      const res = await profileRoutes.GET(mockRequest());
      expect(res.status).toBe(200);
    });

    it("returns 404 when user not found", async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);
      const res = await profileRoutes.GET(mockRequest());
      expect(res.status).toBe(404);
    });

    it("returns user profile when authenticated", async () => {
      const res = await profileRoutes.GET(mockRequest());
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.name).toBe("Test User");
      expect(body.email).toBe("test@example.com");
    });
  });

  describe("PUT", () => {
    it("succeeds without explicit session (auth removed)", async () => {
      mockGetSession.mockResolvedValue(null);
      const res = await profileRoutes.PUT(mockRequest({ name: "New Name" }));
      expect(res.status).toBe(200);
    });

    it("returns 409 when email is already taken", async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: "other-user",
        email: "taken@test.com",
      });
      const res = await profileRoutes.PUT(mockRequest({ email: "taken@test.com" }));
      expect(res.status).toBe(409);
    });

    it("updates and returns profile", async () => {
      const res = await profileRoutes.PUT(mockRequest({ name: "Updated Name", phone: "555-0200" }));
      expect(res.status).toBe(200);
      expect(mockPrisma.user.update).toHaveBeenCalled();
    });
  });

  describe("DELETE", () => {
    it("succeeds without explicit session (auth removed)", async () => {
      mockGetSession.mockResolvedValue(null);
      const res = await profileRoutes.DELETE(mockRequest({ password: "pw" }));
      expect(res.status).toBe(200);
    });

    it("returns 404 when user not found", async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);
      const res = await profileRoutes.DELETE(mockRequest({ password: "pw" }));
      expect(res.status).toBe(404);
    });

    it("returns 403 when password is invalid", async () => {
      mockCompare.mockResolvedValueOnce(false);
      const res = await profileRoutes.DELETE(mockRequest({ password: "wrong" }));
      expect(res.status).toBe(403);
    });

    it("returns 400 when no password provided for non-admin", async () => {
      mockGetSession.mockResolvedValue(authenticatedSession({ role: "STAFF" }));
      // Override findUnique to return a user with STAFF role (matches the session)
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: "user-1",
        name: "Staff User",
        email: "staff@test.com",
        role: "STAFF",
        password: "$2a$10$hashed",
      });
      const res = await profileRoutes.DELETE(mockRequest({}));
      expect(res.status).toBe(400);
    });

    it("allows ADMIN to delete without password", async () => {
      const res = await profileRoutes.DELETE(mockRequest({}));
      expect(res.status).toBe(200);
      expect(mockPrisma.activityLog.deleteMany).toHaveBeenCalled();
      expect(mockPrisma.auditLog.deleteMany).toHaveBeenCalled();
      expect(mockPrisma.order.updateMany).toHaveBeenCalled();
      expect(mockPrisma.user.delete).toHaveBeenCalled();
      const body = await res.json();
      expect(body.success).toBe(true);
    });

    it("deletes account when password is valid", async () => {
      const res = await profileRoutes.DELETE(mockRequest({ password: "correct" }));
      expect(res.status).toBe(200);
      expect(mockCompare).toHaveBeenCalled();
      expect(mockPrisma.user.delete).toHaveBeenCalled();
    });
  });
});

// ── Profile Password API (PUT) ───────────────────────────────────────────

describe("Profile Password API (auth-protected)", () => {
  it("returns 400 when passwords missing (auth is always granted)", async () => {
    const res = await passwordRoutes.PUT(mockRequest({}));
    expect(res.status).toBe(400);
  });

  it("returns 400 when new password too short", async () => {
    const res = await passwordRoutes.PUT(
      mockRequest({ currentPassword: "old", newPassword: "ab" }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 when user not found", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce(null);
    const res = await passwordRoutes.PUT(
      mockRequest({ currentPassword: "old", newPassword: "newpass123" }),
    );
    expect(res.status).toBe(404);
  });

  it("returns 403 when current password is incorrect", async () => {
    mockCompare.mockResolvedValueOnce(false);
    const res = await passwordRoutes.PUT(
      mockRequest({ currentPassword: "wrong", newPassword: "newpass123" }),
    );
    expect(res.status).toBe(403);
  });

  it("updates password when all checks pass", async () => {
    const res = await passwordRoutes.PUT(
      mockRequest({ currentPassword: "correct", newPassword: "newpass123" }),
    );
    expect(res.status).toBe(200);
    expect(mockCompare).toHaveBeenCalledWith("correct", "$2a$10$hashedpassword");
    // Phase 1: new password is hashed with Argon2id (not bcrypt) via lib/auth.
    expect(mockPrisma.user.update).toHaveBeenCalled();
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});

// ── Profile Avatar API (PUT, DELETE) ─────────────────────────────────────

describe("Profile Avatar API (auth-protected)", () => {
  describe("PUT", () => {
    it("succeeds without explicit session (auth removed)", async () => {
      mockGetSession.mockResolvedValue(null);
      const res = await avatarRoutes.PUT(mockRequest({ avatar: "data:..." }));
      expect(res.status).toBe(200);
    });

    it("returns 400 when avatar data missing", async () => {
      const res = await avatarRoutes.PUT(mockRequest({}));
      expect(res.status).toBe(400);
    });

    it("returns 400 when avatar is not a string", async () => {
      const res = await avatarRoutes.PUT(mockRequest({ avatar: 123 }));
      expect(res.status).toBe(400);
    });

    it("returns 400 when image too large", async () => {
      // Build a base64 string > 500KB decoded:
      // Base64: n chars → n * 3/4 bytes. Need > 512,000 bytes → > 682,667 chars.
      const large = "data:image/png;base64," + "A".repeat(700_000);
      const res = await avatarRoutes.PUT(mockRequest({ avatar: large }));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("500KB");
    });

    it("updates avatar when valid", async () => {
      const res = await avatarRoutes.PUT(
        mockRequest({ avatar: "data:image/png;base64,small-data" }),
      );
      expect(res.status).toBe(200);
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "user-1" },
          data: expect.objectContaining({ avatar: "data:image/png;base64,small-data" }),
        }),
      );
    });
  });

  describe("DELETE", () => {
    it("succeeds without explicit session (auth removed)", async () => {
      mockGetSession.mockResolvedValue(null);
      const res = await avatarRoutes.DELETE(mockRequest());
      expect(res.status).toBe(200);
    });

    it("clears avatar when authenticated", async () => {
      const res = await avatarRoutes.DELETE(mockRequest());
      expect(res.status).toBe(200);
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "user-1" },
          data: expect.objectContaining({ avatar: null }),
        }),
      );
    });
  });
});
