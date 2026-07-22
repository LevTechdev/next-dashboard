import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { requirePermission, requireAuth } from "@/lib/api-guard";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { response } = await requirePermission("read", "notifications", req);
  if (response) return response;

  const { session } = await requireAuth(req);

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const read = searchParams.get("read"); // "true" or "false"
  const limit = parseInt(searchParams.get("limit") || "50");

  const userId = session.user.id;

  const where: any = {};
  if (userId) where.userId = userId;
  if (type && type !== "all") where.type = type;
  if (read === "true") where.read = true;
  if (read === "false") where.read = false;

  const [notifications, unreadCount, countsByType] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: Math.min(limit, 100),
    }),
    prisma.notification.count({
      where: { ...where, read: false },
    }),
    prisma.notification.groupBy({
      by: ["type", "read"],
      where: { userId },
      _count: true,
    }),
  ]);

  // Build type counts
  const typeCounts: Record<string, { total: number; unread: number }> = {};
  for (const entry of countsByType) {
    if (!typeCounts[entry.type]) {
      typeCounts[entry.type] = { total: 0, unread: 0 };
    }
    typeCounts[entry.type].total += entry._count;
    if (!entry.read) typeCounts[entry.type].unread += entry._count;
  }

  return NextResponse.json({ notifications, unreadCount, typeCounts });
}

export async function POST(req: Request) {
  const { response } = await requirePermission("create", "notifications", req);
  if (response) return response;

  const { session } = await requireAuth(req);

  const body = await req.json();
  const { type, title, description, link } = body;

  if (!type || !title?.trim()) {
    return NextResponse.json({ error: "Type and title are required" }, { status: 400 });
  }

  const userId = session.user.id;

  const notification = await prisma.notification.create({
    data: {
      userId,
      type,
      title: title.trim(),
      description: description?.trim() || null,
      link: link?.trim() || null,
    },
  });

  return NextResponse.json(notification);
}

export async function PUT(req: Request) {
  const { response } = await requirePermission("update", "notifications", req);
  if (response) return response;

  const body = await req.json();
  const { id, action } = body;

  if (!id || !action) {
    return NextResponse.json({ error: "Missing id or action" }, { status: 400 });
  }

  if (action === "mark-read") {
    const updated = await prisma.notification.update({
      where: { id },
      data: { read: true, readAt: new Date() },
    });
    return NextResponse.json(updated);
  }

  if (action === "mark-unread") {
    const updated = await prisma.notification.update({
      where: { id },
      data: { read: false, readAt: null },
    });
    return NextResponse.json(updated);
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}

export async function DELETE(req: Request) {
  const { response } = await requirePermission("delete", "notifications", req);
  if (response) return response;

  const { session } = await requireAuth(req);

  const body = await req.json();
  const { id, action } = body;

  if (action === "clear-all") {
    const userId = session.user.id;
    await prisma.notification.deleteMany({ where: { userId } });
    return NextResponse.json({ success: true });
  }

  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  await prisma.notification.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
