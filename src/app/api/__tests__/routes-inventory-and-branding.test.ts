import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET as getReplenishment } from "@/app/api/inventory/replenishment/route";
import { GET as getPOs, POST as postPO } from "@/app/api/inventory/purchase-orders/route";
import {
  GET as getPODetail,
  PATCH as patchPODetail,
} from "@/app/api/inventory/purchase-orders/[id]/route";
import { GET as getPOPdf } from "@/app/api/inventory/purchase-orders/[id]/pdf/route";
import { GET as getWarehouses } from "@/app/api/inventory/warehouses/route";
import { GET as getTenants, POST as postTenant } from "@/app/api/tenants/route";
import { POST as postSwitchTenant } from "@/app/api/tenants/switch/route";
import { GET as getBranding, PUT as putBranding } from "@/app/api/tenant/branding/route";
import { POST as postDomainVerify } from "@/app/api/tenant/domain-verify/route";

// Mock api-guard
vi.mock("@/lib/api-guard", () => ({
  requireAuth: vi.fn(async () => ({
    session: {
      user: {
        id: "user-admin-1",
        sub: "user-admin-1",
        name: "Admin User",
        email: "admin@dashboard.com",
        role: "ADMIN",
        tenantId: "tenant-1",
      },
    },
    response: null,
  })),
  requirePermission: vi.fn(async () => ({
    session: {
      user: {
        id: "user-admin-1",
        sub: "user-admin-1",
        name: "Admin User",
        email: "admin@dashboard.com",
        role: "ADMIN",
        tenantId: "tenant-1",
      },
    },
    response: null,
  })),
}));

// Mock db
vi.mock("@/lib/db", () => ({
  prisma: {
    product: {
      findMany: vi.fn(async () => [
        {
          id: "prod-test-1",
          name: "Test Oxford Shirt",
          sku: "SHIRT-TEST-001",
          price: 150000,
          costPrice: 90000,
          stock: 4,
          category: { name: "Apparel" },
          orderItems: [{ quantity: 15, order: { createdAt: new Date().toISOString() } }],
        },
        {
          id: "prod-test-2",
          name: "Premium Denim Jeans",
          sku: "JEAN-TEST-002",
          price: 350000,
          costPrice: 200000,
          stock: 80,
          category: { name: "Apparel" },
          orderItems: [{ quantity: 10, order: { createdAt: new Date().toISOString() } }],
        },
      ]),
      update: vi.fn(async ({ data }: any) => ({
        id: "prod-test-1",
        stock: 54,
      })),
    },
    tenant: {
      findMany: vi.fn(async () => [
        {
          id: "tenant-1",
          name: "Default Workspace",
          slug: "default",
          createdAt: new Date(),
          _count: { users: 3, products: 12, orders: 140 },
        },
        {
          id: "tenant-2",
          name: "Apex Global Studio",
          slug: "apex-global",
          createdAt: new Date(),
          _count: { users: 1, products: 5, orders: 20 },
        },
      ]),
      findUnique: vi.fn(async ({ where }: any) => {
        if (where.slug === "default" || where.id === "tenant-1") {
          return { id: "tenant-1", name: "Default Workspace", slug: "default" };
        }
        if (where.slug === "tenant-b" || where.id === "tenant-2") {
          return { id: "tenant-2", name: "Apex Global Studio", slug: "apex-global" };
        }
        return null;
      }),
      create: vi.fn(async ({ data }: any) => ({
        id: "tenant-new-123",
        name: data.name,
        slug: data.slug,
        createdAt: new Date(),
      })),
    },
    user: {
      update: vi.fn(async ({ where, data }: any) => ({
        id: where.id,
        name: "Admin User",
        email: "admin@dashboard.com",
        role: "ADMIN",
        tenantId: data.tenantId,
      })),
    },
  },
}));

describe("Inventory Replenishment & Purchase Orders API", () => {
  it("GET /api/inventory/replenishment calculates replenishment metrics", async () => {
    const res = await getReplenishment();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.items).toBeDefined();
    expect(data.items.length).toBe(2);
    expect(data.summary.totalProducts).toBe(2);
    expect(data.items[0].stockoutRisk).toBeDefined();
    expect(data.items[0].supplier).toBeDefined();
  });

  it("GET /api/inventory/purchase-orders lists orders", async () => {
    const req = new Request("http://localhost:3010/api/inventory/purchase-orders");
    const res = await getPOs(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.orders).toBeDefined();
    expect(data.summary).toBeDefined();
  });

  it("POST /api/inventory/purchase-orders creates a PO and validates input", async () => {
    // Missing items test
    const badReq = new Request("http://localhost:3010/api/inventory/purchase-orders", {
      method: "POST",
      body: JSON.stringify({ supplierId: "sup-001", items: [] }),
    });
    const badRes = await postPO(badReq);
    expect(badRes.status).toBe(400);

    // Valid create test
    const validReq = new Request("http://localhost:3010/api/inventory/purchase-orders", {
      method: "POST",
      body: JSON.stringify({
        supplierId: "sup-001",
        warehouseId: "wh-jkt",
        items: [
          {
            productId: "prod-test-1",
            productName: "Test Oxford Shirt",
            sku: "SHIRT-TEST-001",
            quantity: 50,
            unitCost: 90000,
          },
        ],
        notes: "Test inbound shipment",
      }),
    });
    const res = await postPO(validReq);
    expect(res.status).toBe(201);
    const created = await res.json();
    expect(created.poNumber).toMatch(/^PO-\d{4}-\d{4}$/);
    expect(created.totalAmount).toBe(4500000);
    expect(created.status).toBe("ISSUED");
  });

  it("GET & PATCH /api/inventory/purchase-orders/[id] updates status", async () => {
    // Get PO detail
    const getRes = await getPODetail(
      new Request("http://localhost:3010/api/inventory/purchase-orders/po-seed-001"),
      {
        params: Promise.resolve({ id: "po-seed-001" }),
      },
    );
    expect(getRes.status).toBe(200);

    // Update status to RECEIVED
    const patchReq = new Request(
      "http://localhost:3010/api/inventory/purchase-orders/po-seed-001",
      {
        method: "PATCH",
        body: JSON.stringify({ status: "RECEIVED" }),
      },
    );
    const patchRes = await patchPODetail(patchReq, {
      params: Promise.resolve({ id: "po-seed-001" }),
    });
    expect(patchRes.status).toBe(200);
    const updated = await patchRes.json();
    expect(updated.status).toBe("RECEIVED");
    expect(updated.receivedDate).toBeDefined();
  });

  it("GET /api/inventory/purchase-orders/[id]/pdf renders printable HTML", async () => {
    const res = await getPOPdf(
      new Request("http://localhost:3010/api/inventory/purchase-orders/po-seed-001/pdf"),
      {
        params: Promise.resolve({ id: "po-seed-001" }),
      },
    );
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Purchase Order");
    expect(html).toContain("PO-2026-0001");
    expect(html).toContain("Apex Manufacturing");
  });

  it("GET /api/inventory/warehouses returns warehouse allocations", async () => {
    const res = await getWarehouses();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.warehouses.length).toBeGreaterThanOrEqual(3);
    expect(data.summary.totalCapacity).toBeGreaterThan(0);
  });
});

describe("Multi-Tenant Branding & Organization Switcher API", () => {
  it("GET /api/tenants lists available workspaces", async () => {
    const res = await getTenants(new Request("http://localhost:3010/api/tenants"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.tenants.length).toBe(2);
    expect(data.activeTenantId).toBeDefined();
  });

  it("POST /api/tenants creates a new workspace", async () => {
    const req = new Request("http://localhost:3010/api/tenants", {
      method: "POST",
      body: JSON.stringify({ name: "Nebula Labs", slug: "nebula-labs" }),
    });
    const res = await postTenant(req);
    expect(res.status).toBe(201);
    const created = await res.json();
    expect(created.name).toBe("Nebula Labs");
  });

  it("POST /api/tenants/switch switches active organization", async () => {
    const req = new Request("http://localhost:3010/api/tenants/switch", {
      method: "POST",
      body: JSON.stringify({ tenantId: "tenant-2" }),
    });
    const res = await postSwitchTenant(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.activeTenant.id).toBe("tenant-2");
  });

  it("GET & PUT /api/tenant/branding manages white-label settings", async () => {
    const getRes = await getBranding(new Request("http://localhost:3010/api/tenant/branding"));
    expect(getRes.status).toBe(200);
    const initial = await getRes.json();
    expect(initial.branding).toBeDefined();

    const putReq = new Request("http://localhost:3010/api/tenant/branding", {
      method: "PUT",
      body: JSON.stringify({
        brandName: "Starlight Retail Group",
        primaryColor: "#059669",
      }),
    });
    const putRes = await putBranding(putReq);
    expect(putRes.status).toBe(200);
    const updated = await putRes.json();
    expect(updated.branding.brandName).toBe("Starlight Retail Group");
    expect(updated.branding.primaryColor).toBe("#059669");
  });

  it("POST /api/tenant/domain-verify validates custom domain format & CNAME", async () => {
    // Bad domain
    const badReq = new Request("http://localhost:3010/api/tenant/domain-verify", {
      method: "POST",
      body: JSON.stringify({ domain: "bad" }),
    });
    const badRes = await postDomainVerify(badReq);
    expect(badRes.status).toBe(400);

    // Good domain
    const goodReq = new Request("http://localhost:3010/api/tenant/domain-verify", {
      method: "POST",
      body: JSON.stringify({ domain: "dashboard.starlight.com" }),
    });
    const goodRes = await postDomainVerify(goodReq);
    expect(goodRes.status).toBe(200);
    const verified = await goodRes.json();
    expect(verified.status).toBe("VERIFIED");
    expect(verified.sslActive).toBe(true);
  });
});
