"use client";

import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useViewTransition } from "@/components/view-transition-provider";
import { useAnalytics } from "@/hooks/use-analytics";
import { AnimatePresence, motion } from "framer-motion";
import { LayoutDashboard, ShoppingCart, Users, Package, Globe, Check } from "lucide-react";

const LANGUAGES = [
  { code: "en", label: "EN", name: "English", flag: "🇬🇧" },
  { code: "id", label: "ID", name: "Bahasa Indonesia", flag: "🇮🇩" },
  { code: "zh", label: "中文", name: "简体中文", flag: "🇨🇳" },
  { code: "ja", label: "日本語", name: "日本語", flag: "🇯🇵" },
];

const mobileNavItems = [
  { label: "Home", href: "/dashboard", icon: LayoutDashboard },
  { label: "Orders", href: "/orders", icon: ShoppingCart },
  { label: "Customers", href: "/customers", icon: Users },
  { label: "Products", href: "/products", icon: Package },
];

const popoverVariants = {
  hidden: {
    opacity: 0,
    y: 12,
    scale: 0.92,
    transformOrigin: "bottom center",
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: "spring" as const,
      stiffness: 350,
      damping: 25,
      mass: 0.8,
    },
  },
  exit: {
    opacity: 0,
    y: 8,
    scale: 0.95,
    transition: {
      duration: 0.15,
      ease: "easeIn" as const,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, x: -8 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: {
      delay: 0.03 * i,
      type: "spring" as const,
      stiffness: 300,
      damping: 24,
    },
  }),
};

export function MobileNav() {
  const pathname = usePathname();
  const params = useParams();
  const locale = (params?.locale as string) || "en";
  const [showLangMenu, setShowLangMenu] = useState(false);
  const { push: pushWithTransition } = useViewTransition();
  const { trackLanguageSwitch } = useAnalytics();

  const switchLocale = (newLocale: string) => {
    if (newLocale === locale) return;
    setShowLangMenu(false);
    trackLanguageSwitch(locale, newLocale);
    const newPath = pathname.replace(/^\/[a-z]{2}(?:-\w{2})?/, `/${newLocale}`);
    localStorage.setItem("dashboard-locale", newLocale);
    pushWithTransition(newPath);
  };

  const currentLang = LANGUAGES.find((l) => l.code === locale) || LANGUAGES[0];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 lg:hidden">
      <div className="flex items-center justify-around h-16 bg-white dark:bg-gray-950 border-t border-gray-200 dark:border-gray-800 safe-area-bottom">
        {mobileNavItems.map((item) => {
          const fullHref = `/${locale}${item.href}`;
          const isActive =
            pathname === fullHref ||
            (item.href !== "" && pathname.startsWith(fullHref)) ||
            (item.href === "" && pathname === `/${locale}`);
          const Icon = item.icon;

          return (
            <Link
              key={fullHref}
              href={fullHref}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 px-3 py-1 min-w-[64px] transition-colors duration-200 relative",
                isActive
                  ? "text-indigo-600 dark:text-indigo-400"
                  : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300",
              )}
            >
              <div
                className={cn(
                  "flex items-center justify-center w-10 h-8 rounded-lg transition-all duration-200",
                  isActive && "bg-indigo-50 dark:bg-indigo-900/20",
                )}
              >
                <Icon className="h-5 w-5" />
              </div>
              <span className="text-[10px] font-medium leading-none">{item.label}</span>
              {isActive && (
                <span className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-full" />
              )}
            </Link>
          );
        })}

        {/* Language Picker with active-state feedback */}
        <div className="relative">
          <motion.button
            whileTap={{ scale: 0.88 }}
            onClick={() => setShowLangMenu(!showLangMenu)}
            className={cn(
              "flex flex-col items-center justify-center gap-0.5 px-3 py-1 min-w-[64px] transition-colors duration-200 relative",
              showLangMenu
                ? "text-indigo-600 dark:text-indigo-400"
                : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 active:text-indigo-500",
            )}
            aria-label="Switch language"
          >
            <motion.div
              animate={
                showLangMenu
                  ? { scale: [1, 1.15, 1], rotate: [0, -8, 8, 0] }
                  : { scale: 1, rotate: 0 }
              }
              transition={{ duration: 0.4, ease: "easeInOut" }}
              className={cn(
                "flex items-center justify-center w-10 h-8 rounded-lg transition-all duration-200",
                showLangMenu &&
                  "bg-indigo-50 dark:bg-indigo-900/20 ring-2 ring-indigo-200 dark:ring-indigo-800",
              )}
            >
              <span className="text-sm leading-none mr-0.5">{currentLang.flag}</span>
              <Globe className="h-4 w-4" />
            </motion.div>
            <span
              className={cn(
                "text-[10px] font-semibold leading-none transition-all duration-200",
                showLangMenu
                  ? "text-indigo-600 dark:text-indigo-400"
                  : "text-gray-500 dark:text-gray-400",
              )}
            >
              {currentLang.label}
            </span>
            {showLangMenu && (
              <motion.span
                layoutId="mobileLangActiveBar"
                className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-full"
              />
            )}
          </motion.button>

          {/* Animated Language Popover */}
          <AnimatePresence>
            {showLangMenu && (
              <>
                <motion.div
                  key="lang-backdrop"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="fixed inset-0 z-40"
                  onClick={() => setShowLangMenu(false)}
                />
                <motion.div
                  key="lang-popover"
                  variants={popoverVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 z-50 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-2xl overflow-hidden min-w-[184px]"
                >
                  {/* Header */}
                  <div className="px-4 pt-3 pb-2 border-b border-gray-100 dark:border-gray-800">
                    <p className="text-[11px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                      Language
                    </p>
                  </div>

                  {/* Language list with staggered entrance */}
                  {LANGUAGES.map((lang, idx) => {
                    const isSelected = locale === lang.code;
                    return (
                      <motion.button
                        key={lang.code}
                        custom={idx}
                        variants={itemVariants}
                        initial="hidden"
                        animate="visible"
                        whileHover={{ x: 4 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => switchLocale(lang.code)}
                        className={cn(
                          "w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors",
                          isSelected
                            ? "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 font-medium"
                            : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50",
                        )}
                      >
                        <span className="text-base shrink-0">{lang.flag}</span>
                        <div className="flex-1 text-left min-w-0">
                          <span
                            className={cn(
                              "block text-sm leading-tight",
                              isSelected && "text-indigo-600 dark:text-indigo-400",
                            )}
                          >
                            {lang.label}
                          </span>
                          <span className="block text-[10px] text-gray-400 dark:text-gray-500 leading-tight mt-0.5 truncate">
                            {lang.name}
                          </span>
                        </div>
                        {isSelected ? (
                          <motion.span
                            initial={{ scale: 0, rotate: -90 }}
                            animate={{ scale: 1, rotate: 0 }}
                            transition={{ type: "spring", stiffness: 400, damping: 20 }}
                          >
                            <Check className="h-4 w-4 text-indigo-500" />
                          </motion.span>
                        ) : (
                          <span className="h-1.5 w-1.5 rounded-full bg-gray-200 dark:bg-gray-700" />
                        )}
                      </motion.button>
                    );
                  })}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>
    </nav>
  );
}
