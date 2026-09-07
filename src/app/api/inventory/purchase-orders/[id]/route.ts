import { NextResponse } from "next/server";
import { getPurchaseOrderById, updatePurchaseOrderStatus } from "@/lib/purchase-orders-store";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const po = getPurchaseOrderById(id);
    if (!po) {
      return NextResponse.json({ error: "Purchase order not found" }, { status: 404 });
    }
    return NextResponse.json(po);
  } catch {
    return NextResponse.json({ error: "Failed to fetch purchase order" }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { status } = body;

    if (!["DRAFT", "ISSUED", "RECEIVED", "CANCELLED"].includes(status)) {
      return NextResponse.json({ error: "Invalid purchase order status" }, { status: 400 });
    }

    const updated = updatePurchaseOrderStatus(id, status);
    if (!updated) {
      return NextResponse.json({ error: "Purchase order not found" }, { status: 404 });
    }

    // If marked as RECEIVED, replenish stock in Prisma DB and log InventoryRecord
    if (status === "RECEIVED") {
      for (const item of updated.items) {
        try {
          await prisma.product.update({
            where: { id: item.productId },
            data: {
              stock: { increment: item.quantity },
              inventoryItems: {
                create: {
                  type: "IN",
                  quantity: item.quantity,
                  notes: "Restock received via PO " + updated.poNumber,
                },
              },
            },
          });
        } catch (e) {
          // If productId was mock or changed, continue gracefully
          console.warn("Stock replenishment warning for product:", item.productId, e);
        }
      }
    }

    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to update purchase order" },
      { status: 500 },
    );
  }
}
