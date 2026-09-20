import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-guard";
import { getTenantId, tenantWhere, sameTenant } from "@/lib/tenancy";
import { regenerateDashboardOg } from "@/lib/og-dashboard-server.mjs";
import { buildMonthlyTrend } from "@/lib/trend-series";
import { captureValuationSnapshot, getValuationTrend } from "@/lib/inventory-snapshot-store";

export async function GET(req: Request) {
  const { session, response } = await requirePermission("read", "products", req);
  if (response) return response;
  const tenantId = getTenantId(session!);
  const scope = tenantWhere(tenantId);

  const { searchParams } = new URL(req.url);
  const includeCategories = searchParams.get("includeCategories");

  if (includeCategories === "true") {
    const includeValue = searchParams.get("includeValue") === "true";
    const [products, categories, productDates, itemActivity] = await Promise.all([
      prisma.product.findMany({
        where: scope,
        orderBy: { createdAt: "desc" },
        include: { category: true, _count: { select: { orderItems: true, affiliateLinks: true } } },
      }),
      prisma.productCategory.findMany({ where: scope, orderBy: { name: "asc" } }),
      prisma.product.findMany({
        where: scope,
        select: { createdAt: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.orderItem.findMany({
        where: { order: { is: scope } },
        select: { quantity: true, total: true, order: { select: { createdAt: true } } },
      }),
    ]);

    // Real monthly series for the summary-card sparklines: products created,
    // units sold, and sales value — bucketed over the trailing 12 months.
    const activity = itemActivity.map((i) => ({
      createdAt: i.order.createdAt,
      quantity: i.quantity,
      total: i.total,
    }));
    const trends = {
      products: buildMonthlyTrend(productDates),
      units: buildMonthlyTrend(activity, (i) => i.quantity),
      value: buildMonthlyTrend(activity, (i) => i.total),
    };

    const body: Record<string, unknown> = { products, categories, trends };
    if (includeValue) {
      const totalValue = products.reduce((sum, p) => sum + p.price * p.stock, 0);
      body.totalValue = totalValue;
      body.lowStockCount = products.filter((p) => p.stock > 0 && p.stock < 10).length;
      body.outOfStockCount = products.filter((p) => p.stock <= 0).length;
      body.inStockCount = products.filter((p) => p.stock >= 10).length;

      // Daily stock×cost snapshot — the Valuation card's own real trend.
      await captureValuationSnapshot(totalValue);
      body.trends = { ...trends, valuation: await getValuationTrend() };
    }
    return NextResponse.json(body);
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
  regenerateDashboardOg(req.headers?.get("cookie"));
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
  regenerateDashboardOg(req.headers?.get("cookie"));
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
  regenerateDashboardOg(req.headers?.get("cookie"));
  return NextResponse.json({ success: true });
}
