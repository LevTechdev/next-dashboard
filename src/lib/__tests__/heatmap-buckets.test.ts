import { describe, expect, it } from "vitest";
import { bucketValues, maxOf, sumOf } from "@/lib/heatmap-buckets";

/**
 * Reconciliation audit for the activity heatmap's aggregation views.
 *
 * The invariant under audit: weekly / monthly / yearly all partition the SAME
 * daily counts, so any total derived from one range must be derivable from
 * the others. Bucket totals are asserted to reconcile with the weekly view's
 * daily counts — the bug class this guards against is an aggregation that
 * drops, double-counts, or re-weights days when switching ranges.
 */

/** Deterministic synthetic year: known counts on known days. */
function fixtureDays(): Record<string, number> {
  return {
    "2026-01-03": 2,
    "2026-01-04": 5,
    "2026-01-11": 1,
    "2026-02-01": 3,
    "2026-02-14": 8,
    "2026-03-21": 4,
    "2026-12-31": 7,
  };
}

describe("heatmap bucket reconciliation", () => {
  const days = fixtureDays();
  const weekly = bucketValues(days, "weekly");
  const monthly = bucketValues(days, "monthly");
  const yearly = bucketValues(days, "yearly");

  it("weekly cells are the raw daily counts (identity)", () => {
    expect(weekly).toEqual(days);
  });

  it("monthly buckets equal the sum of that month's daily counts", () => {
    // Jan: 2 + 5 + 1 = 8; Feb: 3 + 8 = 11; Mar: 4; Dec: 7
    expect(monthly["2026-01-03"]).toBe(8);
    expect(monthly["2026-01-04"]).toBe(8);
    expect(monthly["2026-01-11"]).toBe(8);
    expect(monthly["2026-02-01"]).toBe(11);
    expect(monthly["2026-02-14"]).toBe(11);
    expect(monthly["2026-03-21"]).toBe(4);
    expect(monthly["2026-12-31"]).toBe(7);
  });

  it("weekly and yearly cells sum to the same grand total (no dropped or double-counted days)", () => {
    const expected = sumOf(days);
    expect(sumOf(weekly)).toBe(expected);
    expect(sumOf(yearly)).toBe(expected);
  });

  it("monthly bucket totals reconcile with the daily counts (each month counted once)", () => {
    // In monthly view every DAY renders its month's total, so summing cells
    // would repeat a month once per day. The reconciling quantity is the sum
    // over DISTINCT months, which must equal the underlying daily total.
    const monthOf = (key: string) => key.slice(0, 7);
    const distinctMonthTotals = new Set<string>();
    const monthSumByKey = new Map<string, number>();
    for (const [key, value] of Object.entries(monthly)) {
      monthSumByKey.set(monthOf(key), value); // constant within a month
    }
    for (const m of monthSumByKey.keys()) distinctMonthTotals.add(m);
    let monthlyGrand = 0;
    for (const m of distinctMonthTotals) {
      // One representative day per month proves the stored total matches the
      // sum of that month's raw daily counts.
      const repDay = Object.keys(days).find((k) => monthOf(k) === m);
      expect(repDay).toBeDefined();
      monthlyGrand += monthly[repDay!];
    }
    expect(monthlyGrand).toBe(sumOf(days));
  });

  it("yearly colors days (identity to weekly) so the ramp stays multi-level", () => {
    expect(yearly).toEqual(weekly);
  });

  it("ramp domain: max cell value is the day max in weekly/yearly, the busiest month in monthly", () => {
    expect(maxOf(weekly)).toBe(8);
    expect(maxOf(yearly)).toBe(8);
    expect(maxOf(monthly)).toBe(11);
  });

  it("a day present in weekly is present in monthly with its month total (no silently empty buckets)", () => {
    for (const key of Object.keys(weekly)) {
      expect(monthly[key]).toBeGreaterThan(0);
    }
  });

  it("handles month boundaries and sparse years without cross-bucket bleed", () => {
    const sparse = { "2025-12-31": 2, "2026-01-01": 6 };
    const m = bucketValues(sparse, "monthly");
    expect(m["2025-12-31"]).toBe(2); // Dec 2025 bucket — not merged into Jan 2026
    expect(m["2026-01-01"]).toBe(6);
    expect(sumOf(m)).toBe(8);
  });
});
