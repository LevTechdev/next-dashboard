import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-guard";
import { getTenantId } from "@/lib/tenancy";

export const dynamic = "force-dynamic";

/**
 * GET /api/dashboard/pipeline?range=7d|30d|90d
 *
 * Real pipeline-stage numbers for the Stage Bars Card:
 *  - visits:      distinct sessions with activity in the window (site visits)
 *  - signups:     users created in the window
 *  - active:      users with a session in the window
 *  - pro:         users on a Professional (PRO) tier plan
 *  - team:        members of the workspace (tenant users)
 *  - enterprise:  users on an Enterprise tier plan / CLIENT_ENTERPRISE role
 *
 * Every count is derived from live tables — no mock data.
 */

const RANGES: Record<string, number> = { "7d": 7, "30d": 30, "90d": 90 };

export async function GET(req: Request) {
  const { session, response } = await requireAuth(req);
  if (response) return response;
  const tenantId = getTenantId(session);

  const url = new URL(req.url);
  const rangeKey = url.searchParams.get("range") ?? "30d";
  const days = RANGES[rangeKey] ?? 30;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  try {
    const tenantFilter = tenantId ? { tenantId } : {};

    // Previous window of the same length, for week-over-week style deltas:
    // conversion = stage ÷ visits, compared current vs previous window.
    const prevSince = new Date(since.getTime() - days * 24 * 60 * 60 * 1000);

    const [visits, signups, active, pro, team, enterprise, prevVisits, prevSignups, prevActive] =
      await Promise.all([
        // Distinct visitor sessions touching the workspace in the window.
        prisma.session.count({
          where: { createdAt: { gte: since }, user: tenantFilter },
        }),
        prisma.user.count({ where: { ...tenantFilter, createdAt: { gte: since } } }),
        // Active = users who have a session created inside the window.
        prisma.user.count({
          where: { ...tenantFilter, sessions: { some: { createdAt: { gte: since } } } },
        }),
        prisma.user.count({
          where: {
            ...tenantFilter,
            subscription: {
              status: { in: ["ACTIVE", "TRIALING"] },
              plan: { name: "Professional" },
            },
          },
        }),
        tenantId
          ? prisma.user.count({ where: { tenantId } })
          : prisma.user.count({ where: { id: session!.user.id } }),
        prisma.user.count({
          where: {
            ...tenantFilter,
            OR: [
              { role: "CLIENT_ENTERPRISE" },
              {
                subscription: {
                  status: { in: ["ACTIVE", "TRIALING"] },
                  plan: { name: "Enterprise" },
                },
              },
            ],
          },
        }),
        // Previous-window mirrors (deltas for visit-proportional stages).
        prisma.session.count({
          where: { createdAt: { gte: prevSince, lt: since }, user: tenantFilter },
        }),
        prisma.user.count({ where: { ...tenantFilter, createdAt: { gte: prevSince, lt: since } } }),
        prisma.user.count({
          where: {
            ...tenantFilter,
            sessions: { some: { createdAt: { gte: prevSince, lt: since } } },
          },
        }),
      ]);

    // Conversion rate per stage relative to visits (null when the denominator
    // is zero), plus the delta vs the previous window in percentage points.
    // Plan/team stages are inventories, not window flows — they carry a null
    // delta rather than a meaningless comparison.
    const rate = (n: number, visitsN: number) => (visitsN > 0 ? (n / visitsN) * 100 : null);
    const prevRate = (n: number, visitsN: number) => (visitsN > 0 ? (n / visitsN) * 100 : null);
    const delta = (cur: number | null, prev: number | null) =>
      cur === null || prev === null ? null : Math.round((cur - prev) * 10) / 10;

    const conversions = {
      visitToSignup: {
        rate: rate(signups, visits),
        deltaPp: delta(rate(signups, visits), prevRate(prevSignups, prevVisits)),
      },
      signupToActive: {
        rate: rate(active, signups),
        // active/prevSignups approximates the prior window's activation rate
        // (we cannot reconstruct prior-window actives that are still active
        // now, so active-count ratio is the honest comparable).
        deltaPp: delta(rate(active, signups), prevRate(prevActive, prevSignups)),
      },
      activeToPro: {
        rate: rate(pro, active),
        deltaPp: null,
      },
      proToTeam: { rate: rate(team, pro), deltaPp: null },
      teamToEnterprise: { rate: rate(enterprise, team), deltaPp: null },
      visits: {
        rate: 100,
        deltaPp: delta(100, prevVisits > 0 ? 100 : null),
      },
    };

    return NextResponse.json({ visits, signups, active, pro, team, enterprise, conversions });
  } catch {
    return NextResponse.json({ error: "pipeline_unavailable" }, { status: 500 });
  }
}
