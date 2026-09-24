"use client";

/**
 * Client-side access-token refresh integration for Phase 2 rotation.
 *
 * Access tokens are short-lived (15m); the refresh token rotates. To keep the
 * existing app (which fetches many protected /api routes directly) working
 * without rewriting every call site, we install a guarded wrapper around
 * window.fetch that, on a 401 from a same-origin /api request, calls
 * /api/auth/refresh once: GETs then retry with the new token, unsafe methods
 * surface their original 401 (replaying a spent body is never safe). A
 * single-flight guard dedupes concurrent refreshes; auth endpoints are never
 * intercepted (no loops).
 *
 * When the rotation proves the session is gone for good (expired/revoked/
 * reused refresh token, or a disabled account), the wrapper force-closes the
 * app onto the login form — see forceLoginRedirect.
 */

let installed = false;
let nativeFetch: typeof fetch;
let csrfEnsuring: Promise<void> | null = null;

/**
 * Terminal session loss → force-close every client surface and land on the
 * login form.
 *
 * A full navigation (not router.push) is deliberate: it discards all in-memory
 * state — auth context, SSE stream, cached fetches, the stay-signed-in
 * extension — so a dead session can never linger as a half-authenticated shell
 * and no later tab-focus revalidation can adopt a different account in place.
 * Loop-guarded and skipped on the auth screens themselves.
 */
let redirectingToLogin = false;

export function forceLoginRedirect(reason: "expired" | "session-changed" = "expired"): void {
  if (typeof window === "undefined" || redirectingToLogin) return;
  const path = window.location.pathname;
  // Already on an auth screen: nothing to close, and redirecting again would
  // fight the login flow's own navigation.
  if (/\/(login|register|forgot-password|reset-password)(\/|$)/.test(path)) return;
  redirectingToLogin = true;
  try {
    // A granted "stay signed in" window must not outlive the session it
    // extended, or the next login would start in the extended rhythm.
    window.localStorage.removeItem("session_stay_signed_in");
  } catch {
    /* storage unavailable — the redirect below is what matters */
  }
  const locale = path.split("/")[1] || "en";
  window.location.assign(`/${locale}/login?reason=${reason}`);
}

/**
 * Refresh-response codes that mean the session is gone for good (as opposed to
 * "no session at all", which anonymous visitors on public pages hit all the
 * time and must not be bounced for).
 */
const TERMINAL_REFRESH_CODES = new Set(["SESSION_EXPIRED", "REFRESH_REUSE", "ACCOUNT_UNAVAILABLE"]);

/**
 * Session provenance: set the first time this JS context sees an
 * authenticated `/api/auth/me` response through the fetch wrapper (the auth
 * provider fetches it on mount and after every login).
 *
 * It enables the abort backstop below. A terminal rotation response can be
 * lost client-side — the force-close navigation itself (or any navigation)
 * aborts the in-flight fetch — while the server has already cleared the
 * cookies. Every later rotation then answers `NO_SESSION` (no cookie
 * presented), which is NOT terminal because anonymous visitors hit it all
 * the time. Without provenance that is unrecoverable: the tab still renders
 * the dashboard shell but can never re-authenticate — a zombie half-session.
 * A tab that provably HAD a session and now provably has none is exactly the
 * dead session this module exists to close out.
 */
let hadSession = false;

const CSRF_COOKIE = "csrf_token";
const CSRF_HEADER = "x-csrf-token";

function readCsrfCookie(): string | null {
  const match = document.cookie
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${CSRF_COOKIE}=`));
  return match ? decodeURIComponent(match.slice(CSRF_COOKIE.length + 1)) : null;
}

/**
 * Make sure a CSRF token cookie exists before an unsafe-method request.
 * Double-submit: the middleware requires the cookie to be echoed in the
 * X-CSRF-Token header — if the cookie is missing entirely we fetch one from
 * /api/auth/csrf (single-flight so bursts don't stampede the endpoint).
 */
function ensureCsrfToken(): Promise<void> {
  if (readCsrfCookie()) return Promise.resolve();
  if (!csrfEnsuring) {
    const doFetch = nativeFetch || window.fetch.bind(window);
    csrfEnsuring = doFetch("/api/auth/csrf", { credentials: "same-origin" })
      .then(() => undefined)
      .catch(() => undefined)
      .finally(() => {
        csrfEnsuring = null;
      });
  }
  return csrfEnsuring;
}

function isSameOriginApi(url: string): boolean {
  try {
    const u = new URL(url, window.location.origin);
    return u.origin === window.location.origin && u.pathname.startsWith("/api/");
  } catch {
    return false;
  }
}

function isAuthEndpoint(url: string): boolean {
  return (
    url.includes("/api/auth/refresh") ||
    url.includes("/api/auth/login") ||
    url.includes("/api/auth/logout") ||
    url.includes("/api/auth/register")
  );
}

/**
 * Single-flight refresh: at most one /api/auth/refresh in flight at a time.
 * The shared gate carries the HTTP status so both boolean and detailed
 * callers served by the same rotation see the real outcome — a second
 * in-flight POST would present the just-consumed refresh token and trip
 * reuse detection (family-wide revocation = surprise sign-out).
 */
let inFlight: Promise<{ ok: boolean; status: number }> | null = null;

function singleFlightRefresh(): Promise<{ ok: boolean; status: number }> {
  if (typeof window === "undefined") return Promise.resolve({ ok: false, status: 0 });
  if (!inFlight) {
    const doFetch = nativeFetch || window.fetch.bind(window);
    inFlight = (async () => {
      // This call uses nativeFetch to avoid recursing into the fetch wrapper,
      // so the double-submit CSRF header must be added explicitly — the
      // middleware rejects POSTs without it, and a missing header made EVERY
      // rotation 403 (the stay-signed-in alert then treated 403 as a hard
      // rejection and force-signed the user out instead of extending).
      await ensureCsrfToken();
      const token = readCsrfCookie();
      const res = await doFetch("/api/auth/refresh", {
        method: "POST",
        credentials: "same-origin",
        ...(token ? { headers: { [CSRF_HEADER]: token } } : {}),
      });
      if (res.status === 401) {
        // Distinguish a dead session from an anonymous request: only the
        // former force-closes the app back to the login form.
        let code: string | undefined;
        try {
          code = ((await res.clone().json()) as { code?: string }).code;
        } catch {
          /* non-JSON body — leave the caller to handle the 401 */
        }
        if (code && TERMINAL_REFRESH_CODES.has(code)) {
          forceLoginRedirect("expired");
        } else if (code === "NO_SESSION" && hadSession) {
          // Abort backstop (see `hadSession`): the terminal response that
          // should have force-closed us was lost to a navigation abort, and
          // the server already cleared the cookies. The session cookies are
          // provably gone from a tab that provably held a session — close it
          // out instead of leaving a zombie shell that polls 401 forever.
          forceLoginRedirect("expired");
        }
      }
      return { ok: res.ok, status: res.status };
    })()
      .catch(() => ({ ok: false, status: 0 }))
      .finally(() => {
        inFlight = null;
      });
  }
  return inFlight;
}

export function refreshAccessToken(): Promise<boolean> {
  return singleFlightRefresh().then((r) => r.ok);
}

/**
 * Refresh that REPORTS HTTP status — for callers that must distinguish
 * "refresh succeeded" from "refresh rejected" (the stay-signed-in alert
 * signs out only on a hard rejection). Shares the single-flight gate with
 * refreshAccessToken, so a manual "Stay signed in" rotation can never
 * overlap a poller's 401-recovery rotation.
 */
export function refreshAccessTokenDetailed(): Promise<{ ok: boolean; status: number }> {
  return singleFlightRefresh();
}

/**
 * Pre-warm the CSRF token at app start so the first mutation never pays the
 * /api/auth/csrf round-trip. Fire-and-forget: the ensureCsrfToken path inside
 * the wrapper remains the correctness backstop.
 */
export function prewarmCsrfToken(): void {
  if (typeof window === "undefined") return;
  if (readCsrfCookie()) return;
  void ensureCsrfToken();
}

/** Install the fetch wrapper once. Idempotent and browser-only. */
export function installAuthFetch(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;
  nativeFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : (input as Request).url;
    const method = (
      init?.method ||
      (typeof input === "object" && "method" in input ? (input as Request).method : "GET") ||
      "GET"
    ).toUpperCase();

    // Double-submit CSRF: unsafe methods echo the csrf_token cookie in a
    // header. If the cookie is absent (first mutation of the session), fetch
    // one first. Cross-site attackers can neither read the cookie nor set
    // the header, so the pair proves same-origin JS sent the request.
    let csrfHeaders: Record<string, string> | undefined;
    if (
      (method === "POST" || method === "PUT" || method === "PATCH" || method === "DELETE") &&
      isSameOriginApi(url)
    ) {
      await ensureCsrfToken();
      const token = readCsrfCookie();
      if (token) csrfHeaders = { [CSRF_HEADER]: token };
    }

    let res: Response;
    try {
      res = await nativeFetch(input as RequestInfo, {
        ...init,
        ...(csrfHeaders
          ? {
              headers: { ...(init?.headers as Record<string, string> | undefined), ...csrfHeaders },
            }
          : {}),
      });
    } catch (err) {
      // If the network is down or CORS fails, fetch natively throws a TypeError.
      // To prevent unhandled rejections from crashing the Next.js app or polluting
      // the console if a caller forgets a try/catch, we intercept it and return a 503.
      console.warn("[client-refresh] Network fetch failed:", err);
      return new Response(JSON.stringify({ error: "Network Error" }), {
        status: 503,
        statusText: "Service Unavailable",
        headers: { "Content-Type": "application/json" },
      });
    }

    if (res.status !== 401 || !isSameOriginApi(url) || isAuthEndpoint(url)) {
      // A 200 from /api/auth/me is the one response that proves this JS
      // context held an authenticated session — record it for the abort
      // backstop in singleFlightRefresh (see `hadSession`).
      if (res.ok && isSameOriginApi(url) && url.includes("/api/auth/me")) {
        hadSession = true;
      }
      return res;
    }

    // Any same-origin API 401 is a candidate for session death: rotate once.
    // The rotation itself force-closes the app to the login form when the
    // refresh token is gone for good (see singleFlightRefresh), so an expired
    // session can never leave the current page half-alive. GETs additionally
    // retry with the new token; unsafe methods return their original 401
    // because replaying a consumed request body is not safe.
    const refreshed = await refreshAccessToken();
    if (!refreshed || method !== "GET") return res;
    return nativeFetch(input as RequestInfo, init);
  };
}
