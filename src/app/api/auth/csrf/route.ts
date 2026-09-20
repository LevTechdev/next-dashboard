import { NextResponse } from "next/server";
import { CSRF_COOKIE_NAME, generateCsrfToken } from "@/lib/csrf";

export const dynamic = "force-dynamic";

/**
 * GET /api/auth/csrf — issue a double-submit CSRF token.
 *
 * Sets a JS-readable (not httpOnly) `csrf_token` cookie and returns the same
 * value in the body so SPA code can either read the cookie or use the JSON
 * response. The middleware requires the pair (cookie + X-CSRF-Token header)
 * to match on every unsafe-method /api request.
 *
 * Security properties: the token is NOT an auth secret — it works precisely
 * because a cross-site attacker can neither read our cookie (same-origin
 * policy) nor set our header. Regenerated per issue; rotating it is safe
 * because clients re-fetch before mutations.
 */
export async function GET() {
  const token = generateCsrfToken();
  const res = NextResponse.json({ csrfToken: token });
  res.cookies.set(CSRF_COOKIE_NAME, token, {
    httpOnly: false, // must be readable by the SPA to echo in the header
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12, // 12h — client refreshes it opportunistically
  });
  return res;
}
