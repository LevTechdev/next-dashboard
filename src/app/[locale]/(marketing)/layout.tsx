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

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const pathname = usePathname();
  const locale = (params?.locale as string) || "en";
  const { theme, setTheme } = useTheme();
  const t = useTranslations("site");
  const [mounted, setMounted] = useState(false);
  const { trackLanguageSwitch } = useAnalytics();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
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

  // Track scroll for navbar transparency
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 0);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false); // eslint-disable-line react-hooks/set-state-in-effect
  }, [pathname]);

  // Track language switches
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
    // Persist locale for next-intl middleware and bust the client Router Cache
    // so server components re-render with the new locale's messages.
    setLocaleCookie(newLocale);
    router.push(newPath);
    router.refresh();
  };

  const navItems = (
    <>
      {navLinks.map((link) => {
        const isActive = pathname === `/${locale}${link.href}`;
        const Icon = link.icon;
        return (
          <Link
            key={link.href}
            href={`/${locale}${link.href}`}
            className={cn(
              "relative flex items-center gap-1.5 text-[13px] font-medium tracking-[-0.01em] transition-colors duration-200 px-2.5 py-1.5 rounded-lg whitespace-nowrap",
              isActive
                ? "text-primary bg-primary/10"
                : "text-black/70 hover:text-black hover:bg-black/[0.04] dark:text-white/70 dark:hover:text-white dark:hover:bg-white/[0.06]",
            )}
          >
            <Icon size={14} className="h-3.5 w-3.5" />
            {t(link.labelKey)}
          </Link>
        );
      })}
    </>
  );

  return (
    <ViewTransitionProvider>
      <UnsupportedBrowserBanner />
      <div className="min-h-screen bg-zinc-50 dark:bg-[#0b0c11] text-zinc-900 dark:text-zinc-100 transition-colors motion-spring">
        {/* ═══ APPLE HIG FROSTED-GLASS NAV (full-width sticky bar) ═══ */}
        <header
          className={cn(
            "fixed top-0 left-0 right-0 z-50 apple-glass",
            scrolled && "apple-glass-scrolled",
          )}
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div
              className={cn(
                "flex items-center justify-between h-[52px] transition-[height] duration-300 ease-out",
                scrolled && "h-11",
              )}
            >
              {/* Logo (shared element — morphs smoothly across pages) */}
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
              <nav className="hidden lg:flex items-center gap-0.5 lg:gap-1">{navItems}</nav>

              {/* Right Side: Toggles + CTAs */}
              <div className="hidden lg:flex items-center gap-1 lg:gap-1.5">
                {/* Language Toggle */}
                <div className="flex items-center gap-0.5 px-1.5 py-1 rounded-lg bg-black/5 dark:bg-white/5 mr-0.5 lg:mr-1">
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

                {/* CTAs — auth-aware */}
                <div className="flex items-center gap-2 ml-1 lg:ml-2">
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
              </div>

              {/* Mobile: Language + Theme + Menu */}
              <div className="flex lg:hidden items-center gap-1">
                {/* Language Toggle (mobile compact) */}
                <button
                  onClick={() => switchLocale(locale === "en" ? "id" : "en")}
                  className="p-2 rounded-lg text-muted-foreground hover:text-foreground dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-all"
                  aria-label="Switch language"
                >
                  <EarthIcon size={16} className="h-4 w-4" />
                </button>

                {/* Theme Toggle (mobile) */}
                <button
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                  className="p-2 rounded-lg text-muted-foreground hover:text-foreground dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-all"
                  aria-label="Toggle theme"
                >
                  {mounted && theme === "dark" ? (
                    <SunIcon size={16} className="h-4 w-4" />
                  ) : (
                    <MoonIcon size={16} className="h-4 w-4" />
                  )}
                </button>

                {/* Menu button */}
                <button
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="p-2 rounded-lg text-muted-foreground hover:text-foreground dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-all"
                  aria-label="Toggle menu"
                >
                  {mobileMenuOpen ? (
                    <XIcon size={20} className="h-5 w-5" />
                  ) : (
                    <MenuIcon size={20} className="h-5 w-5" animateOnHover={false} />
                  )}
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* ═══ MOBILE MENU OVERLAY ═══ */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-white/90 dark:bg-black/80 backdrop-blur-3xl lg:hidden overflow-y-auto"
            >
              <motion.div
                initial="hidden"
                animate="visible"
                exit="hidden"
                variants={{
                  hidden: {},
                  visible: {
                    transition: { staggerChildren: 0.06, delayChildren: 0.1 },
                  },
                }}
                // min-h-full + flex-col + mb-auto on the last nav item keeps
                // the profile / sign-in section pinned to the bottom edge, and
                // overflow-y-auto on the overlay keeps it reachable by
                // scrolling on short viewports instead of being cut off.
                className="min-h-full flex flex-col px-6 pt-16 pb-6"
              >
                {navLinks.map((link, idx) => {
                  const isActive = pathname === `/${locale}${link.href}`;
                  const Icon = link.icon;
                  return (
                    <motion.div
                      key={link.href}
                      className={idx === navLinks.length - 1 ? "mb-auto" : undefined}
                      variants={{
                        hidden: { opacity: 0, y: 20, x: -10 },
                        visible: {
                          opacity: 1,
                          y: 0,
                          x: 0,
                          transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] },
                        },
                      }}
                    >
                      <Link
                        href={`/${locale}${link.href}`}
                        className={cn(
                          "flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-medium transition-all",
                          isActive
                            ? "bg-black/10 dark:bg-white/10 text-foreground dark:text-white"
                            : "text-muted-foreground hover:text-foreground dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5",
                        )}
                      >
                        <Icon size={20} className="h-5 w-5" />
                        {t(link.labelKey)}
                      </Link>
                    </motion.div>
                  );
                })}
                <motion.hr
                  variants={{
                    hidden: { opacity: 0 },
                    visible: { opacity: 1, transition: { delay: 0.3 } },
                  }}
                  className="border-border my-4"
                />
                <motion.div
                  variants={{
                    hidden: { opacity: 0, y: 20 },
                    visible: {
                      opacity: 1,
                      y: 0,
                      transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] },
                    },
                  }}
                  className="space-y-2 pt-2"
                >
                  {/* Mobile language switcher */}
                  <div className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-black/5 dark:bg-white/5 mb-3">
                    <EarthIcon size={16} className="h-4 w-4 text-muted-foreground" />
                    <button
                      onClick={() => switchLocale("en")}
                      className={cn(
                        "flex-1 text-center px-3 py-1.5 text-sm font-semibold rounded-lg transition-all",
                        locale === "en"
                          ? "bg-white dark:bg-white/20 text-foreground dark:text-white shadow-sm"
                          : "text-muted-foreground",
                      )}
                    >
                      English
                    </button>
                    <button
                      onClick={() => switchLocale("id")}
                      className={cn(
                        "flex-1 text-center px-3 py-1.5 text-sm font-semibold rounded-lg transition-all",
                        locale === "id"
                          ? "bg-white dark:bg-white/20 text-foreground dark:text-white shadow-sm"
                          : "text-muted-foreground",
                      )}
                    >
                      Indonesia
                    </button>
                  </div>

                  {isAuthenticated ? (
                    <Link
                      href={`/${locale}/dashboard`}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition-all"
                    >
                      <Avatar className="h-10 w-10 ring-2 ring-primary/40 shrink-0">
                        <AvatarImage src={user?.avatar || ""} alt={user?.name || ""} />
                        <AvatarFallback className="text-sm bg-primary text-primary-foreground font-semibold">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-sm font-semibold text-foreground truncate">
                          {user?.name || "User"}
                        </span>
                        <span className="text-xs text-muted-foreground">{t("goToDashboard")}</span>
                      </div>
                      <ChevronRightIcon
                        size={18}
                        className="h-4 w-4 text-muted-foreground shrink-0"
                      />
                    </Link>
                  ) : (
                    <div className="flex items-center gap-2">
                      <RadialGlowButton
                        asChild
                        size="sm"
                        wrapperClassName="w-full flex-1"
                        className="w-full text-center"
                        style={{ minHeight: 44, lineHeight: "44px" }}
                      >
                        <Link href={`/${locale}/login`}>{t("signIn")}</Link>
                      </RadialGlowButton>
                      <RadialGlowButton
                        asChild
                        size="sm"
                        wrapperClassName="w-full flex-1"
                        className="w-full text-center"
                        style={{ minHeight: 44, lineHeight: "44px" }}
                      >
                        <Link href={`/${locale}/register`}>
                          {t("signUp")}
                          <ChevronRightIcon
                            size={16}
                            className="h-4 w-4 inline-block align-middle ml-1.5"
                          />
                        </Link>
                      </RadialGlowButton>
                    </div>
                  )}
                </motion.div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

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
