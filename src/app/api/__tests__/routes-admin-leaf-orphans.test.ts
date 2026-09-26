import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * GET /api/admin/leaf-orphans — the admin ops signal for the leaf-sync
 * orphan report (the report minus the acknowledged-orphan ledger).
 *
 * Pinned here:
 *   • ADMIN-only (403 otherwise) — same gate as the other /api/admin routes.
 *   • The verdict: `ok` when nothing is unsyncable, `bad` when the projected
 *     report still NAMES unacknowledged rows, `warn` when counts remain but
 *     every sampled ref has been acknowledged (stragglers without samples).
 *   • The projection rides on readLeafOrphanReport (unit-tested in
 *     scripts/lib/__tests__/leaf-orphans.test.ts) — here it is stubbed, and
 *     the route's aggregation is what's under test.
 */
const mockRequireAuth = vi.fn();
const mockReadReport = vi.fn();
const mockFindUser = vi.fn();
const mockAckRefs = vi.fn();

vi.mock("@/lib/api-guard", () => ({
  requireAuth: mockRequireAuth,
}));
vi.mock("@/lib/db", () => ({
  prisma: { user: { findUnique: mockFindUser } },
}));
vi.mock("@/lib/scheduler", () => ({
  readLeafOrphanReport: mockReadReport,
  leafSyncScriptPath: () => "scripts/sync-supabase-leaves.mjs",
  runSchedulerJob: vi.fn(),
  recordExternalJobRun: vi.fn(),
}));
vi.mock("@/lib/leaf-orphans-admin", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  // GET now projects through the shared lib; feed it the same stub the old
  // readLeafOrphanReport seam used, so the aggregation stays under test.
  readRawLeafOrphanReport: mockReadReport,
  acknowledgeLeafOrphanRefs: mockAckRefs,
}));
// The projection's ledger read must be hermetic: the real file is gitignored
// local operator state whose entries would silently change the verdict.
vi.mock("../../../../scripts/lib/leaf-orphans.mjs", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  readAckLedger: () => ({ entries: [] }),
}));
vi.mock("@/lib/run-cli", () => ({
  runCli: vi.fn(),
}));

const route = await import("@/app/api/admin/leaf-orphans/route");
const { normalizeRole } = await import("@/lib/permissions");

function authed(role: string) {
  mockRequireAuth.mockResolvedValue({
    session: { user: { id: "admin-1", email: "a@test.com", role } },
    response: null,
  });
  mockFindUser.mockResolvedValue({ role });
}

const req = () => new Request("http://localhost/api/admin/leaf-orphans");

describe("GET /api/admin/leaf-orphans", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("refuses non-admin users", async () => {
    authed("USER");
    const res = await route.GET(req());
    expect(res.status).toBe(403);
    expect(mockReadReport).not.toHaveBeenCalled();
    // Sanity: the gate matches the other admin routes' role normalization.
    expect(normalizeRole("ADMIN")).toBe("ADMIN");
  });

  it("reports ok with zero totals when no report exists", async () => {
    authed("ADMIN");
    mockReadReport.mockResolvedValue(undefined);
    const res = await route.GET(req());
    const body = await res.json();
    expect(body.state).toBe("ok");
    expect(body.total).toBe(0);
    expect(body.tables).toEqual({});
  });

  it("reports bad while the report still names unacknowledged rows", async () => {
    authed("ADMIN");
    mockReadReport.mockResolvedValue({
      Session: { count: 97, samples: ["cmuS1 [userId=cmuU1]"] },
      SecurityEvent: { count: 2850, samples: ["cmuE1 [tenantId=cmuT1]"] },
    });
    const res = await route.GET(req());
    const body = await res.json();
    expect(body.state).toBe("bad");
    expect(body.total).toBe(2947);
    expect(body.unacknowledgedSamples).toBe(2);
    expect(body.tables.Session.count).toBe(97);
  });

  it("reports warn when orphans remain but every sampled ref is acknowledged", async () => {
    authed("ADMIN");
    mockReadReport.mockResolvedValue({
      // No samples key at all: the projection dropped every named ref.
      Session: { count: 3 },
      FxRateSnapshot: { count: 10 },
    });
    const res = await route.GET(req());
    const body = await res.json();
    expect(body.state).toBe("warn");
    expect(body.total).toBe(13);
    expect(body.unacknowledgedSamples).toBe(0);
  });

  it("ignores zero-count tables the projection kept for bookkeeping", async () => {
    authed("ADMIN");
    mockReadReport.mockResolvedValue({
      Session: { count: 0 },
      SecurityEvent: { count: 5, samples: ["cmuE9 [userId=cmuU9]"] },
    });
    const res = await route.GET(req());
    const body = await res.json();
    expect(body.state).toBe("bad");
    expect(body.total).toBe(5);
    expect(Object.keys(body.tables)).toEqual(["SecurityEvent"]);
  });
});

describe("POST /api/admin/leaf-orphans (ack)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const ackReq = (body: unknown) =>
    new Request("http://localhost/api/admin/leaf-orphans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

  it("refuses non-admin users before touching the ledger", async () => {
    authed("USER");
    const res = await route.POST(ackReq({ action: "ack", refs: ["cmuS1"] }));
    expect(res.status).toBe(403);
    expect(mockAckRefs).not.toHaveBeenCalled();
  });

  it("rejects an ack with no refs", async () => {
    authed("ADMIN");
    for (const body of [
      { action: "ack" },
      { action: "ack", refs: [] },
      { action: "ack", refs: ["   "] },
    ]) {
      const res = await route.POST(ackReq(body));
      expect(res.status).toBe(400);
    }
    expect(mockAckRefs).not.toHaveBeenCalled();
  });

  it("writes the refs to the shared ledger and echoes the fresh projection", async () => {
    authed("ADMIN");
    mockAckRefs.mockResolvedValue(2);
    // After the ack, the projection shows the remaining unnamed count only.
    mockReadReport.mockResolvedValue({
      Session: { count: 3, samples: ["cmuS1 [userId=cmuU1]"] },
    });

    const res = await route.POST(
      ackReq({ action: "ack", refs: ["cmuS1 [userId=cmuU1]", "cmuE1 [tenantId=cmuT1]"] }),
    );
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, acknowledged: 2, summary: { state: "bad", total: 3 } });
    expect(mockAckRefs).toHaveBeenCalledWith(["cmuS1 [userId=cmuU1]", "cmuE1 [tenantId=cmuT1]"]);
  });

  it("keeps the run-now action working when no body is sent", async () => {
    authed("ADMIN");
    const { runCli } = await import("@/lib/run-cli");
    vi.mocked(runCli).mockResolvedValue({ stdout: "sync ok", stderr: "" });
    const { runSchedulerJob } = await import("@/lib/scheduler");
    vi.mocked(runSchedulerJob).mockResolvedValue({ orphanReport: {} });

    const res = await route.POST(
      new Request("http://localhost/api/admin/leaf-orphans", { method: "POST" }),
    );
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(runSchedulerJob).toHaveBeenCalledWith("supabase-leaf-sync");
  });
});
