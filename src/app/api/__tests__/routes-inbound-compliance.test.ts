import { describe, it, expect, vi, beforeEach } from "vitest";
import * as inboundShopifyRoute from "../webhooks/inbound/[platform]/route";
import * as dlqRoute from "../webhooks/inbound/dlq/route";
import * as compliancePackRoute from "../security/audit/compliance-pack/route";
import * as aiActionExecuteRoute from "../ai/actions/execute/route";
import { prisma } from "@/lib/db";
import crypto from "crypto";
import { PLATFORM_SECRETS } from "@/lib/inbound-webhooks";

// Mock DB
vi.mock("@/lib/db", () => ({
  prisma: {
    salesChannel: {
      findFirst: vi.fn().mockResolvedValue({ id: "chan-01", name: "Shopify Store" }),
    },
    customer: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi
        .fn()
        .mockResolvedValue({ id: "cust-01", name: "Shopify Buyer", totalSpent: 150000 }),
      update: vi.fn().mockResolvedValue({ id: "cust-01" }),
    },
    order: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({
        id: "ord-test-01",
        orderNumber: "#SHPF-9999",
        status: "PROCESSING",
        grandTotal: 150000,
      }),
    },
    orderItem: {
      create: vi.fn().mockResolvedValue({ id: "item-01" }),
    },
    activityLog: {
      create: vi.fn().mockResolvedValue({ id: "act-01" }),
    },
    discount: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockImplementation(({ data }) =>
        Promise.resolve({
          id: "disc-999",
          code: data.code,
          name: data.name,
          value: data.value,
          isActive: true,
        }),
      ),
    },
  },
}));

// Mock auth
vi.mock("@/lib/api-guard", () => ({
  requireAuth: vi.fn().mockResolvedValue({
    session: { user: { id: "user-admin", role: "ADMIN", tenantId: "default" } },
    response: null,
  }),
}));

vi.mock("@/lib/audit-chain", () => ({
  verifyAuditChain: vi.fn().mockResolvedValue({
    ok: true,
    total: 80,
    verified: 80,
    firstBreakSeq: null,
    breaks: [],
  }),
}));

describe("Inbound Webhooks, DLQ & Compliance API Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("POST /api/webhooks/inbound/shopify rejects unsigned requests and isolates to DLQ", async () => {
    const req = new Request("http://localhost:3010/api/webhooks/inbound/shopify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "123", total_price: 150000 }),
    });

    const res = await inboundShopifyRoute.POST(req, {
      params: Promise.resolve({ platform: "shopify" }),
    });

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.status).toBe("QUEUED_IN_DLQ");
    expect(json.dlqId).toBeDefined();
  });

  it("POST /api/webhooks/inbound/shopify ingests valid HMAC signed webhook", async () => {
    const payload = {
      id: "991823",
      name: "#SHPF-9918",
      total_price: 250000,
      currency: "IDR",
      financial_status: "paid",
      customer: { first_name: "Anita", last_name: "Dewi", email: "anita@domain.com" },
      line_items: [{ title: "Silk Scarf", sku: "SCRF-01", quantity: 1, price: 250000 }],
    };
    const rawBody = JSON.stringify(payload);
    const secret = PLATFORM_SECRETS.shopify;
    const validSig = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("base64");

    const req = new Request("http://localhost:3010/api/webhooks/inbound/shopify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-shopify-hmac-sha256": validSig,
      },
      body: rawBody,
    });

    const res = await inboundShopifyRoute.POST(req, {
      params: Promise.resolve({ platform: "shopify" }),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.platform).toBe("shopify");
    expect(prisma.order.create).toHaveBeenCalled();
  });

  it("GET /api/webhooks/inbound/dlq returns queue statistics", async () => {
    const req = new Request("http://localhost:3010/api/webhooks/inbound/dlq");
    const res = await dlqRoute.GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.summary).toBeDefined();
    expect(Array.isArray(json.entries)).toBe(true);
  });

  it("GET /api/security/audit/compliance-pack returns structured compliance pack and HTML certificate", async () => {
    const jsonReq = new Request("http://localhost:3010/api/security/audit/compliance-pack");
    const jsonRes = await compliancePackRoute.GET(jsonReq);
    expect(jsonRes.status).toBe(200);
    const body = await jsonRes.json();
    expect(body.ok).toBe(true);
    expect(body.pack.merkleChain.ok).toBe(true);

    const htmlReq = new Request(
      "http://localhost:3010/api/security/audit/compliance-pack?format=html",
    );
    const htmlRes = await compliancePackRoute.GET(htmlReq);
    expect(htmlRes.status).toBe(200);
    const text = await htmlRes.text();
    expect(text).toContain("Enterprise Compliance & Audit Proof Pack");
  });

  it("POST /api/ai/actions/execute executes discount proposal", async () => {
    const req = new Request("http://localhost:3010/api/ai/actions/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        proposal: {
          id: "prop-test-01",
          type: "CREATE_DISCOUNT",
          title: "Launch 15% VIP Win-Back Discount",
          description: "Re-engage at risk VIPs",
          payload: { code: "TESTWB15", value: 15, durationDays: 14 },
        },
      }),
    });

    const res = await aiActionExecuteRoute.POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.resultId).toBe("disc-999");
  });
});
