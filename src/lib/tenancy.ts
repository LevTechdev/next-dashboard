import "server-only";
import { prisma } from "@/lib/db";

type SessionLike = { user: { tenantId?: string | null } };

/**
 * App-layer multi-tenancy helpers.
 *
 * The acting tenant is derived from the authenticated session (carried in the
 * JWT). Queries against tenant-scoped models must filter by `tenantWhere`, and
 * writes/reads of a specific row must confirm `sameTenant` before proceeding —
 * this is what isolates one workspace's data from another's.
 */

/** Current tenant id from the session (null = system/legacy, no tenant claim). */
export function getTenantId(session: SessionLike): string | null {
  return session.user.tenantId ?? null;
}

/**
 * Prisma `where` fragment scoping a query to the caller's tenant. A null tenant
 * is scoped to null-tenant rows (strict isolation) so a session without a
 * tenant claim can never read another tenant's data.
 */
export function tenantWhere(tenantId: string | null): { tenantId: string | null } {
  return { tenantId };
}

/** True when a fetched row belongs to the caller's tenant. */
export function sameTenant(
  tenantId: string | null,
  row: { tenantId?: string | null } | null | undefined,
): boolean {
  if (!row) return false;
  return (row.tenantId ?? null) === tenantId;
}

/**
 * Effective workspace for a session. The JWT tenant claim wins; legacy
 * sessions without a claim operate on the default (first-created) workspace —
 * the same semantic `scripts/backfill-tenant.mjs` applies when backfilling
 * null-tenant rows (and that the SAML connections route mirrors).
 */
export async function effectiveTenantId(session: SessionLike): Promise<string | null> {
  const claimed = getTenantId(session);
  if (claimed) return claimed;
  const fallback = await prisma.tenant.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  return fallback?.id ?? null;
}

/**
 * Audit READS (ActivityLog, SecurityEvent) use the same strict tenant filter
 * as every other tenant-scoped query (`tenantWhere`). Every audit write now
 * carries a tenantId and `scripts/backfill-audit-tenants.mjs` assigns legacy
 * pre-tenancy rows to the default workspace, so no OR-null fallback is
 * needed — a row without a tenant belongs to nobody and stays invisible.
 */
