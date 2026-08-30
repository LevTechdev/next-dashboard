import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { requirePermission, requireAuth } from "@/lib/api-guard";
import crypto from "crypto";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { response } = await requirePermission("update", "integrations");
  if (response) return response;
  const { session } = await requireAuth(req);

  const body = await req.json();
  const { endpointId } = body;

  if (!endpointId) {
    return NextResponse.json({ error: "Missing endpointId" }, { status: 400 });
  }

  const endpoint = await prisma.webhookEndpoint.findUnique({
    where: { id: endpointId },
  });

  if (!endpoint) {
    return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
  }

  const testPayload = JSON.stringify({
    event: "test.ping",
    timestamp: new Date().toISOString(),
    data: {
      message: "This is a test webhook from your dashboard.",
      endpoint: endpoint.name,
    },
  });

  // Compute HMAC signature
  const signature = crypto.createHmac("sha256", endpoint.secret).update(testPayload).digest("hex");

  const startTime = Date.now();
  let statusCode = 0;
  let responseBody = "";
  let deliveryStatus = "FAILED";

  try {
    const res = await fetch(endpoint.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Signature": signature,
        "X-Webhook-Event": "test.ping",
        "User-Agent": "Dashboard-Webhook/1.0",
      },
      body: testPayload,
      signal: AbortSignal.timeout(10000),
    });

    statusCode = res.status;
    responseBody = await res.text().catch(() => "");
    deliveryStatus = statusCode >= 200 && statusCode < 300 ? "DELIVERED" : "FAILED";
  } catch (err: any) {
    responseBody = err.message || "Request failed";
    statusCode = 0;
  }

  const duration = Date.now() - startTime;

  // Record the delivery
  const delivery = await prisma.webhookDelivery.create({
    data: {
      endpointId: endpoint.id,
      event: "test.ping",
      payload: testPayload,
      status: deliveryStatus,
      statusCode,
      response: responseBody.slice(0, 1000),
      durationMs: duration,
    },
  });

  // Update endpoint status
  await prisma.webhookEndpoint.update({
    where: { id: endpoint.id },
    data: {
      lastTriggeredAt: new Date(),
      lastStatus: deliveryStatus === "DELIVERED" ? "success" : "failed",
    },
  });

  await prisma.auditLog.create({
    data: {
      action: "TEST_WEBHOOK",
      entity: "WebhookEndpoint",
      entityId: endpoint.id,
      details: `Tested webhook "${endpoint.name}" → ${deliveryStatus} (${statusCode || "N/A"}) in ${duration}ms`,
      tenantId: session.user.tenantId,
    },
  });

  return NextResponse.json({
    id: delivery.id,
    status: deliveryStatus,
    statusCode,
    durationMs: duration,
    request: { url: endpoint.url, payload: testPayload },
    response: responseBody.slice(0, 500),
  });
}
