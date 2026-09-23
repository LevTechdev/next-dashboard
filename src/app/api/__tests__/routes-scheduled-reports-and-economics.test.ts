import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockRequireAuth, mockRequirePermission, mockPrisma, mockSendEmail } = vi.hoisted(() => {
  return {
    mockRequireAuth: vi.fn(),
    mockRequirePermission: vi.fn(),
    mockPrisma: {
      order: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
      },
      campaign: {
        findMany: vi.fn(),
      },
    },
    mockSendEmail: vi.fn(),
  };
});

vi.mock("@/lib/api-guard", () => ({
  requireAuth: mockRequireAuth,
  requirePermission: mockRequirePermission,
}));

vi.mock("@/lib/db", () => ({
  prisma: mockPrisma,
}));

vi.mock("@/lib/email", () => ({
  sendEmail: mockSendEmail,
}));

import * as scheduledReportsRoute from "../reports/scheduled/route";
import * as sendDigestRoute from "../reports/send-digest/route";
import * as marketingEconomicsRoute from "../analytics/marketing-unit-economics/route";
import * as orderPayRoute from "../orders/[id]/pay/route";

describe("Scheduled Reports API (/api/reports/scheduled)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue({
      session: { user: { id: "u-1", name: "Admin", email: "admin@test.com", role: "ADMIN" } },
      response: null,
    });
    mockRequirePermission.mockResolvedValue({
      role: "ADMIN",
      session: { user: { id: "u-1", name: "Admin", email: "admin@test.com", role: "ADMIN" } },
      response: null,
    });
  });

  it("GET returns the active scheduled report configuration", async () => {
    const req = new Request("http://localhost:3010/api/reports/scheduled");
    const res = await scheduledReportsRoute.GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.schedule).toHaveProperty("frequency");
    expect(data.schedule).toHaveProperty("recipients");
  });

  it("POST updates the scheduled report configuration", async () => {
    const req = new Request("http://localhost:3010/api/reports/scheduled", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        frequency: "MONTHLY",
        recipients: ["finance@company.com"],
        metrics: { gmv: true, topProducts: true, forecast: true, channelBreakdown: false },
      }),
    });
    const res = await scheduledReportsRoute.POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.schedule.frequency).toBe("MONTHLY");
    expect(data.schedule.recipients).toEqual(["finance@company.com"]);
  });

  it("POST rejects invalid frequency", async () => {
    const req = new Request("http://localhost:3010/api/reports/scheduled", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ frequency: "HOURLY" }),
    });
    const res = await scheduledReportsRoute.POST(req);
    expect(res.status).toBe(400);
  });
});

describe("Send Digest API (/api/reports/send-digest)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue({
      session: { user: { id: "u-1", name: "Admin", email: "admin@test.com", role: "ADMIN" } },
      response: null,
    });
    mockPrisma.order.findMany.mockResolvedValue([
      {
        id: "ord_1",
        grandTotal: 1500,
        paymentStatus: "PAID",
        createdAt: new Date(),
        items: [
          {
            name: "Smart Watch Elite",
            quantity: 5,
            price: 300,
            total: 1500,
            product: { name: "Smart Watch Elite", sku: "SW-01" },
          },
        ],
      },
    ]);
  });

  it("computes executive KPIs and dispatches digest email via sendEmail", async () => {
    const req = new Request("http://localhost:3010/api/reports/send-digest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "stakeholder@company.com" }),
    });

    const res = await sendDigestRoute.POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.sentTo).toBe("stakeholder@company.com");
    expect(data.summary.gmv).toBe(1500);
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "stakeholder@company.com",
        subject: expect.stringContaining("Executive Business Digest"),
      }),
    );
  });
});

describe("Marketing Unit Economics Analytics API (/api/analytics/marketing-unit-economics)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue({
      session: { user: { id: "u-1", name: "Admin", email: "admin@test.com", role: "ADMIN" } },
      response: null,
    });
    mockPrisma.order.findMany.mockResolvedValue([
      {
        id: "ord_1",
        grandTotal: 500,
        paymentStatus: "PAID",
        items: [
          {
            quantity: 2,
            price: 250,
            product: { price: 250, costPrice: 75 },
          },
        ],
      },
    ]);
    mockPrisma.campaign.findMany.mockResolvedValue([
      {
        id: "cmp_1",
        name: "Instagram Ads",
        spent: 120,
        status: "ACTIVE",
      },
    ]);
  });

  it("GET returns live unit economics and funnel flow-down", async () => {
    const req = new Request("http://localhost:3010/api/analytics/marketing-unit-economics");
    const res = await marketingEconomicsRoute.GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.unitEconomics).toHaveProperty("roas");
    expect(data.unitEconomics).toHaveProperty("breakEvenROAS");
    expect(data.unitEconomics).toHaveProperty("targetPriceMVP");
    expect(data.funnel).toHaveProperty("contributionMargin");
  });

  it("POST recalculates simulator scenario with custom inputs", async () => {
    const req = new Request("http://localhost:3010/api/analytics/marketing-unit-economics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        price: 150,
        cogs: 45,
        adSpend: 3000,
        conversions: 60,
        cpc: 1.2,
        conversionRate: 0.04,
      }),
    });
    const res = await marketingEconomicsRoute.POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.unitEconomics.roas).toBeGreaterThan(0);
    expect(data.unitEconomics.targetPriceMVP).toBeGreaterThan(0);
  });
});

describe("Order Pay Gateway Route (/api/orders/[id]/pay)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue({
      session: { user: { id: "u-1", name: "Admin", email: "admin@test.com", role: "ADMIN" } },
      response: null,
    });
  });

  it("returns 404 when order does not exist", async () => {
    mockPrisma.order.findUnique.mockResolvedValueOnce(null);
    const req = new Request("http://localhost:3010/api/orders/ord_missing/pay");
    const res = await orderPayRoute.GET(req, { params: Promise.resolve({ id: "ord_missing" }) });
    expect(res.status).toBe(404);
  });

  it("redirects to gateway payment when order exists", async () => {
    mockPrisma.order.findUnique.mockResolvedValueOnce({
      id: "ord_ok",
      orderNumber: "ORD-777",
      grandTotal: 100,
    });

    const req = new Request("http://localhost:3010/api/orders/ord_ok/pay?gateway=midtrans");
    const res = await orderPayRoute.GET(req, { params: Promise.resolve({ id: "ord_ok" }) });
    expect([302, 307]).toContain(res.status);
    expect(res.headers.get("location")).toContain("payment=midtrans_success");
  });
});
