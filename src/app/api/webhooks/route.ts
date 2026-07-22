import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { requirePermission, requireAuth } from "@/lib/api-guard";
import crypto from "crypto";

export const dynamic = "force-dynamic";

const WEBHOOK_EVENTS = [
  "order.created",
  "order.updated",
  "order.cancelled",
  "order.refunded",
  "customer.created",
  "customer.updated",
  "product.created",
  "product.updated",
  "product.low_stock",
  "payment.completed",
  "payment.failed",
] as const;

export async function GET(req: Request) {
  const { response } = await requirePermission("read", "integrations", req);
  if (response) return response;

  const endpoints = await prisma.webhookEndpoint.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { deliveries: true } },
    },
  });

  return NextResponse.json(endpoints);
}

export async function POST(req: Request) {
  const { response } = await requirePermission("create", "integrations", req);
  if (response) return response;

  const body = await req.json();
  const { name, url, events, description } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  if (!url?.trim()) {
    return NextResponse.json({ error: "URL is required" }, { status: 400 });
  }
  if (!events?.length) {
    return NextResponse.json({ error: "At least one event is required" }, { status: 400 });
  }

  // Validate events
  const invalid = events.filter((e: string) => !WEBHOOK_EVENTS.includes(e as any));
  if (invalid.length > 0) {
    return NextResponse.json({ error: `Invalid events: ${invalid.join(", ")}` }, { status: 400 });
  }

  // Generate HMAC secret
  const secret = crypto.randomBytes(24).toString("hex");

  const { session } = await requireAuth(req);
  const userId = session.user.id;

  const endpoint = await prisma.webhookEndpoint.create({
    data: {
      name: name.trim(),
      url: url.trim(),
      secret,
      subscribedEvents: events,
      description: description?.trim() || null,
      status: "ACTIVE",
      userId,
    },
  });

  await prisma.auditLog.create({
    data: {
      action: "CREATE_WEBHOOK",
      entity: "WebhookEndpoint",
      entityId: endpoint.id,
      details: `Created webhook endpoint "${name}" → ${url}`,
    },
  });

  return NextResponse.json(endpoint);
}

export async function PUT(req: Request) {
  const { response } = await requirePermission("update", "integrations", req);
  if (response) return response;

  const body = await req.json();
  const { id, name, url, events, status, description } = body;

  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const existing = await prisma.webhookEndpoint.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
  }

  const data: any = {};
  if (name?.trim()) data.name = name.trim();
  if (url?.trim()) data.url = url.trim();
  if (events) {
    const invalid = events.filter((e: string) => !WEBHOOK_EVENTS.includes(e as any));
    if (invalid.length > 0) {
      return NextResponse.json({ error: `Invalid events: ${invalid.join(", ")}` }, { status: 400 });
    }
    data.subscribedEvents = events;
  }
  if (status) data.status = status;
  if (description !== undefined) data.description = description?.trim() || null;

  const updated = await prisma.webhookEndpoint.update({
    where: { id },
    data,
  });

  await prisma.auditLog.create({
    data: {
      action: "UPDATE_WEBHOOK",
      entity: "WebhookEndpoint",
      entityId: id,
      details: `Updated webhook "${updated.name}"`,
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(req: Request) {
  const { response } = await requirePermission("delete", "integrations", req);
  if (response) return response;

  const { id } = await req.json();
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const endpoint = await prisma.webhookEndpoint.findUnique({ where: { id } });
  if (!endpoint) {
    return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
  }

  await prisma.webhookEndpoint.delete({ where: { id } });

  await prisma.auditLog.create({
    data: {
      action: "DELETE_WEBHOOK",
      entity: "WebhookEndpoint",
      entityId: id,
      details: `Deleted webhook "${endpoint.name}"`,
    },
  });

  return NextResponse.json({ success: true });
}

export { WEBHOOK_EVENTS };
