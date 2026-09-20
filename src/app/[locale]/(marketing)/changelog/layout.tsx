import { pageMetadata } from "@/lib/seo-page-metadata";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return pageMetadata(locale, "/changelog", "Changelog");
}

export default function ChangelogLayout({ children }: { children: React.ReactNode }) {
  return children;
}
