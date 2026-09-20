import { requireAuth } from "@/lib/api-guard";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { writeDeletionAudit } from "@/lib/activity-audit";
import { resolveSessionUserId } from "@/lib/session-user";

export async function PUT(req: Request) {
  const { session, response } = await requireAuth(req);
  if (response) return response;
  const userId = await resolveSessionUserId(session);

  if (!userId) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const body = await req.json();
  const { avatar, coverImage } = body; // base64 data URL strings

  // Cover upload: same 10MB budget, stored on User.coverImage.
  if (coverImage !== undefined) {
    if (coverImage === null) {
      const user = await prisma.user.update({
        where: { id: userId },
        data: { coverImage: null },
        select: { id: true, coverImage: true },
      });
      return NextResponse.json(user);
    }
    if (typeof coverImage !== "string") {
      return NextResponse.json({ error: "Invalid cover data" }, { status: 400 });
    }
    const sizeInBytes = Buffer.from(coverImage.split(",")[1] || coverImage, "base64").length;
    if (sizeInBytes > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "Image too large. Max 10MB" }, { status: 400 });
    }
    const user = await prisma.user.update({
      where: { id: userId },
      data: { coverImage },
      select: { id: true, coverImage: true },
    });
    return NextResponse.json(user);
  }

  if (!avatar || typeof avatar !== "string") {
    return NextResponse.json({ error: "Invalid avatar data" }, { status: 400 });
  }

  // Validate base64 image size (max 10MB)
  const sizeInBytes = Buffer.from(avatar.split(",")[1] || avatar, "base64").length;
  if (sizeInBytes > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "Image too large. Max 10MB" }, { status: 400 });
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
  const userId = await resolveSessionUserId(session);

  if (!userId) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: { avatar: null },
    select: { id: true, avatar: true },
  });

  await writeDeletionAudit({
    session,
    action: "DELETE_AVATAR",
    entity: "User",
    entityId: user.id,
    details: "Profile photo removed",
    req,
  });

  return NextResponse.json(user);
}
