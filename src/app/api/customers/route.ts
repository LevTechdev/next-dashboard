import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-guard";
import { getTenantId, tenantWhere, sameTenant } from "@/lib/tenancy";
import { encryptPII, decryptCustomerPII } from "@/lib/pii";

export async function GET(req: Request) {
  const { session, response } = await requirePermission("read", "customers", req);
  if (response) return response;
  const tenantId = getTenantId(session!);

  const customers = await prisma.customer.findMany({
    where: tenantWhere(tenantId),
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { orders: true } } },
  });
  return NextResponse.json(customers.map(decryptCustomerPII));
}

export async function POST(req: Request) {
  const { session, response } = await requirePermission("create", "customers", req);
  if (response) return response;
  const tenantId = getTenantId(session!);

  const body = await req.json();
  const customer = await prisma.customer.create({
    data: {
      name: body.name,
      email: encryptPII(body.email),
      phone: encryptPII(body.phone),
      city: body.city,
      segment: body.segment || "REGULAR",
      tenantId,
    },
  });
  return NextResponse.json(decryptCustomerPII(customer));
}

export async function PUT(req: Request) {
  const { session, response } = await requirePermission("update", "customers", req);
  if (response) return response;
  const tenantId = getTenantId(session!);

  const body = await req.json();
  const existing = await prisma.customer.findUnique({
    where: { id: body.id },
    select: { tenantId: true },
  });
  if (!sameTenant(tenantId, existing)) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  const customer = await prisma.customer.update({
    where: { id: body.id },
    data: {
      name: body.name,
      email: encryptPII(body.email),
      phone: encryptPII(body.phone),
      city: body.city,
      segment: body.segment,
      isActive: body.isActive,
    },
  });
  return NextResponse.json(decryptCustomerPII(customer));
}

export async function DELETE(req: Request) {
  const { session, response } = await requirePermission("delete", "customers", req);
  if (response) return response;
  const tenantId = getTenantId(session!);

  const { id } = await req.json();
  const existing = await prisma.customer.findUnique({
    where: { id },
    select: { tenantId: true },
  });
  if (!sameTenant(tenantId, existing)) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  await prisma.customer.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
