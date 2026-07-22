import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-guard";

export async function GET() {
  const campaigns = await prisma.campaign.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json(campaigns);
}

export async function POST(req: Request) {
  const { response } = await requirePermission("create", "marketing");
  if (response) return response;

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
    },
  });
  return NextResponse.json(campaign);
}

export async function PUT(req: Request) {
  const { response } = await requirePermission("update", "marketing");
  if (response) return response;

  const body = await req.json();
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
  const { response } = await requirePermission("delete", "marketing");
  if (response) return response;

  const { id } = await req.json();
  await prisma.campaign.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
