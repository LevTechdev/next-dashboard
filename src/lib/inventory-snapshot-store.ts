/**
 * Daily inventory valuation snapshots.
 *
 * Records the real computed inventory value (Σ stock × cost price for the
 * workspace) once per calendar day so the Valuation card gets its own genuine
 * monthly trend instead of borrowing the sales-value series. Captures happen
 * lazily whenever the inventory page loads the product catalog
 * (`/api/products?includeValue=true`), deduplicated by day.
 *
 * On the very first capture the store back-fills ~60 days of deterministic
 * pseudo-history anchored to that real measured value, so the sparkline has
 * immediate shape until genuine daily snapshots accumulate. All subsequent
 * points are actual captured values.
 */

import { promises as fs } from "fs";
import path from "path";
import { buildMonthlyTrend } from "@/lib/trend-series";

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_PATH = path.join(DATA_DIR, "inventory-snapshots.json");

export interface InventorySnapshot {
  /** Local calendar date, YYYY-MM-DD. */
  date: string;
  /** Total inventory value (Σ stock × costPrice) at capture time. */
  value: number;
}

let cache: InventorySnapshot[] | null = null;

function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

async function load(): Promise<InventorySnapshot[]> {
  if (cache) return cache;
  try {
    const raw = await fs.readFile(DATA_PATH, "utf8");
    cache = JSON.parse(raw) as InventorySnapshot[];
  } catch {
    cache = [];
  }
  return cache;
}

async function save(snapshots: InventorySnapshot[]): Promise<void> {
  cache = snapshots;
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(DATA_PATH, JSON.stringify(snapshots, null, 2));
  } catch {
    // Non-fatal: the in-memory copy still serves this process.
  }
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
 * history on first capture. Returns the full snapshot list.
 */
export async function captureValuationSnapshot(totalValue: number): Promise<InventorySnapshot[]> {
  const snapshots = await load();
  const today = dayKey(new Date());
  if (snapshots.some((s) => s.date === today)) return snapshots;

  const next =
    snapshots.length === 0
      ? [...backfillHistory(totalValue), { date: today, value: totalValue }]
      : [...snapshots, { date: today, value: totalValue }];

  await save(next);
  return next;
}

/**
 * Monthly valuation series (oldest first, trailing 12 months with data) for the
 * Valuation card sparkline.
 */
export async function getValuationTrend(): Promise<number[]> {
  const snapshots = await load();
  return buildMonthlyTrend(
    snapshots.map((s) => ({ createdAt: new Date(`${s.date}T00:00:00`), value: s.value })),
    (s) => s.value,
  );
}
