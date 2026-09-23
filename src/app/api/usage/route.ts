import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-guard";
import { getTierFeaturesForWorkspace, API_KEY_LIMITS } from "@/lib/plan-tiers";
import { sendEmail } from "@/lib/email";
import { sendPushToTenant } from "@/lib/web-push";

export const dynamic = "force-dynamic";

/**
 * Usage & quota metering for the signed-in user's workspace.
 *
 * Reports current-period consumption against the ACTIVE plan's limits
 * (null limit = unlimited), persists a monthly snapshot per metric into the
 * UsageRecord table (idempotent per metric+period so repeated GETs refresh
 * rather than duplicate), and returns a 12-cycle history for the Billing
 * trend chart. The same numbers back the 402 plan-limit enforcement on
 * POST /api/orders and POST /api/team/invitations.
 *
 * While computing, quota thresholds (80% / 100%) are evaluated per capped
 * metric and workspace owners receive a Notification the first time a
 * threshold is crossed in a billing cycle (deduplicated via the existing
 * Notification row for that cycle+threshold).
 */

const METRIC_KEYS = ["orders", "teamMembers", "apiKeys"] as const;
type MetricKey = (typeof METRIC_KEYS)[number];

/** UsageRecord.metric values — snake_case per the schema comment. */
const METRIC_COLUMN: Record<MetricKey, string> = {
  orders: "orders",
  teamMembers: "team_members",
  apiKeys: "api_keys",
};

function calendarPeriod(now = new Date()): { start: Date; end: Date } {
  const start = new Date(now);
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);
  return { start, end };
}

/** Notification title prefix so dedup queries can filter precisely. */
const QUOTA_ALERT_PREFIX = "[Quota]";

interface QuotaCrossing {
  metric: MetricKey;
  label: string;
  used: number;
  limit: number;
  /** 80 or 100 */
  threshold: number;
}

function metricLabels(): Record<MetricKey, string> {
  // Server-side, non-localized labels are fine for notification payloads —
  // the UI renders them with a locale-aware formatter where it matters.
  return { orders: "Orders", teamMembers: "Team members", apiKeys: "API keys" };
}

export async function GET(req: Request) {
  const { session, response } = await requirePermission("read", "billing", req);
  if (response) return response;
  const tenantId = session!.user.tenantId;
  const userId = session!.user.id;

  const { start, end } = calendarPeriod();
  // Workspace-aware tier: CLIENT members inherit the owner's plan so the
  // usage card shows the workspace's real limits (self-serve upgrades).
  const features = await getTierFeaturesForWorkspace(userId, tenantId);

  const [ordersUsed, teamUsed, apiKeysUsed, activeSubscription] = await Promise.all([
    prisma.order.count({ where: { tenantId, createdAt: { gte: start, lt: end } } }),
    tenantId
      ? prisma.user.count({ where: { tenantId } })
      : prisma.user.count({ where: { id: userId } }),
    prisma.apiKey.count({ where: { userId, status: "ACTIVE" } }),
    prisma.subscription.findFirst({
      // Snapshot rows may anchor to an ACTIVE sub or an UNEXPIRED PRO trial
      // (the 14-day signup trial) — the trial's UsageRecords must persist
      // too. A lapsed TRIALING row must NOT match: plan.trial would stay
      // truthy (daysLeft clamped to 0) and the billing chip would never
      // disappear after the trial ends.
      where: {
        userId,
        OR: [{ status: "ACTIVE" }, { status: "TRIALING", currentPeriodEnd: { gt: new Date() } }],
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, status: true, currentPeriodEnd: true },
    }),
  ]);

  const used: Record<MetricKey, number> = {
    orders: ordersUsed,
    teamMembers: teamUsed,
    apiKeys: apiKeysUsed,
  };
  const limits: Record<MetricKey, number | null> = {
    orders: features.maxOrders,
    teamMembers: features.maxTeamMembers,
    apiKeys: API_KEY_LIMITS[features.tier],
  };

  // ── Persist the monthly snapshot (idempotent per metric+period) ──────────
  // One UsageRecord per metric per cycle: refresh `value` on re-GET so the
  // snapshot always mirrors reality instead of accumulating rows.
  const subscriptionId = activeSubscription?.id ?? null;
  try {
    await Promise.all(
      METRIC_KEYS.map(async (metric) => {
        const existing = await prisma.usageRecord.findFirst({
          where: {
            subscriptionId,
            metric: METRIC_COLUMN[metric],
            periodStart: start,
          },
          select: { id: true },
        });
        const data = {
          subscriptionId,
          metric: METRIC_COLUMN[metric],
          value: used[metric],
          periodStart: start,
          periodEnd: end,
        };
        if (existing) {
          await prisma.usageRecord.update({
            where: { id: existing.id },
            data: { value: used[metric], periodEnd: end },
          });
        } else {
          await prisma.usageRecord.create({ data });
        }
      }),
    );
  } catch {
    // Metering persistence is best-effort — never block the usage read.
  }

  // ── Quota threshold notifications (80% / 100%) ───────────────────────────
  const crossings: QuotaCrossing[] = [];
  const labels = metricLabels();
  for (const metric of METRIC_KEYS) {
    const limit = limits[metric];
    if (limit === null || limit <= 0) continue;
    const pct = Math.floor((used[metric] / limit) * 100);
    if (pct >= 100)
      crossings.push({ metric, label: labels[metric], used: used[metric], limit, threshold: 100 });
    else if (pct >= 80)
      crossings.push({ metric, label: labels[metric], used: used[metric], limit, threshold: 80 });
  }

  if (crossings.length > 0) {
    try {
      const owners = await prisma.user.findMany({
        where: tenantId ? { tenantId, role: { in: ["ADMIN"] }, isActive: true } : { id: userId },
        select: { id: true, email: true, name: true },
      });
      await Promise.all(
        owners.flatMap((owner) =>
          crossings.map(async (c) => {
            const dedupKey = `${QUOTA_ALERT_PREFIX} ${c.label} ${c.threshold}% — ${start.toISOString().slice(0, 7)}`;
            const alreadyNotified = await prisma.notification.findFirst({
              where: { userId: owner.id, title: dedupKey },
              select: { id: true },
            });
            if (alreadyNotified) return;
            const description =
              c.threshold === 100
                ? `${c.label} usage has reached ${c.used}/${c.limit} (100%) on the ${features.planName} plan. Upgrade to Professional or Enterprise to raise the limit.`
                : `${c.label} usage is at ${c.used}/${c.limit} (80%+) on the ${features.planName} plan. Consider upgrading before you hit the cap.`;
            await prisma.notification.create({
              data: {
                userId: owner.id,
                // Billing type → dedicated Billing tab in the notifications
                // inbox (quota alerts are commercial, not security alerts).
                type: "billing",
                title: dedupKey,
                description,
                link: "/billing?tab=plans",
              },
            });
            // Mirror the in-app alert to the owner's inbox — same dedup key
            // gates the email, so a re-read of /api/usage never re-sends.
            if (owner.email) {
              try {
                await sendEmail({
                  to: owner.email,
                  subject: `${dedupKey} — action recommended`,
                  html: `
                    <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
                      <h2 style="color: #18181b;">${c.label} quota at ${c.threshold}%</h2>
                      <p>${description}</p>
                      <p>
                        <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://localhost:3010"}/en/billing?tab=plans"
                           style="display: inline-block; background: #6366f1; color: #fff; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: 600;">
                          View plans
                        </a>
                      </p>
                      <p style="color: #71717a; font-size: 12px; margin-top: 24px;">
                        You receive this because you own the ${features.planName} workspace.
                      </p>
                    </div>`,
                  text: `${description}\n\nView plans: /en/billing?tab=plans`,
                });
              } catch {
                // Mailer is best-effort; the in-app notification is the record.
              }
            }
            // Web Push — reaches owners even with every tab closed.
            try {
              await sendPushToTenant(tenantId, {
                title: dedupKey,
                body: description,
                url: "/billing?tab=plans",
                tag: `quota-${c.metric}-${c.threshold}`,
              });
            } catch {
              // Push is best-effort; the in-app notification is the record.
            }
          }),
        ),
      );
    } catch {
      // Threshold notifications are best-effort.
    }
  }

  // ── Per-cycle history for the trend chart ────────────────────────────────
  // Pull every snapshot for this subscription from the last day of the cycle
  // 12 months back, keyed by cycle (YYYY-MM).
  let history: Array<{
    cycle: string;
    periodStart: string;
    orders: number;
    teamMembers: number;
    apiKeys: number;
  }> = [];
  try {
    const records = await prisma.usageRecord.findMany({
      where: {
        subscriptionId,
        metric: { in: METRIC_KEYS.map((m) => METRIC_COLUMN[m]) },
        periodStart: { gte: new Date(new Date(start).setMonth(start.getMonth() - 11)) },
      },
      orderBy: { periodStart: "asc" },
      select: { metric: true, value: true, periodStart: true },
    });
    const byCycle = new Map<
      string,
      { cycle: string; periodStart: string; orders: number; teamMembers: number; apiKeys: number }
    >();
    for (const r of records) {
      const cycle = `${r.periodStart.getUTCFullYear()}-${String(r.periodStart.getUTCMonth() + 1).padStart(2, "0")}`;
      let row = byCycle.get(cycle);
      if (!row) {
        row = {
          cycle,
          periodStart: r.periodStart.toISOString(),
          orders: 0,
          teamMembers: 0,
          apiKeys: 0,
        };
        byCycle.set(cycle, row);
      }
      if (r.metric === "orders") row.orders = r.value;
      else if (r.metric === "team_members") row.teamMembers = r.value;
      else if (r.metric === "api_keys") row.apiKeys = r.value;
    }
    history = Array.from(byCycle.values());
  } catch {
    // History is optional — the chart hides itself when empty.
  }

  return NextResponse.json({
    period: { start: start.toISOString(), end: end.toISOString() },
    plan: {
      name: features.planName,
      tier: features.tier,
      // 14-day PRO trial state — the billing card shows a "Trial" chip with
      // the days remaining so new signups understand why PRO gates are open.
      trial:
        activeSubscription?.status === "TRIALING" && activeSubscription.currentPeriodEnd
          ? {
              daysLeft: Math.max(
                0,
                Math.ceil(
                  (activeSubscription.currentPeriodEnd.getTime() - Date.now()) /
                    (24 * 60 * 60 * 1000),
                ),
              ),
              endsAt: activeSubscription.currentPeriodEnd.toISOString(),
            }
          : null,
    },
    orders: { used: used.orders, limit: limits.orders },
    teamMembers: { used: used.teamMembers, limit: limits.teamMembers },
    apiKeys: { used: used.apiKeys, limit: limits.apiKeys },
    history,
  });
}
