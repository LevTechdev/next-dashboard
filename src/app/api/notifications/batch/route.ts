import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { requirePermission, requireAuth } from "@/lib/api-guard";
import { writeDeletionAudit } from "@/lib/activity-audit";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { response } = await requirePermission("update", "notifications", req);
  if (response) return response;

  const { session } = await requireAuth(req);

  const body = await req.json();
  const { action } = body;

  const userId = session.user.id;

  if (action === "mark-all-read") {
    await prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true, readAt: new Date() },
    });
    return NextResponse.json({ success: true, action: "mark-all-read" });
  }

  if (action === "delete-all-read") {
    const removed = await prisma.notification.deleteMany({
      where: { userId, read: true },
    });

    await writeDeletionAudit({
      session,
      action: "DELETE_READ_NOTIFICATIONS",
      entity: "Notification",
      entityId: null,
      details: `Deleted all read notifications (${removed.count} removed)`,
      req,
    });

    return NextResponse.json({ success: true, action: "delete-all-read" });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
