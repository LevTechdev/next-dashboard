import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo-page-metadata";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  // Transactional route — never belongs in the index (Google: "Soft 404"/thin
  // content risk). noindex overrides the locale-level canonical cleanly.
  return {
    ...pageMetadata(locale, "/checkout"),
    robots: { index: false, follow: false },
  };
}

export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
