import "server-only";

/** Relying Party config for WebAuthn / FIDO2 passkeys. */
export const RP_NAME = "Dashboard";
export const REG_CHALLENGE_COOKIE = "wa_reg_chal";
export const AUTH_CHALLENGE_COOKIE = "wa_auth_chal";
export const CHALLENGE_TTL = 5 * 60; // seconds

/** rpID must be a registrable suffix of the origin host (hostname without port). */
export function getRpID(req: Request): string {
  const host = req.headers.get("host") || "localhost";
  return host.split(":")[0];
}

/** The exact browser origin, used as expectedOrigin during verification. */
export function getExpectedOrigin(req: Request): string {
  const origin = req.headers.get("origin");
  if (origin) return origin;
  const host = req.headers.get("host") || "localhost";
  const proto = (req.headers.get("x-forwarded-proto") || "http").split(",")[0];
  return `${proto}://${host}`;
}

/** Read a short-lived challenge cookie set during the options step. */
export function readChallengeCookie(req: Request, name: string): string | undefined {
  const cookie = req.headers.get("cookie");
  if (!cookie) return undefined;
  for (const c of cookie.split(";").map((s) => s.trim())) {
    if (c.startsWith(`${name}=`)) return decodeURIComponent(c.slice(name.length + 1));
  }
  return undefined;
}

/** Cookie options for the httpOnly challenge cookie. */
export function challengeCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    maxAge: CHALLENGE_TTL,
    path: "/",
  };
}
