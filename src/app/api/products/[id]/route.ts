import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-guard";
import { getTenantId, sameTenant } from "@/lib/tenancy";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requirePermission("read", "products", req);
  if (response) return response;
  const tenantId = getTenantId(session!);

  const { id } = await params;
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      category: true,
      inventoryItems: { orderBy: { createdAt: "desc" }, take: 25 },
      orderItems: {
        orderBy: { id: "desc" },
        take: 10,
        include: { order: { select: { orderNumber: true, createdAt: true, status: true } } },
      },
    },
  });
  if (!product || !sameTenant(tenantId, product)) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }
  return NextResponse.json(product);
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requirePermission("update", "products", req);
  if (response) return response;
  const tenantId = getTenantId(session!);

  const { id } = await params;
  const body = await req.json();

  const existing = await prisma.product.findUnique({ where: { id }, select: { tenantId: true } });
  if (!sameTenant(tenantId, existing)) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  const product = await prisma.product.update({
    where: { id },
    data: {
      name: body.name,
      description: body.description,
      price: body.price !== undefined ? parseFloat(body.price) : undefined,
      costPrice: body.costPrice !== undefined ? parseFloat(body.costPrice) : undefined,
      stock: body.stock !== undefined ? parseInt(body.stock, 10) : undefined,
      sku: body.sku,
      categoryId: body.categoryId,
      isActive: body.isActive,
      image: body.image !== undefined ? body.image : undefined,
      images: Array.isArray(body.images) ? body.images : undefined,
    },
  });

  await prisma.activityLog.create({
    data: {
      action: "UPDATE_PRODUCT",
      entity: "Product",
      entityId: product.id,
      details: `Product ${product.name} updated`,
      userId: session!.user.id,
      tenantId,
    },
  });

  return NextResponse.json(product);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requirePermission("delete", "products", req);
  if (response) return response;
  const tenantId = getTenantId(session!);

  const { id } = await params;
  const existing = await prisma.product.findUnique({ where: { id }, select: { tenantId: true } });
  if (!sameTenant(tenantId, existing)) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  // Soft delete to preserve order item references
  const product = await prisma.product.update({
    where: { id },
    data: { isActive: false },
  });

  await prisma.activityLog.create({
    data: {
      action: "DELETE_PRODUCT",
      entity: "Product",
      entityId: product.id,
      details: `Product ${product.name} deactivated`,
      userId: session!.user.id,
      tenantId,
    },
  });

  return NextResponse.json({ success: true });
}
