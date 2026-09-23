"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Tooltip } from "@/components/ui/tooltip";
import { useAnalytics } from "@/hooks/use-analytics";
import { XIcon, MenuIcon, ChevronRightIcon } from "lucide-animated";
import { BarChart3Icon, ShieldIcon, ZapIcon, GlobeIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { StaggerButton } from "@/components/sora-ui/buttons/stagger-button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/use-auth";
import { BrandLogo } from "@/components/brand/brand-logo";
import { LanguageToggle } from "@/components/layout/language-toggle";
import { ThemeToggleButton } from "@/components/theme/theme-toggle-button";
import { AnimatePresence, motion } from "framer-motion";

export function MarketingHeader({ scrolled }: { scrolled: boolean }) {
  const params = useParams();
  const pathname = usePathname();
  const locale = (params?.locale as string) || "en";
  const t = useTranslations("site");
  const [mounted, setMounted] = useState(false);
  const { trackLanguageSwitch } = useAnalytics();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [prevLocale, setPrevLocale] = useState(locale);
  const { user, isAuthenticated, isLoading } = useAuth();

  const initials =
    user?.name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "U";

  useEffect(() => {
    setMounted(true); // eslint-disable-line react-hooks/set-state-in-effect
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false); // eslint-disable-line react-hooks/set-state-in-effect
  }, [pathname]);

  useEffect(() => {
    if (prevLocale !== locale) {
      trackLanguageSwitch(prevLocale, locale);
      setPrevLocale(locale); // eslint-disable-line react-hooks/set-state-in-effect
    }
  }, [locale, prevLocale, trackLanguageSwitch]);

  // Segment-aware active check: exact match, or the href followed by "/". Any
  // in-page anchor is stripped first — the Features mega-menu deep-links carry
  // a hash (#analytics) that never appears in usePathname(), and a naive
  // startsWith would also light up /en/features while on /en/features-old.
  const isLinkActive = (href: string) => {
    const base = `/${locale}${href.split("#")[0]}`;
    return pathname === base || pathname.startsWith(`${base}/`);
  };

  const megaMenuItems = [
    {
      titleKey: "megaAnalyticsTitle",
      descKey: "megaAnalyticsDesc",
      icon: BarChart3Icon,
      href: "/features#analytics",
      color: "text-blue-500",
      bg: "bg-blue-500/10",
    },
    {
      titleKey: "megaSecurityTitle",
      descKey: "megaSecurityDesc",
      icon: ShieldIcon,
      href: "/features#security",
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
    },
    {
      titleKey: "megaAutomationTitle",
      descKey: "megaAutomationDesc",
      icon: ZapIcon,
      href: "/features#automation",
      color: "text-amber-500",
      bg: "bg-amber-500/10",
    },
    {
      titleKey: "megaScaleTitle",
      descKey: "megaScaleDesc",
      icon: GlobeIcon,
      href: "/features#scale",
      color: "text-indigo-500",
      bg: "bg-indigo-500/10",
    },
  ];

  // Text-only links: the leading feature icons were removed so the nav reads as
  // one typographic row (the mega menu keeps its icons as content markers).
  const standardNavLinks = [
    { labelKey: "navIntegrations", href: "/integrations-overview" },
    { labelKey: "navPricing", href: "/pricing" },
    { labelKey: "navChangelog", href: "/changelog" },
    { labelKey: "navAbout", href: "/about" },
    { labelKey: "navContact", href: "/contact" },
  ] as const;

  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        scrolled
          ? "bg-background/80 backdrop-blur-md border-b border-border shadow-sm py-1.5"
          : "bg-transparent py-3",
      )}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-11">
          {/* Logo — the shared animated BrandLogo (also used on the auth
              pages and in the footer). Kept in the navbar's top-left slot; the
              tile still shrinks on scroll and keeps the nav-logo view-
              transition morph shared with the dashboard sidebar logo. */}
          <BrandLogo
            href={`/${locale}`}
            viewTransitionName="nav-logo"
            size="sm"
            animated
            className="shrink-0"
            tileClassName={cn(
              "shadow-lg transition-all duration-300 group-hover:shadow-xl",
              scrolled ? "h-7 w-7" : "h-8 w-8",
            )}
            wordmarkClassName={cn(
              "transition-all duration-300",
              scrolled ? "text-[13px]" : "text-[15px]",
            )}
          />

          {/* Desktop Nav */}
          <nav className="hidden lg:flex items-center gap-1 relative">
            {/* Mega Menu Trigger for Features */}
            <div className="group inline-block">
              <Link
                href={`/${locale}/features`}
                className={cn(
                  "relative flex items-center gap-1.5 text-[13px] font-medium tracking-[-0.01em] transition-colors duration-200 px-3 py-2 rounded-lg whitespace-nowrap",
                  isLinkActive("/features")
                    ? "text-primary bg-primary/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5",
                )}
              >
                {t("navFeatures")}
                <ChevronRightIcon
                  size={12}
                  className="h-3 w-3 ml-0.5 opacity-50 group-hover:rotate-90 transition-transform duration-200"
                />
              </Link>

              {/* Mega Menu Dropdown */}
              <div className="absolute top-full left-0 pt-2 w-[480px] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 -translate-y-2 group-hover:translate-y-0 z-50">
                <div className="p-4 bg-background/95 backdrop-blur-xl border border-border shadow-2xl rounded-2xl grid grid-cols-2 gap-2">
                  <div className="col-span-2 px-3 pb-2 mb-2 border-b border-border flex justify-between items-center">
                    <span className="text-sm font-semibold">{t("navFeatures")}</span>
                    <Link
                      href={`/${locale}/features`}
                      className="text-xs text-primary hover:underline flex items-center"
                    >
                      {t("viewAllFeatures")} <ChevronRightIcon size={10} className="ml-1" />
                    </Link>
                  </div>
                  {megaMenuItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={`/${locale}${item.href}`}
                        className="flex items-start gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors"
                      >
                        <div className={cn("mt-0.5 p-2 rounded-lg flex-shrink-0", item.bg)}>
                          <Icon size={16} className={item.color} />
                        </div>
                        <div>
                          <h4 className="text-sm font-medium text-foreground mb-0.5">
                            {t(item.titleKey)}
                          </h4>
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            {t(item.descKey)}
                          </p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>

            {standardNavLinks.map((link) => {
              const isActive = isLinkActive(link.href);
              return (
                <StaggerButton
                  key={link.href}
                  href={`/${locale}${link.href}`}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "relative rounded-lg px-3 py-2 text-[13px] font-medium tracking-[-0.01em] transition-colors duration-200 whitespace-nowrap",
                    isActive
                      ? "text-primary bg-primary/10"
                      : "text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5",
                  )}
                >
                  {t(link.labelKey)}
                </StaggerButton>
              );
            })}
          </nav>

          {/* Right Side: Toggles + CTAs */}
          <div className="flex items-center gap-1 lg:gap-1.5">
            {/* Language Toggle — globe icon dropdown with all 4 locales */}
            <LanguageToggle locale={locale} pathname={pathname} />

            {/* Theme Toggle — the shared button, so the reveal origin, the
                hydration-safe icon and the localized label match the
                dashboard header and the auth pages. */}
            <ThemeToggleButton className="p-2 motion-spring-fast" side="bottom" />

            {/* CTAs */}
            <div className="hidden sm:flex items-center gap-2 ml-1 lg:ml-2">
              {!mounted || isLoading ? (
                <div className="h-9 w-9 rounded-full bg-black/5 dark:bg-white/10 animate-pulse" />
              ) : isAuthenticated ? (
                <Tooltip side="bottom" content={user?.name || t("myAccount")}>
                  <Link
                    href={`/${locale}/dashboard`}
                    aria-label={t("myAccount")}
                    className="group flex items-center rounded-full press-scale"
                  >
                    <Avatar className="h-9 w-9 ring-2 ring-primary/40 ring-offset-2 ring-offset-transparent transition-all group-hover:ring-primary/70">
                      <AvatarImage src={user?.avatar || ""} alt={user?.name || ""} />
                      <AvatarFallback className="text-xs bg-primary text-primary-foreground font-semibold">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                  </Link>
                </Tooltip>
              ) : (
                <>
                  <Link
                    href={`/${locale}/login`}
                    className="text-sm font-medium text-foreground hover:opacity-70 transition-opacity px-2"
                  >
                    {t("signIn")}
                  </Link>
                  <Link
                    href={`/${locale}/register`}
                    className="inline-flex items-center justify-center text-sm font-medium bg-foreground text-background px-4 py-1.5 rounded-full hover:opacity-90 transition-opacity"
                  >
                    {t("signUp")}
                  </Link>
                </>
              )}
            </div>

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
              aria-expanded={mobileMenuOpen}
              className="lg:hidden p-2 ml-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-all"
            >
              {mobileMenuOpen ? <XIcon size={20} /> : <MenuIcon size={20} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="lg:hidden overflow-hidden bg-background/95 backdrop-blur-xl border-b border-border"
          >
            <div className="p-4 flex flex-col gap-2">
              {/* Mobile hamburger links carry the same active treatment as the
                  desktop nav (bg-primary/10 + primary text + aria-current), so
                  the current page is obvious at tablet/mobile widths too. */}
              <Link
                href={`/${locale}/features`}
                aria-current={isLinkActive("/features") ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 p-3 rounded-lg font-medium transition-colors",
                  isLinkActive("/features")
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                )}
              >
                {t("navFeatures")}
              </Link>

              {standardNavLinks.map((link) => {
                const active = isLinkActive(link.href);
                return (
                  <Link
                    key={link.href}
                    href={`/${locale}${link.href}`}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-2 p-3 rounded-lg font-medium transition-colors",
                      active
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                    )}
                  >
                    {t(link.labelKey)}
                  </Link>
                );
              })}

              {/* Mobile Auth CTAs */}
              {!isAuthenticated && (
                <div className="flex flex-col gap-2 mt-4 pt-4 border-t border-border">
                  <Link
                    href={`/${locale}/login`}
                    className="flex items-center justify-center p-3 rounded-lg bg-muted text-foreground font-medium"
                  >
                    {t("signIn")}
                  </Link>
                  <Link
                    href={`/${locale}/register`}
                    className="flex items-center justify-center p-3 rounded-lg bg-primary text-primary-foreground font-medium"
                  >
                    {t("signUp")}
                  </Link>
                </div>
              )}
              {isAuthenticated && (
                <div className="flex flex-col gap-2 mt-4 pt-4 border-t border-border">
                  <Link
                    href={`/${locale}/dashboard`}
                    className="flex items-center justify-center p-3 rounded-lg bg-primary text-primary-foreground font-medium"
                  >
                    {t("myAccount")}
                  </Link>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
