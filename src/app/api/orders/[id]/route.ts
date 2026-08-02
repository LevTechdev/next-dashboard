import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-guard";
import { getTenantId, sameTenant } from "@/lib/tenancy";
import { withDecryptedCustomer } from "@/lib/pii";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requirePermission("read", "orders", req);
  if (response) return response;
  const tenantId = getTenantId(session!);

  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      customer: true,
      channel: true,
      user: true,
      items: { include: { product: true } },
      discount: { include: { discount: true } },
    },
  });
  if (!order || !sameTenant(tenantId, order)) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  return NextResponse.json(withDecryptedCustomer(order));
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requirePermission("update", "orders", req);
  if (response) return response;
  const tenantId = getTenantId(session!);

  const { id } = await params;
  const body = await req.json();

  const existing = await prisma.order.findUnique({ where: { id }, select: { tenantId: true } });
  if (!sameTenant(tenantId, existing)) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const data: Record<string, unknown> = {};
  if (body.status) data.status = body.status;
  if (body.paymentStatus) data.paymentStatus = body.paymentStatus;
  if (body.notes !== undefined) data.notes = body.notes;
  if (body.shippingAddress !== undefined) data.shippingAddress = body.shippingAddress;

  const order = await prisma.order.update({ where: { id }, data });

  await prisma.activityLog.create({
    data: {
      action: body.status ? `UPDATE_ORDER_${body.status}` : "UPDATE_ORDER",
      entity: "Order",
      entityId: order.id,
      details: `Order ${order.orderNumber} updated`,
      userId: session!.user.id,
    },
  });

  return NextResponse.json(order);
}
