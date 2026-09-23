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

const PRODUCT_SELECT = {
  id: true,
  name: true,
  slug: true,
  description: true,
  price: true,
  costPrice: true,
  stock: true,
  sku: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

/**
 * GET /api/v1/products — sandboxed product list for the key's workspace.
 * Read-only, tenant-scoped via the key owner.
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
  const active = searchParams.get("active");

  const where = {
    ...tenantWhere(tenantId),
    ...(active === "true" || active === "false" ? { isActive: active === "true" } : {}),
  };

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      select: PRODUCT_SELECT,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.product.count({ where }),
  ]);

  return v1Json(
    {
      data: products,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    },
    auth.rateRemaining,
  );
}
