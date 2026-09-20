import { SignJWT, jwtVerify } from "jose";

/**
 * Role-prefixed dashboard routes — /en/admin/dashboard, /id/staff/orders…
 *
 * The prefix is a *navigation scope*: it tells the app which role's workspace
 * shell to render while the canonical page components stay in place. Two
 * layers keep it honest:
 *
 *   1. Session binding — middleware resolves the prefix against the signed-in
 *      user's actual role and bounces mismatches to their own prefix, so a
 *      STAFF account cannot present itself as /admin/ by editing the URL.
 *   2. Shareable signed scope tokens — `?scope=` carries an HMAC-SHA256 JWT
 *      (same secret as the session) naming the intended role + optional
 *      tenant, so a link bookmarked or shared before login still lands in the
 *      right scope after the session exists — and cannot be forged.
 *
 * The scope never *grants* anything: page components still enforce
 * permissions via RoleGuard and every API route via requirePermission. The
 * prefix is presentation + discoverability, hard-bound to the session.
 */

/** URL segment → allowed roles (SUPERADMIN shares the admin scope). */
export const ROLE_PREFIXES = {
  admin: ["ADMIN", "SUPERADMIN"],
  manager: ["MANAGER"],
  staff: ["STAFF"],
  client: ["CLIENT"],
  enterprise: ["CLIENT_ENTERPRISE"],
} as const satisfies Record<string, readonly string[]>;

export type RolePrefix = keyof typeof ROLE_PREFIXES;

const PREFIX_ALIASES: Record<string, RolePrefix> = {
  admin: "admin",
  superadmin: "admin",
  manager: "manager",
  staff: "staff",
  client: "client",
  enterprise: "enterprise",
};

import type { Role } from "@/lib/permissions";

/** Normalized role → its URL prefix (SUPERADMIN shares /admin). */
export function rolePrefixForRole(role: string | null | undefined): RolePrefix {
  switch (role) {
    case "ADMIN":
    case "SUPERADMIN":
    case "SUPER_ADMIN":
      return "admin";
    case "MANAGER":
      return "manager";
    case "STAFF":
      return "staff";
    case "CLIENT_ENTERPRISE":
      return "enterprise";
    case "CLIENT":
      return "client";
    default:
      return "staff";
  }
}

/** True when the URL prefix is valid for this role (SUPERADMIN ≡ admin). */
export function prefixAllowsRole(prefix: string, role: string): boolean {
  const resolved = PREFIX_ALIASES[prefix.toLowerCase()];
  if (!resolved) return false;
  const normalized = role === "SUPER_ADMIN" ? "SUPERADMIN" : role;
  return (ROLE_PREFIXES[resolved] as readonly string[]).includes(normalized as Role);
}

function secret(): Uint8Array {
  return new TextEncoder().encode(process.env.JWT_SECRET || "dev-jwt-secret-change-in-production");
}

/**
 * Sign a short-lived shareable scope token: { role, tenant? } — the "encrypted
 * link" form. 10-minute TTL keeps leaked links nearly worthless.
 */
export async function encodeScopeToken(payload: {
  role: string;
  tenantId?: string | null;
}): Promise<string> {
  return new SignJWT({ role: payload.role, tenantId: payload.tenantId ?? undefined })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("10m")
    .setJti(crypto.randomUUID())
    .sign(secret());
}

/** Verify a scope token → { role, tenantId? } or null (invalid/expired). */
export async function verifyScopeToken(
  token: string,
): Promise<{ role: string; tenantId?: string } | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    if (typeof payload.role !== "string") return null;
    return {
      role: payload.role,
      tenantId: typeof payload.tenantId === "string" ? payload.tenantId : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Match `/{locale}/{prefix}/{rest}` — locale kept verbatim so middleware can
 * rebuild the canonical path without re-deriving it.
 */
export function splitRolePrefixedPath(
  pathname: string,
): { locale: string; prefix: string; rest: string } | null {
  const match = pathname.match(
    /^\/([a-z]{2}(?:-\w{2})?)\/(admin|manager|staff|client|enterprise)(\/.*)?$/,
  );
  if (!match) return null;
  return { locale: match[1], prefix: match[2], rest: match[3] ?? "" };
}

/**
 * Build a role-prefixed app URL — `roleHref("en", "dashboard", "ADMIN")`
 * → "/en/admin/dashboard". Client-safe (no node APIs), used by nav shells to
 * land users in their own scope.
 */
export function roleHref(locale: string, path: string, role: string | null): string {
  const clean = path.startsWith("/") ? path.slice(1) : path;
  return `/${locale}/${rolePrefixForRole(role)}/${clean}`;
}
