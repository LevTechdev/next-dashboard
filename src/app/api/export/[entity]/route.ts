import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api-guard";
import { getTenantId } from "@/lib/tenancy";
import { assertTierFeature, tierUpgradeResponse, TierUpgradeRequiredError } from "@/lib/plan-tiers";
import { toCsv, csvHeaders, exportFilename, type ExportColumn } from "@/lib/csv-export";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Enterprise custom data exports — the feature `hasCustomExports` gates.
 *
 * GET /api/export/orders|customers|products → CSV download, tenant-scoped,
 * full table (no pagination — exports are for offline analysis). Enterprise
 * only: every other tier gets the standard 402 upgrade challenge, keeping
 * the top plan's pricing honest.
 */

interface OrderRow {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  grandTotal: number;
  createdAt: Date;
  customerName: string | null;
  channelName: string | null;
  itemCount: number;
}

const ORDER_COLUMNS: Array<ExportColumn<OrderRow>> = [
  { header: "Order Number", value: (r) => r.orderNumber },
  { header: "Status", value: (r) => r.status },
  { header: "Payment Status", value: (r) => r.paymentStatus },
  { header: "Customer", value: (r) => r.customerName },
  { header: "Channel", value: (r) => r.channelName },
  { header: "Items", value: (r) => r.itemCount },
  { header: "Grand Total", value: (r) => r.grandTotal },
  { header: "Created At", value: (r) => r.createdAt },
];

interface CustomerRow {
  name: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  country: string | null;
  segment: string | null;
  totalSpent: number;
  totalOrders: number;
  lastOrderDate: Date | null;
  isActive: boolean;
  createdAt: Date;
}

const CUSTOMER_COLUMNS: Array<ExportColumn<CustomerRow>> = [
  { header: "Name", value: (r) => r.name },
  { header: "Email", value: (r) => r.email },
  { header: "Phone", value: (r) => r.phone },
  { header: "City", value: (r) => r.city },
  { header: "Country", value: (r) => r.country },
  { header: "Segment", value: (r) => r.segment },
  { header: "Total Spent", value: (r) => r.totalSpent },
  { header: "Total Orders", value: (r) => r.totalOrders },
  { header: "Last Order", value: (r) => r.lastOrderDate },
  { header: "Active", value: (r) => r.isActive },
  { header: "Created At", value: (r) => r.createdAt },
];

interface ProductRow {
  name: string;
  sku: string | null;
  categoryName: string | null;
  price: number;
  costPrice: number;
  stock: number;
  isActive: boolean;
  createdAt: Date;
}

const PRODUCT_COLUMNS: Array<ExportColumn<ProductRow>> = [
  { header: "Name", value: (r) => r.name },
  { header: "SKU", value: (r) => r.sku },
  { header: "Category", value: (r) => r.categoryName },
  { header: "Price", value: (r) => r.price },
  { header: "Cost Price", value: (r) => r.costPrice },
  { header: "Stock", value: (r) => r.stock },
  { header: "Active", value: (r) => r.isActive },
  { header: "Created At", value: (r) => r.createdAt },
];

export async function GET(req: Request, { params }: { params: Promise<{ entity: string }> }) {
  const { session, response } = await requireAuth(req);
  if (response) return response;

  // Enterprise-only feature — REGULAR/PRO get the 402 upgrade challenge.
  try {
    await assertTierFeature(session!.user.id, "customExports");
  } catch (e) {
    if (e instanceof TierUpgradeRequiredError) return tierUpgradeResponse(e);
    throw e;
  }

  const tenantId = getTenantId(session);
  if (!tenantId) {
    return NextResponse.json({ error: "No workspace" }, { status: 400 });
  }

  const { entity } = await params;

  // Optional ?from=&to= (YYYY-MM-DD) window — the Analytics "Export current
  // view" action forwards the active date range so exports match the screen.
  const url = new URL(req.url);
  const fromParam = url.searchParams.get("from");
  const toParam = url.searchParams.get("to");
  const fromMs = fromParam ? new Date(`${fromParam}T00:00:00`).getTime() : null;
  const toMs = toParam ? new Date(`${toParam}T23:59:59.999`).getTime() : null;
  const hasWindow = fromMs !== null || toMs !== null;

  switch (entity) {
    case "orders": {
      const orders = await prisma.order.findMany({
        where: {
          tenantId,
          ...(hasWindow
            ? {
                createdAt: {
                  ...(fromMs ? { gte: new Date(fromMs) } : {}),
                  ...(toMs ? { lte: new Date(toMs) } : {}),
                },
              }
            : {}),
        },
        orderBy: { createdAt: "desc" },
        include: {
          customer: { select: { name: true } },
          channel: { select: { name: true } },
          items: { select: { quantity: true } },
        },
      });
      const rows: OrderRow[] = orders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        paymentStatus: o.paymentStatus,
        grandTotal: o.grandTotal,
        createdAt: o.createdAt,
        customerName: o.customer?.name ?? null,
        channelName: o.channel?.name ?? null,
        itemCount: o.items.reduce((s, it) => s + it.quantity, 0),
      }));
      return new Response(toCsv(rows, ORDER_COLUMNS), {
        headers: csvHeaders(exportFilename("orders", { from: fromParam, to: toParam })),
      });
    }

    case "customers": {
      const customers = await prisma.customer.findMany({
        where: { tenantId },
        orderBy: { createdAt: "desc" },
      });
      return new Response(toCsv(customers, CUSTOMER_COLUMNS), {
        headers: csvHeaders(exportFilename("customers")),
      });
    }

    case "products": {
      const products = await prisma.product.findMany({
        where: { tenantId },
        orderBy: { createdAt: "desc" },
        include: { category: { select: { name: true } } },
      });
      const rows: ProductRow[] = products.map((p) => ({
        name: p.name,
        sku: p.sku,
        categoryName: p.category?.name ?? null,
        price: p.price,
        costPrice: p.costPrice,
        stock: p.stock,
        isActive: p.isActive,
        createdAt: p.createdAt,
      }));
      return new Response(toCsv(rows, PRODUCT_COLUMNS), {
        headers: csvHeaders(exportFilename("products")),
      });
    }

    default:
      return NextResponse.json(
        { error: "Unknown entity — use orders, customers, or products" },
        { status: 404 },
      );
  }
}
