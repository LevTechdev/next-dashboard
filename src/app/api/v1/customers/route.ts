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
 * GET /api/v1/customers — sandboxed customer list for the key's workspace.
 * Supports segment filtering and pagination.
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
  const segment = searchParams.get("segment");

  const where = {
    ...tenantWhere(tenantId),
    ...(segment ? { segment } : {}),
  };

  const [customers, total] = await Promise.all([
    prisma.customer.findMany({
      where,
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
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.customer.count({ where }),
  ]);

  return v1Json(
    {
      data: customers,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    },
    auth.rateRemaining,
  );
}
