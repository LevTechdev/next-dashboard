import type { MetadataRoute } from "next";
import { AUTH_PATHS, SITE_URL } from "@/lib/site-config";

/**
 * Dynamic robots.txt — replaces the HTML fallthrough that /robots.txt used
 * to serve. The dashboard routes require auth, so disallow crawling there
 * while keeping every marketing surface fully crawlable. Auth disallows are
 * derived from AUTH_PATHS (site-config.ts) so they stay in sync with the
 * middleware's public-route list.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", ...AUTH_PATHS, "/dashboard"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
