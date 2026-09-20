import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api-guard";
import { normalizeRole } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { session, response } = await requireAuth(req);
    if (response) return response;

    // Tenancy fix: tenants are NOT global directory data. Only the platform
    // ADMIN may enumerate every organization — every other role sees exactly
    // the tenant they belong to (the switcher still renders one row, but can
    // never discover or pivot into another org's dashboard).
    const role = normalizeRole(session!.user.role);
    const isAdmin = role === "ADMIN";

    const tenants = await prisma.tenant.findMany({
      where: isAdmin ? undefined : { id: session!.user.tenantId ?? "__none__" },
      select: {
        id: true,
        name: true,
        slug: true,
        createdAt: true,
        _count: {
          select: {
            users: true,
            products: true,
            orders: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({
      tenants: tenants.map((t) => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        createdAt: t.createdAt,
        userCount: t._count.users,
        productCount: t._count.products,
        orderCount: t._count.orders,
      })),
      activeTenantId: session?.user?.tenantId || tenants[0]?.id || null,
    });
  } catch (err: any) {
    return NextResponse.json({ error: "Failed to list tenants" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { session, response } = await requireAuth(req);
    if (response) return response;

    // Only ADMIN may create organizations — a workspace member provisioning
    // arbitrary tenants would silently expand the platform surface.
    if (normalizeRole(session!.user.role) !== "ADMIN") {
      return NextResponse.json(
        { error: "Only administrators can create organizations" },
        { status: 403 },
      );
    }

    const body = await req.json();
    const { name, slug } = body;

    if (!name || !slug) {
      return NextResponse.json(
        { error: "Organization name and slug are required" },
        { status: 400 },
      );
    }

    const cleanSlug = slug
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-");

    const existing = await prisma.tenant.findUnique({
      where: { slug: cleanSlug },
    });
    if (existing) {
      return NextResponse.json(
        { error: "Slug already exists. Please choose a different slug." },
        { status: 409 },
      );
    }

    const newTenant = await prisma.tenant.create({
      data: {
        name,
        slug: cleanSlug,
      },
    });

    return NextResponse.json(newTenant, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to create tenant" }, { status: 500 });
  }
}
