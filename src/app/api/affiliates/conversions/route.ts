import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-guard";
import { computeCommission } from "@/lib/affiliates";

export const dynamic = "force-dynamic";

/**
 * GET /api/affiliates/conversions
 * Lists recent conversions with link/product/platform context.
 */
export async function GET(req: Request) {
  const { response } = await requirePermission("read", "affiliates", req);
  if (response) return response;

  const conversions = await prisma.affiliateConversion.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      link: {
        select: {
          code: true,
          product: { select: { name: true } },
          platform: { select: { name: true, slug: true, color: true } },
        },
      },
    },
  });

  return NextResponse.json(conversions);
}

/**
 * POST /api/affiliates/conversions
 * Records a conversion manually or from an external platform postback.
 * Body: { code, amount, orderId? }
 */
export async function POST(req: Request) {
  const { response } = await requirePermission("create", "affiliates", req);
  if (response) return response;

  const body = await req.json();
  const amount = parseFloat(body.amount);
  if (!body.code || isNaN(amount) || amount <= 0) {
    return NextResponse.json({ error: "code and a positive amount are required" }, { status: 400 });
  }

  const link = await prisma.affiliateLink.findUnique({ where: { code: body.code } });
  if (!link || !link.isActive) {
    return NextResponse.json({ error: "Affiliate link not found or inactive" }, { status: 404 });
  }

  const conversion = await prisma.affiliateConversion.create({
    data: {
      linkId: link.id,
      orderId: body.orderId || null,
      amount,
      commissionAmount: computeCommission(link.commissionType, link.commissionValue, amount),
    },
  });

  return NextResponse.json(conversion);
}

/**
 * PATCH /api/affiliates/conversions
 * Update conversion status: { id, status: PENDING|APPROVED|PAID|REJECTED }
 */
export async function PATCH(req: Request) {
  const { response } = await requirePermission("update", "affiliates", req);
  if (response) return response;

  const body = await req.json();
  if (!body.id || !["PENDING", "APPROVED", "PAID", "REJECTED"].includes(body.status)) {
    return NextResponse.json({ error: "Invalid id or status" }, { status: 400 });
  }

  const conversion = await prisma.affiliateConversion.update({
    where: { id: body.id },
    data: { status: body.status },
  });
  return NextResponse.json(conversion);
}
