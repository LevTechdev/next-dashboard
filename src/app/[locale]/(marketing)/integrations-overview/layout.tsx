import { pageMetadata } from "@/lib/seo-page-metadata";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return pageMetadata(locale, "/integrations-overview", "Integrations");
}

export default function IntegrationsOverviewLayout({ children }: { children: React.ReactNode }) {
  return children;
}
