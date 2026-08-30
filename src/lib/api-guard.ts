import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { verifyToken, getTokenFromRequest, getTokenFromCookie } from "@/lib/auth";
import { isTokenRevoked } from "@/lib/sessions";
import { can, CRUD_PERMISSIONS, type Role } from "@/lib/permissions";
import { buildAbacContext, evaluateRule, type AbacRule } from "@/lib/abac";

type Action = "create" | "read" | "update" | "delete";

type Session = {
  user: {
    id: string;
    sub: string;
    name: string;
    email: string;
    role: string;
    tenantId: string | null;
  };
};

/**
 * Authenticate, then enforce RBAC (and optional ABAC) at the API layer.
 *
 * - SUPER_ADMIN is always allowed; AUDITOR is read-only on every resource.
 * - For resources present in CRUD_PERMISSIONS, the role matrix is enforced.
 * - Unmapped resources preserve prior authenticated-only behavior (non-breaking).
 * - An optional ABAC rule (time/IP/role context) can further restrict access.
 */
export async function requirePermission(
  action: Action,
  resource: string,
  req?: Request,
  opts?: { abac?: AbacRule },
): Promise<{ role: Role | null; session?: Session; response: NextResponse | null }> {
  const { session, response: authResponse } = await requireAuth(req);
  if (authResponse) {
    return { role: null, response: authResponse };
  }

  const role = session.user.role as Role;
  const mapped = Object.prototype.hasOwnProperty.call(CRUD_PERMISSIONS, resource);

  let allowed: boolean;
  if (role === "SUPER_ADMIN") allowed = true;
  else if (role === "AUDITOR") allowed = action === "read";
  else if (mapped) allowed = can(role, action, resource);
  else allowed = true; // unmapped resource: authenticated access (unchanged)

  if (!allowed) {
    return {
      role,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  if (opts?.abac) {
    const ctx = buildAbacContext({ role, userId: session.user.id, req });
    if (!evaluateRule(opts.abac, ctx)) {
      return {
        role,
        response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      };
    }
  }

  return { role, session, response: null };
}

export async function requireAuth(req?: Request): Promise<{
  session: {
    user: {
      id: string;
      sub: string;
      name: string;
      email: string;
      role: string;
      tenantId: string | null;
    };
  };
  response: NextResponse | null;
}> {
  // Try to get token from the request or from the global context
  let token: string | null = null;

  if (req) {
    token = getTokenFromRequest(req) || getTokenFromCookie(req);
  }

  // Fallback to the request-scoped context so routes that call
  // requirePermission(action, resource) WITHOUT forwarding `req` still
  // authenticate correctly (otherwise every such mutation returns 401).
  if (!token) {
    try {
      const cookieStore = await cookies();
      token = cookieStore.get("token")?.value ?? null;
      if (!token) {
        const headerStore = await headers();
        const authHeader = headerStore.get("authorization");
        if (authHeader?.startsWith("Bearer ")) token = authHeader.slice(7);
      }
    } catch {
      // Not in a request scope — leave token null.
    }
  }

  if (!token) {
    return {
      session: { user: { id: "", sub: "", name: "", email: "", role: "", tenantId: null } },
      response: NextResponse.json({ error: "Not authenticated" }, { status: 401 }),
    };
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return {
      session: { user: { id: "", sub: "", name: "", email: "", role: "", tenantId: null } },
      response: NextResponse.json({ error: "Invalid or expired token" }, { status: 401 }),
    };
  }

  // Enforce session revocation: a token whose Session row was revoked (e.g. via
  // "revoke all other sessions") is rejected immediately. Fail-open on infra
  // errors and for legacy tokens without a Session row.
  try {
    if (await isTokenRevoked(token)) {
      return {
        session: { user: { id: "", sub: "", name: "", email: "", role: "", tenantId: null } },
        response: NextResponse.json({ error: "Session revoked" }, { status: 401 }),
      };
    }
  } catch {
    // Session store unavailable — don't lock users out over infra hiccups.
  }

  return {
    session: {
      user: {
        id: decoded.id,
        sub: decoded.id,
        name: decoded.name,
        email: decoded.email,
        role: decoded.role,
        tenantId: decoded.tenantId ?? null,
      },
    },
    response: null,
  };
}
