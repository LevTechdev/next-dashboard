"use client";

/**
 * Client-side access-token refresh integration for Phase 2 rotation.
 *
 * Access tokens are short-lived (15m); the refresh token rotates. To keep the
 * existing app (which fetches many protected /api routes directly) working
 * without rewriting every call site, we install a guarded wrapper around
 * window.fetch that, on a 401 from a same-origin GET /api request, silently
 * calls /api/auth/refresh once and retries. A single-flight guard dedupes
 * concurrent refreshes; auth endpoints are never intercepted (no loops).
 */

let installed = false;
let inFlight: Promise<boolean> | null = null;
let nativeFetch: typeof fetch;

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

/** Single-flight refresh: at most one /api/auth/refresh in flight at a time. */
export function refreshAccessToken(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  const doFetch = nativeFetch || window.fetch.bind(window);
  if (!inFlight) {
    inFlight = doFetch("/api/auth/refresh", { method: "POST", credentials: "same-origin" })
      .then((r) => r.ok)
      .catch(() => false)
      .finally(() => {
        inFlight = null;
      });
  }
  return inFlight;
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

    const res = await nativeFetch(input as RequestInfo, init);

    // Only auto-recover idempotent GETs (retrying a consumed request body is unsafe).
    if (res.status !== 401 || method !== "GET" || !isSameOriginApi(url) || isAuthEndpoint(url)) {
      return res;
    }

    const refreshed = await refreshAccessToken();
    if (!refreshed) return res;
    return nativeFetch(input as RequestInfo, init);
  };
}
