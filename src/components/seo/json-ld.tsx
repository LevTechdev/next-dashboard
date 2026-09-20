/**
 * JSON-LD structured data (Organization + WebSite + SoftwareApplication) for
 * the marketing surfaces. Injected via <script type="application/ld+json">
 * so search engines can build rich results (knowledge panel, sitelinks
 * searchbox, app pricing).
 */
export function JsonLd({ locale = "en" }: { locale?: string }) {
  const siteUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3010"}/${locale}`;

  const data = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${siteUrl}/#organization`,
        name: "Next Dashboard",
        url: siteUrl,
        logo: `${siteUrl}/icons/icon-512x512.png`,
      },
      {
        "@type": "WebSite",
        "@id": `${siteUrl}/#website`,
        url: siteUrl,
        name: "Next Dashboard",
        inLanguage: locale,
        publisher: { "@id": `${siteUrl}/#organization` },
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${siteUrl}/#app`,
        name: "Next Dashboard",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        url: siteUrl,
        description:
          "All-in-one business management platform with analytics, orders, customers, and team management.",
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
          url: `${siteUrl}/pricing`,
        },
        publisher: { "@id": `${siteUrl}/#organization` },
      },
    ],
  };

  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
  );
}
