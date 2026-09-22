import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * fx-history.ts — daily FX snapshots + sharp-move alerts.
 *
 * Mirrors the recovery-drift contract: idempotent daily capture, move judged
 * against the most recent earlier row, alert deduped per day, and a first
 * observation NEVER invents a move.
 */

const upsert = vi.fn().mockResolvedValue({});
const findFirst = vi.fn().mockResolvedValue(null);
const findMany = vi.fn().mockResolvedValue([]);
const createMany = vi.fn().mockResolvedValue({ count: 0 });
const notifFindFirst = vi.fn().mockResolvedValue(null);

vi.mock("@/lib/db", () => ({
  prisma: {
    fxRateSnapshot: {
      upsert: (...a: unknown[]) => upsert(...a),
      findFirst: (...a: unknown[]) => findFirst(...a),
      findMany: (...a: unknown[]) => findMany(...a),
    },
    notification: {
      findFirst: (...a: unknown[]) => notifFindFirst(...a),
      createMany: (...a: unknown[]) => createMany(...a),
    },
    user: { findMany: (...a: unknown[]) => findMany(...a) },
  },
}));

vi.mock("@/lib/market-rates", () => ({
  fetchMidMarketRates: vi.fn().mockResolvedValue({
    base: "USD",
    rates: { USD: 1, IDR: 17_790.47, JPY: 149.2, EUR: 0.92, SGD: 1.34, CNY: 7.24 },
    source: "open-er-api",
    sourceLabel: "ExchangeRate-API",
    fetchedAt: new Date().toISOString(),
    stale: false,
  }),
}));

describe("fx-history", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findFirst.mockResolvedValue(null);
  });

  it("captures one row per tracked pair, judging no move on first observation", async () => {
    const { captureFxSnapshot, trackedQuotes } = await import("@/lib/fx-history");
    const report = await captureFxSnapshot({ notify: false });

    expect(report.captured).toHaveLength(trackedQuotes().length);
    // First-ever capture: no previous rows, so prevRate is null.
    expect(findFirst).toHaveBeenCalled();
    const firstUpsert = upsert.mock.calls[0][0] as {
      create: { prevRate: number | null; movePct: number | null };
    };
    expect(firstUpsert.create.prevRate).toBeNull();
    expect(firstUpsert.create.movePct).toBeNull();
    expect(report.captured.every((c) => c.movePct === null && !c.alerted)).toBe(true);
  });

  it("computes the move against the previous row and alerts beyond the threshold", async () => {
    // Yesterday IDR was 17,000 — today 17,790.47 is a +4.65% move.
    findFirst.mockResolvedValue({ rate: 17_000 });
    const { captureFxSnapshot, FX_MOVE_ALERT_PCT } = await import("@/lib/fx-history");

    const report = await captureFxSnapshot({ notify: true });
    const idr = report.captured.find((c) => c.quote === "IDR")!;
    expect(idr.movePct).not.toBeNull();
    expect(idr.movePct!).toBeGreaterThan(FX_MOVE_ALERT_PCT);
    expect(idr.alerted).toBe(true);
    expect(createMany).toHaveBeenCalled();
  });

  it("stays quiet for a small move", async () => {
    // Only IDR has a previous row, and its move is small; the other pairs
    // have no history (null) so they cannot invent a move either.
    findFirst.mockImplementation((args: { where: { quote: string } }) =>
      args.where.quote === "IDR" ? { rate: 17_750 } : null,
    );
    createMany.mockClear();
    const { captureFxSnapshot } = await import("@/lib/fx-history");
    const report = await captureFxSnapshot({ notify: true });
    const idr = report.captured.find((c) => c.quote === "IDR")!;
    expect(idr.alerted).toBe(false);
    expect(createMany).not.toHaveBeenCalled();
  });

  it("upsert updates the same day's row instead of appending", async () => {
    findFirst.mockResolvedValue({ rate: 17_000 });
    const { captureFxSnapshot } = await import("@/lib/fx-history");
    await captureFxSnapshot({ notify: false });
    for (const call of upsert.mock.calls) {
      expect(
        (call[0] as { where: { base_quote_day: unknown } }).where.base_quote_day,
      ).toBeDefined();
    }
  });

  it("history returns rows oldest-first with numeric rates", async () => {
    findMany.mockResolvedValue([
      { day: "2026-09-20", rate: "17700.000000", source: "open-er-api", movePct: null },
      { day: "2026-09-21", rate: "17790.470000", source: "open-er-api", movePct: 0.51 },
    ]);
    const { fxRateHistory } = await import("@/lib/fx-history");
    const rows = await fxRateHistory("IDR", 30);
    expect(rows).toHaveLength(2);
    expect(rows[0].rate).toBeCloseTo(17_700, 4);
    expect(typeof rows[1].movePct).toBe("number");
  });
});
