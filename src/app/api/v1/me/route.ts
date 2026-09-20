import { prisma } from "@/lib/db";
import {
  authenticateApiKey,
  requireReadScope,
  resolveTenantIdForAuth,
  v1Error,
  v1Json,
} from "@/lib/api-key-auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/me — key metadata plus the owning user and workspace.
 * Lets integrators confirm which identity a key acts as and which tenant
 * its data is scoped to.
 */
export async function GET(req: Request) {
  const auth = await authenticateApiKey(req);
  if (!auth.ok) return v1Error(auth.status, auth.error, auth.hint);

  const scope = requireReadScope(auth);
  if (!scope.ok) return v1Error(scope.status, scope.error, scope.hint);

  const tenantId = await resolveTenantIdForAuth(auth);

  const user = auth.userId
    ? await prisma.user.findUnique({
        where: { id: auth.userId },
        select: { id: true, name: true, email: true, role: true },
      })
    : null;

  const workspace = tenantId
    ? await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { id: true, name: true },
      })
    : null;

  return v1Json(
    {
      key: { id: auth.keyId, name: auth.keyName, scopes: auth.scopes },
      user,
      workspace,
    },
    auth.rateRemaining,
  );
}
