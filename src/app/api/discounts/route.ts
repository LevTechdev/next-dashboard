import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { requirePermission, requireAuth } from "@/lib/api-guard";
import { getTenantId, sameTenant } from "@/lib/tenancy";

export async function GET(req: Request) {
  const { session, response } = await requireAuth(req);
  if (response) return response;
  const tenantId = getTenantId(session);

  const discounts = await prisma.discount.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(discounts);
}

export async function POST(req: Request) {
  const { session, response } = await requirePermission("create", "discounts", req);
  if (response) return response;
  const tenantId = getTenantId(session!);

  const body = await req.json();
  const discount = await prisma.discount.create({
    data: {
      code: body.code.toUpperCase(),
      name: body.name,
      description: body.description,
      type: body.type || "PERCENTAGE",
      value: parseFloat(body.value),
      minPurchase: parseFloat(body.minPurchase || 0),
      maxUses: parseInt(body.maxUses || 0),
      startsAt: new Date(body.startsAt),
      endsAt: new Date(body.endsAt),
      tenantId,
    },
  });
  return NextResponse.json(discount);
}

export async function PUT(req: Request) {
  const { session, response } = await requirePermission("update", "discounts", req);
  if (response) return response;
  const tenantId = getTenantId(session!);

  const body = await req.json();
  const existing = await prisma.discount.findUnique({
    where: { id: body.id },
    select: { tenantId: true },
  });
  if (!sameTenant(tenantId, existing)) {
    return NextResponse.json({ error: "Discount not found" }, { status: 404 });
  }

  const discount = await prisma.discount.update({
    where: { id: body.id },
    data: {
      name: body.name,
      description: body.description,
      type: body.type,
      value: parseFloat(body.value),
      minPurchase: parseFloat(body.minPurchase || 0),
      maxUses: parseInt(body.maxUses || 0),
      startsAt: new Date(body.startsAt),
      endsAt: new Date(body.endsAt),
      isActive: body.isActive,
    },
  });
  return NextResponse.json(discount);
}

export async function DELETE(req: Request) {
  const { session, response } = await requirePermission("delete", "discounts", req);
  if (response) return response;
  const tenantId = getTenantId(session!);

  const { id } = await req.json();
  const existing = await prisma.discount.findUnique({ where: { id }, select: { tenantId: true } });
  if (!sameTenant(tenantId, existing)) {
    return NextResponse.json({ error: "Discount not found" }, { status: 404 });
  }

  await prisma.discount.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
