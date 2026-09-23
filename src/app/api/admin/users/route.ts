import { requireAuth } from "@/lib/api-guard";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { normalizeRole } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { session, response } = await requireAuth(req);
  if (response) return response;

  if (normalizeRole(session.user.role) !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        subscription: {
          select: {
            plan: { select: { name: true } },
            status: true,
          },
          where: { status: "ACTIVE" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const formattedUsers = users.map((u) => ({
      id: u.id,
      name: u.name || "Unknown",
      email: u.email,
      role: u.role,
      plan: u.subscription?.plan?.name || "Free",
      status: u.isActive ? "Active" : "Banned",
      joinedAt: u.createdAt.toISOString(),
    }));

    return NextResponse.json(formattedUsers);
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const { session, response } = await requireAuth(req);
  if (response) return response;

  if (normalizeRole(session.user.role) !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const url = new URL(req.url);
    const userId = url.searchParams.get("id");

    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    // Prevent self-deletion via admin panel
    if (userId === session.user.id) {
      return NextResponse.json({ error: "Cannot delete yourself" }, { status: 400 });
    }

    // Load the target first so guards can reason about its role/tenant.
    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, tenantId: true, isActive: true },
    });
    if (!target) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Never hard-delete an ADMIN account: admin deletion cascades
    // Subscription/Session/etc. (onDelete: Cascade) and unassigns orders —
    // doing it to the LAST active admin of a tenant permanently locks the
    // organization out of admin surfaces. Deactivate instead (revokes the
    // login immediately via every session check) and keep the account
    // recoverable. Non-admin users delete normally.
    const targetRole = normalizeRole(target.role);
    if (targetRole === "ADMIN") {
      const otherAdmins = await prisma.user.count({
        where: {
          tenantId: target.tenantId,
          id: { not: userId },
          isActive: true,
          role: { in: ["ADMIN", "SUPERADMIN"] },
        },
      });
      if (otherAdmins === 0) {
        await prisma.user.update({
          where: { id: userId },
          data: { isActive: false },
        });
        return NextResponse.json({
          success: true,
          deactivated: true,
          message:
            "This is the last admin account — it was deactivated instead of deleted to keep the workspace recoverable.",
        });
      }
    }

    // Transactional teardown: every FK either cascades from User or carries
    // onDelete: SetNull — except ActivityLog/Order (no onDelete → Prisma's
    // default RESTRICT), which must be detached explicitly first. AuditLog
    // rows are kept (they carry userName snapshots; compliance trails must
    // survive account deletion) and their dangling userId is nulled.
    await prisma.$transaction([
      prisma.activityLog.updateMany({ where: { userId }, data: { userId: null } }),
      prisma.order.updateMany({ where: { userId }, data: { userId: null } }),
      prisma.auditLog.updateMany({ where: { userId }, data: { userId: null } }),
      prisma.user.delete({ where: { id: userId } }),
    ]);

    return NextResponse.json({ success: true, message: "User deleted successfully" });
  } catch (error) {
    console.error("Error deleting user:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
