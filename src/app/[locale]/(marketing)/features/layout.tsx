import { pageMetadata } from "@/lib/seo-page-metadata";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return pageMetadata(locale, "/features", "Features");
}

export default function FeaturesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
