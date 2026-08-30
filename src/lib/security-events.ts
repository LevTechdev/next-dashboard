import "server-only";
import { prisma } from "@/lib/db";
import { getRequestMeta } from "@/lib/request-meta";
import { computeHash, GENESIS_HASH } from "@/lib/audit-chain";
import { forwardToSiem } from "@/lib/siem";
import { tenantWhere } from "@/lib/tenancy";

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
  | "MFA_VERIFIED"
  | "EMAIL_VERIFIED"
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
/**
 * True when the app is connected through a pgbouncer **transaction-mode**
 * pooler (e.g. Supabase's default pooler on port 6543 with `?pgbouncer=true`).
 *
 * In transaction mode, Postgres advisory locks and Prisma interactive
 * transactions are unsupported — pgbouncer releases the connection back to the
 * pool at the end of every statement, so a `BEGIN` / advisory-lock / `COMMIT`
 * sequence spans multiple physical connections and always times out (P2028).
 *
 * Detection: presence of `pgbouncer=true` in DATABASE_URL (Supabase convention).
 */
const isPgBouncer =
  typeof process.env.DATABASE_URL === "string" &&
  process.env.DATABASE_URL.includes("pgbouncer=true");

export async function logSecurityEvent(params: {
  userId: string | null;
  type: SecurityEventType;
  req?: Request;
  metadata?: Record<string, unknown>;
  tenantId?: string | null;
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
      tenantId: params.tenantId ?? null,
      createdAt,
    };

    if (isPgBouncer) {
      // pgbouncer transaction-mode: advisory locks and interactive transactions
      // are unsupported. Fall back to sequential queries (best-effort ordering
      // — the hash chain may have gaps under heavy concurrency but the
      // `repair:audit-chain` script can restore it).
      const last = await prisma.securityEvent.findFirst({
        orderBy: { seq: "desc" },
        select: { hash: true },
      });
      const prevHash = last?.hash ?? GENESIS_HASH;
      const hash = computeHash(prevHash, event);
      const created = await prisma.securityEvent.create({
        data: {
          userId: event.userId,
          type: event.type,
          ip: event.ip,
          userAgent: event.userAgent,
          metadata: params.metadata ? (params.metadata as object) : undefined,
          tenantId: event.tenantId,
          createdAt,
          prevHash,
          hash,
        },
      });
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
      return;
    }

    // Non-pgbouncer path: use an advisory lock inside an interactive
    // transaction to guarantee strict sequential hash-chain ordering.
    //
    // The interactive transaction needs a longer-than-default timeout: while
    // one worker holds the advisory lock, a concurrent writer WAITS on it
    // inside the transaction, and Prisma's 5s default deadline can expire
    // mid-wait (P2028). 15s covers the worst-case lock wait plus both queries.
    await prisma.$transaction(
      async (tx) => {
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
            tenantId: event.tenantId,
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
      },
      { timeout: 15_000 },
    );
  } catch (err) {
    console.error("[security-event] failed to log", params.type, err);
  }
}

/**
 * Recent user-visible security events for the Profile → Security activity
 * feed, scoped to the caller's workspace via the strict tenant filter so one
 * workspace never sees another's events.
 */
export async function listSecurityEvents(
  userId: string,
  tenantScope: ReturnType<typeof tenantWhere>,
  limit = 20,
) {
  return prisma.securityEvent.findMany({
    where: { userId, ...tenantScope },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}
