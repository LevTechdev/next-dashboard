import { pageMetadata } from "@/lib/seo-page-metadata";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return pageMetadata(locale, "/terms", "Terms of Service");
}

export default function TermsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
