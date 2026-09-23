import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api-guard";
import { signToken } from "@/lib/auth";
import { normalizeRole } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { session, response } = await requireAuth(req);
    if (response) return response;

    const body = await req.json();
    const { tenantId, slug } = body;

    let targetTenant = null;
    if (tenantId) {
      targetTenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    } else if (slug) {
      targetTenant = await prisma.tenant.findUnique({ where: { slug } });
    }

    if (!targetTenant) {
      return NextResponse.json({ error: "Target organization not found" }, { status: 404 });
    }

    const userId = session!.user.id;
    const role = normalizeRole(session!.user.role);

    // ── Cross-tenant guard (the "dashboard switches to another user's
    // workspace" bug) ── Previously ANY authenticated user could pivot their
    // session into ANY tenant by id — the JWT was re-signed with the foreign
    // tenantId and /api/dashboard happily served the other organization's
    // revenue, orders, and customers. Membership is now mandatory: only the
    // platform ADMIN (already tenant-unrestricted elsewhere) may switch
    // freely; everyone else may only enter a tenant they belong to.
    if (role !== "ADMIN" && session!.user.tenantId !== targetTenant.id) {
      return NextResponse.json(
        { error: "You are not a member of this organization" },
        { status: 403 },
      );
    }

    // Update user's active tenant
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { tenantId: targetTenant.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        tenantId: true,
      },
    });

    // Sign new JWT with updated tenantId claim
    const newToken = signToken({
      id: updatedUser.id,
      name: updatedUser.name,
      email: updatedUser.email,
      role: updatedUser.role,
      tenantId: targetTenant.id,
    });

    // Last-admin protection: if this user is the only active ADMIN of the
    // tenant they are leaving, refuse the switch — otherwise the org is left
    // with no admin and loses all administrative access permanently.
    if (role === "ADMIN" && session!.user.tenantId && session!.user.tenantId !== targetTenant.id) {
      const otherAdmins = await prisma.user.count({
        where: {
          tenantId: session!.user.tenantId,
          id: { not: userId },
          isActive: true,
          role: { in: ["ADMIN", "SUPERADMIN"] },
        },
      });
      if (otherAdmins === 0) {
        return NextResponse.json(
          { error: "Cannot leave: you are the only admin of this organization" },
          { status: 409 },
        );
      }
    }

    const res = NextResponse.json({
      success: true,
      user: updatedUser,
      activeTenant: {
        id: targetTenant.id,
        name: targetTenant.name,
        slug: targetTenant.slug,
      },
    });

    // Set cookie
    res.cookies.set("token", newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60,
      path: "/",
    });

    return res;
  } catch (err: any) {
    console.error("Tenant switch error:", err);
    return NextResponse.json({ error: "Failed to switch organization" }, { status: 500 });
  }
}
