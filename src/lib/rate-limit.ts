import { prisma } from "@/lib/db";
import { logSecurityEvent } from "@/lib/security-events";

/**
 * Sliding-window rate limiting for auth endpoints.
 *
 * Rows live in the SecurityEvent table (type "RATE_LIMITED") — no new Prisma
 * model or migration. Each attempt writes one row; the limiter counts rows
 * inside the window and, once over the limit, keeps recording the rejection
 * (so hammering cannot bypass by refilling the window) until the window
 * slides past.
 *
 * Window state is durable across deploys/instances; the cost is one indexed
 * query per login attempt, which is exactly where you want to spend it.
 */

const SECURITY_TYPE = "RATE_LIMITED";

/** Production budget: 10 login attempts per IP per window. */
export const LOGIN_THROTTLE_DEFAULT = 10;

/**
 * The per-IP login attempt budget for this process.
 *
 * Production is ALWAYS {@link LOGIN_THROTTLE_DEFAULT}. The E2E runner and the
 * CI E2E job raise it through `E2E_LOGIN_THROTTLE_LIMIT`, because the whole auth
 * suite signs in dozens of times from one IP: at 10/120s the specs contend for
 * the same sliding window, `waitForLoginThrottleWindow` sleeps ~2 minutes
 * mid-test, and a previously green suite goes red at random with a different
 * test failing each run.
 *
 * The override is ignored when `NODE_ENV === "production"`, so a stray env var
 * on a live deployment can never weaken the limiter.
 */
export function loginThrottleLimit(): number {
  if (process.env.NODE_ENV === "production") return LOGIN_THROTTLE_DEFAULT;
  const parsed = Number.parseInt(process.env.E2E_LOGIN_THROTTLE_LIMIT ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : LOGIN_THROTTLE_DEFAULT;
}

/**
 * Header the E2E suite uses to pin a SINGLE spec's window to a known budget.
 *
 * The suite-wide `E2E_LOGIN_THROTTLE_LIMIT` (500) exists so dozens of auth
 * specs can sign in from one IP, but it also means a spec that PROVES the
 * limiter (the Security Center burst tests: fill the window, expect 429s, read
 * "used of limit" off the telemetry gauge) can never reach the limit in CI —
 * it was quarantined for exactly that. This header lets such a spec ask for the
 * production budget for its own requests only, from its own spoofed IP.
 *
 * Safety: honoured ONLY when `NODE_ENV !== "production"` — a live deployment
 * ignores it outright, exactly like the env override above. The value must be a
 * positive integer, so a malformed header falls back to the real limit instead
 * of disabling throttling.
 */
export function requestThrottleLimitOverride(req: Request): number | null {
  if (process.env.NODE_ENV === "production") return null;
  const raw = req.headers.get("x-e2e-throttle-limit");
  if (!raw) return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export interface RateLimitResult {
  allowed: boolean;
  /** Attempts recorded inside the current window (including rejections). */
  attempts: number;
  limit: number;
  /** Seconds until the oldest attempt exits the window (only when blocked). */
  retryAfterSeconds: number;
}

function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

/**
 * Record one attempt and decide whether the caller may proceed.
 * Call BEFORE expensive work (password hashing), then bail with 429 when
 * blocked. `keySuffix` distinguishes limits on the same endpoint.
 */
export async function checkLoginRateLimit(
  req: Request,
  opts?: { limit?: number; windowSeconds?: number; email?: string },
): Promise<RateLimitResult> {
  const limit = opts?.limit ?? 10;
  const windowSeconds = opts?.windowSeconds ?? 120;
  const since = new Date(Date.now() - windowSeconds * 1000);
  const ip = clientIp(req);

  const where = {
    type: SECURITY_TYPE,
    createdAt: { gte: since },
    ip,
  };

  const [attempts, oldest] = await Promise.all([
    prisma.securityEvent.count({ where }),
    prisma.securityEvent.findFirst({
      where,
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    }),
  ]);

  const allowed = attempts < limit;

  // Record every attempt — accepted or rejected — so the window keeps filling
  // while an attacker hammers the endpoint (no bypass by waiting out the count).
  //
  // MUST go through logSecurityEvent: a raw `securityEvent.create` leaves
  // prevHash/hash null, and because these rows are always the newest by seq,
  // the next real event would read a null tail hash and link itself to GENESIS
  // — permanently breaking the tamper-evident chain on every throttled login.
  await logSecurityEvent({
    userId: null,
    type: SECURITY_TYPE,
    req,
    metadata: {
      endpoint: "login",
      attempt: attempts + 1,
      limit,
      // Persist the window so the Security Center telemetry card can show
      // live pressure (used / limit, retry-after) without hardcoding it.
      windowSeconds,
      blocked: !allowed,
      ...(opts?.email ? { email: opts.email } : {}),
    },
  });

  return {
    allowed,
    attempts: attempts + 1,
    limit,
    retryAfterSeconds: oldest
      ? Math.max(
          1,
          Math.ceil((oldest.createdAt.getTime() + windowSeconds * 1000 - Date.now()) / 1000),
        )
      : windowSeconds,
  };
}
