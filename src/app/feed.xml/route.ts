import enChangelog from "@/i18n/locales/en.json";
import { SITE_URL } from "@/lib/site-config";

export const dynamic = "force-static";

/**
 * Changelog RSS 2.0 feed (/feed.xml).
 *
 * Entries come from the changelogPage.entries namespace of the en locale
 * bundle — the same array the changelog page renders — so the feed can never
 * drift from the page content. Distribute via Newsletter/FeedBurner or a
 * "subscribe" link next to the changelog subscribe CTA.
 */
type Entry = { version: string; date: string; items?: { type: string; text: string }[] };

export async function GET() {
  const entries = (enChangelog.changelogPage as { entries: Entry[] }).entries ?? [];
  const siteDesc = (enChangelog.site as { footerDesc?: string })?.footerDesc ?? "Changelog";

  const items = entries
    .map((entry) => {
      const summary = (entry.items ?? []).map((i) => `- ${i.text}`).join("\n");
      const pubDate = new Date(entry.date);
      return `    <item>
      <title>Version ${entry.version}</title>
      <link>${SITE_URL}/en/changelog</link>
      <guid isPermaLink="false">${entry.version}-${pubDate.getTime()}</guid>
      <pubDate>${(isNaN(pubDate.getTime()) ? new Date() : pubDate).toUTCString()}</pubDate>
      <description><![CDATA[${summary}]]></description>
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Next Dashboard — Changelog</title>
    <link>${SITE_URL}/en/changelog</link>
    <description>${siteDesc}</description>
    <language>en</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
