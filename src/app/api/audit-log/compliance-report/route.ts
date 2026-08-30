import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-guard";
import { effectiveTenantId, tenantWhere } from "@/lib/tenancy";

export const dynamic = "force-dynamic";

/**
 * GET /api/audit-log/compliance-report?days=30 — all authenticated roles.
 * Returns a compliance summary: action counts, top actors, login activity,
 * security events, and daily activity heatmap data.
 */
export async function GET(req: Request) {
  const { session, response } = await requireAuth(req);
  if (response) return response;

  const tenantScope = tenantWhere(await effectiveTenantId(session!));
  const url = new URL(req.url);
  const days = Math.min(Math.max(parseInt(url.searchParams.get("days") || "30"), 1), 365);

  const since = new Date();
  since.setDate(since.getDate() - days);

  const baseFilter = { AND: [tenantScope, { createdAt: { gte: since } }] };

  // Total logs in range
  const totalLogs = await prisma.activityLog.count({ where: baseFilter });

  // Action type breakdown
  const actionGroups = await prisma.activityLog.groupBy({
    by: ["action"],
    where: baseFilter,
    _count: { action: true },
    orderBy: { _count: { action: "desc" } },
  });

  // Top actors
  const topActors = await prisma.activityLog.groupBy({
    by: ["userId"],
    where: baseFilter,
    _count: { userId: true },
    orderBy: { _count: { userId: "desc" } },
    take: 10,
  });

  const actorIds = topActors.map((a) => a.userId).filter(Boolean) as string[];
  const actorUsers = actorIds.length
    ? await prisma.user.findMany({
        where: { id: { in: actorIds } },
        select: { id: true, name: true, role: true },
      })
    : [];
  const actorMap = new Map(actorUsers.map((u) => [u.id, u]));

  // Login events count
  const loginCount = await prisma.activityLog.count({
    where: { AND: [tenantScope, { createdAt: { gte: since } }, { action: { contains: "LOGIN" } }] },
  });

  // Failed login events
  const failedLogins = await prisma.activityLog.count({
    where: {
      AND: [tenantScope, { createdAt: { gte: since } }, { action: { contains: "LOGIN_FAILED" } }],
    },
  });

  // Daily activity (last N days)
  const dailyActivity: { date: string; count: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const dayStart = new Date();
    dayStart.setDate(dayStart.getDate() - i);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setHours(23, 59, 59, 999);

    const count = await prisma.activityLog.count({
      where: {
        AND: [tenantScope, { createdAt: { gte: dayStart, lte: dayEnd } }],
      },
    });

    dailyActivity.push({
      date: dayStart.toISOString().split("T")[0],
      count,
    });
  }

  // Security events count
  const securityEventCount = await prisma.securityEvent.count({
    where: { createdAt: { gte: since } },
  });

  return NextResponse.json({
    report: {
      period: {
        from: since.toISOString(),
        to: new Date().toISOString(),
        days,
      },
      totalActivity: totalLogs,
      totalSecurityEvents: securityEventCount,
      loginActivity: {
        total: loginCount,
        failed: failedLogins,
        successRate:
          loginCount > 0
            ? (((loginCount - failedLogins) / loginCount) * 100).toFixed(1) + "%"
            : "N/A",
      },
      actionBreakdown: actionGroups.map((g) => ({
        action: g.action,
        count: g._count.action,
      })),
      topActors: topActors.map((a) => ({
        user: a.userId ? actorMap.get(a.userId) : { name: "System", role: "SYSTEM" },
        activityCount: a._count.userId,
      })),
      dailyActivity,
    },
  });
}
