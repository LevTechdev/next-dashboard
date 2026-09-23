import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Dev (next dev) and prod (next start) cannot safely share one .next dir —
  // a prod build in .next makes a fresh dev server 404. Give the prod server
  // its own build dir via NEXT_DIST_DIR so both can run side by side:
  //   NEXT_DIST_DIR=.next-prod npm run build
  //   NEXT_DIST_DIR=.next-prod npx next start -p 3011
  distDir: process.env.NEXT_DIST_DIR || ".next",
  output: process.env.RAILWAY_ENVIRONMENT ? "standalone" : undefined,
  // Playwright is loaded lazily at runtime for the affiliate URL importer's
  // headless fallback; keep it external so it is never bundled.
  serverExternalPackages: ["playwright", "playwright-core"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-DNS-Prefetch-Control", value: "on" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "origin-when-cross-origin" },
        ],
      },
    ];
  },
};

// SEO env guard — every canonical/hreflang/sitemap/robots URL derives from
// NEXT_PUBLIC_APP_URL (site-config.ts). A production deploy that forgets it
// would ship localhost:3010 URLs to crawlers, so fail loudly at build time
// instead of discovering it in Search Console weeks later.
if (
  process.env.NODE_ENV === "production" &&
  !process.env.NEXT_PUBLIC_APP_URL &&
  (process.env.RAILWAY_ENVIRONMENT || process.env.VERCEL)
) {
  throw new Error(
    "NEXT_PUBLIC_APP_URL is required in production (sitemap, robots.txt, canonicals and OG URLs derive from it).",
  );
}

export default withNextIntl(nextConfig);
