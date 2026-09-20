/**
 * Canonical site identity used by sitemap, robots, metadata, and JSON-LD.
 *
 * Single source of truth so SEO surfaces can never drift apart. The app URL
 * comes from NEXT_PUBLIC_APP_URL (falls back to the dev origin), matching the
 * pattern already used for the dashboard OG image URL in src/app/layout.tsx.
 */
export const SITE_NAME = "Next Dashboard";
export const SITE_TAGLINE = "All-in-One Business Management Platform";
export const SITE_DESCRIPTION =
  "Comprehensive business management platform with real-time analytics, multi-channel order management, team collaboration, and powerful reporting. Run your business with real-time intelligence.";

export const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3010").replace(
  /\/$/,
  "",
);

export const SITE_LOCALES = ["en", "id", "zh", "ja"] as const;
export type SiteLocale = (typeof SITE_LOCALES)[number];
export const SITE_DEFAULT_LOCALE: SiteLocale = "en";

/** Auth routes that stay public (no JWT required) but never crawlable. */
export const AUTH_PATHS = ["/login", "/register", "/forgot-password", "/reset-password"] as const;

/** Locale paths that exist as real marketing routes (no auth required). */
export const MARKETING_PATHS = [
  "",
  "/features",
  "/pricing",
  "/about",
  "/careers",
  "/contact",
  "/changelog",
  "/integrations-overview",
  "/terms",
  "/privacy",
  "/cookies",
  "/accessibility",
  "/ui/alert-dialog",
  "/emails",
] as const;

/**
 * Public routes that live OUTSIDE the marketing route group: the transactional
 * checkout flow and the PWA offline fallback. Kept here (not inline in
 * middleware.ts) so middleware and the route-registry guard test read the same
 * list — the guard fails when a new page is reachable by neither.
 */
export const EXTRA_PUBLIC_PATHS = ["/checkout", "/offline"] as const;

/** Build an absolute site URL from an optional locale + path. */
export function siteUrl(locale?: string, path = ""): string {
  if (!locale) return SITE_URL;
  return `${SITE_URL}/${locale}${path}`;
}
