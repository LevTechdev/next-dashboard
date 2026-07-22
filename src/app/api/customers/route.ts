import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-guard";

export async function GET() {
  const customers = await prisma.customer.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { orders: true } } },
  });
  return NextResponse.json(customers);
}

export async function POST(req: Request) {
  const { response } = await requirePermission("create", "customers");
  if (response) return response;

  const body = await req.json();
  const customer = await prisma.customer.create({
    data: {
      name: body.name,
      email: body.email,
      phone: body.phone,
      city: body.city,
      segment: body.segment || "REGULAR",
    },
  });
  return NextResponse.json(customer);
}

export async function PUT(req: Request) {
  const { response } = await requirePermission("update", "customers");
  if (response) return response;

  const body = await req.json();
  const customer = await prisma.customer.update({
    where: { id: body.id },
    data: {
      name: body.name,
      email: body.email,
      phone: body.phone,
      city: body.city,
      segment: body.segment,
      isActive: body.isActive,
    },
  });
  return NextResponse.json(customer);
}

export async function DELETE(req: Request) {
  const { response } = await requirePermission("delete", "customers");
  if (response) return response;

  const { id } = await req.json();
  await prisma.customer.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
