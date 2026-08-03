import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  output: process.env.RAILWAY_ENVIRONMENT ? "standalone" : undefined,
  // Playwright is loaded lazily at runtime for the affiliate URL importer's
  // headless fallback; keep it external so it is never bundled.
  serverExternalPackages: ["playwright", "playwright-core"],
};

export default withNextIntl(nextConfig);
