import { SITE_URL } from "@/lib/site-config";

/**
 * Server-rendered JSON-LD for rich results:
 *
 *  - BreadcrumbList → breadcrumb trail in SERPs for nested marketing pages.
 *  - FAQPage → FAQ accordion rich result (used on the pricing page).
 *
 * Rendered as a single <script type="application/ld+json"> @graph so crawlers
 * see one consistent block per page. Client components can render it too —
 * it is a plain presentational component with no hooks.
 */
export function PageStructuredData({
  locale,
  path,
  title,
  faq,
}: {
  locale: string;
  path: string;
  title: string;
  faq?: { question: string; answer: string }[];
}) {
  const pageUrl = `${SITE_URL}/${locale}${path}`;

  const crumbs = [
    { name: "Home", url: `${SITE_URL}/${locale}` },
    ...(path ? [{ name: title, url: pageUrl }] : []),
  ];

  const graph: Record<string, unknown>[] = [
    {
      "@type": "BreadcrumbList",
      "@id": `${pageUrl}#breadcrumb`,
      itemListElement: crumbs.map((c, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: c.name,
        item: c.url,
      })),
    },
  ];

  if (faq?.length) {
    graph.push({
      "@type": "FAQPage",
      "@id": `${pageUrl}#faq`,
      mainEntity: faq.map((f) => ({
        "@type": "Question",
        name: f.question,
        acceptedAnswer: { "@type": "Answer", text: f.answer },
      })),
    });
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({ "@context": "https://schema.org", "@graph": graph }),
      }}
    />
  );
}
