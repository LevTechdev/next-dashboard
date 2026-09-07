import { describe, it, expect, vi, beforeEach } from "vitest";
import * as healthRoute from "../health/route";
import * as cohortsRoute from "../analytics/cohorts/route";
import * as chatAlertsRoute from "../integrations/chat-alerts/route";
import * as chatAlertsTestRoute from "../integrations/chat-alerts/test/route";
import { prisma } from "@/lib/db";

// Mock DB
vi.mock("@/lib/db", () => ({
  prisma: {
    $queryRaw: vi.fn(),
    user: { count: vi.fn() },
    customer: { count: vi.fn(), findMany: vi.fn() },
    order: { count: vi.fn(), findMany: vi.fn() },
    product: { count: vi.fn() },
  },
}));

describe("Health API (/api/health)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns healthy status 200 with db latency and memory telemetry", async () => {
    (prisma.$queryRaw as any).mockResolvedValueOnce([{ 1: 1 }]);
    const req = new Request("http://localhost:3010/api/health");
    const res = await healthRoute.GET(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe("healthy");
    expect(json.database.status).toBe("connected");
    expect(typeof json.database.latencyMs).toBe("number");
    expect(json.system.memory.heapUsedMb).toBeGreaterThan(0);
    expect(json.version).toBe("0.1.0");
  });

  it("returns deep counts when ?deep=true is requested", async () => {
    (prisma.$queryRaw as any).mockResolvedValueOnce([{ 1: 1 }]);
    (prisma.user.count as any).mockResolvedValueOnce(3);
    (prisma.customer.count as any).mockResolvedValueOnce(12);
    (prisma.order.count as any).mockResolvedValueOnce(150);
    (prisma.product.count as any).mockResolvedValueOnce(8);

    const req = new Request("http://localhost:3010/api/health?deep=true");
    const res = await healthRoute.GET(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.dataCounts).toEqual({
      users: 3,
      customers: 12,
      orders: 150,
      products: 8,
    });
  });

  it("returns 503 degraded status when database query fails", async () => {
    (prisma.$queryRaw as any).mockRejectedValueOnce(new Error("Connection refused"));
    const req = new Request("http://localhost:3010/api/health");
    const res = await healthRoute.GET(req);

    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.status).toBe("degraded");
    expect(json.database.status).toBe("disconnected");
    expect(json.database.error).toContain("Connection refused");
  });
});

describe("Cohorts Analytics API (/api/analytics/cohorts)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("computes 12-month cohort matrix and LTV:CAC curve", async () => {
    (prisma.customer.findMany as any).mockResolvedValueOnce([
      {
        id: "c1",
        name: "Alice",
        email: "alice@test.com",
        createdAt: new Date("2025-01-10"),
        totalSpent: 450,
        totalOrders: 3,
        lastOrderDate: new Date("2025-03-10"),
      },
    ]);
    (prisma.order.findMany as any).mockResolvedValueOnce([
      {
        id: "o1",
        customerId: "c1",
        grandTotal: 150,
        status: "DELIVERED",
        createdAt: new Date("2025-01-10"),
      },
      {
        id: "o2",
        customerId: "c1",
        grandTotal: 300,
        status: "DELIVERED",
        createdAt: new Date("2025-02-14"),
      },
    ]);

    const res = await cohortsRoute.GET();
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(Array.isArray(json.cohorts)).toBe(true);
    expect(Array.isArray(json.ltvCacCurve)).toBe(true);
    expect(json.rfmSegments).toHaveLength(5);
    expect(json.summary.blendedCac).toBe(55);
    expect(json.summary.totalCohortCustomers).toBeGreaterThan(0);
  });
});

describe("Chat Alerts API (/api/integrations/chat-alerts)", () => {
  it("GET returns channels, trigger rules, and delivery logs", async () => {
    const res = await chatAlertsRoute.GET();
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(Array.isArray(json.channels)).toBe(true);
    expect(json.rules.stockoutDoiThreshold).toBeDefined();
    expect(json.rules.vipOrderMinAmount).toBeDefined();
    expect(Array.isArray(json.deliveries)).toBe(true);
  });

  it("POST saves and updates a channel configuration", async () => {
    const req = new Request("http://localhost:3010/api/integrations/chat-alerts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Test Slack Ops",
        platform: "slack",
        webhookUrl: "simulation://slack.test",
        channelName: "#test-ops",
        enabledEvents: ["stockout", "vip_order"],
      }),
    });

    const res = await chatAlertsRoute.POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.channel.name).toBe("Test Slack Ops");
    expect(json.channel.platform).toBe("slack");

    // Clean up channel
    const delReq = new Request(
      `http://localhost:3010/api/integrations/chat-alerts?id=${json.channel.id}`,
      {
        method: "DELETE",
      },
    );
    const delRes = await chatAlertsRoute.DELETE(delReq);
    expect(delRes.status).toBe(200);
  });

  it("POST test dispatcher executes simulated ping and logs receipt", async () => {
    const req = new Request("http://localhost:3010/api/integrations/chat-alerts/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        platform: "slack",
        event: "stockout",
        webhookUrl: "simulation://slack.test",
      }),
    });

    const res = await chatAlertsTestRoute.POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.isSimulated).toBe(true);
    expect(json.statusCode).toBe(200);
    expect(json.payload.text).toContain("CRITICAL STOCKOUT");
    expect(json.delivery.status).toBe("SIMULATED");
  });
});
