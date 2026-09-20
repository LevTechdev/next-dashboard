import type { Metadata } from "next";
import { AppearanceInit } from "@/components/appearance-init";
import { CurrencyProvider } from "@/components/currency-provider";
import { SITE_LOCALES, SITE_NAME, SITE_TAGLINE, SITE_URL } from "@/lib/site-config";
import enMessages from "@/i18n/locales/en.json";
import idMessages from "@/i18n/locales/id.json";
import zhMessages from "@/i18n/locales/zh.json";
import jaMessages from "@/i18n/locales/ja.json";

// Localized OG descriptions — pulled from the site.footerDesc namespace of
// each locale bundle so /id shares an Indonesian card, /zh a Chinese one,
// instead of every locale reusing the English SITE_DESCRIPTION.
const LOCALE_MESSAGES: Record<string, Record<string, any>> = {
  en: enMessages,
  id: idMessages,
  zh: zhMessages,
  ja: jaMessages,
};

function localizedDescription(locale: string): string {
  const msg = LOCALE_MESSAGES[locale];
  const desc = msg?.site?.footerDesc;
  return typeof desc === "string" && desc.length > 20
    ? desc
    : (LOCALE_MESSAGES.en?.site?.footerDesc ?? SITE_TAGLINE);
}

type Props = { params: Promise<{ locale: string }> };

/**
 * Locale-scoped metadata — canonical + hreflang alternates for every page in
 * this segment. Individual client pages can't export metadata themselves, so
 * the locale layout is the right level to dedupe en/id/zh/ja variants.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const safe = (SITE_LOCALES as readonly string[]).includes(locale) ? locale : "en";
  const canonical = `${SITE_URL}/${safe}`;
  const description = localizedDescription(safe);

  const languages = Object.fromEntries(SITE_LOCALES.map((l) => [l, `${SITE_URL}/${l}`]));
  languages["x-default"] = `${SITE_URL}/en`;

  return {
    alternates: {
      canonical: `/${safe}`,
      languages,
    },
    description,
    openGraph: {
      title: `${SITE_NAME} - ${SITE_TAGLINE}`,
      description,
      url: canonical,
      locale: safe,
      alternateLocale: SITE_LOCALES.filter((l) => l !== safe),
    },
  };
}

export default function LocaleLayout({ children }: { children: React.ReactNode }) {
  return (
    <CurrencyProvider>
      <AppearanceInit />
      {children}
    </CurrencyProvider>
  );
}
