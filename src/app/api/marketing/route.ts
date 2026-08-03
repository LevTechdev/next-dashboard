import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { requirePermission, requireAuth } from "@/lib/api-guard";
import { getTenantId, sameTenant } from "@/lib/tenancy";

export async function GET(req: Request) {
  const { session, response } = await requireAuth(req);
  if (response) return response;
  const tenantId = getTenantId(session);

  const campaigns = await prisma.campaign.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(campaigns);
}

export async function POST(req: Request) {
  const { session, response } = await requirePermission("create", "marketing", req);
  if (response) return response;
  const tenantId = getTenantId(session!);

  const body = await req.json();
  const campaign = await prisma.campaign.create({
    data: {
      name: body.name,
      description: body.description,
      type: body.type || "EMAIL",
      status: body.status || "DRAFT",
      budget: parseFloat(body.budget || 0),
      spent: parseFloat(body.spent || 0),
      channel: body.channel,
      startsAt: body.startsAt ? new Date(body.startsAt) : null,
      endsAt: body.endsAt ? new Date(body.endsAt) : null,
      tenantId,
    },
  });
  return NextResponse.json(campaign);
}

export async function PUT(req: Request) {
  const { session, response } = await requirePermission("update", "marketing", req);
  if (response) return response;
  const tenantId = getTenantId(session!);

  const body = await req.json();
  const existing = await prisma.campaign.findUnique({
    where: { id: body.id },
    select: { tenantId: true },
  });
  if (!sameTenant(tenantId, existing)) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  const campaign = await prisma.campaign.update({
    where: { id: body.id },
    data: {
      name: body.name,
      description: body.description,
      type: body.type,
      status: body.status,
      budget: parseFloat(body.budget || 0),
      spent: parseFloat(body.spent || 0),
      channel: body.channel,
      startsAt: body.startsAt ? new Date(body.startsAt) : null,
      endsAt: body.endsAt ? new Date(body.endsAt) : null,
    },
  });
  return NextResponse.json(campaign);
}

export async function DELETE(req: Request) {
  const { session, response } = await requirePermission("delete", "marketing", req);
  if (response) return response;
  const tenantId = getTenantId(session!);

  const { id } = await req.json();
  const existing = await prisma.campaign.findUnique({ where: { id }, select: { tenantId: true } });
  if (!sameTenant(tenantId, existing)) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  await prisma.campaign.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
