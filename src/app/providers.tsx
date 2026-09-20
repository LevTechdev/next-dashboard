"use client";

import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { NextIntlClientProvider } from "next-intl";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { RealtimeProvider } from "@/components/realtime-provider";
import { AuthProvider } from "@/hooks/use-auth";
import { TierSyncWatcher } from "@/components/billing/tier-sync-watcher";
import { VerificationSuccessToaster } from "@/components/security/verification-success-toaster";
import { PWARegister } from "@/components/pwa-register";
import { PostHogProvider } from "@/components/analytics/posthog-provider";
import { ThemeTransitionWatcher } from "@/components/theme-transition-watcher";
import { LOCALE_MESSAGES } from "@/lib/locale-messages";

function LocaleProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const pathLocale = pathname?.split("/")[1];
  const validLocale = pathLocale && pathLocale in LOCALE_MESSAGES ? pathLocale : "en";

  const [locale, setLocale] = useState<string>(validLocale);

  useEffect(() => {
    const loc = validLocale;
    setLocale(loc);
    localStorage.setItem("dashboard-locale", loc);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathLocale]);

  return (
    <NextIntlClientProvider
      locale={locale}
      messages={LOCALE_MESSAGES[locale]}
      timeZone="Asia/Jakarta"
    >
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
        enableColorScheme={false}
        disableTransitionOnChange
      >
        <LocaleProvider>
          <AuthProvider>
            <RealtimeProvider>
              {/* Toaster mounts before {children} so sonner subscribes first —
                  mount-time toast calls (e.g. the Security Center's
                  ?verified=true success toast after a full-page redirect)
                  would otherwise be dropped before the Toaster subscribes. */}
              <Toaster richColors position="top-right" />
              {children}
              <VerificationSuccessToaster />
              <TierSyncWatcher />
              <ThemeTransitionWatcher />
              <PWARegister />
            </RealtimeProvider>
          </AuthProvider>
        </LocaleProvider>
      </ThemeProvider>
    </PostHogProvider>
  );
}
