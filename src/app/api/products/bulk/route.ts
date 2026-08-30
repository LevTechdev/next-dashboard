import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { requirePermission, requireAuth } from "@/lib/api-guard";

/**
 * POST /api/products/bulk
 * Bulk actions on products: { action: "delete" | "deactivate" | "activate", ids: string[] }
 * "delete" is a soft delete (isActive=false) when the product has order
 * references; otherwise the row is removed.
 */
export async function POST(req: Request) {
  const body = await req.json();
  const ids: string[] = Array.isArray(body.ids) ? body.ids : [];
  const action: string = body.action;

  if (ids.length === 0) {
    return NextResponse.json({ error: "No ids provided" }, { status: 400 });
  }
  if (!["delete", "deactivate", "activate"].includes(action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const { response } = await requirePermission(
    action === "delete" ? "delete" : "update",
    "products",
    req,
  );
  if (response) return response;

  let affected = 0;

  if (action === "activate" || action === "deactivate") {
    const result = await prisma.product.updateMany({
      where: { id: { in: ids } },
      data: { isActive: action === "activate" },
    });
    affected = result.count;
  } else {
    // delete: remove products without order references, soft-delete the rest
    const referenced = await prisma.orderItem.findMany({
      where: { productId: { in: ids } },
      select: { productId: true },
      distinct: ["productId"],
    });
    const referencedIds = new Set(referenced.map((r) => r.productId));
    const deletableIds = ids.filter((id) => !referencedIds.has(id));
    const softIds = ids.filter((id) => referencedIds.has(id));

    const [deleted, softDeleted] = await Promise.all([
      deletableIds.length > 0
        ? prisma.product.deleteMany({ where: { id: { in: deletableIds } } })
        : Promise.resolve({ count: 0 }),
      softIds.length > 0
        ? prisma.product.updateMany({
            where: { id: { in: softIds } },
            data: { isActive: false },
          })
        : Promise.resolve({ count: 0 }),
    ]);
    affected = deleted.count + softDeleted.count;
  }

  const { session } = await requireAuth(req);
  await prisma.activityLog.create({
    data: {
      action: `BULK_${action.toUpperCase()}_PRODUCTS`,
      entity: "Product",
      details: `Bulk ${action} on ${affected} products`,
      userId: session.user.id,
      tenantId: session.user.tenantId,
    },
  });

  return NextResponse.json({ success: true, affected });
}
