import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-guard";
import { getTenantId, tenantWhere, sameTenant } from "@/lib/tenancy";

export async function GET(req: Request) {
  const { session, response } = await requirePermission("read", "products", req);
  if (response) return response;
  const tenantId = getTenantId(session!);
  const scope = tenantWhere(tenantId);

  const { searchParams } = new URL(req.url);
  const includeCategories = searchParams.get("includeCategories");

  if (includeCategories === "true") {
    const [products, categories] = await Promise.all([
      prisma.product.findMany({
        where: scope,
        orderBy: { createdAt: "desc" },
        include: { category: true, _count: { select: { orderItems: true, affiliateLinks: true } } },
      }),
      prisma.productCategory.findMany({ where: scope, orderBy: { name: "asc" } }),
    ]);
    return NextResponse.json({ products, categories });
  }

  const products = await prisma.product.findMany({
    where: scope,
    orderBy: { createdAt: "desc" },
    include: { category: true, _count: { select: { orderItems: true, affiliateLinks: true } } },
  });
  return NextResponse.json(products);
}

export async function POST(req: Request) {
  const { session, response } = await requirePermission("create", "products", req);
  if (response) return response;
  const tenantId = getTenantId(session!);

  const body = await req.json();
  const product = await prisma.product.create({
    data: {
      name: body.name,
      slug: body.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      description: body.description,
      price: parseFloat(body.price),
      costPrice: parseFloat(body.costPrice || 0),
      stock: parseInt(body.stock || 0),
      sku: body.sku,
      categoryId: body.categoryId || null,
      tenantId,
    },
  });
  return NextResponse.json(product);
}

export async function PUT(req: Request) {
  const { session, response } = await requirePermission("update", "products", req);
  if (response) return response;
  const tenantId = getTenantId(session!);

  const body = await req.json();
  const existing = await prisma.product.findUnique({
    where: { id: body.id },
    select: { tenantId: true },
  });
  if (!sameTenant(tenantId, existing)) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  const product = await prisma.product.update({
    where: { id: body.id },
    data: {
      name: body.name,
      description: body.description,
      price: parseFloat(body.price),
      costPrice: parseFloat(body.costPrice || 0),
      stock: parseInt(body.stock || 0),
      sku: body.sku,
      categoryId: body.categoryId || null,
      isActive: body.isActive,
    },
  });
  return NextResponse.json(product);
}

export async function DELETE(req: Request) {
  const { session, response } = await requirePermission("delete", "products", req);
  if (response) return response;
  const tenantId = getTenantId(session!);

  const { id } = await req.json();
  const existing = await prisma.product.findUnique({ where: { id }, select: { tenantId: true } });
  if (!sameTenant(tenantId, existing)) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  await prisma.product.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
