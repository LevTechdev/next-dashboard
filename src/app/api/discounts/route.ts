import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-guard";

export async function GET() {
  const discounts = await prisma.discount.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json(discounts);
}

export async function POST(req: Request) {
  const { response } = await requirePermission("create", "discounts");
  if (response) return response;

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
    },
  });
  return NextResponse.json(discount);
}

export async function PUT(req: Request) {
  const { response } = await requirePermission("update", "discounts");
  if (response) return response;

  const body = await req.json();
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
  const { response } = await requirePermission("delete", "discounts");
  if (response) return response;

  const { id } = await req.json();
  await prisma.discount.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
