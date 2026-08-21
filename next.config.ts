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
};

export default withNextIntl(nextConfig);
