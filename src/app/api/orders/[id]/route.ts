import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-guard";
import { getTenantId, sameTenant } from "@/lib/tenancy";
import { withDecryptedCustomer } from "@/lib/pii";
import {
  canTransitionOrderStatus,
  isOrderStatus,
  STATUS_TIMESTAMP_FIELD,
  type OrderStatus,
} from "@/lib/order-status";

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

  const existing = await prisma.order.findUnique({
    where: { id },
    select: { tenantId: true, status: true },
  });
  if (!existing || !sameTenant(tenantId, existing)) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const data: Record<string, unknown> = {};
  let statusChanged = false;

  // Status transitions are validated against the fulfillment state machine
  // (src/lib/order-status.ts): PENDING → PROCESSING → SHIPPED → DELIVERED,
  // with REFUNDED reachable from any non-terminal state and CANCELLED only
  // from PENDING/PROCESSING. Entry timestamps are stamped automatically.
  if (body.status !== undefined) {
    if (!isOrderStatus(body.status)) {
      return NextResponse.json({ error: `Unknown order status: ${body.status}` }, { status: 400 });
    }
    const from = existing.status as OrderStatus;
    const to = body.status as OrderStatus;
    if (from !== to && !canTransitionOrderStatus(from, to)) {
      return NextResponse.json(
        { error: `Cannot transition order from ${from} to ${to}` },
        { status: 400 },
      );
    }
    statusChanged = from !== to;
    data.status = to;
    if (statusChanged) {
      const timestampField = STATUS_TIMESTAMP_FIELD[to];
      if (timestampField) data[timestampField] = new Date();
      if (to === "REFUNDED") data.paymentStatus = "REFUNDED";
    }
  }

  if (body.paymentStatus) data.paymentStatus = body.paymentStatus;
  if (body.notes !== undefined) data.notes = body.notes;
  if (body.shippingAddress !== undefined) data.shippingAddress = body.shippingAddress;
  if (body.trackingNumber !== undefined) data.trackingNumber = body.trackingNumber;
  if (body.carrier !== undefined) data.carrier = body.carrier;

  const order = await prisma.order.update({ where: { id }, data });

  await prisma.activityLog.create({
    data: {
      action: body.status ? `UPDATE_ORDER_${body.status}` : "UPDATE_ORDER",
      entity: "Order",
      entityId: order.id,
      details: statusChanged
        ? `Order ${order.orderNumber} status changed to ${body.status}`
        : `Order ${order.orderNumber} updated`,
      userId: session!.user.id,
      tenantId,
    },
  });

  return NextResponse.json(order);
}
