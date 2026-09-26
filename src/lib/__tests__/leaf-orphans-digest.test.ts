import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import path from "node:path";
import fs from "node:fs";

/**
 * Scheduled ops digest for the leaf-sync orphan report.
 *
 * Pinned here:
 *   • fires only for the "Needs reconciliation" verdict — named rows nobody
 *     has retired (warn/ok stay quiet),
 *   • deduped per UTC day via the gitignored marker file,
 *   • recipients are every active admin, queued through the durable outbox
 *     (enqueueEmail) — never an inline transport call.
 */
vi.mock("@/lib/db", () => ({
  prisma: { user: { findMany: vi.fn() } },
}));
vi.mock("@/lib/email-outbox", () => ({
  enqueueEmail: vi.fn(async () => ({ id: "ob-1" })),
}));

const { enqueueEmail } = await import("@/lib/email-outbox");
const { prisma } = await import("@/lib/db");
const mod = await import("@/lib/leaf-orphans-digest");

let root = "";

function seedWatermark(report: unknown) {
  fs.mkdirSync(path.join(root, "data"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "data", "leaf-sync-watermark.json"),
    JSON.stringify({ orphanReport: report }, null, 2),
  );
}

function stubAdmins(
  admins: Array<Partial<{ id: string; email: string | null; tenantId: string | null }>>,
) {
  vi.mocked(prisma.user.findMany).mockResolvedValue(admins as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  root = fs.mkdtempSync(path.join(process.cwd(), ".tmp-orphan-digest-"));
  vi.spyOn(process, "cwd").mockReturnValue(root);
  stubAdmins([{ id: "admin-1", email: "ops@example.com", tenantId: "tenant-1" }]);
});

afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(root, { recursive: true, force: true });
});

const NAMED = {
  Session: { count: 97, samples: ["cmuS1 [userId=cmuU1]", "cmuS2 [userId=cmuU2]"] },
  SecurityEvent: { count: 2850, samples: ["cmuE1 [tenantId=cmuT1]"] },
};

describe("runLeafOrphansDigest", () => {
  it("queues one digest per admin when the report names unacknowledged rows", async () => {
    seedWatermark(NAMED);
    const result = await mod.runLeafOrphansDigest({ force: true });

    expect(result).toMatchObject({ queued: 1, namedRows: 3 });
    expect(enqueueEmail).toHaveBeenCalledTimes(1);
    const call = vi.mocked(enqueueEmail).mock.calls[0][0];
    expect(call.to).toBe("ops@example.com");
    expect(call.template).toBe("leaf_orphans_digest");
    expect(call.params).toMatchObject({ total: 2947 });
    expect(call.params!.tables).toEqual([
      "SecurityEvent: 2850 rows cannot sync",
      "Session: 97 rows cannot sync",
    ]);
    expect(call.params!.samples).toContain("cmuE1 [tenantId=cmuT1]");
  });

  it("stays silent for the warn verdict (counts remain, nothing named)", async () => {
    seedWatermark({ Session: { count: 3 } });
    const result = await mod.runLeafOrphansDigest({ force: true });

    expect(result).toMatchObject({ queued: 0, skipped: true, namedRows: 0 });
    expect(enqueueEmail).not.toHaveBeenCalled();
  });

  it("stays silent when the report is clean", async () => {
    const result = await mod.runLeafOrphansDigest({ force: true });

    expect(result).toMatchObject({ queued: 0, skipped: true });
    expect(enqueueEmail).not.toHaveBeenCalled();
  });

  it("dedupes per UTC day via the marker file", async () => {
    seedWatermark(NAMED);
    const now = new Date("2026-09-26T10:00:00Z");

    const first = await mod.runLeafOrphansDigest({ now, force: true });
    expect(first.queued).toBe(1);

    // Same day, no force: the marker file now holds 2026-09-26.
    const second = await mod.runLeafOrphansDigest({ now });
    expect(second).toMatchObject({ queued: 0, skipped: true });
    expect(enqueueEmail).toHaveBeenCalledTimes(1); // still just the first send

    // A new UTC day fires again.
    const nextDay = await mod.runLeafOrphansDigest({ now: new Date("2026-09-27T10:00:00Z") });
    expect(nextDay.queued).toBe(1);
    expect(enqueueEmail).toHaveBeenCalledTimes(2);
  });

  it("skips without a marker when the last send was a previous day", async () => {
    seedWatermark(NAMED);
    fs.mkdirSync(root, { recursive: true });
    fs.writeFileSync(
      path.join(root, "data", "leaf-orphans-digest-sent.json"),
      JSON.stringify({ day: "2026-09-25", at: "2026-09-25T02:00:00.000Z" }),
    );

    const result = await mod.runLeafOrphansDigest({ now: new Date("2026-09-26T02:00:00Z") });
    expect(result.queued).toBe(1);
  });

  it("has nothing to send when no admin has an email address", async () => {
    seedWatermark(NAMED);
    stubAdmins([{ id: "admin-1", email: null, tenantId: null }]);

    const result = await mod.runLeafOrphansDigest({ force: true });
    expect(result).toMatchObject({ queued: 0, skipped: true, reason: expect.any(String) });
    expect(enqueueEmail).not.toHaveBeenCalled();
  });
});

describe("digest helpers", () => {
  it("caps the sample list so one mega-report stays readable", async () => {
    const tables = {
      Session: { count: 20, samples: Array.from({ length: 20 }, (_, i) => `cmu${i} [userId=u]`) },
    };
    expect(mod.digestSamples(tables)).toHaveLength(12);
  });
});
