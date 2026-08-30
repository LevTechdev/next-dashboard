import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-guard";

export const dynamic = "force-dynamic";

/**
 * GET /api/affiliates/summary
 * Aggregated affiliate stats: totals plus a per-platform breakdown.
 */
export async function GET(req: Request) {
  const { response } = await requirePermission("read", "affiliates", req);
  if (response) return response;

  const [totalClicks, totalConversions, conversionAgg, platforms] = await Promise.all([
    prisma.affiliateClick.count(),
    prisma.affiliateConversion.count(),
    prisma.affiliateConversion.aggregate({
      _sum: { amount: true, commissionAmount: true },
      where: { status: { not: "REJECTED" } },
    }),
    prisma.affiliatePlatform.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      include: {
        links: {
          select: {
            _count: { select: { clicks: true, conversions: true } },
            conversions: {
              select: { amount: true, commissionAmount: true },
              where: { status: { not: "REJECTED" } },
            },
          },
        },
      },
    }),
  ]);

  const byPlatform = platforms.map((p) => {
    const clicks = p.links.reduce((s, l) => s + l._count.clicks, 0);
    const conversions = p.links.reduce((s, l) => s + l._count.conversions, 0);
    const revenue = p.links.reduce(
      (s, l) => s + l.conversions.reduce((x, c) => x + c.amount, 0),
      0,
    );
    const commission = p.links.reduce(
      (s, l) => s + l.conversions.reduce((x, c) => x + c.commissionAmount, 0),
      0,
    );
    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      color: p.color,
      links: p.links.length,
      clicks,
      conversions,
      revenue,
      commission,
    };
  });

  return NextResponse.json({
    totals: {
      clicks: totalClicks,
      conversions: totalConversions,
      revenue: conversionAgg._sum.amount || 0,
      commission: conversionAgg._sum.commissionAmount || 0,
    },
    byPlatform,
  });
}
