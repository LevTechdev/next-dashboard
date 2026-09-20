import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/db";
import { getClientIp } from "@/lib/request-meta";

/**
 * Sandboxed /v1 API — API-key authentication.
 *
 * Keys are the same `dash_…` secrets minted by Integrations → API Keys
 * (SHA-256-hashed at rest; the raw value is shown exactly once at creation).
 * The v1 routes are a read-only sandbox: v1 auth never accepts cookie/Bearer
 * JWT session tokens, so a key can never escalate to dashboard identity, and
 * the surface is rate-limited per key.
 */

export type ApiKeyScope = "read" | "write" | "admin";

export type V1AuthResult =
  | {
      ok: true;
      keyId: string;
      keyName: string;
      scopes: ApiKeyScope[];
      userId: string | null;
      tenantId: string | null;
      rateRemaining: number;
    }
  | { ok: false; status: 401 | 403 | 429; error: string; hint?: string };

/** Sandbox ceiling — generous for testing, tight enough to stop hammering. */
const RATE_LIMIT_MAX = 60;
const RATE_LIMIT_WINDOW_MS = 60_000;

// Best-effort in-memory limiter (per dev-server instance). Good enough for a
// sandbox; production would front this with a shared store.
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

function rateLimit(keyId: string): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const bucket = rateBuckets.get(keyId);
  if (!bucket || bucket.resetAt <= now) {
    const fresh = { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS };
    rateBuckets.set(keyId, fresh);
    if (rateBuckets.size > 1000) {
      // Opportunistic sweep so the map can't grow unbounded.
      for (const [k, v] of rateBuckets) if (v.resetAt <= now) rateBuckets.delete(k);
    }
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1, resetAt: fresh.resetAt };
  }
  bucket.count += 1;
  return {
    allowed: bucket.count <= RATE_LIMIT_MAX,
    remaining: Math.max(0, RATE_LIMIT_MAX - bucket.count),
    resetAt: bucket.resetAt,
  };
}

export function hashApiKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/** Timing-safe comparison of two hex digests. */
function digestsEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Extract the API key from `Authorization: Bearer dash_…`. */
export function extractApiKey(req: Request): string | null {
  const header = req.headers.get("authorization") ?? "";
  if (!header.toLowerCase().startsWith("bearer ")) return null;
  const token = header.slice(7).trim();
  return token.startsWith("dash_") ? token : null;
}

/**
 * Authenticate a v1 request by API key. Enforces, in order:
 * key present → known hash → ACTIVE → not expired → IP allowlist → rate limit.
 * Scope enforcement is separate (`requireScope`) so routes can pick per action.
 */
export async function authenticateApiKey(req: Request): Promise<V1AuthResult> {
  const raw = extractApiKey(req);
  if (!raw) {
    return {
      ok: false,
      status: 401,
      error: "missing_api_key",
      hint: "Send `Authorization: Bearer dash_…` — keys are minted in Integrations → API Keys.",
    };
  }

  const key = await prisma.apiKey.findUnique({ where: { key: hashApiKey(raw) } });
  if (!key) {
    return { ok: false, status: 401, error: "invalid_api_key" };
  }

  if (key.status !== "ACTIVE") {
    return {
      ok: false,
      status: 401,
      error: "key_revoked",
      hint: `This key is ${key.status}. Create a new one in Integrations → API Keys.`,
    };
  }

  if (key.expiresAt && key.expiresAt.getTime() <= Date.now()) {
    return {
      ok: false,
      status: 401,
      error: "key_expired",
      hint: `This key expired ${key.expiresAt.toISOString()}.`,
    };
  }

  const clientIp = getClientIp(req);
  if (key.ipAllowlist.length > 0) {
    const allowed = key.ipAllowlist.some((entry) => ipMatches(entry, clientIp));
    if (!allowed) {
      return {
        ok: false,
        status: 403,
        error: "ip_not_allowed",
        hint: `Key is restricted to: ${key.ipAllowlist.join(", ")}. Request came from ${clientIp}.`,
      };
    }
  }

  const limit = rateLimit(key.id);
  if (!limit.allowed) {
    const retryAfter = Math.ceil((limit.resetAt - Date.now()) / 1000);
    return {
      ok: false,
      status: 429,
      error: "rate_limited",
      hint: `Sandbox limit is ${RATE_LIMIT_MAX} requests/minute per key. Retry after ~${retryAfter}s.`,
    };
  }

  // Best-effort "last used" stamp — never blocks the request.
  try {
    const now = new Date();
    await prisma.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: now } });
  } catch {
    // Ignore.
  }

  const scopes = key.permissions
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is ApiKeyScope => s === "read" || s === "write" || s === "admin");

  return {
    ok: true,
    keyId: key.id,
    keyName: key.name,
    scopes: scopes.length > 0 ? scopes : ["read"],
    userId: key.userId,
    tenantId: null,
    rateRemaining: limit.remaining,
  };
}

/** Read-scoped sandbox: v1 mutations are out of scope by design. */
export function requireReadScope(
  auth: Extract<V1AuthResult, { ok: true }>,
): { ok: true } | { ok: false; status: 403; error: string; hint: string } {
  if (auth.scopes.includes("read")) return { ok: true };
  return {
    ok: false,
    status: 403,
    error: "insufficient_scope",
    hint: `Key "${auth.keyName}" has scopes [${auth.scopes.join(", ")}] — sandbox reads need "read".`,
  };
}

/** Generate a fresh key triple — same shape as Integrations → API Keys. */
export function generateApiKey(): { key: string; prefix: string; hashedKey: string } {
  const raw = randomBytes(32).toString("hex");
  return {
    key: `dash_${raw}`,
    prefix: `dash_${raw.slice(0, 8)}...`,
    hashedKey: hashApiKey(`dash_${raw}`),
  };
}

/** Minimal CIDR/prefix matcher for IPv4 entries like `10.0.0.0/8` or exact IPs. */
export function ipMatches(entry: string, ip: string): boolean {
  if (!entry.includes("/")) return entry === ip;
  const [base, bitsStr] = entry.split("/");
  const bits = Number(bitsStr);
  if (!Number.isInteger(bits) || bits < 0 || bits > 32) return false;
  const toInt = (v: string) => {
    const parts = v.split(".").map(Number);
    if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255))
      return null;
    return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
  };
  const baseInt = toInt(base);
  const ipInt = toInt(ip);
  if (baseInt === null || ipInt === null) return false;
  if (bits === 0) return true;
  const mask = (0xffffffff << (32 - bits)) >>> 0;
  return (baseInt & mask) === (ipInt & mask);
}

/** Re-export so routes can reject disallowed methods with a consistent body. */
export function methodNotAllowed(allowed: string[]): Response {
  return new Response(JSON.stringify({ error: "method_not_allowed", allowed }), {
    status: 405,
    headers: { "Content-Type": "application/json", Allow: allowed.join(", ") },
  });
}

/**
 * Workspace of the key's owner. Keys carry no tenant claim of their own —
 * they belong to a user, and the user belongs to a workspace. Key owners
 * without a workspace see only null-tenant rows (strict isolation).
 */
export async function resolveTenantIdForAuth(
  auth: Extract<V1AuthResult, { ok: true }>,
): Promise<string | null> {
  if (!auth.userId) return null;
  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { tenantId: true },
  });
  return user?.tenantId ?? null;
}

/** Success JSON envelope with rate-limit telemetry headers. */
export function v1Json(data: unknown, rateRemaining?: number): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      ...(rateRemaining !== undefined ? { "X-RateLimit-Remaining": String(rateRemaining) } : {}),
    },
  });
}

/** Standard v1 error response with JSON envelope. */
export function v1Error(status: number, error: string, hint?: string): Response {
  return new Response(JSON.stringify({ error, ...(hint ? { hint } : {}) }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
