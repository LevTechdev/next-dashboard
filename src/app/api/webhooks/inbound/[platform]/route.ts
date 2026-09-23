import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyInboundSignature, normalizeInboundOrder } from "@/lib/inbound-webhooks";
import { enqueueDlq } from "@/lib/webhook-dlq-store";

export const dynamic = "force-dynamic";

export async function POST(req: Request, props: { params: Promise<{ platform: string }> }) {
  const { platform } = await props.params;
  const plat = platform.toLowerCase();

  const validPlatforms = ["shopify", "tiktok", "shopee", "woocommerce"];
  if (!validPlatforms.includes(plat)) {
    return NextResponse.json({ error: `Unsupported platform: ${platform}` }, { status: 400 });
  }

  let rawBody = "";
  let payload: any = {};
  try {
    rawBody = await req.text();
    payload = JSON.parse(rawBody || "{}");
  } catch {
    const dlq = enqueueDlq({
      platform: plat as any,
      event: "order.inbound",
      headers: Object.fromEntries(req.headers.entries()),
      payload: { raw: rawBody },
      errorMessage: "Malformed JSON body in incoming webhook request",
    });
    return NextResponse.json({ error: "Malformed JSON payload", dlqId: dlq.id }, { status: 400 });
  }

  // 1. Verify cryptographic HMAC signature
  const isSignatureValid = verifyInboundSignature(plat, rawBody, req.headers);

  // If signature is invalid, isolate into Dead-Letter Queue
  if (!isSignatureValid) {
    const dlq = enqueueDlq({
      platform: plat as any,
      event: "order.inbound",
      headers: Object.fromEntries(req.headers.entries()),
      payload,
      errorMessage: `Cryptographic HMAC SHA-256 signature verification failed for ${platform}`,
    });

    return NextResponse.json(
      {
        error: "Signature verification failed",
        platform: plat,
        dlqId: dlq.id,
        status: "QUEUED_IN_DLQ",
      },
      { status: 401 },
    );
  }

  // 2. Normalize order payload
  try {
    const normalized = normalizeInboundOrder(plat, payload);

    // Resolve or create channel
    let channel = await prisma.salesChannel.findFirst({
      where: { name: { contains: plat, mode: "insensitive" } },
    });
    if (!channel) {
      channel = await prisma.salesChannel.findFirst();
    }

    // Resolve or create customer
    let customer = await prisma.customer.findFirst({
      where: { name: normalized.customerName },
    });
    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          name: normalized.customerName,
          email: normalized.customerEmail,
          city: normalized.customerCity || "Jakarta",
          totalSpent: normalized.totalAmount,
          tenantId: "default",
        },
      });
    } else {
      await prisma.customer.update({
        where: { id: customer.id },
        data: { totalSpent: customer.totalSpent + normalized.totalAmount },
      });
    }

    // Generate unique order number if already exists
    let finalOrderNumber = normalized.orderNumber;
    const existingOrder = await prisma.order.findUnique({
      where: { orderNumber: finalOrderNumber },
    });
    if (existingOrder) {
      finalOrderNumber = `${finalOrderNumber}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    }

    // Create Order in DB
    const order = await prisma.order.create({
      data: {
        orderNumber: finalOrderNumber,
        status: normalized.orderStatus,
        paymentStatus: normalized.paymentStatus,
        paymentMethod: `${plat.toUpperCase()}_PAY`,
        totalAmount: normalized.totalAmount,
        grandTotal: normalized.totalAmount,
        customerId: customer.id,
        channelId: channel?.id || null,
        tenantId: "default",
      },
    });

    // Create Order Items
    for (const item of normalized.items) {
      await prisma.orderItem.create({
        data: {
          orderId: order.id,
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          total: item.total,
        },
      });
    }

    // Record Activity Log
    await prisma.activityLog.create({
      data: {
        action: "INBOUND_WEBHOOK_ORDER",
        entity: "Order",
        entityId: order.id,
        details: `Ingested ${plat.toUpperCase()} order ${order.orderNumber} for ${normalized.customerName} (${normalized.totalAmount} ${normalized.currency})`,
        tenantId: "default",
      },
    });

    return NextResponse.json({
      ok: true,
      platform: plat,
      orderId: order.id,
      orderNumber: order.orderNumber,
      grandTotal: order.grandTotal,
      status: order.status,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("[Inbound Webhook Ingestion Error]", err);
    const dlq = enqueueDlq({
      platform: plat as any,
      event: "order.inbound",
      headers: Object.fromEntries(req.headers.entries()),
      payload,
      errorMessage: err?.message || "Internal database ingestion error",
      // DB failures are transient — the delivery-health scheduler will
      // re-dispatch with exponential backoff automatically.
      transient: true,
    });

    return NextResponse.json(
      {
        error: "Failed to persist order to database",
        dlqId: dlq.id,
        details: err?.message,
      },
      { status: 500 },
    );
  }
}
