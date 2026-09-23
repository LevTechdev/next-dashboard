import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/**
 * Release version, resolved once per build.
 *
 * semantic-release tags the release commit, so the newest tag IS the shipped
 * version; it is injected here so the client bundle can report it ("Latest
 * version: 1.1.0") without a runtime git call. A build with no tags in reach
 * (shallow clone, tarball) falls back to package.json, which keeps the two in
 * step with the tag line by convention and is asserted by app-version.test.ts.
 */
function resolveAppVersion(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_VERSION?.trim();
  if (explicit) return explicit.replace(/^v/, "");
  try {
    const tag = execSync("git describe --tags --abbrev=0", {
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
    if (tag) return tag.replace(/^v/, "");
  } catch {
    // No git, no tags, or a shallow clone: fall through to package.json.
  }
  try {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as {
      version?: string;
    };
    if (pkg.version) return pkg.version;
  } catch {
    // Unreadable package.json — the caller's literal fallback takes over.
  }
  return "0.0.0";
}

const appVersion = resolveAppVersion();

const nextConfig: NextConfig = {
  // Exposed to the client bundle so the changelog badge, and any future
  // "About" surface, all read the same version the release was tagged with.
  env: { NEXT_PUBLIC_APP_VERSION: appVersion },
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
