import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-guard";
import { getTierFeaturesForUser } from "@/lib/plan-tiers";
import { computeCommission } from "@/lib/affiliates";
import { getTenantId, sameTenant } from "@/lib/tenancy";
import { regenerateDashboardOg } from "@/lib/og-dashboard-server.mjs";
import { withDecryptedCustomer } from "@/lib/pii";

/**
 * Money is stored in the tenant's major unit at two decimals. Keeping the
 * rounding here means `quantity × price` products never leak float artefacts
 * into a stored total, which is what makes the invoice ledger close exactly.
 */
function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Normalize the request's line items into OrderItem rows.
 *
 * Quantity is coerced to a positive integer and the line total is always
 * RE-DERIVED from price × quantity rather than read from the payload — a
 * client-supplied line total is exactly how an invoice ends up whose rows
 * don't sum to its own subtotal.
 */
function normalizeItems(raw: unknown): Array<{
  name: string;
  productId: string | null;
  quantity: number;
  price: number;
  total: number;
}> {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => {
      const item = (entry ?? {}) as {
        name?: unknown;
        productId?: unknown;
        quantity?: unknown;
        price?: unknown;
      };
      const quantity = Math.max(1, Math.trunc(Number(item.quantity) || 1));
      const price = roundMoney(Number(item.price) || 0);
      return {
        name: String(item.name ?? "Item"),
        productId: typeof item.productId === "string" ? item.productId : null,
        quantity,
        price,
        total: roundMoney(price * quantity),
      };
    })
    .filter((item) => Number.isFinite(item.total));
}

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

  // Plan limit: REGULAR tier caps orders at 100/month.
  const features = await getTierFeaturesForUser(session!.user.id);
  if (features.maxOrders !== null) {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const monthCount = await prisma.order.count({
      where: { tenantId, createdAt: { gte: monthStart } },
    });
    if (monthCount >= features.maxOrders) {
      return new Response(
        JSON.stringify({
          error: "plan_limit_reached",
          limit: "orders",
          max: features.maxOrders,
          used: monthCount,
          requiredTier: "PRO",
        }),
        { status: 402, headers: { "content-type": "application/json" } },
      );
    }
  }

  const body = await req.json();
  const orderNumber = "ORD-" + Date.now().toString(36).toUpperCase();

  // The line items are the source of truth for the money fields. This route
  // used to store the caller's totals verbatim while writing NO OrderItem
  // rows at all, so an order created here rendered an empty item list next to
  // a non-zero subtotal ("the items don't add up to the total") and quietly
  // broke the invariant the invoice route relies on — totalAmount === Σ item
  // totals. Callers that itemize now get a ledger that closes by construction.
  const items = normalizeItems(body.items);
  const discountAmount = parseFloat(body.discountAmount || 0) || 0;
  const shippingAmount = parseFloat(body.shippingAmount || 0) || 0;
  const taxAmount = parseFloat(body.taxAmount || 0) || 0;
  // Without items (offline replays and non-itemizing integrations) the
  // caller's own numbers still stand, exactly as before.
  const totalAmount = items.length
    ? roundMoney(items.reduce((sum, item) => sum + item.total, 0))
    : parseFloat(body.totalAmount || 0) || 0;
  const grandTotal = items.length
    ? roundMoney(totalAmount - discountAmount + shippingAmount + taxAmount)
    : parseFloat(body.grandTotal || 0) || 0;

  const order = await prisma.order.create({
    data: {
      orderNumber,
      customerId: body.customerId,
      channelId: body.channelId,
      status: body.status || "PENDING",
      // The caller states the denomination of the amounts it is sending; USD
      // remains the historical default. Money surfaces read this column —
      // they never infer a currency from magnitude.
      currency: typeof body.currency === "string" && body.currency ? body.currency : "USD",
      totalAmount,
      discountAmount,
      shippingAmount,
      taxAmount,
      grandTotal,
      paymentMethod: body.paymentMethod,
      paymentStatus: body.paymentStatus || "UNPAID",
      shippingAddress: body.shippingAddress,
      notes: body.notes,
      tenantId,
      ...(items.length ? { items: { create: items } } : {}),
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
      tenantId,
    },
  });

  regenerateDashboardOg(req.headers?.get("cookie"));
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
      tenantId,
    },
  });

  regenerateDashboardOg(req.headers?.get("cookie"));
  return NextResponse.json(order);
}
