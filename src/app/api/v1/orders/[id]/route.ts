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
 * GET /api/v1/orders/[id] — a single order from the key's workspace,
 * with line items.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateApiKey(req);
  if (!auth.ok) return v1Error(auth.status, auth.error, auth.hint);

  const scope = requireReadScope(auth);
  if (!scope.ok) return v1Error(scope.status, scope.error, scope.hint);

  const tenantId = await resolveTenantIdForAuth(auth);
  const { id } = await params;

  const order = await prisma.order.findFirst({
    where: { id, ...tenantWhere(tenantId) },
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
      shippingAddress: true,
      trackingNumber: true,
      carrier: true,
      customer: { select: { id: true, name: true, email: true } },
      channel: { select: { name: true } },
      items: {
        select: {
          id: true,
          quantity: true,
          price: true,
          product: { select: { id: true, name: true, sku: true } },
        },
      },
      createdAt: true,
    },
  });

  if (!order) return v1Error(404, "not_found", "No order with this id in the key's workspace.");

  return v1Json({ data: order }, auth.rateRemaining);
}
