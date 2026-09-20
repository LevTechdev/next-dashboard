import type { MetadataRoute } from "next";
import { MARKETING_PATHS, SITE_LOCALES, SITE_URL, SITE_DEFAULT_LOCALE } from "@/lib/site-config";

/**
 * Dynamic sitemap — replaces the ~268KB HTML fallthrough that /sitemap.xml
 * used to serve (no app-router sitemap.ts existed, so the catch-all page
 * answered with text/html 200).
 *
 * Every locale page carries hreflang alternates (including x-default → en)
 * so search engines dedupe the en/id/zh/ja variants instead of treating
 * them as competing duplicates.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return SITE_LOCALES.flatMap((locale) =>
    MARKETING_PATHS.map((path) => {
      const languages = Object.fromEntries(SITE_LOCALES.map((l) => [l, `${SITE_URL}/${l}${path}`]));
      languages["x-default"] = `${SITE_URL}/${SITE_DEFAULT_LOCALE}${path}`;

      return {
        url: `${SITE_URL}/${locale}${path}`,
        lastModified: now,
        changeFrequency: path === "" ? ("daily" as const) : ("weekly" as const),
        priority: path === "" ? 1 : path === "/pricing" || path === "/features" ? 0.9 : 0.7,
        alternates: { languages },
      };
    }),
  );
}
