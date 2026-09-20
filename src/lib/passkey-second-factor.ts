import { SignJWT, jwtVerify } from "jose";

/**
 * Second-factor passkey marker.
 *
 * When a 2FA user authenticates with a passkey from the verification-method
 * chooser, the WebAuthn ceremony runs against
 * /api/auth/webauthn/authenticate/verify in `second_factor` mode: the
 * assertion is cryptographically verified there (against the stored public
 * key + counter), but NO session is issued — the password step already
 * happened in the browser and the login route still has to run. This module
 * bridges the two: a short-lived, single-use, signed marker (JWT in an
 * httpOnly cookie) that the login route verifies and consumes server-side.
 *
 * The audience claim binds the marker to the login endpoint, so a marker can
 * never be replayed as a session cookie.
 */

export const PASSKEY_2FA_COOKIE = "passkey_2fa";
/** Marker TTL: the login POST happens immediately after the ceremony. */
export const PASSKEY_2FA_TTL_SECONDS = 120;

function secret(): Uint8Array {
  return new TextEncoder().encode(process.env.JWT_SECRET || "dev-jwt-secret-change-in-production");
}

export async function issueSecondFactorMarker(userId: string): Promise<string> {
  return new SignJWT({ sub: userId, aud: "login-2fa" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${PASSKEY_2FA_TTL_SECONDS}s`)
    .setJti(crypto.randomUUID())
    .sign(secret());
}

export type MarkerResult = { ok: true; userId: string } | { ok: false; error: string };

/** Verify the marker cookie and return its subject; no consumption (stateless). */
export async function verifySecondFactorMarker(req: Request): Promise<MarkerResult> {
  const token = readMarkerCookie(req);
  if (!token) return { ok: false, error: "PASSKEY_MARKER_MISSING" };
  try {
    const { payload } = await jwtVerify(token, secret(), { audience: "login-2fa" });
    const userId = String(payload.sub ?? "");
    if (!userId) return { ok: false, error: "PASSKEY_MARKER_INVALID" };
    return { ok: true, userId };
  } catch {
    return { ok: false, error: "PASSKEY_MARKER_EXPIRED" };
  }
}

/** Convenience for the login route: verify + check the subject matches. */
export async function consumeSecondFactorMarker(
  req: Request,
  userId: string,
): Promise<MarkerResult> {
  const marker = await verifySecondFactorMarker(req);
  if (!marker.ok) return marker;
  if (marker.userId !== userId) return { ok: false, error: "PASSKEY_MARKER_INVALID" };
  return marker;
}

export function readMarkerCookie(req: Request): string | null {
  const cookie = req.headers.get("cookie") || "";
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${PASSKEY_2FA_COOKIE}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function markerCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    maxAge: PASSKEY_2FA_TTL_SECONDS,
    path: "/",
  };
}
