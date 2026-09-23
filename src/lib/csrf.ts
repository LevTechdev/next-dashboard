/**
 * CSRF defense for cookie-authenticated mutations — double-submit tokens.
 *
 * Layer 1 (double-submit, enforced in middleware): every unsafe-method /api
 * request from the browser must echo a CSRF cookie in the X-CSRF-Token
 * header. The cookie is set by /api/auth/csrf (readable by same-origin JS,
 * so the SPA can echo it) and is NOT an auth secret — an attacker on another
 * origin can neither read the cookie (SOP) nor set the header cross-site.
 * Cookie + header must match, which a cross-site attacker cannot arrange.
 *
 * Layer 2 (same-origin check): requests carrying Origin/Referer must still
 * match the serving host — belt-and-braces on top of the token pair.
 *
 * Non-browser clients (curl, cron, server-to-server webhooks) have no CSRF
 * exposure; they simply omit both headers and pass. The SAML ACS endpoint is
 * exempt (legitimate cross-site IdP form POST).
 *
 * Runs in middleware (edge runtime) — dependency-free.
 */

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/** Cookie that carries the CSRF token (set by /api/auth/csrf, JS-readable). */
export const CSRF_COOKIE_NAME = "csrf_token";

/** Header that must echo the cookie value on unsafe methods. */
export const CSRF_HEADER_NAME = "x-csrf-token";

/**
 * Routes exempt from both CSRF layers: endpoints that legitimately receive
 * cross-site browser posts (SAML ACS is a form POST from the IdP).
 */
export const CSRF_EXEMPT_PATHS = ["/api/auth/saml/acs"];

export interface OriginCheckResult {
  ok: boolean;
  /** The rejected origin, for logging. */
  origin?: string;
}

export interface CsrfCheckResult {
  ok: boolean;
  /** Why the check failed (missing-cookie / missing-header / mismatch). */
  reason?: "missing-cookie" | "missing-header" | "mismatch";
}

export function isUnsafeMethod(method: string): boolean {
  return UNSAFE_METHODS.has(method);
}

function effectiveHost(req: Request): string {
  const fwd = req.headers.get("x-forwarded-host");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("host") ?? "";
}

/** Extract just the host of the Origin (or fallback Referer) header, if any. */
function requestOriginHost(req: Request): string | null {
  const origin = req.headers.get("origin");
  if (origin) {
    try {
      return new URL(origin).host;
    } catch {
      return null;
    }
  }
  const referer = req.headers.get("referer");
  if (referer) {
    try {
      return new URL(referer).host;
    } catch {
      return null;
    }
  }
  return null;
}

/** Layer 2: same-origin check for requests that announce their origin. */
export function assertSameOrigin(req: Request, pathname?: string): OriginCheckResult {
  if (!isUnsafeMethod(req.method)) return { ok: true };

  if (pathname && CSRF_EXEMPT_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return { ok: true };
  }

  const originHost = requestOriginHost(req);
  if (originHost === null) return { ok: true }; // non-browser client

  const host = effectiveHost(req);
  if (host && originHost === host) return { ok: true };

  return { ok: false, origin: originHost };
}

/**
 * True when the request announces itself as a browser fetch (Origin or
 * Referer present). The middleware demands the double-submit pair only from
 * these — headerless callers (curl, cron, webhooks) are not CSRF subjects.
 */
export function requestIsBrowser(req: Request): boolean {
  return requestOriginHost(req) !== null;
}

/** Read the CSRF cookie value from a Cookie header (edge-safe, no deps). */
export function readCsrfCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const name = part.slice(0, eq).trim();
    if (name === CSRF_COOKIE_NAME) {
      return decodeURIComponent(part.slice(eq + 1).trim()) || null;
    }
  }
  return null;
}

/**
 * Layer 1: double-submit token pair. Both the CSRF cookie and the
 * X-CSRF-Token header must be present and identical on unsafe methods.
 */
export function assertCsrfDoubleSubmit(
  req: Request,
  opts?: { cookieToken?: string | null; pathname?: string },
): CsrfCheckResult {
  if (!isUnsafeMethod(req.method)) return { ok: true };

  const pathname = opts?.pathname;
  if (pathname && CSRF_EXEMPT_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return { ok: true };
  }

  const cookieToken =
    opts?.cookieToken !== undefined ? opts.cookieToken : readCsrfCookie(req.headers.get("cookie"));
  if (!cookieToken) return { ok: false, reason: "missing-cookie" };

  const headerToken = req.headers.get(CSRF_HEADER_NAME)?.trim() || null;
  if (!headerToken) return { ok: false, reason: "missing-header" };

  if (cookieToken !== headerToken) return { ok: false, reason: "mismatch" };

  return { ok: true };
}

/** Cryptographically random, URL-safe CSRF token (32 bytes ≈ 43 chars). */
export function generateCsrfToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
