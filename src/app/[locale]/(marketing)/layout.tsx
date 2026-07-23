"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useAnalytics } from "@/hooks/use-analytics";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Menu,
  X,
  ChevronRight,
  Rows,
  Shield,
  Sparkles,
  Layers,
  Sun,
  Moon,
  Globe,
  Info,
  MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import PageTransition from "@/components/page-transition";
import { ViewTransitionProvider, useViewTransition } from "@/components/view-transition-provider";
import { TransitionLink } from "@/components/transition-link";
import UnsupportedBrowserBanner from "@/components/unsupported-browser-banner";

const navLinks = [
  { label: "Features", href: "/features", icon: Rows },
  { label: "Integrations", href: "/integrations-overview", icon: Layers },
  { label: "Pricing", href: "/pricing", icon: Shield },
  { label: "Changelog", href: "/changelog", icon: Sparkles },
  { label: "About", href: "/about", icon: Info },
  { label: "Contact", href: "/contact", icon: MessageSquare },
];

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const pathname = usePathname();
  const locale = (params?.locale as string) || "en";
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const { trackLanguageSwitch } = useAnalytics();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [prevLocale, setPrevLocale] = useState(locale);

  useEffect(() => setMounted(true), []);

  // Track scroll for navbar transparency
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // Track language switches
  useEffect(() => {
    if (prevLocale !== locale) {
      trackLanguageSwitch(prevLocale, locale);
      setPrevLocale(locale);
    }
  }, [locale, prevLocale, trackLanguageSwitch]);

  const { push: pushWithTransition } = useViewTransition();

  const switchLocale = (newLocale: string) => {
    trackLanguageSwitch(locale, newLocale);
    const newPath = pathname.replace(/^\/[a-z]{2}/, `/${newLocale}`);
    localStorage.setItem("dashboard-locale", newLocale);
    pushWithTransition(newPath);
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
              "relative flex items-center gap-1.5 text-sm font-medium transition-all motion-spring-fast px-3 py-2 rounded-lg",
              isActive
                ? "text-foreground bg-black/5 dark:bg-white/10 dark:text-white"
                : "text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/[0.04] dark:hover:text-white",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {link.label}
          </Link>
        );
      })}
    </>
  );

  return (
    <ViewTransitionProvider>
      <UnsupportedBrowserBanner />
      <div className="min-h-screen bg-zinc-50 dark:bg-[#0b0c11] text-zinc-900 dark:text-zinc-100 transition-colors motion-spring">
        {/* ═══ FLUID ISLAND NAV ═══ */}
        <header className="fixed top-0 left-0 right-0 z-50 flex justify-center px-4 pt-4">
          <motion.nav
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
              "w-full max-w-7xl mx-auto glass-panel rounded-2xl px-4 transition-all motion-spring",
              scrolled
                ? "shadow-xl shadow-black/10 dark:shadow-2xl dark:shadow-black/30"
                : "shadow-lg shadow-black/5 dark:shadow-lg dark:shadow-black/10",
            )}
          >
            <div className="flex items-center justify-between h-14 lg:h-16">
              {/* Logo (shared element — morphs smoothly across pages) */}
              <TransitionLink
                href={`/${locale}`}
                viewTransitionName="nav-logo"
                className="flex items-center gap-2.5 group shrink-0"
              >
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-foreground text-background shadow-lg transition-shadow group-hover:shadow-xl">
                  <LayoutDashboard className="h-[18px] w-[18px]" />
                </div>
                <span className="text-sm font-semibold text-foreground">Dashboard</span>
              </TransitionLink>

              {/* Desktop Nav */}
              <nav className="hidden md:flex items-center gap-1">{navItems}</nav>

              {/* Right Side: Toggles + CTAs */}
              <div className="hidden md:flex items-center gap-1.5">
                {/* Language Toggle */}
                <div className="flex items-center gap-0.5 px-1.5 py-1 rounded-lg bg-black/5 dark:bg-white/5 mr-1">
                  <Globe className="h-3.5 w-3.5 text-muted-foreground mr-1" />
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
                    <Sun className="h-4 w-4" />
                  ) : (
                    <Moon className="h-4 w-4" />
                  )}
                </button>

                {/* CTAs */}
                <div className="flex items-center gap-2.5 ml-2">
                  <Link href={`/${locale}/dashboard`}>
                    <Button className="h-9 px-4 text-xs gap-1.5 bg-foreground text-background hover:opacity-90 rounded-lg font-medium press-scale">
                      Dashboard
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </Link>
                </div>
              </div>

              {/* Mobile: Language + Theme + Menu */}
              <div className="flex md:hidden items-center gap-1">
                {/* Language Toggle (mobile compact) */}
                <button
                  onClick={() => switchLocale(locale === "en" ? "id" : "en")}
                  className="p-2 rounded-lg text-muted-foreground hover:text-foreground dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-all"
                  aria-label="Switch language"
                >
                  <Globe className="h-4 w-4" />
                </button>

                {/* Theme Toggle (mobile) */}
                <button
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                  className="p-2 rounded-lg text-muted-foreground hover:text-foreground dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-all"
                  aria-label="Toggle theme"
                >
                  {mounted && theme === "dark" ? (
                    <Sun className="h-4 w-4" />
                  ) : (
                    <Moon className="h-4 w-4" />
                  )}
                </button>

                {/* Menu button */}
                <button
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="p-2 rounded-lg text-muted-foreground hover:text-foreground dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-all"
                  aria-label="Toggle menu"
                >
                  {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                </button>
              </div>
            </div>
          </motion.nav>
        </header>

        {/* ═══ MOBILE MENU OVERLAY ═══ */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-white/90 dark:bg-black/80 backdrop-blur-3xl md:hidden pt-24"
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
                className="px-6 py-6 space-y-1"
              >
                {navLinks.map((link) => {
                  const isActive = pathname === `/${locale}${link.href}`;
                  const Icon = link.icon;
                  return (
                    <motion.div
                      key={link.href}
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
                        <Icon className="h-5 w-5" />
                        {link.label}
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
                    <Globe className="h-4 w-4 text-muted-foreground" />
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

                  <Link
                    href={`/${locale}/dashboard`}
                    className="flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl text-sm font-medium bg-foreground text-background hover:opacity-90 transition-all"
                  >
                    Go to Dashboard
                    <ChevronRight className="h-4 w-4" />
                  </Link>
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
                <p className="text-sm text-muted-foreground leading-relaxed">
                  A comprehensive business management platform with real-time analytics, order
                  tracking, team collaboration, and everything you need to run your business
                  efficiently.
                </p>
              </div>

              {/* Product */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
                  Product
                </h3>
                <ul className="space-y-3">
                  {[
                    { label: "Features", href: "/features" },
                    { label: "Integrations", href: "/integrations-overview" },
                    { label: "Changelog", href: "/changelog" },
                    { label: "Pricing", href: "/pricing" },
                    { label: "About", href: "/about" },
                    { label: "Contact", href: "/contact" },
                  ].map((link) => (
                    <li key={link.href}>
                      <Link
                        href={`/${locale}${link.href}`}
                        className="text-sm text-muted-foreground hover:text-foreground dark:hover:text-white transition-colors"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Company */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
                  Company
                </h3>
                <ul className="space-y-3">
                  <li>
                    <Link
                      href={`/${locale}/dashboard`}
                      className="text-sm text-muted-foreground hover:text-foreground dark:hover:text-white transition-colors"
                    >
                      Dashboard
                    </Link>
                  </li>
                  <li>
                    <Link
                      href={`/${locale}/features`}
                      className="text-sm text-muted-foreground hover:text-foreground dark:hover:text-white transition-colors"
                    >
                      Features
                    </Link>
                  </li>
                </ul>
              </div>
            </div>

            <div className="mt-14 pt-8 border-t border-border">
              <p className="text-xs text-muted-foreground text-center">
                &copy; {new Date().getFullYear()} Dashboard Management System. All rights reserved.
              </p>
            </div>
          </div>
        </footer>
      </div>
    </ViewTransitionProvider>
  );
}
