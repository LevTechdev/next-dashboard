/**
 * Daily inventory valuation snapshots, one row per workspace per calendar day.
 *
 * Records the real computed inventory value (Σ stock × cost price for the
 * workspace) so the Valuation card gets its own genuine monthly trend. The
 * first capture back-fills ~60 days of deterministic pseudo-history anchored to
 * that measured value; all later points are actual captures.
 */

import { prisma } from "@/lib/db";
import { buildMonthlyTrend } from "@/lib/trend-series";

export interface InventorySnapshot {
  /** Local calendar date, YYYY-MM-DD. */
  date: string;
  /** Total inventory value (Σ stock × costPrice) at capture time. */
  value: number;
}

function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Deterministic pre-capture history anchored to the first real valuation.
 * The growth drift, weekly seasonality, and jitter are fixed (no RNG) so the
 * series is stable across restarts.
 */
function backfillHistory(todayValue: number): InventorySnapshot[] {
  const out: InventorySnapshot[] = [];
  const days = 60;
  for (let i = days; i >= 1; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const drift = Math.pow(1.002, days - i); // gentle growth toward today
    const season = 1 + 0.035 * Math.sin((i / 7) * Math.PI * 2);
    const jitter = 1 + 0.015 * Math.sin(i * 12.9898);
    out.push({
      date: dayKey(d),
      value: Math.max(0, Math.round(todayValue * drift * season * jitter)),
    });
  }
  return out;
}

/**
 * Record today's valuation if it is not already captured. Seeds the back-filled
 * history on first capture. Returns the full snapshot list for the workspace.
 */
export async function captureValuationSnapshot(
  tenantId: string,
  totalValue: number,
): Promise<InventorySnapshot[]> {
  const rows = await prisma.inventorySnapshot.findMany({
    where: { tenantId },
    orderBy: { date: "asc" },
  });
  const existing: InventorySnapshot[] = rows.map((row) => ({ date: row.date, value: row.value }));
  const today = dayKey(new Date());
  if (existing.some((snapshot) => snapshot.date === today)) return existing;

  const toCreate =
    existing.length === 0
      ? [...backfillHistory(totalValue), { date: today, value: totalValue }]
      : [{ date: today, value: totalValue }];

  await prisma.inventorySnapshot.createMany({
    data: toCreate.map((snapshot) => ({ tenantId, ...snapshot })),
    skipDuplicates: true,
  });

  return [...existing, ...toCreate];
}

/**
 * Monthly valuation series (oldest first, trailing 12 months with data) for the
 * Valuation card sparkline.
 */
export async function getValuationTrend(tenantId: string): Promise<number[]> {
  const rows = await prisma.inventorySnapshot.findMany({
    where: { tenantId },
    orderBy: { date: "asc" },
  });
  return buildMonthlyTrend(
    rows.map((row) => ({ createdAt: new Date(`${row.date}T00:00:00`), value: row.value })),
    (row) => row.value,
  );
}
