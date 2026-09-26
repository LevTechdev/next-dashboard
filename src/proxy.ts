import { NextRequest, NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";
import { jwtVerify } from "jose";
import { routing } from "./i18n/routing";
import { canAccessPage, type Role } from "@/lib/permissions";
import {
  prefixAllowsRole,
  rolePrefixForRole,
  splitRolePrefixedPath,
  verifyScopeToken,
  type RolePrefix,
} from "@/lib/role-routes";
import { MARKETING_PATHS, AUTH_PATHS, EXTRA_PUBLIC_PATHS } from "@/lib/site-config";
import {
  assertSameOrigin,
  assertCsrfDoubleSubmit,
  requestIsBrowser,
  CSRF_EXEMPT_PATHS,
} from "@/lib/csrf";

const intlMiddleware = createMiddleware(routing);

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "dev-jwt-secret-change-in-production",
);

// Public marketing routes — derived from MARKETING_PATHS (site-config.ts), the
// same list that feeds the sitemap, so the proxy and sitemap can never drift
// apart when a page is added or removed.
const publicRoutes = [
  "/",
  ...MARKETING_PATHS.filter((p) => p !== ""),
  ...AUTH_PATHS,
  // Transactional checkout flow + PWA fallback page (the latter must be
  // reachable without a session). Declared in site-config so the route-registry
  // guard test shares the same list.
  ...EXTRA_PUBLIC_PATHS,
];

// Content-Security-Policy shipped in Report-Only mode first so it never blocks
// rendering; flip the header name to "Content-Security-Policy" to enforce once
// the report endpoint shows no violations.
const CSP = [
  "default-src 'self'",
  "img-src 'self' data: https:",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://app.midtrans.com https://app.sandbox.midtrans.com",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "connect-src 'self' https:",
  // snap.js renders the Midtrans payment iframe in-page.
  "frame-src 'self' https://app.midtrans.com https://app.sandbox.midtrans.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

/** Apply defense-in-depth security headers to every response. */
function withSecurityHeaders(res: NextResponse): NextResponse {
  res.headers.set("Content-Security-Policy-Report-Only", CSP);
  res.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  return res;
}

function isPublicRoute(pathname: string): boolean {
  const withoutLocale = pathname.replace(/^\/[a-z]{2}(?:-\w{2})?/, "") || "/";
  return publicRoutes.some((route) => {
    if (route === "/") return withoutLocale === "/";
    return withoutLocale.startsWith(route);
  });
}

/**
 * Role-prefixed navigation scopes — /en/admin/dashboard, /id/staff/orders.
 *
 * The prefix is presentation, not authorization: the proxy rewrites it away
 * so the request is served by the canonical (dashboard) route tree, while the
 * browser URL keeps the role prefix. A `?scope=` token (HMAC-signed, 10-min
 * TTL) may pin the scope for shareable/bookmarked links — it rides through
 * the login redirect inside `?redirect=` and is validated post-login. Page
 * and API permission checks stay authoritative regardless of the prefix.
 */
const ROLE_PAGE_PREFIXES = new Set(["admin", "manager", "staff", "client", "enterprise"]);

async function handleRolePrefixedPath(req: NextRequest, pathname: string) {
  const parsed = splitRolePrefixedPath(pathname);
  if (!parsed) return null;
  const { locale, prefix, rest } = parsed;

  // A bare role segment with no tail is NOT a scope link — it's the canonical
  // page when one exists at that exact path (e.g. /en/admin, the real
  // user-management page). Treating it as a scope would rewrite it onto the
  // dashboard and shadow that page entirely. Deeper prefixes like
  // /en/admin/orders still hit the rewrite below; auth is enforced by the
  // canonical page + its API guards either way.
  if (!rest) return null;

  // /en/admin/dashboard → /en/dashboard (the prefix REPLACES "dashboard");
  // deeper scopes like /en/admin/orders → /en/dashboard/orders).
  const subPath = rest.replace(/^\/dashboard/, "") || "/dashboard";
  const canonicalPath = `/${locale}/dashboard${subPath === "/dashboard" ? "" : subPath}`;

  const token = req.cookies.get("token")?.value;
  if (!token) {
    // Anonymous visitor with a role-prefixed link: send to login carrying the
    // original URL (signed scope included) for the post-login round-trip.
    const loginUrl = new URL(`/${locale}/login`, req.url);
    loginUrl.searchParams.set("redirect", pathname + req.nextUrl.search);
    return withSecurityHeaders(NextResponse.redirect(loginUrl));
  }

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const sessionRole = String((payload as { role?: string }).role ?? "");

    // A signed ?scope= can pin the prefix for this request — but only when the
    // token names the session's own role (a navigation pin, never an escape).
    const scopeParam = req.nextUrl.searchParams.get("scope");
    const scopePayload = scopeParam ? await verifyScopeToken(scopeParam) : null;
    const allowed =
      prefixAllowsRole(prefix, sessionRole) ||
      (scopePayload != null &&
        scopePayload.role === sessionRole &&
        prefixAllowsRole(prefix, scopePayload.role));

    if (!allowed) {
      // Session bound to a different scope: bounce to the user's own prefix,
      // keeping the same tail shape (/admin/orders → /staff/orders).
      const own = req.nextUrl.clone();
      own.searchParams.delete("scope");
      own.pathname = `/${locale}/${rolePrefixForRole(sessionRole)}${rest || "/dashboard"}`;
      return withSecurityHeaders(NextResponse.redirect(own));
    }

    const res = NextResponse.rewrite(new URL(canonicalPath, req.url));
    res.headers.set("x-nav-role-prefix", prefix);
    return withSecurityHeaders(res);
  } catch {
    // Invalid/expired access token — defer to the generic auth handling.
    return null;
  }
}

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // API requests: enforce CSRF on unsafe methods with two layers —
  //   1. Double-submit token: the csrf_token cookie must be echoed in the
  //      X-CSRF-Token header (set by GET /api/auth/csrf). Non-browser clients
  //      (curl, webhooks) are exempt via the same-origin rule below.
  //   2. Same-origin: requests carrying Origin/Referer must match the host.
  // Auth cookies are httpOnly + SameSite=Lax; both layers are belt-and-braces.
  if (pathname.startsWith("/api/")) {
    if (
      !CSRF_EXEMPT_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`)) &&
      requestIsBrowser(req)
    ) {
      const csrf = assertCsrfDoubleSubmit(req, { pathname });
      if (!csrf.ok) {
        return NextResponse.json({ error: "CSRF token missing or invalid" }, { status: 403 });
      }
    }
    const origin = assertSameOrigin(req, pathname);
    if (!origin.ok) {
      return NextResponse.json({ error: "Cross-origin request rejected" }, { status: 403 });
    }
    return NextResponse.next();
  }

  // Skip for static files, manifest/icons, and locale-detected files
  if (
    pathname.includes("/_next") ||
    pathname.includes("/favicon") ||
    pathname === "/icon" ||
    pathname === "/apple-icon" ||
    pathname === "/manifest.json" ||
    pathname === "/manifest.webmanifest" ||
    pathname.includes(".") ||
    pathname.startsWith("/_vercel")
  ) {
    return NextResponse.next();
  }

  // PWA offline fallback: served as-is (no locale redirect). The service
  // worker caches this exact URL and replays it when a navigation fails, so
  // it must resolve to a 200 page at /offline without a locale round-trip.
  if (pathname === "/offline") {
    return withSecurityHeaders(NextResponse.next());
  }

  // Allow public routes without authentication
  if (isPublicRoute(pathname)) {
    return withSecurityHeaders(intlMiddleware(req));
  }

  // Role-prefixed scope routes (/en/admin/…) are handled by their own pass,
  // which rewrites to the canonical dashboard tree.
  const firstSegmentAfterLocale = pathname.split("/")[2];
  if (firstSegmentAfterLocale && ROLE_PAGE_PREFIXES.has(firstSegmentAfterLocale)) {
    const handled = await handleRolePrefixedPath(req, pathname);
    if (handled) return handled;
  }

  // Protected route: verify the JWT signature at the edge (not just existence).
  const token = req.cookies.get("token")?.value;
  const hasRefresh = req.cookies.has("refresh_token");
  try {
    if (!token) throw new Error("no token");
    await jwtVerify(token, JWT_SECRET);
    return withSecurityHeaders(intlMiddleware(req));
  } catch {
    // Access token missing or expired (it's short-lived). If a refresh cookie
    // is present, let the navigation through — the client silently refreshes
    // and API routes still enforce auth via requireAuth. Only redirect to
    // login when there's no way to re-authenticate.
    if (hasRefresh) {
      return withSecurityHeaders(intlMiddleware(req));
    }

    const locale = pathname.split("/")[1] || "en";
    const loginUrl = new URL(`/${locale}/login`, req.url);
    loginUrl.searchParams.set("redirect", pathname);

    const response = withSecurityHeaders(NextResponse.redirect(loginUrl));
    for (const name of ["token", "refresh_token"]) {
      response.cookies.set(name, "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 0,
        path: "/",
      });
    }
    return response;
  }
}

export const config = {
  // Includes /api so the same-origin (CSRF) check can run on unsafe methods;
  // the api branch short-circuits to NextResponse.next() for everything else.
  // Static files (dots) and Next internals stay excluded.
  matcher: ["/((?!api/auth/saml|_next|.*\\..*).*)"],
};
