import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-guard";
import { computeCommission } from "@/lib/affiliates";
import { getTenantId, sameTenant } from "@/lib/tenancy";
import { withDecryptedCustomer } from "@/lib/pii";

export async function GET(req: Request) {
  const { session, response } = await requirePermission("read", "orders", req);
  if (response) return response;
  const tenantId = getTenantId(session!);

  const { searchParams } = new URL(req.url);
  const channel = searchParams.get("channel");
  const status = searchParams.get("status");

  const where: Record<string, unknown> = { tenantId };
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
  return NextResponse.json(orders.map(withDecryptedCustomer));
}

export async function POST(req: Request) {
  const { session, response } = await requirePermission("create", "orders", req);
  if (response) return response;
  const tenantId = getTenantId(session!);

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
      tenantId,
    },
  });

  // Affiliate attribution: record a conversion when an affiliate code is present
  if (body.affiliateCode) {
    const link = await prisma.affiliateLink.findUnique({
      where: { code: String(body.affiliateCode) },
    });
    if (link?.isActive) {
      await prisma.affiliateConversion.create({
        data: {
          linkId: link.id,
          orderId: order.id,
          amount: order.grandTotal,
          commissionAmount: computeCommission(
            link.commissionType,
            link.commissionValue,
            order.grandTotal,
          ),
        },
      });
    }
  }

  await prisma.activityLog.create({
    data: {
      action: "CREATE_ORDER",
      entity: "Order",
      entityId: order.id,
      details: `Order ${orderNumber} created`,
      userId: session!.user.id,
    },
  });

  return NextResponse.json(order);
}

export async function PUT(req: Request) {
  const { session, response } = await requirePermission("update", "orders", req);
  if (response) return response;
  const tenantId = getTenantId(session!);

  const body = await req.json();
  const existing = await prisma.order.findUnique({
    where: { id: body.id },
    select: { tenantId: true },
  });
  if (!sameTenant(tenantId, existing)) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const order = await prisma.order.update({
    where: { id: body.id },
    data: {
      status: body.status,
      paymentStatus: body.paymentStatus,
      notes: body.notes,
    },
  });

  await prisma.activityLog.create({
    data: {
      action: `UPDATE_ORDER_${body.status}`,
      entity: "Order",
      entityId: order.id,
      details: `Order ${order.orderNumber} updated to ${body.status}`,
      userId: session!.user.id,
    },
  });

  return NextResponse.json(order);
}
