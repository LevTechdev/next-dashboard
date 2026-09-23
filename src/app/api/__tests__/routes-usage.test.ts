import { describe, it, expect, vi, beforeEach } from "vitest";

// ═══════════════════════════════════════════════════════════════════════════
// Hoisted mocks
// ═══════════════════════════════════════════════════════════════════════════

const { mockPrisma, mockRequirePermission, mockRequireAuth } = vi.hoisted(() => ({
  mockPrisma: {
    order: { count: vi.fn() },
    user: { count: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), findUnique: vi.fn() },
    apiKey: { count: vi.fn(), create: vi.fn() },
    auditLog: { create: vi.fn() },
    subscription: { findFirst: vi.fn() },
    usageRecord: { findFirst: vi.fn(), update: vi.fn(), create: vi.fn(), findMany: vi.fn() },
    notification: { findFirst: vi.fn(), create: vi.fn() },
  },
  mockRequirePermission: vi.fn(),
  mockRequireAuth: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/api-guard", () => ({
  requirePermission: mockRequirePermission,
  requireAuth: mockRequireAuth,
}));

// Tier lookup hits the DB — mock the resolvers so REGULAR/PRO/ENTERPRISE are
// all exercisable without a real subscription row. The workspace resolver
// delegates to the user resolver unless the tier is explicitly overridden.
const tierByUser = new Map<string, "REGULAR" | "PRO" | "ENTERPRISE">();
vi.mock("@/lib/plan-tiers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/plan-tiers")>();
  return {
    ...actual,
    getTierFeaturesForUser: vi.fn(async (userId: string) => {
      const tier = tierByUser.get(userId) ?? "REGULAR";
      return actual.TIER_FEATURES[tier];
    }),
    getTierFeaturesForWorkspace: vi.fn(async (userId: string) => {
      const tier = tierByUser.get(userId) ?? "REGULAR";
      return actual.TIER_FEATURES[tier];
    }),
  };
});

import { GET as usageGET } from "@/app/api/usage/route";
import { POST as apiKeysPOST } from "@/app/api/api-keys/route";
import { API_KEY_LIMITS } from "@/lib/plan-tiers";

// ═══════════════════════════════════════════════════════════════════════════
// Fixtures
// ═══════════════════════════════════════════════════════════════════════════

const ADMIN_ID = "user_admin_1";

function granted(tenantId: string | null = "tenant_1") {
  return {
    role: "ADMIN",
    session: {
      user: {
        id: ADMIN_ID,
        sub: ADMIN_ID,
        name: "Admin",
        email: "a@x.dev",
        role: "ADMIN",
        tenantId,
      },
    },
    response: null,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  tierByUser.set(ADMIN_ID, "REGULAR");
  mockRequirePermission.mockResolvedValue(granted());
  mockRequireAuth.mockResolvedValue({ session: granted().session, response: null });
  mockPrisma.order.count.mockResolvedValue(0);
  mockPrisma.user.count.mockResolvedValue(1);
  mockPrisma.apiKey.count.mockResolvedValue(0);
  // Metering persistence + history + threshold-notify defaults (no-ops)
  mockPrisma.subscription.findFirst.mockResolvedValue({ id: "sub_1" });
  mockPrisma.usageRecord.findFirst.mockResolvedValue(null);
  mockPrisma.usageRecord.findMany.mockResolvedValue([]);
  mockPrisma.user.findMany.mockResolvedValue([{ id: ADMIN_ID }]);
  mockPrisma.notification.findFirst.mockResolvedValue(null);
  mockPrisma.notification.create.mockResolvedValue({});
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/usage
// ═══════════════════════════════════════════════════════════════════════════

describe("GET /api/usage", () => {
  it("denies unauthenticated callers via requirePermission", async () => {
    mockRequirePermission.mockResolvedValue({
      role: null,
      response: new Response("no", { status: 401 }),
    });
    const res = await usageGET(new Request("http://local/api/usage"));
    expect(res.status).toBe(401);
  });

  it("reports capped quotas for a REGULAR user", async () => {
    mockPrisma.order.count.mockResolvedValue(37);
    mockPrisma.user.count.mockResolvedValue(2);
    mockPrisma.apiKey.count.mockResolvedValue(1);

    const res = await usageGET(new Request("http://local/api/usage"));
    expect(res.status).toBe(200);
    const body = await res.json();

    // `trial` is null on Starter but populated (daysLeft/endsAt) while a
    // PRO trial from signup is still running.
    expect(body.plan).toEqual({ name: "Starter", tier: "REGULAR", trial: null });
    expect(body.orders).toEqual({ used: 37, limit: 100 });
    expect(body.teamMembers).toEqual({ used: 2, limit: 3 });
    expect(body.apiKeys).toEqual({ used: 1, limit: 2 });
    expect(body.period.start).toBeTruthy();
    expect(body.period.end).toBeTruthy();
  });

  it("scopes order counting to the calendar month period", async () => {
    await usageGET(new Request("http://local/api/usage"));
    const where = mockPrisma.order.count.mock.calls[0][0].where;
    expect(where.tenantId).toBe("tenant_1");
    expect(new Date(where.createdAt.gte).getDate()).toBe(1);
    expect(new Date(where.createdAt.gte).getHours()).toBe(0);
    expect(new Date(where.createdAt.lt).getMonth()).toBe(new Date().getMonth() + 1);
  });

  it("returns null (unlimited) limits for ENTERPRISE", async () => {
    tierByUser.set(ADMIN_ID, "ENTERPRISE");
    const res = await usageGET(new Request("http://local/api/usage"));
    const body = await res.json();
    expect(body.orders.limit).toBeNull();
    expect(body.teamMembers.limit).toBeNull();
    expect(body.apiKeys.limit).toBeNull();
  });

  it("falls back to counting only the user when there is no tenant", async () => {
    mockRequirePermission.mockResolvedValue(granted(null));
    await usageGET(new Request("http://local/api/usage"));
    expect(mockPrisma.user.count).toHaveBeenCalledWith({ where: { id: ADMIN_ID } });
  });

  it("persists one snapshot per metric into UsageRecord for the current cycle", async () => {
    mockPrisma.order.count.mockResolvedValue(37);
    mockPrisma.user.count.mockResolvedValue(2);
    mockPrisma.apiKey.count.mockResolvedValue(1);

    await usageGET(new Request("http://local/api/usage"));

    expect(mockPrisma.usageRecord.create).toHaveBeenCalledTimes(3);
    const metrics = mockPrisma.usageRecord.create.mock.calls.map((c) => c[0]!.data.metric);
    expect(metrics).toEqual(expect.arrayContaining(["orders", "team_members", "api_keys"]));
    const ordersCall = mockPrisma.usageRecord.create.mock.calls.find(
      (c) => c[0]!.data.metric === "orders",
    );
    expect(ordersCall).toBeDefined();
    const ordersSnap = ordersCall![0]!.data;
    expect(ordersSnap.value).toBe(37);
    expect(ordersSnap.subscriptionId).toBe("sub_1");
    expect(new Date(ordersSnap.periodStart).getDate()).toBe(1);
  });

  it("refreshes the existing snapshot instead of duplicating rows", async () => {
    mockPrisma.usageRecord.findFirst.mockResolvedValue({ id: "ur_1" });

    await usageGET(new Request("http://local/api/usage"));

    expect(mockPrisma.usageRecord.create).not.toHaveBeenCalled();
    expect(mockPrisma.usageRecord.update).toHaveBeenCalledTimes(3);
  });

  it("returns the per-cycle history for the trend chart", async () => {
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1, 1);
    lastMonth.setHours(0, 0, 0, 0);
    mockPrisma.usageRecord.findMany.mockResolvedValue([
      { metric: "orders", value: 55, periodStart: lastMonth },
      { metric: "team_members", value: 2, periodStart: lastMonth },
      { metric: "api_keys", value: 1, periodStart: lastMonth },
    ]);

    const res = await usageGET(new Request("http://local/api/usage"));
    const body = await res.json();

    expect(body.history).toHaveLength(1);
    expect(body.history[0].orders).toBe(55);
    expect(body.history[0].teamMembers).toBe(2);
    expect(body.history[0].apiKeys).toBe(1);
    expect(body.history[0].cycle).toMatch(/^\d{4}-\d{2}$/);
  });

  it("notifies owners when a capped metric crosses 80% of quota", async () => {
    mockPrisma.order.count.mockResolvedValue(85); // 85/100 = 85%

    await usageGET(new Request("http://local/api/usage"));

    expect(mockPrisma.notification.create).toHaveBeenCalledTimes(1);
    const notif = mockPrisma.notification.create.mock.calls[0][0].data;
    // Billing type — quota alerts live in the inbox's dedicated Billing tab.
    expect(notif.type).toBe("billing");
    expect(notif.title).toContain("[Quota]");
    expect(notif.title).toContain("80%");
    expect(notif.description).toContain("85/100");
    expect(notif.link).toBe("/billing?tab=plans");
  });

  it("notifies owners when a capped metric reaches 100% of quota", async () => {
    mockPrisma.order.count.mockResolvedValue(100);

    await usageGET(new Request("http://local/api/usage"));

    expect(mockPrisma.notification.create).toHaveBeenCalledTimes(1);
    const notif = mockPrisma.notification.create.mock.calls[0][0].data;
    expect(notif.title).toContain("100%");
    expect(notif.description).toContain("Upgrade");
  });

  it("does not re-notify for the same cycle after the threshold notification exists", async () => {
    mockPrisma.order.count.mockResolvedValue(90);
    mockPrisma.notification.findFirst.mockResolvedValue({ id: "n_1" });

    await usageGET(new Request("http://local/api/usage"));

    expect(mockPrisma.notification.create).not.toHaveBeenCalled();
  });

  it("never notifies for unlimited (null) limits", async () => {
    tierByUser.set(ADMIN_ID, "ENTERPRISE");

    await usageGET(new Request("http://local/api/usage"));

    expect(mockPrisma.notification.create).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// API-key tier quota
// ═══════════════════════════════════════════════════════════════════════════

vi.mock("@/lib/pii", () => ({ withDecryptedCustomer: (x: unknown) => x }));

describe("POST /api/api-keys quota", () => {
  function postReq() {
    return new Request("http://local/api/api-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "CI key" }),
    });
  }

  it("402s once the REGULAR ceiling of active keys is reached", async () => {
    mockPrisma.apiKey.count.mockResolvedValue(API_KEY_LIMITS.REGULAR!);
    const res = await apiKeysPOST(postReq());
    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.error).toBe("plan_limit_reached");
    expect(body.limit).toBe("apiKeys");
    expect(body.used).toBe(API_KEY_LIMITS.REGULAR);
    expect(body.requiredTier).toBe("PRO");
  });

  it("allows creation under the ceiling (does not hit create in this unit, but passes the gate)", async () => {
    mockPrisma.apiKey.count.mockResolvedValue(API_KEY_LIMITS.REGULAR! - 1);
    mockPrisma.apiKey.create.mockResolvedValue({ id: "k1" });
    const res = await apiKeysPOST(postReq());
    expect(res.status).toBe(200);
  });

  it("never gates ENTERPRISE (null limit)", async () => {
    tierByUser.set(ADMIN_ID, "ENTERPRISE");
    mockPrisma.apiKey.create.mockResolvedValue({ id: "k2" });
    const res = await apiKeysPOST(postReq());
    expect(res.status).toBe(200);
    expect(mockPrisma.apiKey.count).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Tier limit table sanity
// ═══════════════════════════════════════════════════════════════════════════

describe("API_KEY_LIMITS", () => {
  it("rises with tier and is unlimited at ENTERPRISE", () => {
    expect(API_KEY_LIMITS.REGULAR).toBeLessThan(API_KEY_LIMITS.PRO!);
    expect(API_KEY_LIMITS.ENTERPRISE).toBeNull();
  });
});
