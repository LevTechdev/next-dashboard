import { NextResponse } from "next/server";
import { requireAuth, requirePermission } from "@/lib/api-guard";
import { effectiveTenantId } from "@/lib/tenancy";
import { getPurchaseOrders, createPurchaseOrder } from "@/lib/purchase-orders-store";
import { buildMonthlyTrend } from "@/lib/trend-series";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { session, response } = await requireAuth(req);
    if (response) return response;
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const tenantId = await effectiveTenantId(session);
    if (!tenantId) {
      return NextResponse.json({ error: "No workspace for this account" }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    let orders = await getPurchaseOrders(tenantId);

    if (status && status !== "ALL") {
      orders = orders.filter((o) => o.status === status);
    }

    const totalIssued = orders
      .filter((o) => o.status === "ISSUED")
      .reduce((sum, o) => sum + o.totalAmount, 0);
    const totalReceived = orders
      .filter((o) => o.status === "RECEIVED")
      .reduce((sum, o) => sum + o.totalAmount, 0);

    return NextResponse.json({
      orders,
      summary: {
        count: orders.length,
        issuedCount: orders.filter((o) => o.status === "ISSUED").length,
        receivedCount: orders.filter((o) => o.status === "RECEIVED").length,
        totalIssued,
        totalReceived,
      },
      trends: {
        issued: buildMonthlyTrend(
          orders.filter((o) => o.status === "ISSUED"),
          (o) => o.totalAmount,
        ),
      },
    });
  } catch (err) {
    console.error("[PURCHASE_ORDERS_GET_ERROR]", err);
    return NextResponse.json({ error: "Failed to fetch purchase orders" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { session, response } = await requirePermission("create", "inventory", req);
    if (response) return response;
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const tenantId = await effectiveTenantId(session);
    if (!tenantId) {
      return NextResponse.json({ error: "No workspace for this account" }, { status: 400 });
    }

    const body = await req.json();
    const { supplierId, items, warehouseId, notes } = body;

    if (!supplierId || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "Supplier and at least one item are required" },
        { status: 400 },
      );
    }

    const po = await createPurchaseOrder({
      tenantId,
      supplierId,
      items,
      warehouseId,
      notes,
    });

    return NextResponse.json(po, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to create purchase order" },
      { status: 500 },
    );
  }
}
