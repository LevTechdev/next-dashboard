import { NextRequest, NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";
import { jwtVerify } from "jose";
import { routing } from "./i18n/routing";

const intlMiddleware = createMiddleware(routing);

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "dev-jwt-secret-change-in-production",
);

// Public routes that don't require authentication
const publicRoutes = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/",
  "/features",
  "/pricing",
  "/changelog",
  "/integrations-overview",
  "/about",
  "/contact",
];

// Content-Security-Policy shipped in Report-Only mode first so it never blocks
// rendering; flip the header name to "Content-Security-Policy" to enforce once
// the report endpoint shows no violations.
const CSP = [
  "default-src 'self'",
  "img-src 'self' data: https:",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "connect-src 'self' https:",
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

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Skip for API routes, static files, manifest/icons, and locale-detected files
  if (
    pathname.startsWith("/api/") ||
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

  // Allow public routes without authentication
  if (isPublicRoute(pathname)) {
    return withSecurityHeaders(intlMiddleware(req));
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
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
