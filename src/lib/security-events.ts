import "server-only";
import { prisma } from "@/lib/db";
import { getRequestMeta } from "@/lib/request-meta";
import { computeHash, GENESIS_HASH } from "@/lib/audit-chain";
import { forwardToSiem } from "@/lib/siem";
import { resolveUserTenantId, tenantWhere } from "@/lib/tenancy";

export type SecurityEventType =
  | "SIGNIN_ALERT_SENT"
  | "SIGNIN_ALERT_SUPPRESSED"
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
  | "REFRESH_REUSE_GRACE"
  | "STEP_UP_VERIFIED"
  | "MFA_VERIFIED"
  /** A TOTP code was presented a second time inside its own time step
   *  (RFC 6238 §5.2 replay guard, src/lib/totp-replay.ts). */
  | "MFA_CODE_REPLAYED"
  | "EMAIL_VERIFIED"
  | "EMAIL_DELIVERY_SENT"
  | "EMAIL_DELIVERY_FAILED"
  | "PASSKEY_ADDED"
  | "PASSKEY_REMOVED"
  | "PASSKEY_LOGIN"
  /** A second enrolled authenticator app (spare device) added or removed. */
  | "BACKUP_AUTHENTICATOR_ADDED"
  | "BACKUP_AUTHENTICATOR_REMOVED"
  /** The "2FA was turned off" alert email, and the "this wasn't me" revoke. */
  | "SECURITY_ALERT_SENT"
  | "SECURITY_ALERT_REVERTED"
  | "TRUSTED_DEVICE_REVOKED"
  /** The account's recovery readiness moved DOWN the ladder (covered →
   *  fragile → locked out) — recorded the day the daily sweep noticed it. */
  | "RECOVERY_READINESS_DROPPED"
  /** Last-resort recovery (authenticator AND backup codes lost). */
  | "ACCOUNT_RECOVERY_REQUESTED"
  | "ACCOUNT_RECOVERY_COMPLETED"
  | "SAML_LOGIN"
  /** The user accepted the dashboard's stay-login alert (or asked at login):
   *  a durable stayLoginUntil grant was stamped on their refresh-token family. */
  | "STAY_LOGIN_GRANTED"
  | "APIKEY_CREATED"
  | "ACCOUNT_LOCKED"
  | "ACCOUNT_DELETED"
  | "SSO_CONNECTION_DELETED"
  /** Rate-limit rejections from src/lib/rate-limit.ts (per-IP sliding window). */
  | "RATE_LIMITED";

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
    // Tenant attribution: a non-null tenantId wins; otherwise a per-user
    // event resolves the workspace from the actor. `check:audit-chain`
    // fails on any HASHED row without a tenant, so an unattributed write
    // here would take the release gate down — resolve centrally instead of
    // trusting every call site to remember.
    //
    // Nullish (undefined OR null) resolves from the actor on purpose: call
    // sites routinely forward `session.user.tenantId ?? null`, and treating
    // that explicit null as "no workspace" silently dropped attribution for
    // whole event families (e.g. EMAIL_DELIVERY_*).
    const tenantId = params.tenantId ?? (await resolveUserTenantId(params.userId));
    const event = {
      userId: params.userId,
      type: params.type,
      ip: meta?.ip ?? null,
      userAgent: meta?.userAgent ?? null,
      metadata: params.metadata ?? null,
      tenantId,
      createdAt,
    };

    if (isPgBouncer) {
      // pgbouncer transaction-mode: advisory locks and interactive transactions
      // are unsupported. Fall back to sequential queries (best-effort ordering
      // — the hash chain may have gaps under heavy concurrency but the
      // `repair:audit-chain` script can restore it).
      const last = await prisma.securityEvent.findFirst({
        where: { hash: { not: null } },
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
          // ONLY the newest *hashed* row can be a link target. Rows written
          // outside this helper (legacy imports) carry `hash = null`; linking
          // to one would set `prevHash = GENESIS`, permanently breaking the
          // chain for every subsequent event.
          where: { hash: { not: null } },
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
