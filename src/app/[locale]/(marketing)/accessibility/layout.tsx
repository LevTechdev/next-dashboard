import { pageMetadata } from "@/lib/seo-page-metadata";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return pageMetadata(locale, "/accessibility", "Accessibility");
}

export default function AccessibilityLayout({ children }: { children: React.ReactNode }) {
  return children;
}
