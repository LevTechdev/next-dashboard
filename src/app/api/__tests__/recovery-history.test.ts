import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * /api/auth/recovery-history — the series behind the Security Center sparkline.
 *
 * Two contracts worth pinning: it is scoped to the caller (a series is personal
 * security data), and `?capture=1` records today's verdict before answering,
 * which is what makes the panel's graph include the moment the user is looking
 * at it.
 */

const { mockPrisma, mockRequireAuth } = vi.hoisted(() => ({
  mockPrisma: {
    user: { findUnique: vi.fn() },
    backupAuthenticator: { findUnique: vi.fn() },
    backupCode: { count: vi.fn() },
    webAuthnCredential: { count: vi.fn() },
    recoveryReadinessSnapshot: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      upsert: vi.fn(),
    },
    notification: { findFirst: vi.fn(), create: vi.fn() },
  },
  mockRequireAuth: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/api-guard", () => ({ requireAuth: mockRequireAuth }));
vi.mock("@/lib/security-events", () => ({ logSecurityEvent: vi.fn() }));
vi.mock("server-only", () => ({}));

const route = await import("../auth/recovery-history/route");

const SESSION = { user: { id: "user-1", email: "u@test.com", tenantId: "t1" } };

function req(query = "") {
  return new Request(`http://localhost:3010/api/auth/recovery-history${query}`);
}

describe("/api/auth/recovery-history", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue({ session: SESSION, response: null });
    mockPrisma.recoveryReadinessSnapshot.findMany.mockResolvedValue([]);
    mockPrisma.recoveryReadinessSnapshot.findFirst.mockResolvedValue(null);
    mockPrisma.recoveryReadinessSnapshot.upsert.mockResolvedValue({});
    mockPrisma.user.findUnique.mockResolvedValue({
      totpEnabled: true,
      emailVerified: new Date(),
    });
    mockPrisma.backupAuthenticator.findUnique.mockResolvedValue({ id: "spare" });
    mockPrisma.backupCode.count.mockResolvedValue(8);
    mockPrisma.webAuthnCredential.count.mockResolvedValue(0);
  });

  it("refuses an unauthenticated caller", async () => {
    const denied = new Response("unauthorized", { status: 401 });
    mockRequireAuth.mockResolvedValue({ session: null, response: denied });

    const res = await route.GET(req());

    expect(res.status).toBe(401);
    expect(mockPrisma.recoveryReadinessSnapshot.findMany).not.toHaveBeenCalled();
  });

  it("reads only the caller's own series", async () => {
    const res = await route.GET(req("?days=30"));
    const body = await res.json();

    expect(res.status).toBe(200);
    const where = mockPrisma.recoveryReadinessSnapshot.findMany.mock.calls[0][0].where;
    expect(where.userId).toBe("user-1");
    expect(body.days).toBe(30);
    expect(body).toMatchObject({ captured: false, snapshots: [], trend: "flat", current: null });
  });

  it("stays read-only unless the caller asks to capture", async () => {
    await route.GET(req());
    expect(mockPrisma.recoveryReadinessSnapshot.upsert).not.toHaveBeenCalled();
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("records today's verdict when the panel asks", async () => {
    const res = await route.GET(req("?capture=1"));
    const body = await res.json();

    expect(body.captured).toBe(true);
    const upsert = mockPrisma.recoveryReadinessSnapshot.upsert.mock.calls[0][0];
    expect(upsert.create.userId).toBe("user-1");
    expect(upsert.create.level).toBe("ready");
    expect(upsert.where.userId_day.day).toBe(new Date().toISOString().slice(0, 10));
  });

  it("summarizes the window as a trend and the newest verdict", async () => {
    mockPrisma.recoveryReadinessSnapshot.findMany.mockResolvedValue([
      { day: "2026-09-20", level: "ready", availableCount: 3, codesLow: false },
      { day: "2026-09-21", level: "thin", availableCount: 2, codesLow: true },
    ]);

    const body = await (await route.GET(req())).json();

    expect(body.trend).toBe("down");
    expect(body.current).toBe("thin");
    expect(body.snapshots).toHaveLength(2);
  });

  it("clamps the requested window to the supported range", async () => {
    await route.GET(req("?days=500"));
    expect(mockPrisma.recoveryReadinessSnapshot.findMany.mock.calls[0][0].where.day.gte).toBe(
      new Date(Date.now() - 29 * 86_400_000).toISOString().slice(0, 10),
    );

    mockPrisma.recoveryReadinessSnapshot.findMany.mockClear();
    const tiny = await (await route.GET(req("?days=0"))).json();
    expect(tiny.days).toBe(1);
  });
});
