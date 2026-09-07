import { NextResponse } from "next/server";
import { getPurchaseOrders, createPurchaseOrder } from "@/lib/purchase-orders-store";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    let orders = getPurchaseOrders();

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
    });
  } catch (err) {
    return NextResponse.json({ error: "Failed to fetch purchase orders" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { supplierId, items, warehouseId, notes } = body;

    if (!supplierId || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "Supplier and at least one item are required" },
        { status: 400 },
      );
    }

    const po = createPurchaseOrder({
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
