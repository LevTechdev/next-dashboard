"use client";

import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { NextIntlClientProvider } from "next-intl";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { RealtimeProvider } from "@/components/realtime-provider";
import { AuthProvider } from "@/hooks/use-auth";
import { PWARegister } from "@/components/pwa-register";
import { PostHogProvider } from "@/components/analytics/posthog-provider";
import { ThemeTransitionWatcher } from "@/components/theme-transition-watcher";
import enMessages from "../i18n/locales/en.json";
import idMessages from "../i18n/locales/id.json";

const LOCALE_MESSAGES: Record<string, Record<string, any>> = {
  en: enMessages,
  id: idMessages,
};

function LocaleProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const pathLocale = pathname?.split("/")[1];
  const validLocale =
    pathLocale === "id" || pathLocale === "en" ? pathLocale : "en";

  const [locale, setLocale] = useState<string>(validLocale);

  useEffect(() => {
    const loc = validLocale;
    setLocale(loc);
    localStorage.setItem("dashboard-locale", loc);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathLocale]);

  return (
    <NextIntlClientProvider locale={locale} messages={LOCALE_MESSAGES[locale]} timeZone="Asia/Jakarta">
      {children}
    </NextIntlClientProvider>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
      <PostHogProvider>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
        >
          <LocaleProvider>
            <AuthProvider>
            <RealtimeProvider>
              {children}
              <ThemeTransitionWatcher />
              <Toaster richColors position="top-right" />
              <PWARegister />
              </RealtimeProvider>
            </AuthProvider>
          </LocaleProvider>
        </ThemeProvider>
      </PostHogProvider>
  );
}
