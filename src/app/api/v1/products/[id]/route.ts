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
 * GET /api/v1/products/[id] — a single product from the key's workspace.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateApiKey(req);
  if (!auth.ok) return v1Error(auth.status, auth.error, auth.hint);

  const scope = requireReadScope(auth);
  if (!scope.ok) return v1Error(scope.status, scope.error, scope.hint);

  const tenantId = await resolveTenantIdForAuth(auth);
  const { id } = await params;

  const product = await prisma.product.findFirst({
    where: { id, ...tenantWhere(tenantId) },
    select: {
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
    },
  });

  if (!product) return v1Error(404, "not_found", "No product with this id in the key's workspace.");

  return v1Json({ data: product }, auth.rateRemaining);
}
