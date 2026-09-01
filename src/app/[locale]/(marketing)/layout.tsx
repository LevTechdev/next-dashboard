"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { useAnalytics } from "@/hooks/use-analytics";
import { setLocaleCookie } from "@/lib/locale-cookie";
import { motion, AnimatePresence } from "framer-motion";
import {
  XIcon,
  MenuIcon,
  ChevronRightIcon,
  SparklesIcon,
  LayersIcon,
  SunIcon,
  MoonIcon,
  MessageSquareIcon,
  EarthIcon,
  LayoutGridIcon,
  CircleDollarSignIcon,
  UsersIcon,
} from "lucide-animated";
import { LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { RadialGlowButton } from "@/components/ui/radial-glow-button";
import { useAuth } from "@/hooks/use-auth";
import PageTransition from "@/components/page-transition";
import { ViewTransitionProvider } from "@/components/view-transition-provider";
import { TransitionLink } from "@/components/transition-link";
import UnsupportedBrowserBanner from "@/components/unsupported-browser-banner";

const navLinks = [
  { labelKey: "navFeatures", href: "/features", icon: LayoutGridIcon },
  { labelKey: "navIntegrations", href: "/integrations-overview", icon: LayersIcon },
  { labelKey: "navPricing", href: "/pricing", icon: CircleDollarSignIcon },
  { labelKey: "navChangelog", href: "/changelog", icon: SparklesIcon },
  { labelKey: "navAbout", href: "/about", icon: UsersIcon },
  { labelKey: "navContact", href: "/contact", icon: MessageSquareIcon },
] as const;

import { MarketingHeader } from "@/components/layout/marketing-header";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const pathname = usePathname();
  const locale = (params?.locale as string) || "en";
  const [scrolled, setScrolled] = useState(false);
  const t = useTranslations("site");

  // Track scroll for navbar transparency
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 0);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <ViewTransitionProvider>
      <UnsupportedBrowserBanner />
      <div className="min-h-screen bg-zinc-50 dark:bg-[#0b0c11] text-zinc-900 dark:text-zinc-100 transition-colors motion-spring">
        <MarketingHeader scrolled={scrolled} />



        {/* ═══ MAIN CONTENT with animated page transitions ═══ */}
        <main className="overflow-x-hidden">
          <PageTransition>{children}</PageTransition>
        </main>

        {/* ═══ FOOTER ═══ */}
        <footer className="border-t border-border bg-zinc-100 dark:bg-[#0b0c11]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-20">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
              {/* Brand (same viewTransitionName as navbar logo → morphs on nav) */}
              <div className="md:col-span-2 max-w-sm">
                <Link href={`/${locale}`} className="flex items-center gap-2.5 mb-4">
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-foreground text-background">
                    <LayoutDashboard className="h-[18px] w-[18px]" />
                  </div>
                  <span className="text-sm font-semibold text-foreground">Dashboard</span>
                </Link>
                <p className="text-sm text-muted-foreground leading-relaxed">{t("footerDesc")}</p>
              </div>

              {/* Product */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
                  {t("footerProduct")}
                </h3>
                <ul className="space-y-3">
                  {[
                    { labelKey: "navFeatures", href: "/features" },
                    { labelKey: "navIntegrations", href: "/integrations-overview" },
                    { labelKey: "navChangelog", href: "/changelog" },
                    { labelKey: "navPricing", href: "/pricing" },
                    { labelKey: "navAbout", href: "/about" },
                    { labelKey: "navContact", href: "/contact" },
                  ].map((link) => (
                    <li key={link.href}>
                      <Link
                        href={`/${locale}${link.href}`}
                        className="text-sm text-muted-foreground hover:text-foreground dark:hover:text-white transition-colors"
                      >
                        {t(link.labelKey)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Company */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
                  {t("footerCompany")}
                </h3>
                <ul className="space-y-3">
                  <li>
                    <Link
                      href={`/${locale}/dashboard`}
                      className="text-sm text-muted-foreground hover:text-foreground dark:hover:text-white transition-colors"
                    >
                      {t("dashboard")}
                    </Link>
                  </li>
                  <li>
                    <Link
                      href={`/${locale}/features`}
                      className="text-sm text-muted-foreground hover:text-foreground dark:hover:text-white transition-colors"
                    >
                      {t("navFeatures")}
                    </Link>
                  </li>
                </ul>
              </div>
            </div>

            <div className="mt-14 pt-8 border-t border-border">
              <p className="text-xs text-muted-foreground text-center">
                &copy; {new Date().getFullYear()} {t("footerRights")}
              </p>
            </div>
          </div>
        </footer>
      </div>
    </ViewTransitionProvider>
  );
}
