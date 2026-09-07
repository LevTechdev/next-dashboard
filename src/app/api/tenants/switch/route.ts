import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api-guard";
import { signToken } from "@/lib/auth";

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
