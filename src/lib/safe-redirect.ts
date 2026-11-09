const FALLBACK_ORIGIN = "https://app.local";

/**
 * Resolve a post-login destination without ever leaving the app origin.
 *
 * The login form accepts `?redirect=` from the middleware so a protected URL
 * can be restored after authentication. That value is attacker-controlled, so
 * it must never reach `router.push()` unchecked: an absolute URL or a
 * protocol-relative path would otherwise turn a login link into an open
 * redirect. Only root-relative, same-origin paths are returned.
 */
export function safeRedirectPath(raw: string | null | undefined, fallback: string): string {
  const safeFallback =
    fallback.startsWith("/") && !fallback.startsWith("//") && !fallback.startsWith("/\\")
      ? fallback
      : "/";

  if (!raw) return safeFallback;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) {
    return safeFallback;
  }

  let url: URL;
  try {
    // A fixed origin makes protocol-relative and absolute inputs observable
    // instead of accidentally treating them as app paths.
    url = new URL(raw, FALLBACK_ORIGIN);
  } catch {
    return safeFallback;
  }

  if (url.origin !== FALLBACK_ORIGIN) return safeFallback;
  if (hasUnsafePathEncoding(url.pathname)) return safeFallback;

  return `${url.pathname}${url.search}${url.hash}`;
}

/**
 * Some routers decode path segments after navigation. Reject encoded slash or
 * backslash sequences before they can turn a root-relative path into `//host`
 * or `/\host`.
 */
function hasUnsafePathEncoding(pathname: string): boolean {
  let decoded = pathname;

  for (let depth = 0; depth < 4; depth += 1) {
    if (decoded.startsWith("//") || decoded.includes("\\")) return true;
    if (!/%[0-9a-f]{2}/i.test(decoded)) return false;

    try {
      decoded = decodeURIComponent(decoded);
    } catch {
      return true;
    }
  }

  return true;
}
