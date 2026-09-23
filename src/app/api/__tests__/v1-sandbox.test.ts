import { describe, it, expect, vi, beforeEach } from "vitest";

// ═══════════════════════════════════════════════════════════════════════════
// Hoisted mocks
// ═══════════════════════════════════════════════════════════════════════════

const { mockPrisma } = vi.hoisted(() => {
  const chain = <T extends Record<string, unknown>>(overrides: Partial<T> = {}) =>
    new Proxy<T>({} as T, {
      get(_, prop) {
        const key = String(prop);
        return (overrides as any)[key] ?? vi.fn().mockResolvedValue(null);
      },
    });

  return {
    mockPrisma: {
      apiKey: chain({
        findUnique: vi.fn().mockResolvedValue(null),
        update: vi.fn().mockResolvedValue({}),
      }),
      user: chain({
        findUnique: vi.fn().mockResolvedValue({ tenantId: "t1" }),
      }),
      tenant: chain({
        findUnique: vi.fn().mockResolvedValue({ id: "t1", name: "Acme" }),
      }),
      product: chain({
        findMany: vi.fn().mockResolvedValue([{ id: "p1", name: "Widget" }]),
        findFirst: vi.fn().mockResolvedValue({ id: "p1", name: "Widget" }),
        count: vi.fn().mockResolvedValue(1),
      }),
      order: chain({
        findMany: vi.fn().mockResolvedValue([{ id: "o1", orderNumber: "ORD-1" }]),
        findFirst: vi.fn().mockResolvedValue({ id: "o1", orderNumber: "ORD-1" }),
        count: vi.fn().mockResolvedValue(1),
      }),
      customer: chain({
        findMany: vi.fn().mockResolvedValue([{ id: "c1", name: "Jane" }]),
        findFirst: vi.fn().mockResolvedValue({ id: "c1", name: "Jane" }),
        count: vi.fn().mockResolvedValue(1),
      }),
    },
  };
});

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));

vi.mock("@/lib/tenancy", () => ({
  tenantWhere: (t: any) => ({ tenantId: t }),
  getTenantId: (s: any) => s?.user?.tenantId ?? null,
  sameTenant: (t: any, row: any) => !!row && (row.tenantId ?? null) === t,
}));

vi.mock("@/lib/request-meta", () => ({
  getClientIp: () => "203.0.113.10",
}));

import {
  extractApiKey,
  hashApiKey,
  ipMatches,
  requireReadScope,
  authenticateApiKey,
} from "@/lib/api-key-auth";
import { GET as pingGET } from "../v1/ping/route";
import { GET as meGET } from "../v1/me/route";
import { GET as productsGET } from "../v1/products/route";
import { GET as productGET } from "../v1/products/[id]/route";
import { GET as ordersGET } from "../v1/orders/route";
import { GET as orderGET } from "../v1/orders/[id]/route";
import { GET as customersGET } from "../v1/customers/route";
import { GET as customerGET } from "../v1/customers/[id]/route";

// ═══════════════════════════════════════════════════════════════════════════
// Fixtures
// ═══════════════════════════════════════════════════════════════════════════

const RAW_KEY = "dash_" + "a".repeat(64);
const HASHED = hashApiKey(RAW_KEY);

function activeKey(overrides: Record<string, unknown> = {}) {
  return {
    id: "key-1",
    name: "Docs testing",
    status: "ACTIVE",
    expiresAt: null,
    ipAllowlist: [] as string[],
    permissions: "read",
    userId: "u1",
    ...overrides,
  };
}

function keyReq(): Request {
  return new Request("http://localhost:3010/api/v1/ping", {
    headers: { Authorization: `Bearer ${RAW_KEY}` },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.apiKey.findUnique.mockResolvedValue(activeKey());
  mockPrisma.user.findUnique.mockResolvedValue({
    id: "u1",
    name: "Owner",
    email: "owner@test.com",
    role: "ADMIN",
    tenantId: "t1",
  });
  mockPrisma.tenant.findUnique.mockResolvedValue({ id: "t1", name: "Acme" });
});

// ═══════════════════════════════════════════════════════════════════════════
// Key-matching primitives
// ═══════════════════════════════════════════════════════════════════════════

describe("api-key primitives", () => {
  it("extracts only dash_ Bearer keys", () => {
    expect(
      extractApiKey(new Request("http://x", { headers: { Authorization: `Bearer ${RAW_KEY}` } })),
    ).toBe(RAW_KEY);
    expect(
      extractApiKey(new Request("http://x", { headers: { Authorization: "Bearer sk_live_123" } })),
    ).toBeNull();
    expect(extractApiKey(new Request("http://x"))).toBeNull();
  });

  it("hashes to sha256 like the minting route", () => {
    // Deterministic and 64 hex chars.
    expect(hashApiKey(RAW_KEY)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashApiKey(RAW_KEY)).toBe(hashApiKey(RAW_KEY));
  });

  it("matches exact IPs and CIDR prefixes, rejects others", () => {
    expect(ipMatches("203.0.113.10", "203.0.113.10")).toBe(true);
    expect(ipMatches("203.0.113.11", "203.0.113.10")).toBe(false);
    expect(ipMatches("203.0.113.0/24", "203.0.113.10")).toBe(true);
    expect(ipMatches("203.0.113.0/24", "203.0.114.10")).toBe(false);
    expect(ipMatches("0.0.0.0/0", "1.2.3.4")).toBe(true);
    expect(ipMatches("10.0.0.0/8", "10.200.1.2")).toBe(true);
    expect(ipMatches("bogus/33", "10.0.0.1")).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Authentication gate
// ═══════════════════════════════════════════════════════════════════════════

describe("authenticateApiKey", () => {
  it("accepts a valid active key and parses its scopes", async () => {
    const auth = await authenticateApiKey(keyReq());
    expect(auth.ok).toBe(true);
    if (auth.ok) {
      expect(auth.keyName).toBe("Docs testing");
      expect(auth.scopes).toEqual(["read"]);
    }
  });

  it("rejects unknown keys with 401", async () => {
    mockPrisma.apiKey.findUnique.mockResolvedValue(null);
    const auth = await authenticateApiKey(keyReq());
    expect(auth).toMatchObject({ ok: false, status: 401, error: "invalid_api_key" });
  });

  it("rejects a JWT-shaped bearer token without a lookup", async () => {
    const auth = await authenticateApiKey(
      new Request("http://x", { headers: { Authorization: "Bearer eyJhbGciOiJIUzI1NiJ9.x.y" } }),
    );
    expect(auth).toMatchObject({ ok: false, status: 401, error: "missing_api_key" });
    expect(mockPrisma.apiKey.findUnique).not.toHaveBeenCalled();
  });

  it("rejects revoked keys", async () => {
    mockPrisma.apiKey.findUnique.mockResolvedValue(activeKey({ status: "REVOKED" }));
    const auth = await authenticateApiKey(keyReq());
    expect(auth).toMatchObject({ ok: false, status: 401, error: "key_revoked" });
  });

  it("rejects expired keys", async () => {
    mockPrisma.apiKey.findUnique.mockResolvedValue(
      activeKey({ expiresAt: new Date(Date.now() - 1000) }),
    );
    const auth = await authenticateApiKey(keyReq());
    expect(auth).toMatchObject({ ok: false, status: 401, error: "key_expired" });
  });

  it("rejects IPs outside the allowlist with 403", async () => {
    mockPrisma.apiKey.findUnique.mockResolvedValue(activeKey({ ipAllowlist: ["10.0.0.0/8"] }));
    const auth = await authenticateApiKey(keyReq());
    expect(auth).toMatchObject({ ok: false, status: 403, error: "ip_not_allowed" });
  });

  it("allows IPs inside the allowlist", async () => {
    mockPrisma.apiKey.findUnique.mockResolvedValue(activeKey({ ipAllowlist: ["203.0.113.0/24"] }));
    const auth = await authenticateApiKey(keyReq());
    expect(auth.ok).toBe(true);
  });

  it("requires the read scope for data endpoints", async () => {
    const granted = { ok: true } as const;
    expect(requireReadScope({ ...(granted as any), scopes: ["read"] })).toEqual({ ok: true });
    const denied = requireReadScope({ ...(granted as any), scopes: ["write"] } as any);
    expect(denied).toMatchObject({ ok: false, status: 403, error: "insufficient_scope" });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Route behavior
// ═══════════════════════════════════════════════════════════════════════════

describe("v1 routes", () => {
  it("ping echoes key identity without touching workspace data", async () => {
    const res = await pingGET(keyReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.pong).toBe(true);
    expect(body.key.scopes).toEqual(["read"]);
    expect(mockPrisma.product.findMany).not.toHaveBeenCalled();
  });

  it("me reports the key's user and workspace", async () => {
    const res = await meGET(keyReq());
    const body = await res.json();
    expect(body.workspace).toEqual({ id: "t1", name: "Acme" });
    expect(body.user.email).toBeDefined();
  });

  it("each list endpoint scopes its query to the key owner's tenant", async () => {
    await productsGET(keyReq());
    expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: "t1" } }),
    );

    await ordersGET(keyReq());
    expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: "t1" } }),
    );

    await customersGET(keyReq());
    expect(mockPrisma.customer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: "t1" } }),
    );
  });

  it("detail endpoints 404 instead of leaking other tenants' rows", async () => {
    mockPrisma.product.findFirst.mockResolvedValueOnce(null);
    const res = await productGET(keyReq(), { params: Promise.resolve({ id: "other" }) });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("not_found");
  });

  it("orders rejects an invalid status filter with 400", async () => {
    const res = await ordersGET(
      new Request("http://localhost:3010/api/v1/orders?status=NOPE", {
        headers: { Authorization: `Bearer ${RAW_KEY}` },
      }),
    );
    expect(res.status).toBe(400);
    expect(mockPrisma.order.findMany).not.toHaveBeenCalled();
  });

  it("every route rejects requests without a key", async () => {
    for (const handler of [pingGET, meGET, productsGET, ordersGET, customersGET]) {
      const res = await handler(new Request("http://localhost:3010/api/v1/x"));
      expect(res.status).toBe(401);
    }
    for (const handler of [productGET, orderGET, customerGET]) {
      const res = await handler(new Request("http://localhost:3010/api/v1/x/1"), {
        params: Promise.resolve({ id: "1" }),
      });
      expect(res.status).toBe(401);
    }
  });
});
