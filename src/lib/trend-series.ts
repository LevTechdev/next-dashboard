/**
 * Monthly trend helpers shared by dashboard-adjacent APIs (products, purchase
 * orders). Buckets items by the calendar month of `createdAt` over the trailing
 * 12 months and returns only the months that actually have data (oldest first,
 * capped at 12 points) — the same convention /api/dashboard uses for its
 * sparkline series, so a card never drowns in leading zero months.
 */

const MONTH_KEYS = Array.from({ length: 12 }, (_, i) => {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - (11 - i));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
});

export interface Trendable {
  createdAt: string | Date;
}

/**
 * Build a monthly count/sum series from dated items.
 * @param items items with a `createdAt` (ISO string or Date)
 * @param valueFn per-item value; default counts each item as 1
 */
export function buildMonthlyTrend<T extends Trendable>(
  items: T[],
  valueFn: (item: T) => number = () => 1,
): number[] {
  const buckets = new Map<string, number>(MONTH_KEYS.map((k) => [k, 0]));
  for (const item of items) {
    const d = new Date(item.createdAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (buckets.has(key)) {
      buckets.set(key, (buckets.get(key) ?? 0) + valueFn(item));
    }
  }
  const series = MONTH_KEYS.map((k) => buckets.get(k) ?? 0);
  const firstNonZero = series.findIndex((v) => v > 0);
  return firstNonZero === -1 ? [] : series.slice(firstNonZero);
}
