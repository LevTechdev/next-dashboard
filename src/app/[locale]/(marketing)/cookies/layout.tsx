import { pageMetadata } from "@/lib/seo-page-metadata";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return pageMetadata(locale, "/cookies", "Cookie Policy");
}

export default function CookiesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
