import "server-only";

import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { sendPushToTenant } from "@/lib/web-push";
import {
  readReportSchedule,
  writeReportSchedule,
  type ReportScheduleConfig,
} from "@/lib/report-schedule-store";

/**
 * Scheduled executive reports — the delivery engine behind the Reports
 * page's schedule config.
 *
 * runScheduledReports() is called by the scheduler's daily window; it
 * compares each active schedule's frequency against lastSentAt and emails
 * the executive digest (GMV, orders, AOV, top products, 30-day forecast)
 * when a period boundary has crossed. The send-digest route remains for
 * on-demand sends; this module is the automated half that was missing.
 */

export interface ScheduledReportsResult {
  checked: number;
  sent: number;
  skipped: boolean;
  reason?: string;
}

function fmt(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

/** Days in one frequency period. */
function periodDays(frequency: ReportScheduleConfig["frequency"]): number {
  switch (frequency) {
    case "DAILY":
      return 1;
    case "WEEKLY":
      return 7;
    case "MONTHLY":
      return 30;
  }
}

async function computeExecutiveMetrics() {
  const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [orders, recentOrders] = await Promise.all([
    prisma.order.findMany({
      where: { paymentStatus: "PAID" },
      select: { grandTotal: true, createdAt: true },
    }),
    prisma.order.findMany({
      where: { paymentStatus: "PAID", createdAt: { gte: since30 } },
      include: { items: { include: { product: { select: { name: true, sku: true } } } } },
    }),
  ]);

  const gmv = orders.reduce((s, o) => s + (o.grandTotal || 0), 0);
  const totalOrders = orders.length;
  const aov = totalOrders > 0 ? gmv / totalOrders : 0;

  // Top 3 products by revenue over the trailing 30 days.
  const byProduct = new Map<
    string,
    { name: string; sku: string; units: number; revenue: number }
  >();
  for (const o of recentOrders) {
    for (const item of o.items) {
      const key = item.product?.sku ?? item.productId ?? "unknown";
      const entry = byProduct.get(key) ?? {
        name: item.product?.name ?? "Unknown product",
        sku: item.product?.sku ?? "—",
        units: 0,
        revenue: 0,
      };
      entry.units += item.quantity;
      entry.revenue += (item.price ?? 0) * item.quantity;
      byProduct.set(key, entry);
    }
  }
  const topProducts = [...byProduct.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 3);

  // 30-day forecast from the trailing-30-day run rate.
  const last30Revenue = recentOrders.reduce((s, o) => s + (o.grandTotal || 0), 0);
  const forecast = last30Revenue; // next 30 days ≈ trailing 30 days

  return { gmv, totalOrders, aov, topProducts, forecast };
}

function digestHtml(m: Awaited<ReturnType<typeof computeExecutiveMetrics>>): string {
  return `<!doctype html>
<html><body style="margin:0;background:#f4f4f5;font-family:-apple-system,Segoe UI,sans-serif;">
  <div style="max-width:560px;margin:24px auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e4e4e7;">
    <div style="background:#18181b;color:#fff;padding:24px 28px;">
      <div style="font-size:11px;letter-spacing:0.1em;text-transform:uppercase;opacity:0.7;">Scheduled Executive Report</div>
      <div style="font-size:26px;font-weight:800;margin-top:4px;">${fmt(m.gmv)} GMV</div>
      <div style="font-size:13px;opacity:0.8;margin-top:2px;">${m.totalOrders.toLocaleString()} orders · ${fmt(m.aov)} AOV</div>
    </div>
    <div style="padding:24px 28px;color:#18181b;">
      <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#71717a;margin-bottom:10px;">Top 3 products (30 days)</div>
      ${m.topProducts
        .map(
          (
            p,
            i,
          ) => `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f4f4f4;font-size:13px;">
            <div><strong>#${i + 1} ${p.name}</strong><div style="color:#71717a;font-size:11px;">SKU ${p.sku} · ${p.units} units</div></div>
            <div style="font-weight:700;">${fmt(p.revenue)}</div>
          </div>`,
        )
        .join("")}
      <div style="margin-top:16px;padding:14px;border-radius:12px;background:#f0fdf4;border:1px solid #bbf7d0;">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#166534;">30-day revenue forecast</div>
        <div style="font-size:22px;font-weight:800;color:#14532d;margin-top:2px;">${fmt(m.forecast)}</div>
      </div>
      <div style="margin-top:20px;font-size:11px;color:#a1a1aa;">
        You receive this because a scheduled report is configured for your workspace. Manage it under Reports → Schedule.
      </div>
    </div>
  </div>
</body></html>`;
}

/**
 * Run due scheduled reports. Returns a summary for the scheduler ledger.
 */
export async function runScheduledReports(
  opts: { force?: boolean } = {},
): Promise<ScheduledReportsResult> {
  const config = readReportSchedule();
  if (!config.isActive || config.recipients.length === 0) {
    return { checked: 0, sent: 0, skipped: true, reason: "no active schedule or recipients" };
  }

  // Frequency gate: only send when the last send is older than one period
  // (or force is set — used by the manual trigger and tests).
  if (!opts.force && config.lastSentAt) {
    const elapsedDays =
      (Date.now() - new Date(config.lastSentAt).getTime()) / (24 * 60 * 60 * 1000);
    if (elapsedDays < periodDays(config.frequency)) {
      return {
        checked: 1,
        sent: 0,
        skipped: true,
        reason: `next send in ${(periodDays(config.frequency) - elapsedDays).toFixed(1)}d`,
      };
    }
  }

  const metrics = await computeExecutiveMetrics();
  const frequencyLabel = config.frequency.charAt(0) + config.frequency.slice(1).toLowerCase();
  const periodLabel =
    config.frequency === "WEEKLY" ? "Weekly" : config.frequency === "MONTHLY" ? "Monthly" : "Daily";

  let sent = 0;
  for (const to of config.recipients) {
    try {
      await sendEmail({
        to,
        subject: `${periodLabel} Executive Report: ${fmt(metrics.gmv)} GMV`,
        html: digestHtml(metrics),
        text: `${periodLabel} Executive Report\nGMV: ${fmt(metrics.gmv)}\nOrders: ${metrics.totalOrders}\nAOV: ${fmt(metrics.aov)}\n30-day forecast: ${fmt(metrics.forecast)}\n`,
      });
      sent += 1;
    } catch (err) {
      console.error(`[scheduled-reports] send to ${to} failed:`, err);
    }
  }

  // One push per workspace member with push enabled — quiet nudge that the
  // fresh report is in their inbox.
  try {
    await sendPushToTenant(null, {
      title: `${frequencyLabel} report delivered`,
      body: `GMV ${fmt(metrics.gmv)} · ${metrics.totalOrders.toLocaleString()} orders — full report in your inbox.`,
      url: "/reports",
      tag: "scheduled-report",
    });
  } catch {
    // Push is best-effort.
  }

  config.lastSentAt = new Date().toISOString();
  writeReportSchedule(config);

  return { checked: 1, sent, skipped: false };
}

/** Manual trigger used by the cron route and tests. */
export async function runScheduledReportsManual() {
  return runScheduledReports({ force: true });
}
