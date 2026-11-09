/**
 * Acknowledged-orphan ledger — the pure subtraction the scheduler card and the
 * ack CLI apply to the raw leaf-sync report.
 *
 * Lifecycle being pinned:
 *   1. The raw report (scripts/sync-supabase-leaves.mjs) carries a table's
 *      orphans — count + sample fingerprints.
 *   2. An operator acknowledges a sample ref
 *      (node scripts/ack-leaf-orphans.mjs <ref>): the ref retires from the
 *      projected report everywhere.
 *   3. --unack restores it: the raw report shines through untouched.
 */
import { describe, expect, it } from "vitest";
import {
  applyAckLedger,
  isRefAcknowledged,
  normalizeAckEntries,
  sampleRef,
  stragglerAckRefs,
} from "../leaf-orphans.mjs";

const REPORT = {
  SecurityEvent: {
    count: 2837,
    samples: [
      "cmuEvent1 [userId=cmuUserA]",
      "cmuEvent2 [userId=cmuUserB tenantId=cmuTenant1]",
      "cmuEvent3 [userId=cmuUserC]",
    ],
  },
  Session: { count: 94, samples: ["cmuSession1 [userId=cmuUserA]"] },
  FxRateSnapshot: { count: 10 }, // conflict-skips: no samples to name
};

describe("sampleRef", () => {
  it("extracts the subject id from a fingerprint", () => {
    expect(sampleRef("cmuEvent1 [userId=cmuUserA]")).toBe("cmuEvent1");
    expect(sampleRef("cmuEvent2 [userId=cmuUserB tenantId=cmuTenant1]")).toBe("cmuEvent2");
  });

  it("passes a bare ref through and tolerates junk", () => {
    expect(sampleRef("cmuEvent1")).toBe("cmuEvent1");
    expect(sampleRef("   ")).toBe("");
    expect(sampleRef(null)).toBe("");
  });
});

describe("isRefAcknowledged", () => {
  it("matches the fingerprint and its bare-subject form", () => {
    expect(isRefAcknowledged("cmuEvent1 [userId=cmuUserA]", ["cmuEvent1"])).toBe(true);
    expect(isRefAcknowledged("cmuEvent1", ["cmuEvent1"])).toBe(true);
  });

  it("does not match a prefix-only id collision", () => {
    expect(isRefAcknowledged("cmuEvent1X [userId=u]", ["cmuEvent1"])).toBe(false);
  });

  it("does not match a different row sharing the FK value", () => {
    expect(isRefAcknowledged("cmuEvent1 [userId=cmuUserA]", ["cmuUserA"])).toBe(false);
  });
});

describe("applyAckLedger", () => {
  it("removes acknowledged samples and decrements the count", () => {
    const out = applyAckLedger(REPORT, ["cmuEvent1"]);
    expect(out.SecurityEvent).toEqual({
      count: 2836,
      samples: REPORT.SecurityEvent.samples.slice(1),
    });
    expect(out.Session).toEqual({ count: 94, samples: ["cmuSession1 [userId=cmuUserA]"] });
    expect(out.FxRateSnapshot).toEqual({ count: 10 });
  });

  it("drops a table whose count reaches zero and keeps bare-count tables", () => {
    const out = applyAckLedger(
      { Session: { count: 1, samples: ["cmuSession1 [userId=u]"] }, FxRateSnapshot: { count: 7 } },
      ["cmuSession1"],
    );
    expect(out).toEqual({ FxRateSnapshot: { count: 7 } });
  });

  it("treats an all-acknowledged report as empty", () => {
    const out = applyAckLedger(
      { Session: { count: 2, samples: ["cmuS1 [userId=u]", "cmuS2 [userId=u]"] } },
      ["cmuS1", "cmuS2"],
    );
    expect(out).toEqual({});
  });

  it("is a no-op against an empty ledger", () => {
    expect(applyAckLedger(REPORT, [])).toEqual(REPORT);
    expect(applyAckLedger(REPORT, undefined)).toEqual(REPORT);
  });

  it("never goes negative on over-acknowledgement", () => {
    // Two acknowledged samples but the count says 1: the floor holds and the
    // emptied table disappears rather than reporting a negative debt.
    const out = applyAckLedger(
      { Session: { count: 1, samples: ["cmuS1 [userId=u]", "cmuS2 [userId=u]"] } },
      ["cmuS1", "cmuS2"],
    );
    expect(out).toEqual({});
  });

  it("tolerates a hand-edited report (missing samples field)", () => {
    const out = applyAckLedger({ Session: { count: 94 } }, ["cmuWhatever"]);
    expect(out).toEqual({ Session: { count: 94 } });
  });
});

describe("stragglerAckRefs", () => {
  it("marks exactly the tables whose count survives with no unacknowledged samples", () => {
    // SecurityEvent still names rows → NOT a straggler. Session's only sample
    // is acked → straggler. FxRateSnapshot was never sampled → straggler.
    const report = applyAckLedger(REPORT, ["cmuSession1"]);
    expect(report).toEqual({
      SecurityEvent: {
        count: 2837,
        samples: REPORT.SecurityEvent.samples,
      },
      Session: { count: 93 }, // the one named sample retired from the tally
      FxRateSnapshot: { count: 10 },
    });
    expect(stragglerAckRefs(report)).toEqual(["table:Session", "table:FxRateSnapshot"]);
  });

  it("returns nothing for a clean report and tolerates junk entries", () => {
    expect(stragglerAckRefs({})).toEqual([]);
    expect(stragglerAckRefs(undefined)).toEqual([]);
    expect(stragglerAckRefs({ Session: null, Junk: "nope" })).toEqual([]);
  });
});

describe("table-scoped acks in applyAckLedger", () => {
  it("retires a table's whole remaining entry", () => {
    const out = applyAckLedger(
      { Session: { count: 94 }, FxRateSnapshot: { count: 10 }, SecurityEvent: { count: 3 } },
      ["table:Session"],
    );
    expect(out).toEqual({ FxRateSnapshot: { count: 10 }, SecurityEvent: { count: 3 } });
  });

  it("never matches a row subject (the prefix is cuid-hostile)", () => {
    // A table-scoped ref for a table the report does not contain retires
    // nothing — and no row subject can ever look like `table:…`.
    expect(applyAckLedger(REPORT, ["table:NoSuchTable"])).toEqual(REPORT);
  });

  it("round-trips: straggler refs derived from a projected report retire it fully", () => {
    const projected = applyAckLedger(REPORT, [
      "cmuSession1",
      "cmuEvent1",
      "cmuEvent2",
      "cmuEvent3",
    ]);
    const out = applyAckLedger(projected, stragglerAckRefs(projected));
    expect(out).toEqual({});
  });
});

describe("normalizeAckEntries", () => {
  it("keeps well-formed entries with the subject ref and trimmed note", () => {
    const out = normalizeAckEntries([
      { ref: "cmuE1 [userId=u]", note: "  dev fixture  ", at: "2026-09-26T00:00:00.000Z" },
    ]);
    expect(out).toEqual([{ ref: "cmuE1", note: "dev fixture", at: "2026-09-26T00:00:00.000Z" }]);
  });

  it("drops ref-less and duplicate entries (first wins)", () => {
    const out = normalizeAckEntries([
      { ref: "cmuE1" },
      { ref: "cmuE1", note: "second" },
      { note: "no ref" },
      null,
    ]);
    expect(out).toEqual([{ ref: "cmuE1" }]);
  });
});
