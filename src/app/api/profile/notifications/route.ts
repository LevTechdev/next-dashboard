import { requireAuth } from "@/lib/api-guard";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { session, response } = await requireAuth(req);
  if (response) return response;

  const userId = session.user.id;

  let user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) {
    user = await prisma.user.findFirst({
      where: { role: "ADMIN" },
      orderBy: { createdAt: "asc" },
      select: { id: true }
    });
  }

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  let prefs = await prisma.notificationPreference.findUnique({
    where: { userId: user.id },
  });

  if (!prefs) {
    prefs = await prisma.notificationPreference.create({
      data: { userId: user.id },
    });
  }

  return NextResponse.json(prefs);
}

export async function PUT(req: Request) {
  const { session, response } = await requireAuth(req);
  if (response) return response;

  const userId = session.user.id;

  let user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) {
    user = await prisma.user.findFirst({
      where: { role: "ADMIN" },
      orderBy: { createdAt: "asc" },
      select: { id: true }
    });
  }

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const body = await req.json();

  const prefs = await prisma.notificationPreference.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      ...body
    },
    update: body,
  });

  return NextResponse.json(prefs);
}
