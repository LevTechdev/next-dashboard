import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-guard";
import { formatDateTime } from "@/lib/utils";
import { effectiveTenantId, tenantWhere } from "@/lib/tenancy";

export async function GET(req: Request) {
  const { session, response } = await requireAuth(req);
  if (response) return response;

  // Only the caller's workspace's audit records. All audit rows are
  // tenant-attributed (writes + db:backfill-audit), so a strict filter applies.
  const tenantScope = tenantWhere(await effectiveTenantId(session!));

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() || "";
  const actionFilter = searchParams.get("action")?.trim() || "";
  const dateFrom = searchParams.get("from")?.trim() || "";
  const dateTo = searchParams.get("to")?.trim() || "";
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = Math.min(50, Math.max(10, parseInt(searchParams.get("limit") || "25")));

  // Build filter if query/action/dates provided (AND-combined with tenant scope).
  const whereFilter: any = { AND: [tenantScope] };
  if (q) {
    whereFilter.AND.push({
      OR: [
        { action: { contains: q, mode: "insensitive" } },
        { details: { contains: q, mode: "insensitive" } },
        { entity: { contains: q, mode: "insensitive" } },
        { user: { name: { contains: q, mode: "insensitive" } } },
      ],
    });
  }
  if (actionFilter) {
    whereFilter.AND.push({ action: { contains: actionFilter, mode: "insensitive" } });
  }
  if (dateFrom) {
    whereFilter.AND.push({ createdAt: { gte: new Date(dateFrom) } });
  }
  if (dateTo) {
    const to = new Date(dateTo);
    to.setHours(23, 59, 59, 999);
    whereFilter.AND.push({ createdAt: { lte: to } });
  }

  const [logs, totalCount] = await Promise.all([
    prisma.activityLog.findMany({
      where: whereFilter,
      include: {
        user: { select: { id: true, name: true, role: true, avatar: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.activityLog.count({ where: whereFilter }),
  ]);

  return NextResponse.json({
    logs: logs.map((log) => ({
      id: log.id,
      action: log.action,
      entity: log.entity,
      entityId: log.entityId,
      details: log.details,
      user: log.user
        ? { name: log.user.name, role: log.user.role }
        : { name: "System", role: "SYSTEM" },
      createdAt: log.createdAt.toISOString(),
      formattedDate: formatDateTime(log.createdAt),
    })),
    pagination: {
      page,
      limit,
      total: totalCount,
      totalPages: Math.ceil(totalCount / limit),
    },
  });
}
