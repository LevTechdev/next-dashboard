import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { getTierFeaturesForUser, API_KEY_LIMITS } from "@/lib/plan-tiers";

/**
 * Daily quota digest for workspace owners.
 *
 * Shared by GET /api/usage/digest (the cron/HTTP entry point) and the
 * in-app scheduler (scheduler.ts). Mails every owner a compact
 * per-workspace summary of all capped metrics (used/limit/%, ⚠ markers at
 * ≥80%) so owners who don't log in daily still see where their plan stands.
 */

const METRICS = ["orders", "teamMembers", "apiKeys"] as const;
export type MetricKey = (typeof METRICS)[number];

const METRIC_LABEL: Record<MetricKey, string> = {
  orders: "Orders",
  teamMembers: "Team members",
  apiKeys: "API keys",
};

/** Human labels for the digest's missed-event rollup. */
const NOTIF_LABEL: Record<string, string> = {
  order: "New orders",
  customer: "New customers",
  product: "New products",
  revenue: "Revenue updates",
  inventory: "Stock alerts",
  discount: "Discount expirations",
  campaign: "Campaign alerts",
  milestone: "Milestones",
  alert: "System alerts",
};

export function calendarPeriod(now = new Date()): { start: Date; end: Date } {
  const start = new Date(now);
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);
  return { start, end };
}

export interface DigestMetric {
  key: MetricKey;
  label: string;
  used: number;
  limit: number | null;
  pct: number | null;
  warn: boolean;
}

/** Per-type rollup of notifications the owner received since the last digest. */
export interface DigestNotificationSummary {
  type: string;
  total: number;
  unread: number;
}

export interface WorkspaceDigest {
  userId: string;
  email: string | null;
  name: string | null;
  planName: string;
  metrics: DigestMetric[];
  anyWarn: boolean;
  /** Notifications since the previous daily digest — closes the loop for
   * owners who missed realtime toasts (6s) or haven't opened the bell. */
  notifications: DigestNotificationSummary[];
  /** True when at least one notification type has unread events. */
  hasUnreadNotifications: boolean;
}

export async function computeDigestFor(userId: string): Promise<WorkspaceDigest | null> {
  const { start } = calendarPeriod();
  const features = await getTierFeaturesForUser(userId);
  const tenantId = (
    await prisma.user.findUnique({ where: { id: userId }, select: { tenantId: true } })
  )?.tenantId;

  const [ordersUsed, teamUsed, apiKeysUsed, notifGrouped] = await Promise.all([
    prisma.order.count({ where: { tenantId, createdAt: { gte: start } } }),
    tenantId
      ? prisma.user.count({ where: { tenantId } })
      : prisma.user.count({ where: { id: userId } }),
    prisma.apiKey.count({ where: { userId, status: "ACTIVE" } }),
    prisma.notification.groupBy({
      by: ["type"],
      where: { userId, createdAt: { gte: start } },
      _count: { _all: true, read: true },
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

  const metrics: DigestMetric[] = METRICS.map((key) => {
    const limit = limits[key];
    const pct =
      limit === null || limit <= 0 ? null : Math.min(100, Math.round((used[key] / limit) * 100));
    return {
      key,
      label: METRIC_LABEL[key],
      used: used[key],
      limit,
      pct,
      warn: pct !== null && pct >= 80,
    };
  });

  // Missed-event rollup: notifications created this cycle, per type.
  // _count.read counts READ rows, so unread = total − read.
  const notifications: DigestNotificationSummary[] = notifGrouped
    .map((g) => ({
      type: g.type,
      total: g._count._all,
      unread: g._count._all - g._count.read,
    }))
    .sort((a, b) => b.total - a.total);

  return {
    userId,
    email: null,
    name: null,
    planName: features.planName,
    metrics,
    anyWarn: metrics.some((m) => m.warn),
    notifications,
    hasUnreadNotifications: notifications.some((n) => n.unread > 0),
  };
}

export function digestHtml(digest: WorkspaceDigest): string {
  const rows = digest.metrics
    .map(
      (m) =>
        `<tr>
          <td style="padding:6px 10px;border-bottom:1px solid #f4f4f5;">${m.label}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #f4f4f5;text-align:right;">${m.used.toLocaleString()} / ${m.limit === null ? "∞" : m.limit.toLocaleString()}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #f4f4f5;text-align:right;color:${m.warn ? "#d97706" : "#059669"};font-weight:600;">${m.pct === null ? "—" : `${m.pct}%${m.warn ? " ⚠" : ""}`}</td>
        </tr>`,
    )
    .join("");

  // Missed-event section — only when there is something to catch up on.
  const notifRows = digest.notifications
    .map(
      (n) =>
        `<tr>
          <td style="padding:6px 10px;border-bottom:1px solid #f4f4f5;">${NOTIF_LABEL[n.type] ?? n.type}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #f4f4f5;text-align:right;">${n.total}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #f4f4f5;text-align:right;color:${n.unread > 0 ? "#6366f1" : "#a1a1aa"};font-weight:600;">${n.unread}</td>
        </tr>`,
    )
    .join("");
  const notifSection = notifRows
    ? `
      <h3 style="color: #18181b; margin: 24px 0 0;">While you were away</h3>
      <p style="color: #71717a; font-size: 12px; margin: 4px 0 8px;">Events you received since the last digest — unread counts include toasts that auto-dismissed before you saw them.</p>
      <table style="border-collapse: collapse; width: 100%; margin: 8px 0 16px;">
        <thead>
          <tr>
            <th style="text-align:left;padding:6px 10px;font-size:11px;color:#71717a;text-transform:uppercase;">Event</th>
            <th style="text-align:right;padding:6px 10px;font-size:11px;color:#71717a;text-transform:uppercase;">Received</th>
            <th style="text-align:right;padding:6px 10px;font-size:11px;color:#71717a;text-transform:uppercase;">Unread</th>
          </tr>
        </thead>
        <tbody>${notifRows}</tbody>
      </table>`
    : "";
  return `
    <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #18181b;">Daily usage digest — ${digest.planName} plan</h2>
      <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
        <thead>
          <tr>
            <th style="text-align:left;padding:6px 10px;font-size:11px;color:#71717a;text-transform:uppercase;">Metric</th>
            <th style="text-align:right;padding:6px 10px;font-size:11px;color:#71717a;text-transform:uppercase;">Used / Limit</th>
            <th style="text-align:right;padding:6px 10px;font-size:11px;color:#71717a;text-transform:uppercase;">Usage</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      ${notifSection}
      <p>
        <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://localhost:3010"}/en/billing"
           style="display: inline-block; background: #6366f1; color: #fff; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: 600;">
          Open billing
        </a>
      </p>
      <p style="color: #71717a; font-size: 12px; margin-top: 24px;">
        Daily quota summary for your workspace. ⚠ marks metrics at or above 80% of the plan limit.
      </p>
    </div>`;
}

export function digestText(digest: WorkspaceDigest): string {
  const usage = digest.metrics
    .map(
      (m) =>
        `${m.label}: ${m.used}${m.limit === null ? " (unlimited)" : ` / ${m.limit}`}${m.warn ? " ⚠" : ""}`,
    )
    .join("\n");
  const notif = digest.notifications
    .map(
      (n) =>
        `  - ${NOTIF_LABEL[n.type] ?? n.type}: ${n.total} received${n.unread > 0 ? `, ${n.unread} unread` : ""}`,
    )
    .join("\n");
  return notif ? `${usage}\n\nWhile you were away:\n${notif}` : usage;
}

/**
 * Compute digests for every workspace owner. When `send` is true the
 * digests are also emailed; per-owner send failures never abort the run.
 */
export async function runQuotaDigest(
  send: boolean,
): Promise<{ owners: number; sent: number; digests: WorkspaceDigest[] }> {
  // One digest per owner: ADMIN users (the merged super-admin) with an ACTIVE subscription.
  const owners = await prisma.user.findMany({
    where: {
      role: { in: ["ADMIN"] },
      isActive: true,
      subscription: { status: "ACTIVE" },
    },
    select: { id: true, email: true, name: true },
  });

  const digests: WorkspaceDigest[] = [];
  for (const owner of owners) {
    const digest = await computeDigestFor(owner.id);
    if (!digest) continue;
    digest.email = owner.email;
    digest.name = owner.name;
    digests.push(digest);
  }

  let sent = 0;
  if (send) {
    for (const digest of digests) {
      if (!digest.email) continue;
      try {
        await sendEmail({
          to: digest.email,
          subject: `Daily usage digest — ${digest.planName} plan${digest.anyWarn ? " (quota warning)" : ""}`,
          html: digestHtml(digest),
          text: digestText(digest),
        });
        sent += 1;
      } catch {
        // Per-owner failures shouldn't abort the whole digest run.
      }
    }
  }

  return { owners: digests.length, sent, digests };
}
