import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { requirePermission, requireAuth } from "@/lib/api-guard";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const channel = searchParams.get("channel");
  const status = searchParams.get("status");

  const where: any = {};
  if (channel && channel !== "all") {
    const ch = await prisma.salesChannel.findUnique({ where: { slug: channel } });
    if (ch) where.channelId = ch.id;
  }
  if (status && status !== "all") where.status = status;

  const orders = await prisma.order.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { customer: true, channel: true, user: true, items: true },
  });
  return NextResponse.json(orders);
}

export async function POST(req: Request) {
  const { response } = await requirePermission("create", "orders", req);
  if (response) return response;

  const body = await req.json();
  const orderNumber = "ORD-" + Date.now().toString(36).toUpperCase();

  const order = await prisma.order.create({
    data: {
      orderNumber,
      customerId: body.customerId,
      channelId: body.channelId,
      status: body.status || "PENDING",
      totalAmount: parseFloat(body.totalAmount || 0),
      discountAmount: parseFloat(body.discountAmount || 0),
      shippingAmount: parseFloat(body.shippingAmount || 0),
      taxAmount: parseFloat(body.taxAmount || 0),
      grandTotal: parseFloat(body.grandTotal || 0),
      paymentMethod: body.paymentMethod,
      paymentStatus: body.paymentStatus || "UNPAID",
      shippingAddress: body.shippingAddress,
      notes: body.notes,
    },
  });

  const { session: createSession } = await requireAuth(req);

  await prisma.activityLog.create({
    data: {
      action: "CREATE_ORDER",
      entity: "Order",
      entityId: order.id,
      details: `Order ${orderNumber} created`,
      userId: createSession.user.id,
    },
  });

  return NextResponse.json(order);
}

export async function PUT(req: Request) {
  const { response } = await requirePermission("update", "orders", req);
  if (response) return response;

  const body = await req.json();
  const order = await prisma.order.update({
    where: { id: body.id },
    data: {
      status: body.status,
      paymentStatus: body.paymentStatus,
      notes: body.notes,
    },
  });

  const { session: updateSession } = await requireAuth(req);

  await prisma.activityLog.create({
    data: {
      action: `UPDATE_ORDER_${body.status}`,
      entity: "Order",
      entityId: order.id,
      details: `Order ${order.orderNumber} updated to ${body.status}`,
      userId: updateSession.user.id,
    },
  });

  return NextResponse.json(order);
}
