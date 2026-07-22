import { requireAuth } from "@/lib/api-guard";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

async function resolveUserId(mockId: string): Promise<string | null> {
  // Try findUnique first, fallback to first admin
  const user =
    (await prisma.user.findUnique({ where: { id: mockId }, select: { id: true } })) ??
    (await prisma.user.findFirst({
      where: { role: "ADMIN" },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    }));
  return user?.id ?? null;
}

export async function PUT(req: Request) {
  const { session, response } = await requireAuth(req);
  if (response) return response;
  const userId = await resolveUserId(session.user.id);

  if (!userId) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const body = await req.json();
  const { avatar } = body; // base64 data URL string

  if (!avatar || typeof avatar !== "string") {
    return NextResponse.json({ error: "Invalid avatar data" }, { status: 400 });
  }

  // Validate base64 image size (max ~500KB)
  const sizeInBytes = Buffer.from(avatar.split(",")[1] || avatar, "base64").length;
  if (sizeInBytes > 500 * 1024) {
    return NextResponse.json({ error: "Image too large. Max 500KB" }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: { avatar },
    select: { id: true, avatar: true },
  });

  return NextResponse.json(user);
}

export async function DELETE(req: Request) {
  const { session, response } = await requireAuth(req);
  if (response) return response;
  const userId = await resolveUserId(session.user.id);

  if (!userId) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: { avatar: null },
    select: { id: true, avatar: true },
  });

  return NextResponse.json(user);
}
