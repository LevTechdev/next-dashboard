import { prisma } from "@/lib/db";
import { tenantWhere } from "@/lib/tenancy";
import {
  authenticateApiKey,
  requireReadScope,
  resolveTenantIdForAuth,
  v1Error,
  v1Json,
} from "@/lib/api-key-auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/orders — sandboxed order list for the key's workspace.
 * Supports status/paymentStatus filters and pagination; sums are returned
 * as-is (workspace currency units) so no silent conversion happens.
 */
export async function GET(req: Request) {
  const auth = await authenticateApiKey(req);
  if (!auth.ok) return v1Error(auth.status, auth.error, auth.hint);

  const scope = requireReadScope(auth);
  if (!scope.ok) return v1Error(scope.status, scope.error, scope.hint);

  const tenantId = await resolveTenantIdForAuth(auth);

  const { searchParams } = new URL(req.url);
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 20));
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const status = searchParams.get("status");
  const paymentStatus = searchParams.get("paymentStatus");

  const validStatuses = ["PENDING", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"];
  if (status && !validStatuses.includes(status)) {
    return v1Error(400, "invalid_status", `status must be one of: ${validStatuses.join(", ")}`);
  }

  const where = {
    ...tenantWhere(tenantId),
    ...(status ? { status } : {}),
    ...(paymentStatus ? { paymentStatus } : {}),
  };

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        paymentStatus: true,
        paymentMethod: true,
        totalAmount: true,
        discountAmount: true,
        shippingAmount: true,
        taxAmount: true,
        grandTotal: true,
        customer: { select: { id: true, name: true } },
        channel: { select: { name: true } },
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.order.count({ where }),
  ]);

  return v1Json(
    {
      data: orders,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    },
    auth.rateRemaining,
  );
}
