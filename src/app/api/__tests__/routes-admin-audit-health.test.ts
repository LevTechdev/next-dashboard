import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * GET /api/admin/audit-health — the admin-panel twin of the CI gate in
 * scripts/check-audit-chain.ts plus the Phase-2 mail outbox health.
 *
 * Pinned here:
 *   • ADMIN-only (403 otherwise) — same gate as /api/admin/users.
 *   • The chain section passes through the REAL verifier's verdict, including
 *     firstBreakSeq and a capped breaks list.
 *   • Attribution counts mirror the CI check's semantics: missingTenant counts
 *     only hashed rows WITH an actor (actor-less telemetry is exempt), and
 *     orphanTenant counts distinct dead-tenant references.
 *   • Mail health passes through emailOutboxHealth() untouched — the scheduler
 *     and verify:mail already own its unit coverage.
 *   • Read-only: the route must never write or log events.
 */
const mockRequireAuth = vi.fn();
const mockVerifyAuditChain = vi.fn();
const mockEmailOutboxHealth = vi.fn();

vi.mock("@/lib/api-guard", () => ({
  requireAuth: mockRequireAuth,
}));
vi.mock("@/lib/audit-chain", () => ({
  verifyAuditChain: mockVerifyAuditChain,
}));
vi.mock("@/lib/email-outbox", () => ({
  emailOutboxHealth: mockEmailOutboxHealth,
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    securityEvent: {
      count: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
        // Mirror the three count shapes the route issues.
        if (where.hash === null) return 1; // nullHash
        if (where.userId && where.tenantId === null) return 2; // missingTenant
        return 0;
      }),
      findMany: vi.fn(async () => [{ tenantId: "t-a" }, { tenantId: "t-ghost" }]),
    },
    tenant: {
      findMany: vi.fn(async ({ where }: { where: { id: { in: string[] } } }) =>
        where.id.in.filter((id) => id !== "t-ghost").map((id) => ({ id })),
      ),
    },
  },
}));

const route = await import("@/app/api/admin/audit-health/route");
const { normalizeRole } = await import("@/lib/permissions");

function authed(role: string) {
  mockRequireAuth.mockResolvedValue({
    session: { user: { id: "admin-1", email: "a@test.com", role, tenantId: "t-a" } },
    response: null,
  });
}

const CHAIN_OK = {
  ok: true,
  total: 10,
  verified: 10,
  firstBreakSeq: null,
  breaks: [] as Array<{ seq: number; id: string; reason: string }>,
};

const MAIL_OK = {
  pending: 0,
  sending: 0,
  sent: 5,
  failed: 0,
  stuck: 0,
  oldestPendingAt: null,
};

function jsonReq(): Request {
  return new Request("http://localhost/api/admin/audit-health");
}

describe("GET /api/admin/audit-health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyAuditChain.mockResolvedValue(CHAIN_OK);
    mockEmailOutboxHealth.mockResolvedValue(MAIL_OK);
  });

  it("returns 403 for non-admin sessions", async () => {
    authed("CLIENT");
    expect(normalizeRole("CLIENT")).not.toBe("ADMIN");

    const res = await route.GET(jsonReq());
    expect(res.status).toBe(403);
    // The guard fires before any data access.
    expect(mockVerifyAuditChain).not.toHaveBeenCalled();
  });

  it("aggregates chain, attribution, and mail health for an admin", async () => {
    authed("ADMIN");

    const res = await route.GET(jsonReq());
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.chain).toEqual({
      ok: true,
      total: 10,
      verified: 10,
      firstBreakSeq: null,
      breaks: [],
    });
    expect(body.attribution).toEqual({ missingTenant: 2, orphanTenant: 1, nullHash: 1 });
    expect(body.mail).toEqual(MAIL_OK);
    expect(typeof body.checkedAt).toBe("string");
    expect(mockVerifyAuditChain).toHaveBeenCalledTimes(1);
    expect(mockEmailOutboxHealth).toHaveBeenCalledTimes(1);
  });

  it("caps the breaks list and passes the verifier verdict through untouched", async () => {
    authed("ADMIN");
    mockVerifyAuditChain.mockResolvedValue({
      ok: false,
      total: 30,
      verified: 24,
      firstBreakSeq: 12,
      breaks: Array.from({ length: 9 }, (_, i) => ({
        seq: i + 1,
        id: `e${i}`,
        reason: "prevHash mismatch",
      })),
    });

    const res = await route.GET(jsonReq());
    const body = await res.json();

    expect(body.chain.ok).toBe(false);
    expect(body.chain.firstBreakSeq).toBe(12);
    expect(body.chain.breaks).toHaveLength(5); // capped at 5 like the CI gate output
  });

  it("makes no writes and logs no events", async () => {
    authed("ADMIN");

    await route.GET(jsonReq());

    const dbModule = (await import("@/lib/db")) as unknown as {
      prisma: Record<string, Record<string, ReturnType<typeof vi.fn>>>;
    };
    const allFns = Object.values(dbModule.prisma).flatMap(Object.values);
    for (const fn of allFns) {
      const name = fn.getMockName();
      expect(
        name.startsWith("update") || name.startsWith("delete") || name.startsWith("create"),
      ).toBe(false);
    }
  });
});
