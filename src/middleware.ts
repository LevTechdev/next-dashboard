import { NextRequest, NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

const intlMiddleware = createMiddleware(routing);

// Public routes that don't require authentication
const publicRoutes = [
  "/login",
  "/register",
  "/",
  "/features",
  "/pricing",
  "/changelog",
  "/integrations-overview",
  "/about",
  "/contact",
];

// Check if a pathname matches any public route (with or without locale prefix)
function isPublicRoute(pathname: string): boolean {
  // Strip locale prefix (en, id, zh, ja, etc.)
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
    return intlMiddleware(req);
  }

  // Check for JWT token in cookies (simple existence check - actual validation happens on API routes)
  const hasToken = req.cookies.has("token");

  if (hasToken) {
    // Token exists — proceed to the page (validation happens server-side)
    return intlMiddleware(req);
  }

  // Not authenticated — redirect to login
  const locale = pathname.split("/")[1] || "en";
  const loginUrl = new URL(`/${locale}/login`, req.url);
  loginUrl.searchParams.set("redirect", pathname);

  const response = NextResponse.redirect(loginUrl);

  // Clear stale token cookie
  response.cookies.set("token", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });

  return response;
}

export const config = {
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
