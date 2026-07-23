import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoisted mocks ──────────────────────────────────────────────────────────

const { mockRequirePermission, mockRequireAuth, mockGetSession, mockHash, mockPrisma } = vi.hoisted(
  () => {
    const model = <T extends Record<string, unknown>>(overrides: Partial<T> = {}) =>
      new Proxy<T>({} as T, {
        get(_, prop) {
          const key = String(prop);
          // Return the override if provided, otherwise a default vi.fn
          return (overrides as any)[key] ?? vi.fn().mockImplementation(() => Promise.resolve(null));
        },
      });

    return {
      mockRequirePermission: vi.fn<
        (
          action: string,
          resource: string,
        ) => Promise<{
          role: string | null;
          response: Response | null;
        }>
      >(),

      mockRequireAuth: vi.fn<
        (req?: Request) => Promise<{
          session: {
            user: { id: string; sub: string; name: string; email: string; role: string };
          };
          response: Response | null;
        }>
      >(),

      mockGetSession: vi.fn<() => Promise<unknown>>(),

      mockHash: vi.fn<(pw: string, rounds: number) => Promise<string>>(),

      mockPrisma: {
        user: model({
          findMany: vi.fn().mockResolvedValue([
            {
              id: "user-1",
              name: "Alice",
              email: "alice@test.com",
              role: "ADMIN",
              createdAt: new Date("2024-01-01"),
            },
          ]),
          create: vi.fn().mockResolvedValue({
            id: "new-user",
            name: "Bob",
            email: "bob@test.com",
            role: "STAFF",
          }),
          update: vi.fn().mockResolvedValue({
            id: "user-1",
            name: "Alice Updated",
            role: "ADMIN",
          }),
          delete: vi.fn().mockResolvedValue({ id: "user-1" }),
        }),

        order: model({
          findMany: vi
            .fn()
            .mockResolvedValue([{ id: "order-1", orderNumber: "ORD-001", grandTotal: 100 }]),
          create: vi.fn().mockResolvedValue({
            id: "order-new",
            orderNumber: "ORD-TEST",
            grandTotal: 200,
          }),
          update: vi.fn().mockResolvedValue({
            id: "order-1",
            orderNumber: "ORD-001",
            status: "SHIPPED",
          }),
          aggregate: vi.fn().mockResolvedValue({ _sum: { grandTotal: 1000 } }),
          count: vi.fn().mockResolvedValue(10),
        }),

        customer: model({
          findMany: vi.fn().mockResolvedValue([{ id: "cust-1", name: "John Doe" }]),
          create: vi.fn().mockResolvedValue({
            id: "cust-new",
            name: "Jane Doe",
          }),
          update: vi.fn().mockResolvedValue({
            id: "cust-1",
            name: "John Updated",
          }),
          delete: vi.fn().mockResolvedValue({ id: "cust-1" }),
        }),

        campaign: model({
          findMany: vi.fn().mockResolvedValue([{ id: "camp-1", name: "Summer Sale" }]),
          create: vi.fn().mockResolvedValue({
            id: "camp-new",
            name: "New Campaign",
          }),
          update: vi.fn().mockResolvedValue({
            id: "camp-1",
            name: "Updated Campaign",
          }),
          delete: vi.fn().mockResolvedValue({ id: "camp-1" }),
        }),

        product: model({
          findMany: vi.fn().mockResolvedValue([{ id: "prod-1", name: "Widget", price: 29.99 }]),
          create: vi.fn().mockResolvedValue({
            id: "prod-new",
            name: "Gadget",
            price: 49.99,
          }),
          update: vi.fn().mockResolvedValue({
            id: "prod-1",
            name: "Widget Pro",
            price: 39.99,
          }),
          delete: vi.fn().mockResolvedValue({ id: "prod-1" }),
        }),

        discount: model({
          findMany: vi.fn().mockResolvedValue([{ id: "disc-1", code: "SAVE10" }]),
          create: vi.fn().mockResolvedValue({
            id: "disc-new",
            code: "NEWCODE",
            value: 15,
          }),
          update: vi.fn().mockResolvedValue({
            id: "disc-1",
            code: "SAVE10",
            value: 20,
          }),
          delete: vi.fn().mockResolvedValue({ id: "disc-1" }),
        }),

        salesChannel: model({
          findMany: vi
            .fn()
            .mockResolvedValue([{ id: "ch-1", name: "Online Store", slug: "online-store" }]),
          findUnique: vi.fn().mockResolvedValue({
            id: "ch-1",
            name: "Online Store",
            slug: "online-store",
          }),
        }),

        activityLog: model({
          create: vi.fn().mockResolvedValue({ id: "log-1" }),
        }),

        productCategory: model({
          findMany: vi.fn().mockResolvedValue([{ id: "cat-1", name: "Electronics" }]),
        }),
      },
    };
  },
);

// ── Module mocks ────────────────────────────────────────────────────────────

vi.mock("@/lib/api-guard", () => ({
  requirePermission: mockRequirePermission,
  requireAuth: mockRequireAuth,
}));

vi.mock("@/lib/db", () => ({
  prisma: mockPrisma,
}));

vi.mock("@/lib/auth0", () => ({
  auth0: { getSession: mockGetSession },
}));

vi.mock("bcryptjs", () => ({
  hash: mockHash,
}));

// ── Imports under test ─────────────────────────────────────────────────────

// The route files are side-effect-only modules that export handler functions.
// Import each route group so we can call its handlers.
import * as teamRoutes from "../team/route";
import * as ordersRoutes from "../orders/route";
import * as customersRoutes from "../customers/route";
import * as marketingRoutes from "../marketing/route";
import * as productsRoutes from "../products/route";
import * as discountsRoutes from "../discounts/route";

// ── Helpers ────────────────────────────────────────────────────────────────

function mockRequest(body?: unknown): Request {
  return {
    json: () => Promise.resolve(body ?? {}),
    url: "http://localhost:3000/api/test",
  } as Request;
}

/** Return a 403 Response as requirePermission would */
function permissionDenied(): {
  role: null;
  response: Response;
} {
  return {
    role: null,
    response: new Response(JSON.stringify({ error: "Forbidden: insufficient permissions" }), {
      status: 403,
    }),
  };
}

/** Return a success result as requirePermission would */
function permissionGranted(role = "ADMIN"): {
  role: string;
  response: null;
} {
  return { role, response: null };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSession.mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } });
  mockRequireAuth.mockResolvedValue({
    session: {
      user: {
        id: "mock-admin-user",
        sub: "mock-admin-user",
        name: "Admin",
        email: "admin@dashboard.com",
        role: "ADMIN",
      },
    },
    response: null,
  });
  mockHash.mockResolvedValue("$2a$10$hashedpassword");
});

// ── Team API ──────────────────────────────────────────────────────────────

describe("Team API (read/create/update/delete — ADMIN only)", () => {
  describe("authorization: permission denied", () => {
    it("GET returns 403 when requirePermission denies", async () => {
      mockRequirePermission.mockResolvedValue(permissionDenied());
      const res = await teamRoutes.GET(mockRequest());
      expect(res.status).toBe(403);
      expect(mockRequirePermission).toHaveBeenCalledWith("read", "team", expect.anything());
    });

    it("POST returns 403 when requirePermission denies", async () => {
      mockRequirePermission.mockResolvedValue(permissionDenied());
      const res = await teamRoutes.POST(mockRequest({ name: "Bob" }));
      expect(res.status).toBe(403);
    });

    it("PUT returns 403 when requirePermission denies", async () => {
      mockRequirePermission.mockResolvedValue(permissionDenied());
      const res = await teamRoutes.PUT(mockRequest({ id: "user-1" }));
      expect(res.status).toBe(403);
    });

    it("DELETE returns 403 when requirePermission denies", async () => {
      mockRequirePermission.mockResolvedValue(permissionDenied());
      const res = await teamRoutes.DELETE(mockRequest({ id: "user-1" }));
      expect(res.status).toBe(403);
    });
  });

  describe("authorization: permission granted", () => {
    it("GET returns users", async () => {
      mockRequirePermission.mockResolvedValue(permissionGranted());
      const res = await teamRoutes.GET(mockRequest());
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toHaveLength(1);
      expect(body[0].name).toBe("Alice");
    });

    it("POST creates a user with hashed password", async () => {
      mockRequirePermission.mockResolvedValue(permissionGranted());
      const res = await teamRoutes.POST(
        mockRequest({ name: "Bob", email: "bob@test.com", password: "secret" }),
      );
      expect(res.status).toBe(200);
      expect(mockHash).toHaveBeenCalledWith("secret", 10);
      expect(mockPrisma.user.create).toHaveBeenCalled();
    });

    it("PUT updates a user", async () => {
      mockRequirePermission.mockResolvedValue(permissionGranted());
      const res = await teamRoutes.PUT(mockRequest({ id: "user-1", name: "Alice Updated" }));
      expect(res.status).toBe(200);
      expect(mockPrisma.user.update).toHaveBeenCalled();
    });

    it("DELETE deletes a user", async () => {
      mockRequirePermission.mockResolvedValue(permissionGranted());
      const res = await teamRoutes.DELETE(mockRequest({ id: "user-1" }));
      expect(res.status).toBe(200);
      expect(mockPrisma.user.delete).toHaveBeenCalledWith({
        where: { id: "user-1" },
      });
    });
  });
});

// ── Orders API (POST, PUT guarded; GET is public) ─────────────────────────

describe("Orders API (POST/PUT guarded, GET public)", () => {
  describe("POST — guarded", () => {
    it("returns 403 when requirePermission denies", async () => {
      mockRequirePermission.mockResolvedValue(permissionDenied());
      const res = await ordersRoutes.POST(mockRequest({ customerId: "c-1" }));
      expect(res.status).toBe(403);
      expect(mockRequirePermission).toHaveBeenCalledWith("create", "orders", expect.anything());
    });

    it("creates order and logs activity when permission granted", async () => {
      mockRequirePermission.mockResolvedValue(permissionGranted());
      const res = await ordersRoutes.POST(mockRequest({ customerId: "c-1", totalAmount: "200" }));
      expect(res.status).toBe(200);
      expect(mockPrisma.order.create).toHaveBeenCalled();
      expect(mockPrisma.activityLog.create).toHaveBeenCalled();
    });
  });

  describe("PUT — guarded", () => {
    it("returns 403 when requirePermission denies", async () => {
      mockRequirePermission.mockResolvedValue(permissionDenied());
      const res = await ordersRoutes.PUT(mockRequest({ id: "order-1", status: "SHIPPED" }));
      expect(res.status).toBe(403);
      expect(mockRequirePermission).toHaveBeenCalledWith("update", "orders", expect.anything());
    });

    it("updates order and logs activity when permission granted", async () => {
      mockRequirePermission.mockResolvedValue(permissionGranted());
      const res = await ordersRoutes.PUT(mockRequest({ id: "order-1", status: "SHIPPED" }));
      expect(res.status).toBe(200);
      expect(mockPrisma.order.update).toHaveBeenCalled();
      expect(mockPrisma.activityLog.create).toHaveBeenCalled();
    });
  });

  describe("GET — public (no permission check)", () => {
    it("returns orders without calling requirePermission", async () => {
      const res = await ordersRoutes.GET(
        mockRequest(), // GET doesn't check permissions
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body[0].orderNumber).toBe("ORD-001");
      expect(mockRequirePermission).not.toHaveBeenCalled();
    });
  });
});

// ── Customers API (POST, PUT, DELETE guarded; GET is public) ──────────────

describe("Customers API (POST/PUT/DELETE guarded, GET public)", () => {
  const guardedMethods = [
    { method: "POST", body: { name: "Jane" }, handler: customersRoutes.POST },
    {
      method: "PUT",
      body: { id: "cust-1", name: "John Updated" },
      handler: customersRoutes.PUT,
    },
    {
      method: "DELETE",
      body: { id: "cust-1" },
      handler: customersRoutes.DELETE,
    },
  ] as const;

  describe("guarded methods return 403 when denied", () => {
    it.each(guardedMethods)(
      "$method returns 403 when requirePermission denies",
      async ({ handler, body }) => {
        mockRequirePermission.mockResolvedValue(permissionDenied());
        const res = await handler(mockRequest(body));
        expect(res.status).toBe(403);
      },
    );
  });

  describe("guarded methods succeed when permission granted", () => {
    it("POST creates a customer", async () => {
      mockRequirePermission.mockResolvedValue(permissionGranted());
      const res = await customersRoutes.POST(mockRequest({ name: "Jane" }));
      expect(res.status).toBe(200);
      expect(mockPrisma.customer.create).toHaveBeenCalled();
    });

    it("PUT updates a customer", async () => {
      mockRequirePermission.mockResolvedValue(permissionGranted());
      const res = await customersRoutes.PUT(mockRequest({ id: "cust-1", name: "John Updated" }));
      expect(res.status).toBe(200);
      expect(mockPrisma.customer.update).toHaveBeenCalled();
    });

    it("DELETE deletes a customer", async () => {
      mockRequirePermission.mockResolvedValue(permissionGranted());
      const res = await customersRoutes.DELETE(mockRequest({ id: "cust-1" }));
      expect(res.status).toBe(200);
      expect(mockPrisma.customer.delete).toHaveBeenCalled();
    });
  });

  describe("GET — public (no permission check)", () => {
    it("returns customers without calling requirePermission", async () => {
      const res = await customersRoutes.GET();
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body[0].name).toBe("John Doe");
      expect(mockRequirePermission).not.toHaveBeenCalled();
    });
  });
});

// ── Marketing API (POST, PUT, DELETE guarded; GET is public) ─────────────

describe("Marketing API (POST/PUT/DELETE guarded, GET public)", () => {
  describe("guarded methods return 403 when denied", () => {
    it.each([
      ["POST", { name: "Campaign" }, marketingRoutes.POST],
      ["PUT", { id: "camp-1" }, marketingRoutes.PUT],
      ["DELETE", { id: "camp-1" }, marketingRoutes.DELETE],
    ] as const)("%s returns 403", async (_, body, handler) => {
      mockRequirePermission.mockResolvedValue(permissionDenied());
      const res = await handler(mockRequest(body));
      expect(res.status).toBe(403);
    });
  });

  describe("guarded methods succeed when permission granted", () => {
    it("POST creates a campaign", async () => {
      mockRequirePermission.mockResolvedValue(permissionGranted());
      const res = await marketingRoutes.POST(mockRequest({ name: "New Campaign", type: "EMAIL" }));
      expect(res.status).toBe(200);
      expect(mockPrisma.campaign.create).toHaveBeenCalled();
    });

    it("PUT updates a campaign", async () => {
      mockRequirePermission.mockResolvedValue(permissionGranted());
      const res = await marketingRoutes.PUT(mockRequest({ id: "camp-1", name: "Updated" }));
      expect(res.status).toBe(200);
      expect(mockPrisma.campaign.update).toHaveBeenCalled();
    });

    it("DELETE deletes a campaign", async () => {
      mockRequirePermission.mockResolvedValue(permissionGranted());
      const res = await marketingRoutes.DELETE(mockRequest({ id: "camp-1" }));
      expect(res.status).toBe(200);
      expect(mockPrisma.campaign.delete).toHaveBeenCalled();
    });
  });

  describe("GET — public (no permission check)", () => {
    it("returns campaigns without calling requirePermission", async () => {
      const res = await marketingRoutes.GET();
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body[0].name).toBe("Summer Sale");
      expect(mockRequirePermission).not.toHaveBeenCalled();
    });
  });
});

// ── Products API (POST, PUT, DELETE guarded; GET is public) ───────────────

describe("Products API (POST/PUT/DELETE guarded, GET public)", () => {
  describe("guarded methods return 403 when denied", () => {
    it.each([
      ["POST", { name: "Gadget" }, productsRoutes.POST],
      ["PUT", { id: "prod-1" }, productsRoutes.PUT],
      ["DELETE", { id: "prod-1" }, productsRoutes.DELETE],
    ] as const)("%s returns 403", async (_, body, handler) => {
      mockRequirePermission.mockResolvedValue(permissionDenied());
      const res = await handler(mockRequest(body));
      expect(res.status).toBe(403);
    });
  });

  describe("guarded methods succeed when permission granted", () => {
    it("POST creates a product", async () => {
      mockRequirePermission.mockResolvedValue(permissionGranted());
      const res = await productsRoutes.POST(mockRequest({ name: "Gadget", price: "49.99" }));
      expect(res.status).toBe(200);
      expect(mockPrisma.product.create).toHaveBeenCalled();
    });

    it("PUT updates a product", async () => {
      mockRequirePermission.mockResolvedValue(permissionGranted());
      const res = await productsRoutes.PUT(mockRequest({ id: "prod-1", name: "Widget Pro" }));
      expect(res.status).toBe(200);
      expect(mockPrisma.product.update).toHaveBeenCalled();
    });

    it("DELETE deletes a product", async () => {
      mockRequirePermission.mockResolvedValue(permissionGranted());
      const res = await productsRoutes.DELETE(mockRequest({ id: "prod-1" }));
      expect(res.status).toBe(200);
      expect(mockPrisma.product.delete).toHaveBeenCalled();
    });
  });

  describe("GET — public (no permission check)", () => {
    it("returns products without calling requirePermission", async () => {
      const res = await productsRoutes.GET(mockRequest());
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body[0].name).toBe("Widget");
      expect(mockRequirePermission).not.toHaveBeenCalled();
    });
  });
});

// ── Discounts API (POST, PUT, DELETE guarded; GET is public) ──────────────

describe("Discounts API (POST/PUT/DELETE guarded, GET public)", () => {
  describe("guarded methods return 403 when denied", () => {
    it.each([
      ["POST", { code: "NEWCODE", value: "15" }, discountsRoutes.POST],
      ["PUT", { id: "disc-1" }, discountsRoutes.PUT],
      ["DELETE", { id: "disc-1" }, discountsRoutes.DELETE],
    ] as const)("%s returns 403", async (_, body, handler) => {
      mockRequirePermission.mockResolvedValue(permissionDenied());
      const res = await handler(mockRequest(body));
      expect(res.status).toBe(403);
    });
  });

  describe("guarded methods succeed when permission granted", () => {
    it("POST creates a discount", async () => {
      mockRequirePermission.mockResolvedValue(permissionGranted());
      const res = await discountsRoutes.POST(mockRequest({ code: "NEWCODE", value: "15" }));
      expect(res.status).toBe(200);
      expect(mockPrisma.discount.create).toHaveBeenCalled();
    });

    it("PUT updates a discount", async () => {
      mockRequirePermission.mockResolvedValue(permissionGranted());
      const res = await discountsRoutes.PUT(mockRequest({ id: "disc-1", value: "20" }));
      expect(res.status).toBe(200);
      expect(mockPrisma.discount.update).toHaveBeenCalled();
    });

    it("DELETE succeeds when permission granted", async () => {
      mockRequirePermission.mockResolvedValue(permissionGranted());
      const res = await discountsRoutes.DELETE(mockRequest({ id: "disc-1" }));
      expect(res.status).toBe(200);
      expect(mockPrisma.discount.delete).toHaveBeenCalled();
    });
  });

  describe("GET — public (no permission check)", () => {
    it("returns discounts without calling requirePermission", async () => {
      const res = await discountsRoutes.GET();
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body[0].code).toBe("SAVE10");
      expect(mockRequirePermission).not.toHaveBeenCalled();
    });
  });
});
