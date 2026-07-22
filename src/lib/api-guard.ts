import { NextResponse } from "next/server";
import { verifyToken, getTokenFromRequest, getTokenFromCookie } from "@/lib/auth";
import type { Role } from "@/lib/permissions";

type Action = "create" | "read" | "update" | "delete";

export async function requirePermission(
  action: Action,
  resource: string,
  req?: Request
): Promise<{ role: Role | null; response: NextResponse | null }> {
  const { session, response: authResponse } = await requireAuth(req);
  if (authResponse) {
    return { role: null, response: authResponse };
  }

  return { role: session.user.role as Role, response: null };
}

export async function requireAuth(
  req?: Request
): Promise<{
  session: { user: { id: string; sub: string; name: string; email: string; role: string } };
  response: NextResponse | null;
}> {
  // Try to get token from the request or from the global context
  let token: string | null = null;

  if (req) {
    token = getTokenFromRequest(req) || getTokenFromCookie(req);
  }

  if (!token) {
    return {
      session: { user: { id: "", sub: "", name: "", email: "", role: "" } },
      response: NextResponse.json({ error: "Not authenticated" }, { status: 401 }),
    };
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return {
      session: { user: { id: "", sub: "", name: "", email: "", role: "" } },
      response: NextResponse.json({ error: "Invalid or expired token" }, { status: 401 }),
    };
  }

  return {
    session: {
      user: {
        id: decoded.id,
        sub: decoded.id,
        name: decoded.name,
        email: decoded.email,
        role: decoded.role,
      },
    },
    response: null,
  };
}
