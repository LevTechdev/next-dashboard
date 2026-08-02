import "server-only";
import { prisma } from "@/lib/db";
import { getRequestMeta } from "@/lib/request-meta";
import { computeHash, GENESIS_HASH } from "@/lib/audit-chain";
import { forwardToSiem } from "@/lib/siem";

export type SecurityEventType =
  | "LOGIN"
  | "LOGIN_FAILED"
  | "LOGOUT"
  | "PASSWORD_CHANGE"
  | "TOTP_ENABLED"
  | "TOTP_DISABLED"
  | "BACKUP_CODES_GENERATED"
  | "BACKUP_CODE_USED"
  | "SESSION_REVOKED"
  | "SESSIONS_REVOKED_ALL"
  | "REFRESH_REUSE"
  | "STEP_UP_VERIFIED"
  | "PASSKEY_ADDED"
  | "PASSKEY_REMOVED"
  | "PASSKEY_LOGIN"
  | "SAML_LOGIN"
  | "APIKEY_CREATED"
  | "ACCOUNT_LOCKED";

/**
 * Append a security event. Best-effort: never throws into the caller so a
 * logging failure can't break the security action it records.
 */
export async function logSecurityEvent(params: {
  userId: string | null;
  type: SecurityEventType;
  req?: Request;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const meta = params.req ? getRequestMeta(params.req) : null;
    const createdAt = new Date();
    const event = {
      userId: params.userId,
      type: params.type,
      ip: meta?.ip ?? null,
      userAgent: meta?.userAgent ?? null,
      metadata: params.metadata ?? null,
      createdAt,
    };
    // Append under an advisory lock so the hash chain stays linear under
    // concurrent writers. The lock is Postgres-specific; ignored elsewhere.
    await prisma.$transaction(async (tx) => {
      try {
        await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(727274)");
      } catch {
        /* non-Postgres or lock unavailable — proceed best-effort */
      }
      const last = await tx.securityEvent.findFirst({
        orderBy: { seq: "desc" },
        select: { hash: true },
      });
      const prevHash = last?.hash ?? GENESIS_HASH;
      const hash = computeHash(prevHash, event);
      const created = await tx.securityEvent.create({
        data: {
          userId: event.userId,
          type: event.type,
          ip: event.ip,
          userAgent: event.userAgent,
          metadata: params.metadata ? (params.metadata as object) : undefined,
          createdAt,
          prevHash,
          hash,
        },
      });
      // Real-time SIEM forward (no-op unless SIEM_WEBHOOK_URL is configured).
      await forwardToSiem({
        id: created.id,
        seq: created.seq,
        userId: created.userId,
        type: created.type,
        ip: created.ip,
        userAgent: created.userAgent,
        metadata: created.metadata,
        createdAt: created.createdAt,
      });
    });
  } catch (err) {
    console.error("[security-event] failed to log", params.type, err);
  }
}

/** Recent user-visible security events for the Profile → Security activity feed. */
export async function listSecurityEvents(userId: string, limit = 20) {
  return prisma.securityEvent.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}
