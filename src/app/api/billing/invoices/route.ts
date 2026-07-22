import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { requirePermission, requireAuth } from "@/lib/api-guard";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { response } = await requirePermission("read", "billing", req);
  if (response) return response;

  const { searchParams } = new URL(req.url);
  const limit = parseInt(searchParams.get("limit") || "50");

  const { session } = await requireAuth(req);
  const userId = session.user.id;

  const where = { userId };

  const invoices = await prisma.invoice.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: Math.min(limit, 100),
    include: { plan: { select: { name: true } } },
  });

  // Calculate totals
  const totals = await prisma.invoice.aggregate({
    where: { ...where, status: "PAID" },
    _sum: { amount: true },
    _count: true,
  });

  return NextResponse.json({
    invoices,
    totals: {
      totalPaid: totals._sum.amount || 0,
      totalInvoices: totals._count,
    },
  });
}
