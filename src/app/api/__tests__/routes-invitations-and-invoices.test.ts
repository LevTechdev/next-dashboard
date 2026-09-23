import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from "vitest";
import fs from "fs";
import path from "path";
import { saveTenantBranding } from "@/lib/tenant-branding";

const { mockRequireAuth, mockRequirePermission, mockPrisma, mockSendEmail } = vi.hoisted(() => {
  return {
    mockRequireAuth: vi.fn(),
    mockRequirePermission: vi.fn(),
    mockPrisma: {
      order: {
        findUnique: vi.fn(),
        // Issue-time snapshot freeze on first invoice render (non-preview).
        update: vi.fn().mockResolvedValue({ invoiceSnapshot: null }),
      },
      // Team-seat quota gate (POST /api/team/invitations)
      user: { count: vi.fn() },
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

// Tier lookup for the seat-quota gate — keep tests on the unlimited default
// unless a case opts into a capped tier.
vi.mock("@/lib/plan-tiers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/plan-tiers")>();
  return {
    ...actual,
    getTierFeaturesForUser: vi.fn(async () => actual.TIER_FEATURES.ENTERPRISE),
  };
});

import * as invitationsRoute from "../team/invitations/route";
import * as orderInvoiceRoute from "../orders/[id]/invoice/route";

describe("Team Invitations Route (/api/team/invitations)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue({
      session: {
        user: { id: "u-admin", name: "Admin Boss", email: "boss@example.com", role: "ADMIN" },
      },
      response: null,
    });
    mockRequirePermission.mockResolvedValue({
      role: "ADMIN",
      session: {
        user: {
          id: "u-admin",
          name: "Admin Boss",
          email: "boss@example.com",
          role: "ADMIN",
          tenantId: "tenant_1",
        },
      },
      response: null,
    });
    mockPrisma.user.count.mockResolvedValue(2);
  });

  it("GET returns current list of invitations", async () => {
    const req = new Request("http://localhost:3010/api/team/invitations");
    const res = await invitationsRoute.GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("invitations");
    expect(Array.isArray(data.invitations)).toBe(true);
  });

  it("POST creates a new team invitation with custom channels and role", async () => {
    const req = new Request("http://localhost:3010/api/team/invitations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "charlie@company.com",
        role: "Manager",
        allowedChannels: ["Online Store", "TikTok Shop"],
        expiresInDays: 30,
      }),
    });
    const res = await invitationsRoute.POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.invitation.email).toBe("charlie@company.com");
    expect(data.invitation.role).toBe("Manager");
    expect(data.invitation.allowedChannels).toEqual(["Online Store", "TikTok Shop"]);
  });

  it("POST validates email requirement", async () => {
    const req = new Request("http://localhost:3010/api/team/invitations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        role: "Manager",
      }),
    });
    const res = await invitationsRoute.POST(req);
    expect(res.status).toBe(400);
  });

  it("POST returns 402 with upgrade hints when the plan seat limit is reached", async () => {
    const { getTierFeaturesForUser } = await import("@/lib/plan-tiers");
    vi.mocked(getTierFeaturesForUser).mockResolvedValueOnce({
      tier: "REGULAR",
      planName: "Starter",
      maxOrders: 100,
      maxTeamMembers: 3,
      hasAnalytics: false,
      hasReports: false,
      hasMultiChannel: false,
      hasApiAccess: false,
      hasRoleBasedAccess: false,
      hasCustomExports: false,
      supportLevel: "email",
    });
    // 3 members on the tenant + 2 pending seeds = 5 seats already consumed.
    mockPrisma.user.count.mockResolvedValueOnce(3);

    const req = new Request("http://localhost:3010/api/team/invitations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "overflow@company.com", role: "STAFF" }),
    });
    const res = await invitationsRoute.POST(req);
    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.error).toBe("plan_limit_reached");
    expect(body.limit).toBe("teamMembers");
    expect(body.requiredTier).toBe("PRO");
  });

  it("DELETE revokes an existing invitation", async () => {
    const createReq = new Request("http://localhost:3010/api/team/invitations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "revoke.me@company.com",
        role: "Staff",
      }),
    });
    const createRes = await invitationsRoute.POST(createReq);
    const created = await createRes.json();

    const delReq = new Request(
      `http://localhost:3010/api/team/invitations?id=${created.invitation.id}`,
      {
        method: "DELETE",
      },
    );
    const delRes = await invitationsRoute.DELETE(delReq);
    expect(delRes.status).toBe(200);
    const delData = await delRes.json();
    expect(delData.success).toBe(true);
  });

  it("PATCH updates an existing invitation role and channels", async () => {
    const createReq = new Request("http://localhost:3010/api/team/invitations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "edit.me@company.com",
        role: "STAFF",
        allowedChannels: ["Online Store"],
      }),
    });
    const createRes = await invitationsRoute.POST(createReq);
    const created = await createRes.json();

    const patchReq = new Request("http://localhost:3010/api/team/invitations", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: created.invitation.id,
        role: "MANAGER",
        allowedChannels: ["Online Store", "Shopify"],
        expiresInDays: 14,
      }),
    });
    const patchRes = await invitationsRoute.PATCH(patchReq);
    expect(patchRes.status).toBe(200);
    const patchData = await patchRes.json();
    expect(patchData.success).toBe(true);
    expect(patchData.invitation.role).toBe("MANAGER");
    expect(patchData.invitation.allowedChannels).toEqual(["Online Store", "Shopify"]);
  });
});

describe("Order Invoice Route (/api/orders/[id]/invoice)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue({
      session: {
        user: { id: "u-admin", name: "Admin", email: "admin@example.com", role: "ADMIN" },
      },
      response: null,
    });
  });

  it("renders the sample invoice when the order is not found", async () => {
    // Missing orders fall back to the sample invoice so the template customizer
    // preview and print flows keep working even with an empty catalog.
    mockPrisma.order.findUnique.mockResolvedValueOnce(null);
    const req = new Request("http://localhost:3010/api/orders/ord_missing/invoice");
    const res = await orderInvoiceRoute.GET(req, {
      params: Promise.resolve({ id: "ord_missing" }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    const html = await res.text();
    expect(html).toContain("ORD-2026-8942");
    expect(html).toContain("window.print()");
  });

  it("returns branded HTML invoice with QR code and VAT when order exists", async () => {
    mockPrisma.order.findUnique.mockResolvedValueOnce({
      id: "ord_123",
      orderNumber: "ORD-9999",
      status: "COMPLETED",
      totalAmount: 200,
      taxAmount: 22,
      shippingAmount: 10,
      grandTotal: 232,
      paymentMethod: "CREDIT_CARD",
      paymentStatus: "PAID",
      createdAt: new Date("2026-03-01"),
      customer: {
        name: "Test Customer",
        email: "customer@example.com",
        city: "Jakarta",
        country: "Indonesia",
      },
      channel: {
        name: "TikTok Shop",
      },
      items: [
        {
          id: "item_1",
          name: "Item 1",
          quantity: 2,
          price: 100,
          total: 200,
          product: { name: "Item 1", sku: "SKU-1" },
        },
      ],
    });

    const req = new Request("http://localhost:3010/api/orders/ord_123/invoice");
    const res = await orderInvoiceRoute.GET(req, { params: Promise.resolve({ id: "ord_123" }) });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    const html = await res.text();
    expect(html).toContain("ORD-9999");
    expect(html).toContain("Test Customer");
    expect(html).toContain("data:image/png;base64");
    expect(html).toContain("window.print()");
    // Issuer identity now comes from tenant branding (default tenant), not the
    // old hardcoded LevTech fallback.
    expect(html).toContain("Next Dashboard Enterprise");
    expect(html).toContain("VAT / PPN (11%)");
  });

  it("derives Subtotal and Total Due from the line items, not the stored totals", async () => {
    // Regression: the invoice preferred Order.totalAmount/grandTotal over the
    // rows it prints, so whenever the stored totals had drifted away from the
    // items the document showed a "Total Due / Paid" that its own line items
    // did not add up to. The items are what the customer can see, so they win.
    mockPrisma.order.findUnique.mockResolvedValueOnce({
      id: "ord_drift",
      orderNumber: "ORD-4242",
      status: "COMPLETED",
      // Deliberately wrong: the two items below sum to 300.
      totalAmount: 999,
      grandTotal: 1234,
      discountAmount: 0,
      taxAmount: 33,
      shippingAmount: 0,
      paymentStatus: "PENDING",
      paymentMethod: "BANK_TRANSFER",
      invoiceSnapshot: null,
      createdAt: new Date("2026-03-01"),
      customer: {
        name: "Drift Customer",
        email: "drift@example.com",
        city: "Jakarta",
        country: "Indonesia",
      },
      channel: { name: "Direct" },
      items: [
        {
          id: "i1",
          name: "Line A",
          quantity: 2,
          price: 100,
          total: 200,
          product: { name: "Line A", sku: "SKU-A" },
        },
        {
          id: "i2",
          name: "Line B",
          quantity: 1,
          price: 100,
          total: 100,
          product: { name: "Line B", sku: "SKU-B" },
        },
      ],
    });

    const req = new Request("http://localhost:3010/api/orders/ord_drift/invoice");
    const res = await orderInvoiceRoute.GET(req, { params: Promise.resolve({ id: "ord_drift" }) });
    const html = await res.text();

    // 200 + 100 of items, plus the order's real 33 tax.
    expect(html).toContain("$300.00");
    expect(html).toContain("$333.00");
    // The stale stored figures must not reach the page at all.
    expect(html).not.toContain("$999.00");
    expect(html).not.toContain("$1,234.00");
    // 33 / 300 is 11%, so the label states the real rate.
    expect(html).toContain("VAT / PPN (11%)");
  });

  it("omits the tax row entirely when the order carries no tax", async () => {
    mockPrisma.order.findUnique.mockResolvedValueOnce({
      id: "ord_notax",
      orderNumber: "ORD-5150",
      status: "PENDING",
      totalAmount: 50,
      grandTotal: 50,
      discountAmount: 0,
      taxAmount: 0,
      shippingAmount: 0,
      paymentStatus: "PENDING",
      paymentMethod: "BANK_TRANSFER",
      invoiceSnapshot: null,
      createdAt: new Date("2026-03-01"),
      customer: {
        name: "No Tax",
        email: "notax@example.com",
        city: "Jakarta",
        country: "Indonesia",
      },
      channel: { name: "Direct" },
      items: [
        {
          id: "i1",
          name: "Line",
          quantity: 1,
          price: 50,
          total: 50,
          product: { name: "Line", sku: "SKU-N" },
        },
      ],
    });

    const req = new Request("http://localhost:3010/api/orders/ord_notax/invoice");
    const res = await orderInvoiceRoute.GET(req, { params: Promise.resolve({ id: "ord_notax" }) });
    const html = await res.text();

    // A "VAT / PPN (11%) $0.00" line is noise at best and a wrong rate at worst.
    expect(html).not.toContain("VAT / PPN");
    expect(html).toContain("$50.00");
  });

  it("reconciles an IDR invoice in whole rupiah, rows and totals together", async () => {
    // Reproduces the bug a rupiah reader reported: converted line by line at
    // 0-decimal precision, the printed rows no longer summed to the printed
    // Subtotal (each line rounded its own way, and the totals rounded from the
    // USD figure). Two 33.333 lines are the minimal case — summed *after*=
    // rounding they are Rp1,056,656; converted as a total they are Rp1,056,655.
    mockPrisma.order.findUnique.mockResolvedValueOnce({
      id: "ord_idr",
      orderNumber: "ORD-IDR-1",
      status: "COMPLETED",
      totalAmount: 66.666,
      grandTotal: 69.9993,
      discountAmount: 0,
      taxAmount: 3.3333,
      shippingAmount: 0,
      paymentStatus: "PAID",
      paymentMethod: "BANK_TRANSFER",
      invoiceSnapshot: null,
      createdAt: new Date("2026-09-10"),
      customer: { name: "Warga Rupiah", email: "rp@example.com", city: "Bandung" },
      channel: { name: "Direct" },
      items: [
        { quantity: 1, price: 33.333, total: 33.333, product: { name: "Line A", sku: "SKU-A" } },
        { quantity: 1, price: 33.333, total: 33.333, product: { name: "Line B", sku: "SKU-B" } },
      ],
    });

    const req = new Request("http://localhost:3010/api/orders/ord_idr/invoice?currency=IDR");
    const res = await orderInvoiceRoute.GET(req, { params: Promise.resolve({ id: "ord_idr" }) });
    const html = await res.text();

    // Rows: 2 × Rp528,328 — and the Subtotal is their sum, not the rounded total.
    expect(html).toContain("Rp528,328");
    expect(html).toContain("Rp1,056,656");
    expect(html).not.toContain("Rp1,056,655");
    // Tax Rp52,833 then grand total = subtotal + tax, on the displayed values.
    expect(html).toContain("Rp52,833");
    expect(html).toContain("Rp1,109,489");
    // No dollar sign and no stray cents anywhere in a rupiah invoice.
    expect(html).not.toContain("$");
    // The rate that produced these figures is stated, not implied.
    expect(html).toContain("Converted at 1 USD = Rp15,850");
  });
});

describe("Tenant Branding → Invoice Integration", () => {
  const BRANDING_FILE = path.join(process.cwd(), "data", "tenant-branding.json");
  const TEST_TENANT = "test-branding-invoice";
  let original: string | null;

  beforeAll(() => {
    original = fs.existsSync(BRANDING_FILE) ? fs.readFileSync(BRANDING_FILE, "utf8") : null;
  });

  afterAll(() => {
    // Restore the real branding store so other suites / the dev server are
    // never affected by the test tenant.
    if (original === null) {
      if (fs.existsSync(BRANDING_FILE)) fs.unlinkSync(BRANDING_FILE);
    } else {
      fs.writeFileSync(BRANDING_FILE, original, "utf8");
    }
  });

  it("renders the saved brand name, address, and NPWP for that tenant", async () => {
    const saved = saveTenantBranding(TEST_TENANT, {
      brandName: "Kopi Kenangan Senja",
      invoiceAddress: "Jl. Cempaka Putih No. 17, Yogyakarta 55223, Indonesia",
      taxId: "99.777.555.4-333.000",
      accentColor: "#0ea5e9",
      invoiceHeaderNote: "Terima kasih atas kepercayaan Anda.",
    });

    expect(saved.brandName).toBe("Kopi Kenangan Senja");

    mockPrisma.order.findUnique.mockResolvedValueOnce({
      id: "ord_branding",
      orderNumber: "ORD-BRAND-1",
      status: "COMPLETED",
      totalAmount: 100,
      taxAmount: 11,
      shippingAmount: 0,
      grandTotal: 111,
      paymentMethod: "QRIS",
      paymentStatus: "PAID",
      createdAt: new Date("2026-09-01"),
      customer: {
        name: "Rina Putri",
        email: "rina@example.com",
        city: "Yogyakarta",
        country: "Indonesia",
      },
      channel: { name: "Online Store" },
      items: [
        {
          quantity: 2,
          unitPrice: 50,
          totalPrice: 100,
          product: { name: "Es Kopi Susu" },
        },
      ],
    });

    // requireAuth's session carries the tenant id — the invoice route reads it
    // from session.user.tenantId.
    mockRequireAuth.mockResolvedValueOnce({
      session: { user: { id: "u-1", tenantId: TEST_TENANT } },
      response: null,
    });

    const req = new Request("http://localhost:3010/api/orders/ord_branding/invoice", {
      headers: { host: "localhost:3010" },
    });
    const res = await orderInvoiceRoute.GET(req, {
      params: Promise.resolve({ id: "ord_branding" }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    const html = await res.text();

    expect(html).toContain("Kopi Kenangan Senja");
    expect(html).toContain("Jl. Cempaka Putih No. 17, Yogyakarta 55223, Indonesia");
    expect(html).toContain("99.777.555.4-333.000");
    expect(html).toContain("Terima kasih atas kepercayaan Anda.");
    // The default tenant's brand must NOT leak into this tenant's invoice.
    expect(html).not.toContain("Next Dashboard Enterprise");
  });
});
