import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { signToken, REFRESH_COOKIE, type AuthUser } from "@/lib/auth";
import { rotateRefreshToken, revokeFamily } from "@/lib/refresh-tokens";
import { rotateSessionAccessToken } from "@/lib/sessions";
import { setAuthCookies, clearAuthCookies } from "@/lib/auth-cookies";
import { logSecurityEvent } from "@/lib/security-events";

export const dynamic = "force-dynamic";

function readRefreshCookie(req: Request): string | undefined {
  const cookie = req.headers.get("cookie");
  if (!cookie) return undefined;
  for (const c of cookie.split(";").map((s) => s.trim())) {
    if (c.startsWith(`${REFRESH_COOKIE}=`)) return c.slice(REFRESH_COOKIE.length + 1);
  }
  return undefined;
}

/**
 * POST /api/auth/refresh — rotate the refresh token and mint a new short-lived
 * access token. Reuse of a consumed token revokes the whole family.
 */
export async function POST(req: Request) {
  const raw = readRefreshCookie(req);
  const result = await rotateRefreshToken(raw);

  if (result.status === "reuse") {
    await logSecurityEvent({
      userId: result.userId,
      type: "REFRESH_REUSE",
      req,
      metadata: { familyId: result.familyId },
    });
    const res = NextResponse.json({ error: "Refresh token reuse detected" }, { status: 401 });
    clearAuthCookies(res);
    return res;
  }

  if (result.status === "invalid") {
    const res = NextResponse.json({ error: "Invalid or expired refresh token" }, { status: 401 });
    clearAuthCookies(res);
    return res;
  }

  const user = await prisma.user.findUnique({ where: { id: result.userId } });
  if (!user || !user.isActive) {
    await revokeFamily(result.familyId);
    const res = NextResponse.json({ error: "Account unavailable" }, { status: 401 });
    clearAuthCookies(res);
    return res;
  }

  const authUser: AuthUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    tenantId: user.tenantId,
  };
  const accessToken = signToken(authUser);

  // Point the session at the new access token (keeps revocation coherent).
  await rotateSessionAccessToken(result.familyId, accessToken);

  const res = NextResponse.json({ success: true });
  setAuthCookies(res, accessToken, result.token);
  return res;
}
