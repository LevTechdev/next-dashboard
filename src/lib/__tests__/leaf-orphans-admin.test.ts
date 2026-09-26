import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import path from "node:path";
import fs from "node:fs";

/**
 * Admin-side leaf-orphan helpers (src/lib/leaf-orphans-admin.ts).
 *
 * These write the REAL gitignored ledger under a temp cwd and exercise the
 * real projection from scripts/lib/leaf-orphans.mjs — the same mechanism the
 * ack CLI drives — plus the shared summarize the GET endpoint and the digest
 * both read.
 */
const { ackLedgerPath, applyAckLedger } = await import("../../../scripts/lib/leaf-orphans.mjs");
const mod = await import("@/lib/leaf-orphans-admin");

let root = "";
let watermark = "";

function seedWatermark(report: unknown) {
  fs.mkdirSync(path.join(root, "data"), { recursive: true });
  fs.writeFileSync(watermark, JSON.stringify({ orphanReport: report }, null, 2));
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(process.cwd(), ".tmp-leaf-orphans-"));
  watermark = path.join(root, "data", "leaf-sync-watermark.json");
  vi.spyOn(process, "cwd").mockReturnValue(root);
});

afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(root, { recursive: true, force: true });
});

describe("readRawLeafOrphanReport", () => {
  it("returns the RAW report — the ledger is applied by the caller, not here", async () => {
    seedWatermark({
      Session: { count: 1, samples: ["cmuS [userId=cmuU]"] },
      SecurityEvent: { count: 5 },
    });
    // Pre-acknowledge the Session sample, then prove the raw read ignores it.
    await mod.acknowledgeLeafOrphanRefs(["cmuS [userId=cmuU]"]);
    const raw = await mod.readRawLeafOrphanReport();
    expect(raw).toEqual({
      Session: { count: 1, samples: ["cmuS [userId=cmuU]"] },
      SecurityEvent: { count: 5 },
    });
  });

  it("reads as undefined when the state file is missing or malformed", async () => {
    expect(await mod.readRawLeafOrphanReport()).toBeUndefined();
    fs.mkdirSync(path.join(root, "data"), { recursive: true });
    fs.writeFileSync(watermark, "{not json");
    expect(await mod.readRawLeafOrphanReport()).toBeUndefined();
  });
});

describe("acknowledgeLeafOrphanRefs", () => {
  it("persists normalized refs to the shared ledger and counts only new ones", async () => {
    seedWatermark({
      Session: { count: 2, samples: ["cmuS1 [userId=cmuU1]", "cmuS2 [userId=cmuU2]"] },
    });

    const first = await mod.acknowledgeLeafOrphanRefs(["cmuS1 [userId=cmuU1]", "cmuS1"]);
    expect(first).toBe(1); // the fingerprint and its bare id are the same ref

    // Idempotent + additive: re-acking changes nothing new, a new ref counts.
    const second = await mod.acknowledgeLeafOrphanRefs(["cmuS1", "cmuS2"]);
    expect(second).toBe(1);

    const ledger = JSON.parse(fs.readFileSync(ackLedgerPath(root), "utf-8"));
    expect(ledger.entries.map((e: { ref: string }) => e.ref).sort()).toEqual(["cmuS1", "cmuS2"]);
  });

  it("returns 0 and writes nothing for an empty ref list", async () => {
    expect(await mod.acknowledgeLeafOrphanRefs([])).toBe(0);
    expect(await mod.acknowledgeLeafOrphanRefs(["  "])).toBe(0);
    expect(fs.existsSync(ackLedgerPath(root))).toBe(false);
  });
});

describe("acknowledgeLeafOrphanStragglers", () => {
  it("acks the current fingerprints plus table-scoped straggler refs in one ledger", async () => {
    seedWatermark({
      Session: {
        count: 3,
        samples: ["cmuS1 [userId=cmuU1]", "cmuS2 [userId=cmuU2]", "cmuS3 [userId=cmuU3]"],
      },
      SecurityEvent: { count: 7 },
    });

    const { acknowledged, tables } = await mod.acknowledgeLeafOrphanStragglers();
    // 3 fingerprints + 1 table ref (SecurityEvent), all new.
    expect(acknowledged).toBe(4);
    expect(tables).toEqual(["SecurityEvent"]);

    const ledger = JSON.parse(fs.readFileSync(ackLedgerPath(root), "utf-8"));
    expect(ledger.entries.map((e: { ref: string }) => e.ref).sort()).toEqual([
      "cmuS1",
      "cmuS2",
      "cmuS3",
      "table:SecurityEvent",
    ]);

    // The projection flips warn → ok.
    const summary = await mod.summarizeLeafOrphans(await mod.readRawLeafOrphanReport());
    expect(summary).toMatchObject({ state: "ok", total: 0, unacknowledgedSamples: 0 });
  });

  it("is idempotent for the named rows, then retires the straggler table once", async () => {
    seedWatermark({ Session: { count: 2, samples: ["cmuS1 [userId=cmuU1]"] } });
    await mod.acknowledgeLeafOrphanRefs(["cmuS1 [userId=cmuU1]"]);

    // The sample is acked; the table is now a straggler (count 1, no names).
    const first = await mod.acknowledgeLeafOrphanStragglers();
    expect(first).toEqual({ acknowledged: 1, tables: ["Session"] });

    // A new load generation shifts the count — the retirement is
    // generation-crossing BY DESIGN (the ledger keeps it until
    // `--unack table:Session`), so the second run is a no-op and the
    // projection stays clean.
    seedWatermark({ Session: { count: 9, samples: [] } });
    const second = await mod.acknowledgeLeafOrphanStragglers();
    expect(second).toEqual({ acknowledged: 0, tables: [] });
    const summary = await mod.summarizeLeafOrphans(await mod.readRawLeafOrphanReport());
    expect(summary.state).toBe("ok");

    // Pinned consequence: even NEW named samples on that table stay retired —
    // the operator retired the table, and only --unack brings it back.
    seedWatermark({ Session: { count: 10, samples: ["cmuS9 [userId=cmuU9]"] } });
    const afterNewLoad = await mod.summarizeLeafOrphans(await mod.readRawLeafOrphanReport());
    expect(afterNewLoad.state).toBe("ok");
  });

  it("still acks the named rows when the report is entirely clean", async () => {
    seedWatermark({ Session: { count: 1, samples: ["cmuS1 [userId=cmuU1]"] } });
    const { acknowledged, tables } = await mod.acknowledgeLeafOrphanStragglers();
    expect(acknowledged).toBe(1);
    expect(tables).toEqual([]);
  });

  it("writes nothing when there is no report at all", async () => {
    const result = await mod.acknowledgeLeafOrphanStragglers();
    expect(result).toEqual({ acknowledged: 0, tables: [] });
    expect(fs.existsSync(ackLedgerPath(root))).toBe(false);
  });
});

describe("summarizeLeafOrphans", () => {
  it("projects bad → warn → ok through the acknowledged ledger", async () => {
    seedWatermark({
      Session: {
        count: 3,
        samples: ["cmuS1 [userId=cmuU1]", "cmuS2 [userId=cmuU2]", "cmuS3 [userId=cmuU3]"],
      },
      SecurityEvent: { count: 7 },
    });

    const bad = await mod.summarizeLeafOrphans(await mod.readRawLeafOrphanReport());
    expect(bad).toMatchObject({ state: "bad", total: 10, unacknowledgedSamples: 3 });

    await mod.acknowledgeLeafOrphanRefs(["cmuS1", "cmuS2", "cmuS3"]);
    const warn = await mod.summarizeLeafOrphans(await mod.readRawLeafOrphanReport());
    expect(warn.state).toBe("warn"); // SecurityEvent's 7 rows remain, but nothing is named
    expect(warn.total).toBe(7);
    expect(warn.unacknowledgedSamples).toBe(0);
    expect(warn.tables.Session).toBeUndefined(); // fully-acked tables disappear
  });

  it("reports ok when there is no report", async () => {
    expect(await mod.summarizeLeafOrphans(undefined)).toEqual({
      state: "ok",
      total: 0,
      unacknowledgedSamples: 0,
      tables: {},
    });
  });

  it("matches the shared projection helper entry for entry", async () => {
    seedWatermark({ Session: { count: 2, samples: ["cmuS1 [userId=cmuU1]"] } });
    await mod.acknowledgeLeafOrphanRefs(["cmuS1"]);
    const summary = await mod.summarizeLeafOrphans(await mod.readRawLeafOrphanReport());
    expect(summary.tables).toEqual(
      applyAckLedger({ Session: { count: 2, samples: ["cmuS1 [userId=cmuU1]"] } }, [
        { ref: "cmuS1" },
      ]),
    );
  });
});
