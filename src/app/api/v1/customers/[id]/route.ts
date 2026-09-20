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
 * GET /api/v1/customers/[id] — a single customer from the key's workspace.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateApiKey(req);
  if (!auth.ok) return v1Error(auth.status, auth.error, auth.hint);

  const scope = requireReadScope(auth);
  if (!scope.ok) return v1Error(scope.status, scope.error, scope.hint);

  const tenantId = await resolveTenantIdForAuth(auth);
  const { id } = await params;

  const customer = await prisma.customer.findFirst({
    where: { id, ...tenantWhere(tenantId) },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      city: true,
      country: true,
      segment: true,
      totalSpent: true,
      totalOrders: true,
      lastOrderDate: true,
      isActive: true,
      createdAt: true,
    },
  });

  if (!customer)
    return v1Error(404, "not_found", "No customer with this id in the key's workspace.");

  return v1Json({ data: customer }, auth.rateRemaining);
}
