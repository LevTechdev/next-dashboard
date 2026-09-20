import { pageMetadata } from "@/lib/seo-page-metadata";
import { PageStructuredData } from "@/components/seo/page-structured-data";
import enMessages from "@/i18n/locales/en.json";

// FAQ items mirror the pricing page's FaqAccordion (faqQ1–faqA4) so the
// FAQPage JSON-LD can never drift from what users actually see.
function pricingFaq(): { question: string; answer: string }[] {
  const p = enMessages.pricingPage as unknown as Record<string, string>;
  return [1, 2, 3, 4]
    .map((n) => ({ question: p[`faqQ${n}`], answer: p[`faqA${n}`] }))
    .filter((f) => f.question && f.answer);
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return pageMetadata(locale, "/pricing", "Pricing");
}

export default async function PricingLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return (
    <>
      <PageStructuredData locale={locale} path="/pricing" title="Pricing" faq={pricingFaq()} />
      {children}
    </>
  );
}
