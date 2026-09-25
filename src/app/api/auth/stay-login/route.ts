import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api-guard";
import { REFRESH_COOKIE } from "@/lib/auth";
import { getFamilyForToken, STAY_LOGIN_GRANT_MS } from "@/lib/refresh-tokens";
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

function stayCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true as const,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

/**
 * Durable "stay signed in" grant.
 *
 * The dashboard's stay-login sentinel used to keep its extension ONLY in
 * localStorage — any redirect, site-data wipe, or second account on the same
 * browser silently ended it, and the user was signed out despite having
 * clicked "Stay signed in". The grant now lives where the session itself
 * lives: `stayLoginUntil` on the refresh-token family.
 *
 *   POST — record the grant on the caller's current family for
 *          STAY_LOGIN_GRANT_MS (7 days) and mirror it in a short stay cookie
 *          (client-readable by design; it is a UX hint, not a credential —
 *          possession of the refresh cookie is what authenticates).
 *   GET  — report whether the caller's family currently holds a live grant
 *          (used by the sentinel on mount and before any sign-out).
 *   DELETE — revoke the grant explicitly (future settings surface).
 *
 * A family-level grant is exactly right for scope: one grant per device, it
 * dies with the family (logout, theft revocation, password change), and it
 * never outlives a refresh token that can still use it.
 */

export async function POST(req: Request) {
  const { session, response } = await requireAuth(req);
  if (response) return response;

  const familyId = await getFamilyForToken(readRefreshCookie(req));
  if (!familyId) {
    return NextResponse.json({ error: "No active session family" }, { status: 409 });
  }

  const until = new Date(Date.now() + STAY_LOGIN_GRANT_MS);
  await prisma.refreshToken.updateMany({
    where: { familyId, revokedAt: null },
    data: { stayLoginUntil: until },
  });
  await logSecurityEvent({
    userId: session.user.id,
    type: "STAY_LOGIN_GRANTED",
    req,
    metadata: { familyId, until: until.toISOString() },
  });

  const res = NextResponse.json({ success: true, until: until.toISOString() });
  // Seven days matches the grant so the cookie never outlives it.
  res.cookies.set("stay_login", "1", stayCookieOptions(Math.floor(STAY_LOGIN_GRANT_MS / 1000)));
  return res;
}

export async function GET(req: Request) {
  const { response } = await requireAuth(req);
  if (response) return response;

  const familyId = await getFamilyForToken(readRefreshCookie(req));
  if (!familyId) {
    return NextResponse.json({ granted: false, until: null });
  }

  const live = await prisma.refreshToken.findFirst({
    where: { familyId, revokedAt: null, stayLoginUntil: { gt: new Date() } },
    select: { stayLoginUntil: true },
    orderBy: { stayLoginUntil: "desc" },
  });

  return NextResponse.json({
    granted: Boolean(live),
    until: live?.stayLoginUntil?.toISOString() ?? null,
  });
}

export async function DELETE(req: Request) {
  const { response } = await requireAuth(req);
  if (response) return response;

  const familyId = await getFamilyForToken(readRefreshCookie(req));
  if (familyId) {
    await prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { stayLoginUntil: null },
    });
  }
  const res = NextResponse.json({ success: true });
  res.cookies.set("stay_login", "", stayCookieOptions(0));
  return res;
}
