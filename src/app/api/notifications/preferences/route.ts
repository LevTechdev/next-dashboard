import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { requirePermission, requireAuth } from "@/lib/api-guard";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { response } = await requirePermission("read", "notifications", req);
  if (response) return response;

  const { session } = await requireAuth(req);

  const userId = session.user.id;

  const preferences = await prisma.notificationPreference.findUnique({
    where: { userId },
  });

  return NextResponse.json({ preferences: preferences ?? null });
}

export async function PUT(req: Request) {
  const { response } = await requirePermission("update", "notifications", req);
  if (response) return response;

  const { session } = await requireAuth(req);

  const body = await req.json();
  const userId = session.user.id;

  const preferences = await prisma.notificationPreference.upsert({
    where: { userId },
    update: body,
    create: {
      userId,
      ...body,
    },
  });

  return NextResponse.json(preferences);
}
