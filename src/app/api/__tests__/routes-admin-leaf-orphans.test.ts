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
const mockAckStragglers = vi.fn();
const mockSendTestDigest = vi.fn();

vi.mock("@/lib/api-guard", () => ({
  requireAuth: mockRequireAuth,
}));
vi.mock("@/lib/db", () => ({
  prisma: { user: { findUnique: mockFindUser } },
}));
vi.mock("@/lib/email", () => ({
  // Route test never renders a transport; only misconfiguration surfacing
  // (mailMisconfigured) flows through this seam.
  describeMailConfiguration: () => ({ transport: "smtp", from: "ops@test", warnings: [] }),
}));
vi.mock("@/lib/leaf-orphans-digest", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  sendTestLeafOrphansDigest: (...args: unknown[]) => mockSendTestDigest(...args),
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
  acknowledgeLeafOrphanStragglers: mockAckStragglers,
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

describe("POST /api/admin/leaf-orphans (ack-stragglers)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const stragglerReq = () =>
    new Request("http://localhost/api/admin/leaf-orphans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "ack-stragglers" }),
    });

  it("refuses non-admin users before touching the ledger", async () => {
    authed("USER");
    const res = await route.POST(stragglerReq());
    expect(res.status).toBe(403);
    expect(mockAckStragglers).not.toHaveBeenCalled();
  });

  it("retires the stragglers and echoes the fresh projection", async () => {
    authed("ADMIN");
    mockAckStragglers.mockResolvedValue({ acknowledged: 4, tables: ["Session"] });
    mockReadReport.mockResolvedValue({}); // post-retirement projection: clean

    const res = await route.POST(stragglerReq());
    const body = await res.json();
    expect(body).toMatchObject({
      ok: true,
      acknowledged: 4,
      tables: ["Session"],
      summary: { state: "ok", total: 0 },
    });
    expect(mockAckStragglers).toHaveBeenCalledTimes(1);
  });

  it("reports a no-op retirement without erroring", async () => {
    authed("ADMIN");
    mockAckStragglers.mockResolvedValue({ acknowledged: 0, tables: [] });
    mockReadReport.mockResolvedValue({ Session: { count: 3 } });

    const res = await route.POST(stragglerReq());
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.acknowledged).toBe(0);
    expect(body.summary).toMatchObject({ state: "warn" });
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

describe("POST /api/admin/leaf-orphans (test-digest)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const testReq = () =>
    new Request("http://localhost/api/admin/leaf-orphans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "test-digest" }),
    });

  it("refuses non-admin users", async () => {
    authed("USER");
    const res = await route.POST(testReq());
    expect(res.status).toBe(403);
    expect(mockSendTestDigest).not.toHaveBeenCalled();
  });

  it("queues exactly one digest to the requesting admin and reports mailQueued", async () => {
    authed("ADMIN");
    mockSendTestDigest.mockResolvedValue({
      ok: true,
      mailQueued: 1,
      mailMisconfigured: false,
      namedRows: 19,
    });

    const res = await route.POST(testReq());
    const body = await res.json();
    expect(body).toEqual({ ok: true, emailQueued: 1, mailMisconfigured: false });
    // Recipients are narrowed to the session admin — a smoke test never
    // mails the whole admin roster.
    expect(mockSendTestDigest).toHaveBeenCalledWith({
      recipients: [{ id: "admin-1", email: "a@test.com" }],
    });
  });

  it("falls back to the DB row when the session carries no email", async () => {
    authed("ADMIN");
    mockRequireAuth.mockResolvedValue({
      session: { user: { id: "admin-1", role: "ADMIN" } },
      response: null,
    });
    mockFindUser
      .mockResolvedValueOnce({ role: "ADMIN" }) // the gate check
      .mockResolvedValueOnce({ email: "db@test.com" }); // the recipient fallback
    mockSendTestDigest.mockResolvedValue({
      ok: true,
      mailQueued: 1,
      mailMisconfigured: false,
      namedRows: 19,
    });

    await route.POST(testReq());
    expect(mockSendTestDigest).toHaveBeenCalledWith({
      recipients: [{ id: "admin-1", email: "db@test.com" }],
    });
  });

  it("turns a clean-report refusal into a localized 400 with the machine code", async () => {
    authed("ADMIN");
    mockSendTestDigest.mockResolvedValue({
      ok: false,
      mailQueued: 0,
      mailMisconfigured: false,
      namedRows: 0,
      code: "clean",
      reason: "the mirror is complete — nothing to preview",
    });

    const res = await route.POST(testReq());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toEqual({
      ok: false,
      code: "clean",
      reason: "the mirror is complete — nothing to preview",
      mailMisconfigured: false,
    });
  });

  it("surfaces mailMisconfigured so the UI warns instead of promising an inbox message", async () => {
    authed("ADMIN");
    mockSendTestDigest.mockResolvedValue({
      ok: true,
      mailQueued: 1,
      mailMisconfigured: true,
      namedRows: 3,
    });

    const res = await route.POST(testReq());
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.mailMisconfigured).toBe(true);
  });
});
