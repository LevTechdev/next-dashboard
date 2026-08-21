import { NextResponse } from "next/server";
import { REFRESH_COOKIE, getTokenFromCookie, verifyToken } from "@/lib/auth";
import { getFamilyForToken, revokeFamily } from "@/lib/refresh-tokens";
import { clearAuthCookies } from "@/lib/auth-cookies";
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

export async function POST(req: Request) {
  // Revoke the refresh-token family (and its session) so the tokens can't be reused.
  const raw = readRefreshCookie(req);
  const familyId = await getFamilyForToken(raw);
  if (familyId) await revokeFamily(familyId);

  // Best-effort actor for the audit log.
  const access = getTokenFromCookie(req);
  const decoded = access ? verifyToken(access) : null;
  if (decoded)
    await logSecurityEvent({ userId: decoded.id, type: "LOGOUT", req, tenantId: decoded.tenantId });

  const response = NextResponse.json({ success: true, message: "Logged out successfully" });
  clearAuthCookies(response);
  return response;
}
