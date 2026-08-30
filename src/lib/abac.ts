import "server-only";
import type { Role } from "@/lib/permissions";
import { getClientIp } from "@/lib/request-meta";

/**
 * Attribute-Based Access Control layer that composes on top of RBAC.
 * RBAC answers "can this role do this action on this resource type?"; ABAC adds
 * contextual conditions (ownership, tenant, time-of-day, source IP).
 */
export interface AbacContext {
  role: Role;
  userId: string;
  tenantId: string | null;
  ip: string;
  now: Date;
}

/** Context-only rule (no target row) — used at the guard layer. */
export type AbacRule = (ctx: AbacContext) => boolean;

export function buildAbacContext(params: {
  role: Role;
  userId: string;
  req?: Request;
  tenantId?: string | null;
}): AbacContext {
  return {
    role: params.role,
    userId: params.userId,
    tenantId: params.tenantId ?? null,
    ip: params.req ? getClientIp(params.req) : "unknown",
    now: new Date(),
  };
}

// ── Context-only rules ───────────────────────────────────────────────
/** Restrict an action to a window of hours [start, end) in server local time. */
export const withinHours =
  (startHour: number, endHour: number): AbacRule =>
  (ctx) => {
    const h = ctx.now.getHours();
    return h >= startHour && h < endHour;
  };

/** Require the caller's IP to be in an allowlist (empty allowlist = allow all). */
export const ipInAllowlist =
  (allow: string[]): AbacRule =>
  (ctx) =>
    allow.length === 0 || allow.includes(ctx.ip);

/** Require one of the given roles (finer than the RBAC matrix when needed). */
export const roleIn =
  (...roles: Role[]): AbacRule =>
  (ctx) =>
    roles.includes(ctx.role);

export const allOf =
  (...rules: AbacRule[]): AbacRule =>
  (ctx) =>
    rules.every((r) => r(ctx));

export const anyOf =
  (...rules: AbacRule[]): AbacRule =>
  (ctx) =>
    rules.some((r) => r(ctx));

/** Safe evaluation — a throwing rule denies rather than crashes. */
export function evaluateRule(rule: AbacRule, ctx: AbacContext): boolean {
  try {
    return rule(ctx);
  } catch {
    return false;
  }
}

// ── Resource-bound checks (BOLA/IDOR + tenant isolation) ──────────────
/** Object-level ownership check for /[id] routes. SUPER_ADMIN bypasses. */
export function ownsResource(
  ctx: AbacContext,
  row: { userId?: string | null } | null | undefined,
): boolean {
  if (ctx.role === "SUPER_ADMIN") return true;
  return !!row && row.userId === ctx.userId;
}

/**
 * Tenant isolation check. No-op until app-layer tenancy is enabled
 * (ctx.tenantId null), then enforces row.tenantId === ctx.tenantId.
 */
export function resourceInTenant(
  ctx: AbacContext,
  row: { tenantId?: string | null } | null | undefined,
): boolean {
  if (ctx.role === "SUPER_ADMIN") return true;
  if (!ctx.tenantId) return true;
  return !!row && row.tenantId === ctx.tenantId;
}
