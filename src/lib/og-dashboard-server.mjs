/**
 * Server-side OG dashboard generator.
 *
 * Owns the caches and rendering for `/api/og/dashboard` so both the route and
 * the data-mutation API routes (orders/products/customers) can share one code
 * path. Data mutations call `regenerateDashboardOg(cookie)` fire-and-forget,
 * which re-renders against the live `/api/dashboard` numbers and writes a
 * fresh PNG to disk — no need to wait for the 24h disk TTL.
 */
import { promises as fs } from "fs";
import path from "path";
import {
  buildDashboardSvg,
  buildDashboardHtml,
  formatCompactUsd,
  initialsOf,
  DEFAULT_MONTHLY,
} from "./og-dashboard.mjs";

const MEM_TTL_MS = 10 * 60 * 1000;
const DISK_TTL_MS = 24 * 60 * 60 * 1000;
const DISK_PATH = path.join(process.cwd(), "public", "og", "dashboard.png");

// Coalescing window for mutation-driven refreshes: a burst of order/product/
// customer updates schedules at most ONE regeneration (trailing debounce), so
// rapid-fire writes never pay one Chromium render per mutation.
const REGEN_DEBOUNCE_MS = Number(process.env.OG_REGEN_DEBOUNCE_MS ?? 1500);

let memCache = null;

// Pending debounced regeneration state.
let regenTimer = null;
let regenQueued = false;
let regenCookie = null;

function statusText(status) {
  const map = {
    PENDING: "Pending",
    PROCESSING: "Processing",
    COMPLETED: "Completed",
    SHIPPED: "Shipped",
    DELIVERED: "Completed",
    CANCELLED: "Cancelled",
    REFUNDED: "Refunded",
    PAID: "Completed",
    UNPAID: "Pending",
  };
  return map[status] ?? "Completed";
}

/** Shape live dashboard numbers into the panel's KPI/order/bar inputs. */
/**
 * @param {any} data
 */
export function shapeLive(data) {
  const stats = data?.stats ?? {};
  const kpis = [
    {
      label: "Total Revenue",
      value: formatCompactUsd(stats.totalRevenue ?? 284750),
      delta: `+${stats.revenueGrowth ?? 12.5}%`,
    },
    {
      label: "Total Orders",
      value: (stats.totalOrders ?? 1847).toLocaleString("en-US"),
      delta: `+${stats.ordersGrowth ?? 8.3}%`,
    },
    {
      label: "Total Customers",
      value: (stats.totalCustomers ?? 892).toLocaleString("en-US"),
      delta: `+${stats.customersGrowth ?? 15.2}%`,
    },
    {
      label: "Total Products",
      value: (stats.totalProducts ?? 156).toLocaleString("en-US"),
      delta: `+${stats.productsGrowth ?? 5.1}%`,
    },
  ];

  const orders = (data?.recentOrders?.slice(0, 3) ?? []).map((o) => ({
    initials: initialsOf(o.customer?.name ?? "Guest"),
    name: o.customer?.name ?? "Guest",
    meta: `${o.orderNumber ?? "ORD-?"} · ${o.channel?.name ?? "—"}`,
    status: statusText(o.status ?? "Completed"),
    amount: `$${Number(o.grandTotal ?? 0).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`,
    color: "#22c55e",
  }));

  let values = DEFAULT_MONTHLY;
  if (data?.revenueData?.length) {
    const points = data.revenueData.slice(0, 12);
    const maxRev = Math.max(...points.map((p) => p.revenue), 1);
    values = points.map((p) => Math.max(6, Math.round((p.revenue / maxRev) * 118)));
  }

  return { kpis, orders, values };
}

/** @param {string | null} [cookie] */
async function loadLive(cookie) {
  try {
    const origin = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3010";
    const res = await fetch(`${origin}/api/dashboard`, {
      headers: cookie ? { cookie } : {},
      cache: "no-store",
    });
    if (!res.ok) return null; // unauthenticated or error → demo fallback
    return await res.json();
  } catch {
    return null;
  }
}

/** @param {string} html @param {string} svg */
async function renderPng(html, svg) {
  try {
    const { chromium } = await import("playwright");
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({
        viewport: { width: 1200, height: 630 },
        deviceScaleFactor: 1,
      });
      await page.setContent(html, { waitUntil: "load" });
      return await page.screenshot({ type: "png" });
    } finally {
      await browser.close().catch(() => {});
    }
  } catch {
    const sharp = (await import("sharp")).default;
    return sharp(Buffer.from(svg)).png().toBuffer();
  }
}

async function readDiskPng() {
  try {
    const stat = await fs.stat(DISK_PATH);
    if (Date.now() - stat.mtimeMs > DISK_TTL_MS) return null;
    return await fs.readFile(DISK_PATH);
  } catch {
    return null;
  }
}

async function writeDiskPng(png) {
  try {
    await fs.mkdir(path.dirname(DISK_PATH), { recursive: true });
    await fs.writeFile(DISK_PATH, png);
  } catch {
    // Non-fatal: the in-memory cache still covers this process.
  }
}

/**
 * Get the OG PNG. Serves memory → disk (fast path, no Chromium), and only
 * renders when both are stale/missing. `force` skips all caches and renders
 * fresh against live data.
 * @param {{ cookie?: string | null, force?: boolean }} [opts]
 */
export async function generateDashboardOg({ cookie = null, force = false } = {}) {
  if (!force && memCache && Date.now() - memCache.at < MEM_TTL_MS) {
    return { png: memCache.png, source: "memory" };
  }

  if (!force) {
    const diskPng = await readDiskPng();
    if (diskPng) {
      memCache = { at: Date.now(), png: diskPng };
      return { png: diskPng, source: "disk" };
    }
  }

  const live = await loadLive(cookie);
  const { kpis, orders, values } = shapeLive(live);
  const html = buildDashboardHtml({ kpis, orders, values });
  const svg = buildDashboardSvg({ kpis, orders, values });
  const png = await renderPng(html, svg);

  memCache = { at: Date.now(), png };
  // Await the disk write so a completed render is guaranteed to be persisted
  // (tests and the webhook rely on the file being fresh when this resolves).
  await writeDiskPng(png);
  return { png, source: live ? "live" : "demo" };
}

/**
 * Coalesced refresh after dashboard-affecting mutations. Trailing-debounced:
 * rapid-fire calls share one timer and render at most once against the latest
 * cookie. Safe to call fire-and-forget from route handlers.
 * @param {string | null} [cookie]
 */
export function regenerateDashboardOg(cookie = null) {
  regenCookie = cookie ?? regenCookie;
  regenQueued = true;
  if (regenTimer) return;
  regenTimer = setTimeout(() => {
    regenTimer = null;
    runQueuedRegeneration();
  }, REGEN_DEBOUNCE_MS);
}

/** Run (and clear) whatever regeneration is currently queued. */
async function runQueuedRegeneration() {
  regenQueued = false;
  const cookie = regenCookie;
  regenCookie = null;
  await generateDashboardOg({ cookie, force: true }).catch(() => {});
}

/**
 * Execute any pending debounced regeneration immediately and await its
 * completion (used by tests). Returns true when a render ran, else false.
 * @returns {Promise<boolean>}
 */
export async function flushDashboardOgRegeneration() {
  if (regenTimer) {
    clearTimeout(regenTimer);
    regenTimer = null;
  }
  if (!regenQueued) return false;
  await runQueuedRegeneration();
  return true;
}

/**
 * Force a fresh render now (used by the POST webhook endpoint).
 * @param {string | null} [cookie]
 */
export async function regenerateDashboardOgNow(cookie = null) {
  return generateDashboardOg({ cookie, force: true });
}
