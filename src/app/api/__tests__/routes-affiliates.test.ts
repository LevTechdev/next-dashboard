import { describe, it, expect, vi, beforeEach } from "vitest";

// ═══════════════════════════════════════════════════════════════════════════
// Hoisted mocks
// ═══════════════════════════════════════════════════════════════════════════

const { mockRequirePermission, mockPrisma } = vi.hoisted(() => {
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
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
      aggregate: vi.fn().mockResolvedValue({ _sum: {}, _count: 0 }),
      ...overrides,
    });

  return {
    mockRequirePermission: vi.fn<() => Promise<unknown>>(),
    mockPrisma: {
      affiliateClick: deepModel({
        count: vi.fn().mockResolvedValue(150),
        create: vi.fn().mockResolvedValue({ id: "click-1" }),
      }),
      affiliateConversion: deepModel({
        count: vi.fn().mockResolvedValue(12),
        aggregate: vi.fn().mockResolvedValue({
          _sum: { amount: 5000, commissionAmount: 500 },
        }),
      }),
      affiliatePlatform: deepModel({
        count: vi.fn().mockResolvedValue(3),
        findMany: vi.fn().mockResolvedValue([
          {
            id: "plat-1",
            name: "TikTok Shop",
            slug: "tiktok-shop",
            color: "#FE2C55",
            sortOrder: 1,
            isActive: true,
            headlessEnabled: false,
            connection: {
              id: "conn-1",
              status: "CONNECTED",
              shopId: "shop-1",
              storeUrl: "https://shop.tiktok.com",
              lastSyncAt: new Date(),
              lastError: null,
              productsSynced: 42,
              apiKey: "key-xxx",
            },
            _count: { links: 5 },
            links: [
              {
                _count: { clicks: 100, conversions: 8 },
                conversions: [{ amount: 3000, commissionAmount: 300 }],
              },
            ],
          },
        ]),
        createMany: vi.fn().mockResolvedValue({ count: 6 }),
        update: vi.fn().mockImplementation(({ where, data }) =>
          Promise.resolve({
            id: where?.id || "plat-1",
            name: "TikTok Shop",
            slug: "tiktok-shop",
            headlessEnabled: data?.headlessEnabled ?? false,
            isActive: data?.isActive ?? true,
          }),
        ),
      }),
      product: deepModel({
        findUnique: vi.fn().mockResolvedValue({
          id: "p-1",
          name: "Widget",
          slug: "widget",
          price: 29.99,
        }),
      }),

      affiliateLink: deepModel({
        findMany: vi.fn().mockResolvedValue([
          {
            id: "link-1",
            code: "summer2024",
            targetUrl: "https://example.com/product/123",
            isActive: true,
            slug: "summer2024",
            commissionType: "PERCENTAGE",
            commissionValue: 10,
            createdAt: new Date(),
            product: { id: "p-1", name: "Widget", price: 29.99, image: null },
            platform: { id: "plat-1", name: "TikTok Shop", slug: "tiktok-shop", color: "#FE2C55" },
            _count: { clicks: 50, conversions: 3 },
            conversions: [
              { amount: 1000, commissionAmount: 100, status: "APPROVED" },
              { amount: 500, commissionAmount: 50, status: "REJECTED" },
            ],
          },
        ]),
        findUnique: vi.fn().mockResolvedValue({
          id: "link-1",
          code: "summer2024",
          targetUrl: "https://example.com/product/123",
          isActive: true,
          slug: "summer2024",
          platform: { slug: "tiktok-shop" },
        }),
        create: vi.fn().mockResolvedValue({
          id: "link-new",
          code: "newlink",
          productId: "p-1",
          platformId: "plat-1",
          targetUrl: "https://example.com/product",
          commissionType: "PERCENTAGE",
          commissionValue: 10,
          product: { id: "p-1", name: "Widget", price: 29.99 },
          platform: { id: "plat-1", name: "TikTok Shop", slug: "tiktok-shop", color: "#FE2C55" },
        }),
        update: vi.fn().mockImplementation(({ where, data }) =>
          Promise.resolve({
            id: where?.id || "link-1",
            code: "summer2024",
            isActive: data?.isActive ?? true,
            commissionType: data?.commissionType ?? "PERCENTAGE",
            commissionValue: data?.commissionValue ?? 10,
            targetUrl: data?.targetUrl ?? "https://example.com/product/123",
          }),
        ),
        delete: vi.fn().mockResolvedValue({ id: "link-1" }),
      }),
      activityLog: deepModel({}),
    },
  };
});

// ═══════════════════════════════════════════════════════════════════════════
// Module mocks
// ═══════════════════════════════════════════════════════════════════════════

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));

vi.mock("@/lib/api-guard", () => ({
  requirePermission: mockRequirePermission,
  requireAuth: vi.fn().mockResolvedValue({
    session: { user: { id: "u-1", sub: "u-1", name: "Admin", email: "a@test.com", role: "ADMIN" } },
    response: null,
  }),
}));

vi.mock("crypto", () => {
  const hashUpdate = vi.fn().mockReturnThis();
  const hashDigest = vi.fn().mockReturnValue("a".repeat(64));
  return {
    default: {
      createHash: vi.fn(() => ({ update: hashUpdate, digest: hashDigest })),
      randomBytes: vi.fn((n: number) => Buffer.from("b".repeat(n))),
    },
    createHash: vi.fn(() => ({ update: hashUpdate, digest: hashDigest })),
    randomBytes: vi.fn((n: number) => Buffer.from("b".repeat(n))),
  };
});

// ═══════════════════════════════════════════════════════════════════════════
// Imports under test
// ═══════════════════════════════════════════════════════════════════════════

import * as summaryRoutes from "../affiliates/summary/route";
import * as platformsRoutes from "../affiliates/platforms/route";
import * as platformByIdRoutes from "../affiliates/platforms/[id]/route";
import * as linksRoutes from "../affiliates/links/route";
import * as linkByIdRoutes from "../affiliates/links/[id]/route";
import * as affCodeRoutes from "../aff/[code]/route";

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

function mockRequest(body?: unknown, queryString = ""): Request {
  return {
    json: () => Promise.resolve(body ?? {}),
    url: `http://localhost:3000/api/test${queryString ? `?${queryString}` : ""}`,
    headers: {
      get: (name: string) => {
        if (name === "x-forwarded-for") return "127.0.0.1";
        if (name === "user-agent") return "Mozilla/5.0";
        if (name === "referer") return "https://example.com";
        return null;
      },
    },
  } as unknown as Request;
}

function permissionDenied() {
  return {
    role: null,
    response: new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 }),
  };
}

function permissionGranted(role = "ADMIN") {
  return { role, response: null };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequirePermission.mockResolvedValue(permissionGranted());
});

// ═══════════════════════════════════════════════════════════════════════════
// Affiliates Summary
// ═══════════════════════════════════════════════════════════════════════════

describe("Affiliates Summary", () => {
  describe("authorization", () => {
    it("returns 403 when permission denied", async () => {
      mockRequirePermission.mockResolvedValue(permissionDenied());
      const res = await summaryRoutes.GET(mockRequest());
      expect(res.status).toBe(403);
      expect(mockRequirePermission).toHaveBeenCalledWith("read", "affiliates", expect.anything());
    });
  });

  describe("GET", () => {
    it("returns aggregated stats with per-platform breakdown", async () => {
      const res = await summaryRoutes.GET(mockRequest());
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.totals.clicks).toBe(150);
      expect(body.totals.conversions).toBe(12);
      expect(body.totals.revenue).toBe(5000);
      expect(body.totals.commission).toBe(500);
      expect(body.byPlatform).toHaveLength(1);
      expect(body.byPlatform[0].name).toBe("TikTok Shop");
      expect(body.byPlatform[0].clicks).toBe(100);
      expect(body.byPlatform[0].conversions).toBe(8);
      expect(body.byPlatform[0].revenue).toBe(3000);
      expect(body.byPlatform[0].commission).toBe(300);
    });

    it("queries active platforms only", async () => {
      await summaryRoutes.GET(mockRequest());
      expect(mockPrisma.affiliatePlatform.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isActive: true },
        }),
      );
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Affiliates Platforms
// ═══════════════════════════════════════════════════════════════════════════

describe("Affiliates Platforms", () => {
  describe("authorization", () => {
    it("returns 403 when permission denied", async () => {
      mockRequirePermission.mockResolvedValue(permissionDenied());
      const res = await platformsRoutes.GET(mockRequest());
      expect(res.status).toBe(403);
    });
  });

  describe("GET", () => {
    it("returns platforms with connection info and link counts", async () => {
      const res = await platformsRoutes.GET(mockRequest());
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toHaveLength(1);
      expect(body[0].name).toBe("TikTok Shop");
      expect(body[0].slug).toBe("tiktok-shop");
      expect(body[0].connection.status).toBe("CONNECTED");
      expect(body[0]._count.links).toBe(5);
    });

    it("auto-seeds default platforms when count is 0", async () => {
      mockPrisma.affiliatePlatform.count.mockResolvedValueOnce(0);
      await platformsRoutes.GET(mockRequest());
      expect(mockPrisma.affiliatePlatform.createMany).toHaveBeenCalled();
    });

    it("skips seeding when platforms already exist", async () => {
      mockPrisma.affiliatePlatform.count.mockResolvedValueOnce(6);
      await platformsRoutes.GET(mockRequest());
      expect(mockPrisma.affiliatePlatform.createMany).not.toHaveBeenCalled();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Affiliates Platform [id]
// ═══════════════════════════════════════════════════════════════════════════

describe("Affiliates Platform [id]", () => {
  const params = { params: Promise.resolve({ id: "plat-1" }) };

  describe("authorization", () => {
    it("returns 403 when permission denied", async () => {
      mockRequirePermission.mockResolvedValue(permissionDenied());
      const res = await platformByIdRoutes.PATCH(mockRequest({ headlessEnabled: true }), params);
      expect(res.status).toBe(403);
      expect(mockRequirePermission).toHaveBeenCalledWith("update", "affiliates", expect.anything());
    });
  });

  describe("PATCH", () => {
    it("returns 400 when no valid settings provided", async () => {
      const res = await platformByIdRoutes.PATCH(mockRequest({ foo: "bar" }), params);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("No valid settings");
    });

    it("updates headlessEnabled setting", async () => {
      const res = await platformByIdRoutes.PATCH(mockRequest({ headlessEnabled: true }), params);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.headlessEnabled).toBe(true);
      expect(mockPrisma.affiliatePlatform.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "plat-1" },
          data: { headlessEnabled: true },
        }),
      );
    });

    it("updates isActive setting", async () => {
      const res = await platformByIdRoutes.PATCH(mockRequest({ isActive: false }), params);
      expect(res.status).toBe(200);
      expect(mockPrisma.affiliatePlatform.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { isActive: false },
        }),
      );
    });

    it("updates multiple settings at once", async () => {
      const res = await platformByIdRoutes.PATCH(
        mockRequest({ headlessEnabled: true, isActive: false }),
        params,
      );
      expect(res.status).toBe(200);
      expect(mockPrisma.affiliatePlatform.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { headlessEnabled: true, isActive: false },
        }),
      );
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Aff [code] — Public affiliate redirect
// ═══════════════════════════════════════════════════════════════════════════

describe("Aff [code]", () => {
  const params = { params: Promise.resolve({ code: "summer2024" }) };

  describe("GET", () => {
    it("returns 404 when link not found", async () => {
      mockPrisma.affiliateLink.findUnique.mockResolvedValueOnce(null);
      const res = await affCodeRoutes.GET(mockRequest(), params);
      expect(res.status).toBe(404);
    });

    it("returns 404 when link is inactive", async () => {
      mockPrisma.affiliateLink.findUnique.mockResolvedValueOnce({
        id: "link-1",
        code: "summer2024",
        targetUrl: "https://example.com/product",
        isActive: false,
        platform: { slug: "tiktok-shop" },
      });
      const res = await affCodeRoutes.GET(mockRequest(), params);
      expect(res.status).toBe(404);
    });

    it("records a click and redirects with UTM params", async () => {
      const res = await affCodeRoutes.GET(mockRequest(), params);
      // Redirect response has status 302
      expect(res.status).toBe(302);
      expect(res.headers.get("location")).toContain("utm_source=affiliate");
      expect(res.headers.get("location")).toContain("utm_medium=tiktok-shop");
      expect(res.headers.get("location")).toContain("utm_campaign=summer2024");
      expect(mockPrisma.affiliateClick.create).toHaveBeenCalled();
    });

    it("records IP hash for privacy", async () => {
      await affCodeRoutes.GET(mockRequest(), params);
      expect(mockPrisma.affiliateClick.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            linkId: "link-1",
            ipHash: expect.any(String),
          }),
        }),
      );
    });
    it("returns 500 when target URL is invalid", async () => {
      mockPrisma.affiliateLink.findUnique.mockResolvedValueOnce({
        id: "link-1",
        code: "bad-link",
        targetUrl: "not-a-valid-url",
        isActive: true,
        platform: { slug: "tiktok-shop" },
      });
      const res = await affCodeRoutes.GET(mockRequest(), {
        params: Promise.resolve({ code: "bad-link" }),
      });
      expect(res.status).toBe(500);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Affiliates Links
// ═══════════════════════════════════════════════════════════════════════════

describe("Affiliates Links", () => {
  describe("authorization", () => {
    it("GET returns 403 when permission denied", async () => {
      mockRequirePermission.mockResolvedValue(permissionDenied());
      const res = await linksRoutes.GET(mockRequest());
      expect(res.status).toBe(403);
      expect(mockRequirePermission).toHaveBeenCalledWith("read", "affiliates", expect.anything());
    });

    it("POST returns 403 when permission denied", async () => {
      mockRequirePermission.mockResolvedValue(permissionDenied());
      const res = await linksRoutes.POST(mockRequest({ productId: "p-1", platformId: "plat-1" }));
      expect(res.status).toBe(403);
    });
  });

  describe("GET", () => {
    it("returns links with stats", async () => {
      const res = await linksRoutes.GET(mockRequest());
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toHaveLength(1);
      expect(body[0].code).toBe("summer2024");
      expect(body[0].stats.revenue).toBe(1500); // all conversions summed
      expect(body[0].stats.commission).toBe(100); // REJECTED excluded
      expect(body[0].product.name).toBe("Widget");
      expect(body[0].platform.name).toBe("TikTok Shop");
    });
  });

  describe("POST", () => {
    it("returns 400 when productId missing", async () => {
      const res = await linksRoutes.POST(mockRequest({ platformId: "plat-1" }));
      expect(res.status).toBe(400);
    });

    it("returns 400 when platformId missing", async () => {
      const res = await linksRoutes.POST(mockRequest({ productId: "p-1" }));
      expect(res.status).toBe(400);
    });

    it("returns 404 when product not found", async () => {
      mockPrisma.product.findUnique.mockResolvedValueOnce(null);
      const res = await linksRoutes.POST(
        mockRequest({ productId: "p-missing", platformId: "plat-1" }),
      );
      expect(res.status).toBe(404);
    });

    it("returns 400 when commission value is invalid", async () => {
      mockPrisma.product.findUnique.mockResolvedValueOnce({
        id: "p-1",
        name: "W",
        slug: "w",
        price: 10,
      });
      mockPrisma.affiliatePlatform.findUnique.mockResolvedValueOnce({
        id: "plat-1",
        name: "T",
        slug: "t",
        connection: null,
        baseUrl: "https://t.com",
      });
      const res = await linksRoutes.POST(
        mockRequest({ productId: "p-1", platformId: "plat-1", commissionValue: "-5" }),
      );
      expect(res.status).toBe(400);
    });

    it("creates an affiliate link and logs activity", async () => {
      mockPrisma.product.findUnique.mockResolvedValueOnce({
        id: "p-1",
        name: "Widget",
        slug: "widget",
        price: 29.99,
      });
      mockPrisma.affiliatePlatform.findUnique.mockResolvedValueOnce({
        id: "plat-1",
        name: "TikTok Shop",
        slug: "tiktok-shop",
        baseUrl: "https://shop.tiktok.com",
        connection: null,
      });
      const res = await linksRoutes.POST(
        mockRequest({
          productId: "p-1",
          platformId: "plat-1",
          commissionType: "FIXED",
          commissionValue: "25",
        }),
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.code).toBeDefined();
      expect(mockPrisma.affiliateLink.create).toHaveBeenCalled();
      expect(mockPrisma.activityLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: "CREATE_AFFILIATE_LINK" }),
        }),
      );
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Affiliates Link [id]
// ═══════════════════════════════════════════════════════════════════════════

describe("Affiliates Link [id]", () => {
  const params = { params: Promise.resolve({ id: "link-1" }) };

  describe("authorization", () => {
    it("PATCH returns 403 when permission denied", async () => {
      mockRequirePermission.mockResolvedValue(permissionDenied());
      const res = await linkByIdRoutes.PATCH(mockRequest({ isActive: false }), params);
      expect(res.status).toBe(403);
    });

    it("DELETE returns 403 when permission denied", async () => {
      mockRequirePermission.mockResolvedValue(permissionDenied());
      const res = await linkByIdRoutes.DELETE(mockRequest(), params);
      expect(res.status).toBe(403);
    });
  });

  describe("PATCH", () => {
    it("updates isActive flag", async () => {
      const res = await linkByIdRoutes.PATCH(mockRequest({ isActive: false }), params);
      expect(res.status).toBe(200);
      expect(mockPrisma.affiliateLink.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "link-1" },
          data: expect.objectContaining({ isActive: false }),
        }),
      );
    });

    it("updates commission type and value", async () => {
      const res = await linkByIdRoutes.PATCH(
        mockRequest({ commissionType: "FIXED", commissionValue: "50" }),
        params,
      );
      expect(res.status).toBe(200);
    });

    it("returns 400 for invalid commission value", async () => {
      const res = await linkByIdRoutes.PATCH(mockRequest({ commissionValue: "abc" }), params);
      expect(res.status).toBe(400);
    });

    it("updates targetUrl", async () => {
      const res = await linkByIdRoutes.PATCH(
        mockRequest({ targetUrl: "https://new.url/product" }),
        params,
      );
      expect(res.status).toBe(200);
    });
  });

  describe("DELETE", () => {
    it("deletes a link", async () => {
      const res = await linkByIdRoutes.DELETE(mockRequest(), params);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(mockPrisma.affiliateLink.delete).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "link-1" } }),
      );
    });
  });
});
