import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api-guard";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { session, response } = await requireAuth(req);
    if (response) return response;

    const tenants = await prisma.tenant.findMany({
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
