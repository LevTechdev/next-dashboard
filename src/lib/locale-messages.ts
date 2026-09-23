import enMessages from "@/i18n/locales/en.json";
import idMessages from "@/i18n/locales/id.json";
import zhMessages from "@/i18n/locales/zh.json";
import jaMessages from "@/i18n/locales/ja.json";

/**
 * Shared static locale bundles.
 *
 * providers.tsx consumes this map for NextIntlClientProvider; non-React
 * surfaces (the auth hook's welcome-back toast) import the same map so copy
 * stays localized without threading a React context through them.
 */
export const LOCALE_MESSAGES: Record<string, Record<string, any>> = {
  en: enMessages,
  id: idMessages,
  zh: zhMessages,
  ja: jaMessages,
};
