import "server-only";

import { prisma } from "@/lib/db";
import { getRequestMeta } from "@/lib/request-meta";

/**
 * Append an audit entry for a destructive action (delete / revoke / remove).
 *
 * The `/audit-log` page reads `ActivityLog` tenant-scoped, so the caller's
 * workspace sees who destroyed what and why. The write is strictly
 * best-effort: a logging failure must never break the destructive operation
 * the user just confirmed.
 */
export async function writeDeletionAudit(params: {
  /** Shape-compatible with the session returned by `requireAuth`. */
  session: { user: { id: string; tenantId: string | null } };
  action: string;
  entity: string;
  entityId?: string | null;
  details: string;
  req?: Request;
}): Promise<void> {
  try {
    const meta = params.req ? getRequestMeta(params.req) : null;

    // ActivityLog has no ip/userAgent columns; the network context rides
    // along in details so the trail keeps the audit value of the
    // SecurityEvent stream (which does store ip/userAgent).
    const details = meta
      ? `${params.details} — ${meta.browser} / ${meta.device} / ${meta.ip}`
      : params.details;

    await prisma.activityLog.create({
      data: {
        action: params.action,
        entity: params.entity,
        entityId: params.entityId ?? null,
        details,
        userId: params.session.user.id,
        tenantId: params.session.user.tenantId ?? null,
      },
    });
  } catch {
    // Best-effort by contract.
  }
}
