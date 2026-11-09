import { NextResponse } from "next/server";
import { requireAuth, requirePermission } from "@/lib/api-guard";
import { effectiveTenantId } from "@/lib/tenancy";
import { getPurchaseOrderById, updatePurchaseOrderStatus } from "@/lib/purchase-orders-store";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { session, response } = await requireAuth(req);
    if (response) return response;
    const tenantId = await effectiveTenantId(session);
    if (!tenantId) {
      return NextResponse.json({ error: "No workspace for this account" }, { status: 400 });
    }

    const { id } = await params;
    const po = await getPurchaseOrderById(tenantId, id);
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
    const { session, response } = await requirePermission("update", "inventory", req);
    if (response) return response;
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const tenantId = await effectiveTenantId(session);
    if (!tenantId) {
      return NextResponse.json({ error: "No workspace for this account" }, { status: 400 });
    }

    const { id } = await params;
    const body = await req.json();
    const { status } = body;

    if (!["DRAFT", "ISSUED", "RECEIVED", "CANCELLED"].includes(status)) {
      return NextResponse.json({ error: "Invalid purchase order status" }, { status: 400 });
    }

    const updated = await updatePurchaseOrderStatus(tenantId, id, status);
    if (!updated) {
      return NextResponse.json({ error: "Purchase order not found" }, { status: 404 });
    }

    // If marked as RECEIVED, replenish stock in Prisma DB and log InventoryRecord
    if (status === "RECEIVED") {
      for (const item of updated.items) {
        try {
          // Never replenish a product from another workspace.
          const product = await prisma.product.findFirst({
            where: { id: item.productId, tenantId },
            select: { id: true },
          });
          if (!product) continue;
          await prisma.product.update({
            where: { id: product.id },
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
