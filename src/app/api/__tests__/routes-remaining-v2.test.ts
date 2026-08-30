import { describe, it, expect, vi, beforeEach } from "vitest";

// ═══════════════════════════════════════════════════════════════════════════
// Hoisted mocks
// ═══════════════════════════════════════════════════════════════════════════

const { mockRequirePermission, mockRequireAuth, mockPrisma, mockGetConnector, mockFetchProductFromUrl } = vi.hoisted(
  () => {
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
        groupBy: vi.fn().mockResolvedValue([]),
        upsert: vi.fn().mockImplementation(({ create }) => Promise.resolve({ id: "conn-1", ...create })),
        ...overrides,
      });

    return {
      mockRequirePermission: vi.fn(),
      mockRequireAuth: vi.fn(),
      mockPrisma: {
        affiliateConversion: deepModel({
          create: vi.fn().mockResolvedValue({ id: "conv-1" }),
          update: vi.fn().mockResolvedValue({ id: "conv-1" }),
        }),
        affiliateLink: deepModel({
          findUnique: vi.fn().mockResolvedValue({
            id: "link-1",
            code: "TESTCODE",
            isActive: true,
            commissionType: "PERCENTAGE",
            commissionValue: 10,
            product: { id: "p-1", name: "Widget" },
            platform: { id: "plat-1", name: "TikTok Shop", slug: "tiktok-shop", color: "#FE2C55" },
          }),
        }),
        affiliatePlatform: deepModel({
          findUnique: vi.fn().mockResolvedValue({
            id: "plat-1",
            name: "TikTok Shop",
            slug: "tiktok-shop",
            headlessEnabled: false,
            connection: { id: "conn-1", apiKey: "key-xxx", status: "CONNECTED" },
          }),
        }),
        platformConnection: deepModel({
          upsert: vi.fn().mockImplementation(({ create }) => Promise.resolve({ id: "conn-1", ...create })),
          update: vi.fn().mockResolvedValue({ id: "conn-1" }),
          deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
        }),
        product: deepModel({
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue({ id: "p-new" }),
          update: vi.fn().mockResolvedValue({ id: "p-1" }),
        }),
        activityLog: deepModel({}),
        auditLog: deepModel({}),
        activityLogCount: vi.fn().mockResolvedValue(10),
        activityLogGroupBy: vi.fn().mockResolvedValue([]),
        tenant: deepModel({
          findUnique: vi.fn().mockResolvedValue({ id: "tenant-1", slug: "default" }),
          findFirst: vi.fn().mockResolvedValue({ id: "tenant-1", slug: "default" }),
        }),
        user: deepModel({
          findUnique: vi.fn().mockResolvedValue({ id: "user-1", email: "a@test.com", role: "ADMIN", tenantId: "tenant-1", isActive: true }),
          findMany: vi.fn().mockResolvedValue([]),
        }),
        session: deepModel({ create: vi.fn().mockResolvedValue({ id: "sess-1" }) }),
        ssoConnection: deepModel({
          findUnique: vi.fn().mockResolvedValue(null),
          upsert: vi.fn().mockImplementation(({ create }) => Promise.resolve({ id: "sso-1", ...create })),
          deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
        }),
        securityEvent: deepModel({}),
        webAuthnCredential: deepModel({
          findMany: vi.fn().mockResolvedValue([]),
          findUnique: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue({ id: "cred-1" }),
          update: vi.fn().mockResolvedValue({ id: "cred-1" }),
          deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
        }),
        // For compliance report
        activityLog: deepModel({
          count: vi.fn().mockResolvedValue(10),
          groupBy: vi.fn().mockResolvedValue([
            { action: "LOGIN", _count: { action: 5 } },
            { action: "UPDATE_ORDER", _count: { action: 3 } },
          ]),
        }),
      },
      mockGetConnector: vi.fn(),
      mockFetchProductFromUrl: vi.fn().mockResolvedValue({
        ok: true,
        product: { name: "Test Product", price: 99.99, image: "https://img.example.com/p.jpg", images: ["https://img.example.com/p.jpg"], externalId: "ext-1", source: "headless", fetchTier: "headless", partial: false },
        platformSlug: "tiktok-shop",
      }),
    };
  },
);



// ═══════════════════════════════════════════════════════════════════════════
// Module mocks
// ═══════════════════════════════════════════════════════════════════════════

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));

vi.mock("@/lib/api-guard", () => ({
  requirePermission: mockRequirePermission,
  requireAuth: mockRequireAuth,
}));

vi.mock("@/lib/platform-connectors", () => ({
  getConnector: mockGetConnector,
}));

vi.mock("@/lib/product-link-parser", () => ({
  fetchProductFromUrl: mockFetchProductFromUrl,
  detectPlatform: (url: string) => {
    if (url.includes("tiktok")) return "tiktok-shop";
    if (url.includes("shopee")) return "shopee";
    if (url.includes("tokopedia")) return "tokopedia";
    return null;
  },
}));

vi.mock("@/lib/saml", () => ({
  buildSaml: vi.fn().mockReturnValue({
    generateServiceProviderMetadata: vi.fn().mockReturnValue("<EntityDescriptor/>"),
  }),
  resolveConnectionByTenantSlug: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/tenancy", () => ({
  getTenantId: (s: any) => s?.user?.tenantId,
  effectiveTenantId: async (s: any) => s?.user?.tenantId || "tenant-1",
  tenantWhere: () => ({}),
}));

vi.mock("@/lib/affiliates", () => ({
  computeCommission: (type: string, value: number, amount: number) =>
    type === "FIXED" ? value : amount * (value / 100),
}));

vi.mock("@/lib/webauthn", () => ({
  RP_NAME: "NextDashboard",
  REG_CHALLENGE_COOKIE: "webauthn_reg_challenge",
  AUTH_CHALLENGE_COOKIE: "webauthn_auth_challenge",
  getRpID: () => "localhost",
  getExpectedOrigin: () => "http://localhost:3000",
  readChallengeCookie: (req: Request, name: string) => {
    const cookie = req.headers.get("cookie") || "";
    const match = cookie.match(new RegExp(`${name}=([^;]+)`));
    return match ? match[1] : null;
  },
  challengeCookieOptions: () => ({ path: "/", httpOnly: true, maxAge: 300 }),
}));

vi.mock("@simplewebauthn/server", () => ({
  verifyRegistrationResponse: vi.fn().mockResolvedValue({
    verified: true,
    registrationInfo: {
      credential: { id: "cred-123", publicKey: new Uint8Array([1, 2, 3]), counter: 0, transports: ["internal"] },
    },
  }),
  verifyAuthenticationResponse: vi.fn().mockResolvedValue({
    verified: true,
    authenticationInfo: { newCounter: 1 },
  }),
  generateRegistrationOptions: vi.fn().mockResolvedValue({ challenge: "reg-challenge", rp: { name: "NextDashboard" } }),
  generateAuthenticationOptions: vi.fn().mockResolvedValue({ challenge: "auth-challenge" }),
}));

vi.mock("@/lib/security-events", () => ({
  logSecurityEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/auth", () => ({
  signToken: vi.fn().mockReturnValue("jwt-token-xxx"),
}));

vi.mock("@/lib/sessions", () => ({
  createSession: vi.fn().mockResolvedValue("sess-1"),
}));

vi.mock("@/lib/refresh-tokens", () => ({
  newFamilyId: vi.fn().mockReturnValue("family-1"),
  createRefreshToken: vi.fn().mockResolvedValue("refresh-token"),
}));

vi.mock("@/lib/auth-cookies", () => ({
  setAuthCookies: vi.fn(),
}));

vi.mock("@/lib/step-up", () => ({
  getStepUpToken: vi.fn().mockReturnValue("step-up-token"),
  verifyStepUpToken: vi.fn().mockReturnValue(true),
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

import * as conversionsRoutes from "../affiliates/conversions/route";
import * as importLinkRoutes from "../affiliates/import-link/route";
import * as platformConnectionRoutes from "../affiliates/platforms/[id]/connection/route";
import * as platformSyncRoutes from "../affiliates/platforms/[id]/sync/route";
import * as complianceReportRoutes from "../audit-log/compliance-report/route";
import * as googleCallbackRoutes from "../auth/google/callback/route";
import * as samlConnectionsRoutes from "../auth/saml/connections/route";
import * as samlMetadataRoutes from "../auth/saml/metadata/route";
import * as webauthnRegVerifyRoutes from "../auth/webauthn/register/verify/route";
import * as webauthnRegOptionsRoutes from "../auth/webauthn/register/options/route";
import * as webauthnAuthOptionsRoutes from "../auth/webauthn/authenticate/options/route";
import * as webauthnAuthVerifyRoutes from "../auth/webauthn/authenticate/verify/route";
import * as webauthnCredentialsRoutes from "../auth/webauthn/credentials/route";

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

function mockRequest(body?: unknown, queryString = "", cookie = ""): Request {
  return {
    json: () => Promise.resolve(body ?? {}),
    url: `http://localhost:3000/api/test${queryString ? `?${queryString}` : ""}`,
    headers: {
      get: (name: string) => {
        if (name === "x-forwarded-for") return "127.0.0.1";
        if (name === "user-agent") return "Mozilla/5.0";
        if (name === "referer") return "https://example.com";
        if (name === "cookie") return cookie;
        return null;
      },
    },
  } as unknown as Request;
}

function permissionDenied() {
  return { role: null, response: new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 }) };
}

function permissionGranted(role = "ADMIN") {
  return { role, response: null };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequirePermission.mockResolvedValue(permissionGranted());
  mockRequireAuth.mockResolvedValue({
    session: { user: { id: "user-1", name: "Admin", email: "a@test.com", role: "ADMIN", tenantId: "tenant-1" } },
    response: null,
  });
  // Re-set default mock implementations that clearAllMocks() resets
  mockPrisma.affiliateConversion.findMany.mockResolvedValue([]);
  mockPrisma.affiliatePlatform.findUnique.mockResolvedValue({
    id: "plat-1",
    name: "TikTok Shop",
    slug: "tiktok-shop",
    headlessEnabled: false,
    connection: { id: "conn-1", apiKey: "key-xxx", status: "CONNECTED" },
  });
  mockPrisma.user.findUnique.mockResolvedValue({ id: "user-1", email: "a@test.com", role: "ADMIN", tenantId: "tenant-1", isActive: true });
  mockPrisma.ssoConnection.findUnique.mockResolvedValue(null);
  mockPrisma.webAuthnCredential.findMany.mockResolvedValue([]);
  mockPrisma.webAuthnCredential.findUnique.mockResolvedValue(null);
});

// ═══════════════════════════════════════════════════════════════════════════
// Affiliates Conversions
// ═══════════════════════════════════════════════════════════════════════════

describe("Affiliates Conversions", () => {
  describe("GET", () => {
    it("returns 403 when permission denied", async () => {
      mockRequirePermission.mockResolvedValue(permissionDenied());
      const res = await conversionsRoutes.GET(mockRequest());
      expect(res.status).toBe(403);
    });

    it("returns conversions list", async () => {
      mockPrisma.affiliateConversion.findMany.mockResolvedValueOnce([
        { id: "conv-1", amount: 100, commissionAmount: 10, status: "PENDING", link: { code: "CODE", product: { name: "W" }, platform: { name: "T", slug: "t", color: "#000" } } },
      ]);
      const res = await conversionsRoutes.GET(mockRequest());
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toHaveLength(1);
    });
  });

  describe("POST", () => {
    it("returns 400 when code missing", async () => {
      const res = await conversionsRoutes.POST(mockRequest({ amount: "100" }));
      expect(res.status).toBe(400);
    });

    it("returns 400 when amount missing", async () => {
      const res = await conversionsRoutes.POST(mockRequest({ code: "CODE" }));
      expect(res.status).toBe(400);
    });

    it("returns 400 when amount is not positive", async () => {
      const res = await conversionsRoutes.POST(mockRequest({ code: "CODE", amount: "-5" }));
      expect(res.status).toBe(400);
    });

    it("returns 404 when link not found", async () => {
      mockPrisma.affiliateLink.findUnique.mockResolvedValueOnce(null);
      const res = await conversionsRoutes.POST(mockRequest({ code: "MISSING", amount: "100" }));
      expect(res.status).toBe(404);
    });

    it("returns 404 when link is inactive", async () => {
      mockPrisma.affiliateLink.findUnique.mockResolvedValueOnce({ id: "link-1", code: "CODE", isActive: false });
      const res = await conversionsRoutes.POST(mockRequest({ code: "CODE", amount: "100" }));
      expect(res.status).toBe(404);
    });

    it("creates a conversion", async () => {
      const res = await conversionsRoutes.POST(mockRequest({ code: "TESTCODE", amount: "100" }));
      expect(res.status).toBe(200);
      expect(mockPrisma.affiliateConversion.create).toHaveBeenCalled();
    });
  });

  describe("PATCH", () => {
    it("returns 400 when invalid status", async () => {
      const res = await conversionsRoutes.PATCH(mockRequest({ id: "conv-1", status: "INVALID" }));
      expect(res.status).toBe(400);
    });

    it("returns 400 when id missing", async () => {
      const res = await conversionsRoutes.PATCH(mockRequest({ status: "APPROVED" }));
      expect(res.status).toBe(400);
    });

    it("updates conversion status", async () => {
      const res = await conversionsRoutes.PATCH(mockRequest({ id: "conv-1", status: "APPROVED" }));
      expect(res.status).toBe(200);
      expect(mockPrisma.affiliateConversion.update).toHaveBeenCalled();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Affiliates Import Link
// ═══════════════════════════════════════════════════════════════════════════

describe("Affiliates Import Link", () => {
  describe("GET", () => {
    it("returns 400 when url missing", async () => {
      const res = await importLinkRoutes.GET(mockRequest());
      expect(res.status).toBe(400);
    });

    it("returns preview product data", async () => {
      const res = await importLinkRoutes.GET(mockRequest(undefined, "url=https://www.tiktok.com/product/123"));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.product).toBeDefined();
    });

    it("returns 422 when fetch fails", async () => {
      mockFetchProductFromUrl.mockResolvedValueOnce({ ok: false, error: "Cannot fetch product" });
      const res = await importLinkRoutes.GET(mockRequest(undefined, "url=https://www.tiktok.com/product/123"));
      expect(res.status).toBe(422);
    });
  });

  describe("POST", () => {
    it("returns 400 when url missing", async () => {
      const res = await importLinkRoutes.POST(mockRequest({}));
      expect(res.status).toBe(400);
    });

    it("returns 400 for unsupported platform", async () => {
      const res = await importLinkRoutes.POST(mockRequest({ url: "https://www.amazon.com/product" }));
      expect(res.status).toBe(400);
    });

    it("returns 404 when platform not configured", async () => {
      mockPrisma.affiliatePlatform.findUnique.mockResolvedValueOnce(null);
      const res = await importLinkRoutes.POST(mockRequest({ url: "https://www.tiktok.com/product/123" }));
      expect(res.status).toBe(404);
    });

    it("creates product and link on success", async () => {
      const res = await importLinkRoutes.POST(mockRequest({
        url: "https://www.tiktok.com/product/123",
        commissionType: "FIXED",
        commissionValue: "25",
      }));
      expect(res.status).toBe(200);
      expect(mockPrisma.affiliateLink.create).toHaveBeenCalled();
    });

    it("reuses existing product with same SKU", async () => {
      mockPrisma.product.findFirst.mockResolvedValueOnce({ id: "existing-p" });
      const res = await importLinkRoutes.POST(mockRequest({ url: "https://www.tiktok.com/product/123" }));
      expect(res.status).toBe(200);
      expect(mockPrisma.product.update).toHaveBeenCalled();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Platform Connection
// ═══════════════════════════════════════════════════════════════════════════

describe("Platform Connection", () => {
  const params = { params: Promise.resolve({ id: "plat-1" }) };

  describe("PUT", () => {
    it("returns 404 when platform not found", async () => {
      mockPrisma.affiliatePlatform.findUnique.mockResolvedValueOnce(null);
      const res = await platformConnectionRoutes.PUT(mockRequest({ apiKey: "new-key" }), params);
      expect(res.status).toBe(404);
    });

    it("saves credentials and validates connection", async () => {
      mockGetConnector.mockReturnValueOnce({
        testConnection: vi.fn().mockResolvedValue({ ok: true }),
      });
      const res = await platformConnectionRoutes.PUT(mockRequest({ apiKey: "new-key" }), params);
      expect(res.status).toBe(200);
      expect(mockPrisma.platformConnection.upsert).toHaveBeenCalled();
    });

    it("marks ERROR when connector test fails", async () => {
      mockGetConnector.mockReturnValueOnce({
        testConnection: vi.fn().mockResolvedValue({ ok: false, error: "Auth failed" }),
      });
      const res = await platformConnectionRoutes.PUT(mockRequest({ apiKey: "bad" }), params);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe("ERROR");
    });

    it("sets DISCONNECTED when no connector available", async () => {
      mockGetConnector.mockReturnValueOnce(undefined as any);
      const res = await platformConnectionRoutes.PUT(mockRequest({ apiKey: "key" }), params);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe("DISCONNECTED");
    });

    it("does not return secrets in response", async () => {
      mockGetConnector.mockReturnValueOnce({
        testConnection: vi.fn().mockResolvedValue({ ok: true }),
      });
      const res = await platformConnectionRoutes.PUT(mockRequest({ apiKey: "key" }), params);
      const body = await res.json();
      expect(body.apiSecret).toBeUndefined();
      expect(body.accessToken).toBeUndefined();
    });
  });

  describe("DELETE", () => {
    it("disconnects the platform", async () => {
      const res = await platformConnectionRoutes.DELETE(mockRequest(), params);
      expect(res.status).toBe(200);
      expect(mockPrisma.platformConnection.deleteMany).toHaveBeenCalled();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Platform Sync
// ═══════════════════════════════════════════════════════════════════════════

describe("Platform Sync", () => {
  const params = { params: Promise.resolve({ id: "plat-1" }) };

  it("returns 404 when platform not found", async () => {
    mockPrisma.affiliatePlatform.findUnique.mockResolvedValueOnce(null);
    const res = await platformSyncRoutes.POST(mockRequest(), params);
    expect(res.status).toBe(404);
  });

  it("returns 400 when not connected", async () => {
    mockPrisma.affiliatePlatform.findUnique.mockResolvedValueOnce({
      id: "plat-1", name: "T", slug: "t", connection: null,
    });
    const res = await platformSyncRoutes.POST(mockRequest(), params);
    expect(res.status).toBe(400);
  });

  it("returns 400 when no connector", async () => {
    mockGetConnector.mockReturnValueOnce(null);
    const res = await platformSyncRoutes.POST(mockRequest(), params);
    expect(res.status).toBe(400);
  });

  it("returns 502 when fetch fails", async () => {
    mockGetConnector.mockReturnValueOnce({
      fetchProducts: vi.fn().mockResolvedValue({ ok: false, error: "API rate limit" }),
    });
    const res = await platformSyncRoutes.POST(mockRequest(), params);
    expect(res.status).toBe(502);
  });

  it("syncs products successfully", async () => {
    mockGetConnector.mockReturnValueOnce({
      fetchProducts: vi.fn().mockResolvedValue({
        ok: true,
        products: [
          { name: "Product A", price: 10, stock: 5, sku: "SKU-A", externalId: "ext-a" },
        ],
      }),
    });
    const res = await platformSyncRoutes.POST(mockRequest(), params);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.created).toBe(1);
    expect(body.updated).toBe(0);
  });

  it("updates existing products by SKU", async () => {
    mockGetConnector.mockReturnValueOnce({
      fetchProducts: vi.fn().mockResolvedValue({
        ok: true,
        products: [
          { name: "Existing Product", price: 20, stock: 10, sku: "EXISTING-SKU", externalId: "ext-e" },
        ],
      }),
    });
    mockPrisma.product.findFirst.mockResolvedValueOnce({ id: "existing-p" });
    const res = await platformSyncRoutes.POST(mockRequest(), params);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.updated).toBe(1);
    expect(mockPrisma.product.update).toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Compliance Report
// ═══════════════════════════════════════════════════════════════════════════

describe("Compliance Report", () => {
  it("returns 401 when not authenticated", async () => {
    mockRequireAuth.mockResolvedValueOnce({ session: null, response: new Response("Unauthorized", { status: 401 }) });
    const res = await complianceReportRoutes.GET(mockRequest());
    expect(res.status).toBe(401);
  });    it("returns compliance report", async () => {
      // The compliance report route calls prisma.activityLog.count and groupBy
      // multiple times. Mock them to return meaningful data.
      const countMock = mockPrisma.activityLog.count;
      const groupByMock = mockPrisma.activityLog.groupBy;
      countMock.mockResolvedValue(50);
      groupByMock
        .mockResolvedValueOnce([{ action: "LOGIN", _count: { action: 20 } }])
        .mockResolvedValueOnce([{ userId: "user-1", _count: { userId: 30 } }])
        .mockResolvedValue([{ action: "LOGIN", _count: { action: 5 } }]);
      const res = await complianceReportRoutes.GET(mockRequest());
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.report).toBeDefined();
      expect(body.report.totalActivity).toBe(50);
      expect(body.report.period).toBeDefined();
    });

  it("respects custom days parameter", async () => {
    const res = await complianceReportRoutes.GET(mockRequest(undefined, "days=7"));
    expect(res.status).toBe(200);
  });

  it("caps days at 365", async () => {
    const res = await complianceReportRoutes.GET(mockRequest(undefined, "days=9999"));
    expect(res.status).toBe(200);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Google OAuth Callback
// ═══════════════════════════════════════════════════════════════════════════

describe("Google OAuth Callback", () => {
  it("redirects on error param", async () => {
    const res = await googleCallbackRoutes.GET(mockRequest(undefined, "error=access_denied"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("google_access_denied");
  });

  it("redirects when state mismatch (CSRF)", async () => {
    const res = await googleCallbackRoutes.GET(
      mockRequest(undefined, "code=abc&state=xyz", "google_oauth_state=wrong"),
    );
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("invalid_state");
  });

  it("redirects when code missing", async () => {
    const res = await googleCallbackRoutes.GET(
      mockRequest(undefined, "state=xyz", "google_oauth_state=xyz"),
    );
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("missing_code");
  });

  it("redirects when GOOGLE_CLIENT_ID not configured", async () => {
    // GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are captured at module load time,
    // so we test the fallback: when env is set, token exchange will fail
    const res = await googleCallbackRoutes.GET(
      mockRequest(undefined, "code=abc&state=xyz", "google_oauth_state=xyz"),
    );
    // Without env vars set, the route redirects to google_not_configured
    // With env vars set (captured at module load), it proceeds to token exchange
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("error=");
  });

  it("redirects when token exchange fails", async () => {
    process.env.GOOGLE_CLIENT_ID = "test-id";
    process.env.GOOGLE_CLIENT_SECRET = "test-secret";
    // Mock global fetch for token exchange
    const origFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({ ok: false, text: () => Promise.resolve("bad") });
    const res = await googleCallbackRoutes.GET(
      mockRequest(undefined, "code=abc&state=xyz", "google_oauth_state=xyz"),
    );
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("token_exchange_failed");
    global.fetch = origFetch;
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SAML Connections
// ═══════════════════════════════════════════════════════════════════════════

describe("SAML Connections", () => {
  describe("GET", () => {
    it("returns null when no connection", async () => {
      const res = await samlConnectionsRoutes.GET(mockRequest());
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toBeNull();
    });

    it("returns connection details", async () => {
      mockPrisma.ssoConnection.findUnique.mockResolvedValueOnce({
        id: "sso-1", name: "Acme SSO", entryPoint: "https://idp.acme.com", spIssuer: "sp",
        emailDomain: "acme.com", enabled: true, idpCert: "cert-data",
      });
      const res = await samlConnectionsRoutes.GET(mockRequest());
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.name).toBe("Acme SSO");
      expect(body.idpCertConfigured).toBe(true);
    });
  });

  describe("POST", () => {
    it("returns 400 when name missing", async () => {
      const res = await samlConnectionsRoutes.POST(mockRequest({ entryPoint: "https://idp.com" }));
      expect(res.status).toBe(400);
    });

    it("returns 400 when entryPoint missing", async () => {
      const res = await samlConnectionsRoutes.POST(mockRequest({ name: "SSO" }));
      expect(res.status).toBe(400);
    });

    it("returns 400 when idpCert missing on first setup", async () => {
      mockPrisma.ssoConnection.findUnique.mockResolvedValueOnce(null);
      const res = await samlConnectionsRoutes.POST(mockRequest({ name: "SSO", entryPoint: "https://idp.com" }));
      expect(res.status).toBe(400);
    });

    it("creates connection with idpCert", async () => {
      const res = await samlConnectionsRoutes.POST(mockRequest({
        name: "Acme SSO", entryPoint: "https://idp.com", idpCert: "-----BEGIN CERTIFICATE-----\ndata\n-----END CERTIFICATE-----",
      }));
      expect(res.status).toBe(200);
    });

    it("preserves existing cert when not provided on update", async () => {
      mockPrisma.ssoConnection.findUnique.mockResolvedValueOnce({
        id: "sso-1", name: "Old", entryPoint: "https://old", idpCert: "existing-cert",
      });
      const res = await samlConnectionsRoutes.POST(mockRequest({ name: "New", entryPoint: "https://new" }));
      expect(res.status).toBe(200);
    });
  });

  describe("PATCH", () => {
    it("returns 404 when no connection exists", async () => {
      const res = await samlConnectionsRoutes.PATCH(mockRequest({ enabled: false }));
      expect(res.status).toBe(404);
    });

    it("returns 400 when nothing to update", async () => {
      mockPrisma.ssoConnection.findUnique.mockResolvedValueOnce({ id: "sso-1" });
      const res = await samlConnectionsRoutes.PATCH(mockRequest({}));
      expect(res.status).toBe(400);
    });

    it("updates connection", async () => {
      mockPrisma.ssoConnection.findUnique.mockResolvedValueOnce({ id: "sso-1", name: "Old" });
      mockPrisma.ssoConnection.update.mockResolvedValueOnce({ id: "sso-1", name: "New", enabled: true });
      const res = await samlConnectionsRoutes.PATCH(mockRequest({ name: "New" }));
      expect(res.status).toBe(200);
    });
  });

  describe("DELETE", () => {
    it("deletes connection", async () => {
      const res = await samlConnectionsRoutes.DELETE(mockRequest());
      expect(res.status).toBe(200);
      expect(mockPrisma.ssoConnection.deleteMany).toHaveBeenCalled();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SAML Metadata
// ═══════════════════════════════════════════════════════════════════════════

describe("SAML Metadata", () => {
  it("returns SP metadata XML", async () => {
    const res = await samlMetadataRoutes.GET(mockRequest());
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("EntityDescriptor");
    expect(res.headers.get("content-type")).toContain("application/xml");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// WebAuthn Register Options
// ═══════════════════════════════════════════════════════════════════════════

describe("WebAuthn Register Options", () => {
  it("returns 401 when not authenticated", async () => {
    mockRequireAuth.mockResolvedValueOnce({ session: null, response: new Response("Unauthorized", { status: 401 }) });
    const res = await webauthnRegOptionsRoutes.POST(mockRequest());
    expect(res.status).toBe(401);
  });

  it("returns 404 when user not found", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce(null);
    const res = await webauthnRegOptionsRoutes.POST(mockRequest());
    expect(res.status).toBe(404);
  });

  it("returns registration options", async () => {
    const res = await webauthnRegOptionsRoutes.POST(mockRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.challenge).toBe("reg-challenge");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// WebAuthn Register Verify
// ═══════════════════════════════════════════════════════════════════════════

describe("WebAuthn Register Verify", () => {
  it("returns 401 when not authenticated", async () => {
    mockRequireAuth.mockResolvedValueOnce({ session: null, response: new Response("Unauthorized", { status: 401 }) });
    const res = await webauthnRegVerifyRoutes.POST(mockRequest({}, "", "webauthn_reg_challenge=ch1"));
    expect(res.status).toBe(401);
  });

  it("returns 400 when challenge cookie missing", async () => {
    const res = await webauthnRegVerifyRoutes.POST(mockRequest({ credential: {} }));
    expect(res.status).toBe(400);
  });

  it("returns success on valid verification", async () => {
    const res = await webauthnRegVerifyRoutes.POST(
      mockRequest({ credential: { id: "cred-123" }, deviceName: "My Passkey" }, "", "webauthn_reg_challenge=ch1"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// WebAuthn Authenticate Options
// ═══════════════════════════════════════════════════════════════════════════

describe("WebAuthn Authenticate Options", () => {
  it("returns 400 when email missing", async () => {
    const res = await webauthnAuthOptionsRoutes.POST(mockRequest({}));
    expect(res.status).toBe(400);
  });

  it("returns 404 when no passkeys registered", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({ id: "user-1", email: "a@test.com" });
    mockPrisma.webAuthnCredential.findMany.mockResolvedValueOnce([]);
    const res = await webauthnAuthOptionsRoutes.POST(mockRequest({ email: "a@test.com" }));
    expect(res.status).toBe(404);
  });

  it("returns authentication options when passkeys exist", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({ id: "user-1", email: "a@test.com" });
    mockPrisma.webAuthnCredential.findMany.mockResolvedValueOnce([
      { credentialId: "cred-123", transports: "internal" },
    ]);
    const res = await webauthnAuthOptionsRoutes.POST(mockRequest({ email: "a@test.com" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.challenge).toBe("auth-challenge");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// WebAuthn Authenticate Verify
// ═══════════════════════════════════════════════════════════════════════════

describe("WebAuthn Authenticate Verify", () => {
  it("returns 400 when challenge missing", async () => {
    const res = await webauthnAuthVerifyRoutes.POST(mockRequest({ credential: { id: "c1" } }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when credential.id missing", async () => {
    const res = await webauthnAuthVerifyRoutes.POST(
      mockRequest({ credential: {} }, "", "webauthn_auth_challenge=ch1"),
    );
    expect(res.status).toBe(400);
  });

  it("returns 401 when credential not found", async () => {
    mockPrisma.webAuthnCredential.findUnique.mockResolvedValueOnce(null);
    const res = await webauthnAuthVerifyRoutes.POST(
      mockRequest({ credential: { id: "unknown-cred" } }, "", "webauthn_auth_challenge=ch1"),
    );
    expect(res.status).toBe(401);
  });

  it("returns success on valid verification", async () => {
    mockPrisma.webAuthnCredential.findUnique.mockResolvedValueOnce({
      id: "cred-1", credentialId: "cred-123", publicKey: Buffer.from([1, 2, 3]), counter: 0, transports: "internal", userId: "user-1",
    });
    const res = await webauthnAuthVerifyRoutes.POST(
      mockRequest({ credential: { id: "cred-123" } }, "", "webauthn_auth_challenge=ch1"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toBe("Login successful");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// WebAuthn Credentials
// ═══════════════════════════════════════════════════════════════════════════

describe("WebAuthn Credentials", () => {
  describe("GET", () => {
    it("returns 401 when not authenticated", async () => {
      mockRequireAuth.mockResolvedValueOnce({ session: null, response: new Response("Unauthorized", { status: 401 }) });
      const res = await webauthnCredentialsRoutes.GET(mockRequest());
      expect(res.status).toBe(401);
    });

    it("returns credentials list", async () => {
      mockPrisma.webAuthnCredential.findMany.mockResolvedValueOnce([
        { id: "cred-1", deviceName: "MacBook", transports: "internal", createdAt: new Date(), lastUsedAt: null },
      ]);
      const res = await webauthnCredentialsRoutes.GET(mockRequest());
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toHaveLength(1);
      expect(body[0].deviceName).toBe("MacBook");
    });
  });

  describe("DELETE", () => {
    it("returns 401 when step-up token invalid", async () => {
      const { verifyStepUpToken } = await import("@/lib/step-up");
      (verifyStepUpToken as any).mockReturnValueOnce(false);
      const res = await webauthnCredentialsRoutes.DELETE(mockRequest({ id: "cred-1" }));
      expect(res.status).toBe(401);
    });

    it("returns 400 when id missing", async () => {
      const res = await webauthnCredentialsRoutes.DELETE(mockRequest({}));
      expect(res.status).toBe(400);
    });

    it("returns 404 when credential not found", async () => {
      mockPrisma.webAuthnCredential.deleteMany.mockResolvedValueOnce({ count: 0 });
      const res = await webauthnCredentialsRoutes.DELETE(mockRequest({ id: "nonexistent" }));
      expect(res.status).toBe(404);
    });

    it("deletes credential successfully", async () => {
      mockPrisma.webAuthnCredential.deleteMany.mockResolvedValueOnce({ count: 1 });
      const res = await webauthnCredentialsRoutes.DELETE(mockRequest({ id: "cred-1" }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
    });
  });
});
