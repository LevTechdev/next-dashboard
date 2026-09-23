import type { Metadata } from "next";
import { SITE_LOCALES, SITE_NAME, SITE_URL } from "@/lib/site-config";

/**
 * Shared page-level metadata builder for marketing routes. Used by the small
 * server layout.tsx wrappers next to each client page (client pages cannot
 * export metadata), giving every route its own canonical + hreflang cluster
 * instead of falling back to the locale-level canonical.
 *
 * Each page also gets a distinct OG image via the /api/og generator
 * (?title=<page>) so social shares render a branded 1200×630 card per route
 * instead of every page reusing the dashboard capture.
 */
export function pageMetadata(locale: string, path: string, title?: string): Metadata {
  const safe = (SITE_LOCALES as readonly string[]).includes(locale) ? locale : "en";
  const canonical = `${SITE_URL}/${safe}${path}`;

  const languages = Object.fromEntries(SITE_LOCALES.map((l) => [l, `${SITE_URL}/${l}${path}`]));
  languages["x-default"] = `${SITE_URL}/en${path}`;

  const pageTitle = title ?? SITE_NAME;
  const ogImage = `/api/og?title=${encodeURIComponent(pageTitle)}`;
  const ogImageAbs = `${SITE_URL}${ogImage}`;

  return {
    ...(title ? { title } : {}),
    alternates: {
      canonical: `/${safe}${path}`,
      languages,
    },
    openGraph: {
      ...(title ? { title: pageTitle } : {}),
      url: canonical,
      locale: safe,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: `${pageTitle} — ${SITE_NAME}`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      images: [ogImageAbs],
    },
  };
}
