/**
 * Heatmap bucket aggregation — the pure core of the profile activity card.
 *
 * The heatmap always renders the same day-cell matrix; the selected range
 * only changes what each cell is colored by:
 *
 *   weekly  → the day's own count (raw daily buckets)
 *   monthly → the total of the month the day belongs to
 *   yearly  → the day's own count again, but read across the multi-year
 *             fetch (see below)
 *
 * Reconciliation invariant (pinned by unit tests): every range partitions the
 * same daily counts, so the sum of all cell values in a window is identical
 * across ranges — switching tabs re-colors the grid without ever moving a
 * total.
 *
 * Why yearly colors days instead of year totals: the trailing-5-years fetch
 * usually holds data in a single year. Year totals would then give every
 * active-year cell the same saturated value and leave all other years at 0 —
 * the 5-step ramp degenerates to two flat states and reads as "dots lost
 * their colors". Day-level values scaled against the multi-year max keep the
 * ramp multi-level while the longer window widens its domain.
 */

export type HeatGranularity = "weekly" | "monthly" | "yearly";

/** ISO day key (YYYY-MM-DD) → count, as served by /api/profile/activity. */
export type DayCounts = Record<string, number>;

/**
 * Map daily counts to the per-cell values for a range.
 *
 * Returns day-key → value. For "monthly", every day key present in `days`
 * maps to its month's total; days absent from `days` render as 0 by lookup,
 * so they are not emitted here.
 */
export function bucketValues(days: DayCounts, gran: HeatGranularity): DayCounts {
  if (gran !== "monthly") {
    // Weekly and yearly both color cells by the day's own count — yearly
    // just reads a wider fetch (see module doc).
    return { ...days };
  }
  const monthTotals = new Map<string, number>();
  for (const [key, value] of Object.entries(days)) {
    const monthKey = key.slice(0, 7);
    monthTotals.set(monthKey, (monthTotals.get(monthKey) ?? 0) + value);
  }
  const out: DayCounts = {};
  for (const [key] of Object.entries(days)) {
    out[key] = monthTotals.get(key.slice(0, 7)) ?? 0;
  }
  return out;
}

/** Sum of all cell values in a window — the reconciliation anchor. */
export function sumOf(values: DayCounts): number {
  return Object.values(values).reduce((a, b) => a + b, 0);
}

/** Highest single cell value — the ramp's normalization domain. */
export function maxOf(values: DayCounts): number {
  return Object.values(values).reduce((a, b) => Math.max(a, b), 0);
}
