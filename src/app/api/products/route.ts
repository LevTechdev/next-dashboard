import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-guard";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const includeCategories = searchParams.get("includeCategories");

  if (includeCategories === "true") {
    const [products, categories] = await Promise.all([
      prisma.product.findMany({
        orderBy: { createdAt: "desc" },
        include: { category: true, _count: { select: { orderItems: true } } },
      }),
      prisma.productCategory.findMany({ orderBy: { name: "asc" } }),
    ]);
    return NextResponse.json({ products, categories });
  }

  const products = await prisma.product.findMany({
    orderBy: { createdAt: "desc" },
    include: { category: true, _count: { select: { orderItems: true } } },
  });
  return NextResponse.json(products);
}

export async function POST(req: Request) {
  const { response } = await requirePermission("create", "products");
  if (response) return response;

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
    },
  });
  return NextResponse.json(product);
}

export async function PUT(req: Request) {
  const { response } = await requirePermission("update", "products");
  if (response) return response;

  const body = await req.json();
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
  const { response } = await requirePermission("delete", "products");
  if (response) return response;

  const { id } = await req.json();
  await prisma.product.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
