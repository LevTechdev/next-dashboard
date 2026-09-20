// ═══════════════════════════════════════════════════════════════════════════
// OG dashboard regeneration — coalescing + webhook.
//
// Verifies that a burst of dashboard-affecting mutations (here: order creates)
// is coalesced into a single debounced regeneration that lands on disk, and
// that the POST /api/og/dashboard webhook force-renders immediately. Both end
// states are asserted against the persisted public/og/dashboard.png: mtime
// advanced and the bytes still decode as a valid 1200×630 PNG.
//
// Playwright is stubbed to force the fast sharp path (no Chromium launch), and
// global fetch is stubbed to 401 so loadLive falls back to the demo series —
// the render itself is otherwise real (sharp → disk).
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { promises as fs } from "fs";
import path from "path";
import sharp from "sharp";

const OG_PATH = path.join(process.cwd(), "public", "og", "dashboard.png");
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const {
  mockRequireAuth,
  mockRequirePermission,
  mockGetTenantId,
  mockSameTenant,
  mockComputeCommission,
  mockOrderCreate,
  mockAffiliateLinkFindUnique,
  mockActivityLogCreate,
} = vi.hoisted(() => ({
  mockRequireAuth: vi.fn(),
  mockRequirePermission: vi.fn(),
  mockGetTenantId: vi.fn(),
  mockSameTenant: vi.fn(),
  mockComputeCommission: vi.fn(),
  mockOrderCreate: vi.fn(),
  mockAffiliateLinkFindUnique: vi.fn(),
  mockActivityLogCreate: vi.fn(),
}));

vi.mock("@/lib/api-guard", () => ({
  requireAuth: mockRequireAuth,
  requirePermission: mockRequirePermission,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    order: {
      create: mockOrderCreate,
      // Plan-cap read (Starter's monthly limit) on the POST path.
      count: vi.fn().mockResolvedValue(0),
    },
    affiliateLink: { findUnique: mockAffiliateLinkFindUnique },
    activityLog: { create: mockActivityLogCreate },
    // Tier system: orders POST reads the plan cap via plan-tiers.
    subscription: { findFirst: vi.fn().mockResolvedValue(null) },
    plan: { findUnique: vi.fn().mockResolvedValue(null) },
  },
}));

vi.mock("@/lib/tenancy", () => ({
  getTenantId: mockGetTenantId,
  sameTenant: mockSameTenant,
}));

vi.mock("@/lib/affiliates", () => ({
  computeCommission: mockComputeCommission,
}));

// No Chromium in tests — the renderer must fall back to the sharp path.
vi.mock("playwright", () => ({
  chromium: {
    launch: vi.fn().mockRejectedValue(new Error("no browser in unit tests")),
  },
}));

import { POST as createOrder } from "../orders/route";
import { POST as ogWebhook } from "../og/dashboard/route";
import {
  regenerateDashboardOgNow,
  flushDashboardOgRegeneration,
} from "@/lib/og-dashboard-server.mjs";

async function orderRequest(body: Record<string, unknown>): Promise<Request> {
  return new Request("http://localhost:3010/api/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      cookie: "token=abc",
    },
    body: JSON.stringify(body),
  });
}

async function fileMtime(): Promise<number> {
  try {
    return (await fs.stat(OG_PATH)).mtimeMs;
  } catch {
    return 0; // file does not exist yet
  }
}

async function expectValidDashboardPng(): Promise<void> {
  const buf = await fs.readFile(OG_PATH);
  expect(buf.subarray(0, 8)).toEqual(PNG_SIGNATURE);
  const meta = await sharp(buf).metadata();
  expect(meta.width).toBe(1200);
  expect(meta.height).toBe(630);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAuth.mockResolvedValue({
    session: {
      user: { id: "u-1", sub: "u-1", name: "Admin", email: "admin@example.com", role: "ADMIN" },
    },
    response: null,
  });
  mockRequirePermission.mockResolvedValue({
    session: { user: { id: "u-1", role: "ADMIN" } },
    response: null,
  });
  mockGetTenantId.mockReturnValue("tenant-1");
  mockSameTenant.mockReturnValue(true);
  mockComputeCommission.mockReturnValue(0);
  mockAffiliateLinkFindUnique.mockResolvedValue(null);
  mockActivityLogCreate.mockResolvedValue({ id: "log-1" });
  mockOrderCreate.mockResolvedValue({
    id: "ord-1",
    orderNumber: "ORD-ABC123",
    tenantId: "tenant-1",
    grandTotal: 150,
  });

  // Deterministic demo fallback: loadLive sees 401 and returns null.
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 401 })));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("OG dashboard regeneration", () => {
  it("coalesces a burst of order mutations into one debounced render on disk", async () => {
    const before = await fileMtime();

    // Three rapid mutations — the trailing debounce holds, nothing renders yet.
    await createOrder(await orderRequest({ customerId: "c-1", grandTotal: 150 }));
    await createOrder(await orderRequest({ customerId: "c-1", grandTotal: 240 }));
    await createOrder(await orderRequest({ customerId: "c-1", grandTotal: 90 }));

    expect(mockOrderCreate).toHaveBeenCalledTimes(3);

    // Still coalesced: mtime must not have moved before the flush.
    expect(await fileMtime()).toBe(before);

    const flushed = await flushDashboardOgRegeneration();
    expect(flushed).toBe(true);

    expect(await fileMtime()).toBeGreaterThan(before);
    await expectValidDashboardPng();
  });

  it("force-renders immediately via the regeneration webhook", async () => {
    // Seed a baseline render so the webhook has something to advance past.
    await regenerateDashboardOgNow("token=abc");
    const before = await fileMtime();
    expect(before).toBeGreaterThan(0);

    const res = await ogWebhook(
      new Request("http://localhost:3010/api/og/dashboard", { method: "POST" }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.source).toBe("demo");
    expect(body.bytes).toBeGreaterThan(0);

    expect(await fileMtime()).toBeGreaterThan(before);
    await expectValidDashboardPng();
  });
});
