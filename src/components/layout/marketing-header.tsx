"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { useAnalytics } from "@/hooks/use-analytics";
import { setLocaleCookie } from "@/lib/locale-cookie";
import {
  XIcon,
  MenuIcon,
  ChevronRightIcon,
  SparklesIcon,
  LayersIcon,
  SunIcon,
  MoonIcon,
  MessageSquareIcon,
} from "lucide-animated";
import { LayoutDashboard, BarChart3Icon, EarthIcon, LayoutGridIcon, CircleDollarSignIcon, UsersIcon, ShieldIcon, ZapIcon, GlobeIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { RadialGlowButton } from "@/components/ui/radial-glow-button";
import { useAuth } from "@/hooks/use-auth";
import { TransitionLink } from "@/components/transition-link";
import { AnimatePresence, motion } from "framer-motion";

export function MarketingHeader({ scrolled }: { scrolled: boolean }) {
  const params = useParams();
  const pathname = usePathname();
  const locale = (params?.locale as string) || "en";
  const { theme, setTheme } = useTheme();
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

  const router = useRouter();

  const switchLocale = (newLocale: string) => {
    if (newLocale === locale) return;
    trackLanguageSwitch(locale, newLocale);
    const newPath = pathname.replace(/^\/[a-z]{2}(?:-\w{2})?/, `/${newLocale}`);
    localStorage.setItem("dashboard-locale", newLocale);
    setLocaleCookie(newLocale);
    router.push(newPath);
    router.refresh();
  };

  const isLinkActive = (href: string) => pathname.startsWith(`/${locale}${href}`);

  const megaMenuItems = [
    {
      title: "Analytics",
      desc: "Real-time metrics and reporting",
      icon: BarChart3Icon,
      href: "/features#analytics",
      color: "text-blue-500",
      bg: "bg-blue-500/10",
    },
    {
      title: "Security",
      desc: "Enterprise-grade protection",
      icon: ShieldIcon,
      href: "/features#security",
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
    },
    {
      title: "Automation",
      desc: "Smart workflows and triggers",
      icon: ZapIcon,
      href: "/features#automation",
      color: "text-amber-500",
      bg: "bg-amber-500/10",
    },
    {
      title: "Global Scale",
      desc: "Multi-currency & languages",
      icon: GlobeIcon,
      href: "/features#scale",
      color: "text-indigo-500",
      bg: "bg-indigo-500/10",
    },
  ];

  const standardNavLinks = [
    { labelKey: "navIntegrations", href: "/integrations-overview", icon: LayersIcon },
    { labelKey: "navPricing", href: "/pricing", icon: CircleDollarSignIcon },
    { labelKey: "navChangelog", href: "/changelog", icon: SparklesIcon },
    { labelKey: "navAbout", href: "/about", icon: UsersIcon },
    { labelKey: "navContact", href: "/contact", icon: MessageSquareIcon },
  ] as const;

  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        scrolled 
          ? "bg-background/80 backdrop-blur-md border-b border-border shadow-sm py-1.5"
          : "bg-transparent py-3"
      )}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-11">
          {/* Logo */}
          <TransitionLink
            href={`/${locale}`}
            viewTransitionName="nav-logo"
            className="flex items-center gap-2.5 group shrink-0"
          >
            <div
              className={cn(
                "flex items-center justify-center rounded-lg bg-foreground text-background shadow-lg transition-all duration-300 group-hover:shadow-xl",
                scrolled ? "w-7 h-7" : "w-8 h-8",
              )}
            >
              <LayoutDashboard className="h-[18px] w-[18px]" />
            </div>
            <span
              className={cn(
                "font-semibold text-foreground transition-all duration-300",
                scrolled ? "text-[13px]" : "text-sm",
              )}
            >
              Dashboard
            </span>
          </TransitionLink>

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
                <LayoutGridIcon size={14} className="h-3.5 w-3.5" />
                {t("navFeatures")}
                <ChevronRightIcon size={12} className="h-3 w-3 ml-0.5 opacity-50 group-hover:rotate-90 transition-transform duration-200" />
              </Link>
              
              {/* Mega Menu Dropdown */}
              <div className="absolute top-full left-0 pt-2 w-[480px] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 -translate-y-2 group-hover:translate-y-0 z-50">
                <div className="p-4 bg-background/95 backdrop-blur-xl border border-border shadow-2xl rounded-2xl grid grid-cols-2 gap-2">
                  <div className="col-span-2 px-3 pb-2 mb-2 border-b border-border flex justify-between items-center">
                    <span className="text-sm font-semibold">{t("navFeatures")}</span>
                    <Link href={`/${locale}/features`} className="text-xs text-primary hover:underline flex items-center">
                      View all <ChevronRightIcon size={10} className="ml-1" />
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
                          <h4 className="text-sm font-medium text-foreground mb-0.5">{item.title}</h4>
                          <p className="text-xs text-muted-foreground line-clamp-1">{item.desc}</p>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </div>
            </div>

            {standardNavLinks.map((link) => {
              const isActive = isLinkActive(link.href);
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={`/${locale}${link.href}`}
                  className={cn(
                    "relative flex items-center gap-1.5 text-[13px] font-medium tracking-[-0.01em] transition-colors duration-200 px-3 py-2 rounded-lg whitespace-nowrap",
                    isActive
                      ? "text-primary bg-primary/10"
                      : "text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5",
                  )}
                >
                  <Icon size={14} className="h-3.5 w-3.5" />
                  {t(link.labelKey)}
                </Link>
              );
            })}
          </nav>

          {/* Right Side: Toggles + CTAs */}
          <div className="flex items-center gap-1 lg:gap-1.5">
            {/* Language Toggle */}
            <div className="hidden sm:flex items-center gap-0.5 px-1.5 py-1 rounded-lg bg-black/5 dark:bg-white/5 mr-0.5 lg:mr-1">
              <EarthIcon
                size={14}
                className="hidden lg:block h-3.5 w-3.5 text-muted-foreground mr-1"
              />
              <button
                onClick={() => switchLocale("en")}
                className={cn(
                  "px-2 py-0.5 text-[11px] font-semibold rounded-md transition-all motion-spring-fast",
                  locale === "en"
                    ? "bg-white dark:bg-white/20 text-foreground dark:text-white shadow-sm"
                    : "text-muted-foreground hover:text-foreground dark:hover:text-white",
                )}
              >
                EN
              </button>
              <button
                onClick={() => switchLocale("id")}
                className={cn(
                  "px-2 py-0.5 text-[11px] font-semibold rounded-md transition-all motion-spring-fast",
                  locale === "id"
                    ? "bg-white dark:bg-white/20 text-foreground dark:text-white shadow-sm"
                    : "text-muted-foreground hover:text-foreground dark:hover:text-white",
                )}
              >
                ID
              </button>
            </div>

            {/* Theme Toggle */}
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-all motion-spring-fast"
              aria-label="Toggle theme"
            >
              {mounted && theme === "dark" ? (
                <SunIcon size={16} className="h-4 w-4" />
              ) : (
                <MoonIcon size={16} className="h-4 w-4" />
              )}
            </button>

            {/* CTAs */}
            <div className="hidden sm:flex items-center gap-2 ml-1 lg:ml-2">
              {!mounted || isLoading ? (
                <div className="h-9 w-9 rounded-full bg-black/5 dark:bg-white/10 animate-pulse" />
              ) : isAuthenticated ? (
                <Link
                  href={`/${locale}/dashboard`}
                  aria-label={t("myAccount")}
                  title={user?.name || t("myAccount")}
                  className="group flex items-center rounded-full press-scale"
                >
                  <Avatar className="h-9 w-9 ring-2 ring-primary/40 ring-offset-2 ring-offset-transparent transition-all group-hover:ring-primary/70">
                    <AvatarImage src={user?.avatar || ""} alt={user?.name || ""} />
                    <AvatarFallback className="text-xs bg-primary text-primary-foreground font-semibold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                </Link>
              ) : (
                <>
                  <RadialGlowButton asChild size="sm">
                    <Link href={`/${locale}/login`}>{t("signIn")}</Link>
                  </RadialGlowButton>
                  <RadialGlowButton asChild size="sm">
                    <Link href={`/${locale}/register`}>
                      {t("signUp")}
                      <ChevronRightIcon
                        size={14}
                        className="h-3.5 w-3.5 inline-block align-middle ml-1.5"
                      />
                    </Link>
                  </RadialGlowButton>
                </>
              )}
            </div>

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
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
              <Link
                href={`/${locale}/features`}
                className="flex items-center gap-2 p-3 rounded-lg hover:bg-muted/50 font-medium"
              >
                <LayoutGridIcon size={16} className="text-primary" />
                {t("navFeatures")}
              </Link>
              
              {standardNavLinks.map((link) => {
                const Icon = link.icon;
                return (
                  <Link
                    key={link.href}
                    href={`/${locale}${link.href}`}
                    className="flex items-center gap-2 p-3 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground font-medium"
                  >
                    <Icon size={16} />
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
