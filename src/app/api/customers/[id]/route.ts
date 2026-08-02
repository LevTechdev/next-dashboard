import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-guard";
import { getTenantId, sameTenant } from "@/lib/tenancy";
import { encryptPII, decryptCustomerPII } from "@/lib/pii";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requirePermission("read", "customers", req);
  if (response) return response;
  const tenantId = getTenantId(session!);

  const { id } = await params;
  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      orders: {
        orderBy: { createdAt: "desc" },
        take: 25,
        include: { channel: true, items: true },
      },
    },
  });
  if (!customer || !sameTenant(tenantId, customer)) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }
  return NextResponse.json(decryptCustomerPII(customer));
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requirePermission("update", "customers", req);
  if (response) return response;
  const tenantId = getTenantId(session!);

  const { id } = await params;
  const body = await req.json();

  const existing = await prisma.customer.findUnique({ where: { id }, select: { tenantId: true } });
  if (!sameTenant(tenantId, existing)) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  const customer = await prisma.customer.update({
    where: { id },
    data: {
      name: body.name,
      email: encryptPII(body.email),
      phone: encryptPII(body.phone),
      city: body.city,
      country: body.country,
      segment: body.segment,
      notes: body.notes,
      isActive: body.isActive,
    },
  });

  await prisma.activityLog.create({
    data: {
      action: "UPDATE_CUSTOMER",
      entity: "Customer",
      entityId: customer.id,
      details: `Customer ${customer.name} updated`,
      userId: session!.user.id,
    },
  });

  return NextResponse.json(decryptCustomerPII(customer));
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requirePermission("delete", "customers", req);
  if (response) return response;
  const tenantId = getTenantId(session!);

  const { id } = await params;

  const existing = await prisma.customer.findUnique({ where: { id }, select: { tenantId: true } });
  if (!sameTenant(tenantId, existing)) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  // Soft delete to preserve order history
  const customer = await prisma.customer.update({
    where: { id },
    data: { isActive: false },
  });

  await prisma.activityLog.create({
    data: {
      action: "DELETE_CUSTOMER",
      entity: "Customer",
      entityId: customer.id,
      details: `Customer ${customer.name} deactivated`,
      userId: session!.user.id,
    },
  });

  return NextResponse.json({ success: true });
}
