import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-guard";
import { normalizeRole } from "@/lib/permissions";

export const dynamic = "force-dynamic";

/**
 * GET /api/profile/activity
 *
 * Real per-day activity counts for the profile heatmap card, over the last
 * 12 months (GitHub-contribution style). Two signals are merged per day:
 *  - security events (logins, step-ups, key rotations…) — weighted 1
 *  - orders created by the user                    — weighted 3
 *
 * Returns a sparse map of "YYYY-MM-DD" → intensity so the client can render
 * a year grid without 365 row objects.
 */
export async function GET(req: Request) {
  const { session, response } = await requireAuth(req);
  if (response) return response;

  // Admins may request another member's activity (team-page grids); everyone
  // else is pinned to their own data regardless of the query param.
  let userId = session.user.id;
  const requested = new URL(req.url).searchParams.get("userId");
  if (requested && requested !== userId) {
    const viewer = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (normalizeRole(viewer?.role) !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    userId = requested;
  }

  const since = new Date();
  // ?years=1..5 (default 1) — the yearly heatmap view requests 5 so the
  // month×year matrix has more than one populated column.
  const yearsRaw = Number(new URL(req.url).searchParams.get("years") ?? "1");
  const years = Number.isFinite(yearsRaw) ? Math.min(5, Math.max(1, Math.floor(yearsRaw))) : 1;
  since.setDate(since.getDate() - 364 * years);
  since.setHours(0, 0, 0, 0);

  try {
    const [events, orders] = await Promise.all([
      prisma.securityEvent.findMany({
        where: { userId, createdAt: { gte: since } },
        select: { createdAt: true },
      }),
      prisma.order.findMany({
        where: { userId, createdAt: { gte: since } },
        select: { createdAt: true },
      }),
    ]);

    const byDay = new Map<string, number>();
    const keyOf = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const bump = (d: Date, weight: number) => {
      const k = keyOf(d);
      byDay.set(k, (byDay.get(k) ?? 0) + weight);
    };

    for (const e of events) bump(e.createdAt, 1);
    for (const o of orders) bump(o.createdAt, 3);

    return NextResponse.json({
      since: since.toISOString(),
      days: Object.fromEntries(byDay),
      total: [...byDay.values()].reduce((a, b) => a + b, 0),
      activeDays: byDay.size,
    });
  } catch {
    return NextResponse.json({ error: "activity_unavailable" }, { status: 500 });
  }
}
