"use client";

import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useViewTransition } from "@/components/view-transition-provider";
import { useAnalytics } from "@/hooks/use-analytics";
import { AnimatePresence, motion } from "framer-motion";
import { CheckIcon, UsersIcon, EarthIcon } from "lucide-animated";
import { 
  LayoutDashboard, ShoppingCart, Package, MoreHorizontal, 
  BarChart3, LineChart, Boxes, Megaphone, FileText, 
  CreditCard, Bell, Settings, Shield, Users as UsersLucide, User 
} from "lucide-react";
import { useRealtime } from "@/components/realtime-provider";

const LANGUAGES = [
  { code: "en", label: "EN", name: "English", flag: "🇬🇧" },
  { code: "id", label: "ID", name: "Bahasa Indonesia", flag: "🇮🇩" },
  { code: "zh", label: "中文", name: "简体中文", flag: "🇨🇳" },
  { code: "ja", label: "日本語", name: "日本語", flag: "🇯🇵" },
];

const moreNavItems = [
  { label: "Analytics", href: "/analytics", icon: BarChart3 },
  { label: "Sales", href: "/sales", icon: LineChart },
  { label: "Inventory", href: "/inventory", icon: Boxes },
  { label: "Marketing", href: "/marketing", icon: Megaphone },
  { label: "Reports", href: "/reports", icon: FileText },
  { label: "Billing", href: "/billing", icon: CreditCard },
  { label: "Notifications", href: "/notifications", icon: Bell },
  { label: "Settings", href: "/settings", icon: Settings },
  { label: "Security", href: "/security", icon: Shield },
  { label: "Team", href: "/settings/team", icon: UsersLucide },
  { label: "Profile", href: "/profile", icon: User },
];

const mobileNavItems = [
  { label: "Home", href: "/dashboard", icon: LayoutDashboard },
  { label: "Orders", href: "/orders", icon: ShoppingCart },
  { label: "Customers", href: "/customers", icon: UsersIcon },
  { label: "Products", href: "/products", icon: Package },
];

const popoverVariants = {
  hidden: {
    opacity: 0,
    y: 12,
    scale: 0.92,
    transformOrigin: "bottom right",
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
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const { unreadCount } = useRealtime();
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

  const handleNavTap = () => {
    if (navigator.vibrate) {
      navigator.vibrate(10);
    }
  };

  return (
    <nav data-testid="mobile-dock" className="fixed bottom-0 left-0 right-0 z-50 lg:hidden pointer-events-none">
      <div className="flex items-center justify-around h-16 bg-white dark:bg-gray-950 border-t border-gray-200 dark:border-gray-800 safe-area-bottom pointer-events-auto">
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
              onClick={handleNavTap}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 px-3 py-1 min-w-[64px] transition-colors duration-200 relative cursor-pointer",
                isActive
                  ? "text-primary"
                  : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300",
              )}
            >
              <div
                className={cn(
                  "flex items-center justify-center w-10 h-8 rounded-lg transition-all duration-200",
                  isActive && "bg-primary/10",
                )}
              >
                <Icon size={20} className="h-5 w-5" />
              </div>
              <span className="text-[10px] font-medium leading-none">{item.label}</span>
              {isActive && (
                <span className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary rounded-full" />
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
              "flex flex-col items-center justify-center gap-0.5 px-3 py-1 min-w-[64px] transition-colors duration-200 relative cursor-pointer",
              showLangMenu
                ? "text-primary"
                : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 active:text-primary",
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
                showLangMenu && "bg-primary/10 ring-2 ring-primary/30",
              )}
            >
              <span className="text-sm leading-none mr-0.5">{currentLang.flag}</span>
              <EarthIcon size={16} className="h-4 w-4" />
            </motion.div>
            <span
              className={cn(
                "text-[10px] font-semibold leading-none transition-all duration-200",
                showLangMenu ? "text-primary" : "text-gray-500 dark:text-gray-400",
              )}
            >
              {currentLang.label}
            </span>
            {showLangMenu && (
              <motion.span
                layoutId="mobileLangActiveBar"
                className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary rounded-full"
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
                  className="absolute bottom-full right-0 mb-3 z-50 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-2xl overflow-y-auto max-h-[calc(100dvh-5rem)] scrollbar-thin min-w-[184px]"
                >
                  <div className="px-4 pt-3 pb-2 border-b border-gray-100 dark:border-gray-800">
                    <p className="text-[11px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                      Language
                    </p>
                  </div>
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
                            ? "bg-primary/10 text-primary font-medium"
                            : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50",
                        )}
                      >
                        <span className="text-base shrink-0">{lang.flag}</span>
                        <div className="flex-1 text-left min-w-0">
                          <span
                            className={cn(
                              "block text-sm leading-tight",
                              isSelected && "text-primary",
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
                            <CheckIcon size={16} className="h-4 w-4 text-primary" />
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

        {/* More Button (Moved to Far Right) */}
        <button
          onClick={() => {
            handleNavTap();
            setShowMoreMenu(!showMoreMenu);
          }}
          className={cn(
            "flex flex-col items-center justify-center gap-0.5 px-3 py-1 min-w-[64px] transition-colors duration-200 relative cursor-pointer",
            showMoreMenu
              ? "text-primary"
              : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 active:text-primary",
          )}
        >
          <div
            className={cn(
              "flex items-center justify-center w-10 h-8 rounded-lg transition-all duration-200 relative",
              showMoreMenu && "bg-primary/10",
            )}
          >
            <MoreHorizontal size={20} className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-2 w-2 h-2 bg-red-500 rounded-full border border-white dark:border-gray-950" />
            )}
          </div>
          <span className="text-[10px] font-medium leading-none">More</span>
        </button>

      </div>
      
      {/* More Menu Drawer */}
      <AnimatePresence>
        {showMoreMenu && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMoreMenu(false)}
              className="fixed inset-0 bg-black/40 z-[51] pointer-events-auto"
            />
            <motion.div
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={0.2}
              onDragEnd={(e, info) => {
                if (info.offset.y > 100 || info.velocity.y > 500) {
                  setShowMoreMenu(false);
                }
              }}
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-[52] bg-white dark:bg-gray-900 rounded-t-2xl p-4 safe-area-bottom shadow-xl border-t border-gray-200 dark:border-gray-800 overflow-y-auto max-h-[85vh] pointer-events-auto"
            >
              <div className="flex justify-center mb-4 cursor-grab active:cursor-grabbing">
                <div className="w-12 h-1.5 bg-gray-300 dark:bg-gray-700 rounded-full" />
              </div>
              <div className="grid grid-cols-3 gap-4 mb-2">
                {moreNavItems.map((item) => {
                  const Icon = item.icon;
                  const fullHref = `/${locale}${item.href}`;
                  const isActive = pathname.startsWith(fullHref);
                  return (
                    <Link
                      key={item.label}
                      href={fullHref}
                      onClick={() => {
                        handleNavTap();
                        setShowMoreMenu(false);
                      }}
                      className={cn(
                        "flex flex-col items-center justify-center gap-2 p-3 rounded-xl transition-colors outline-none",
                        isActive 
                          ? "bg-primary/10 text-primary" 
                          : "hover:bg-gray-50 dark:hover:bg-gray-800/50 active:bg-primary/5 dark:active:bg-primary/10 focus:ring-2 focus:ring-primary/20"
                      )}
                    >
                      <div className="relative">
                        <Icon size={24} className={isActive ? "text-primary" : "text-gray-600 dark:text-gray-300"} />
                        {item.label === "Notifications" && unreadCount > 0 && (
                          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-gray-900" />
                        )}
                      </div>
                      <span className={cn("text-[11px] font-medium text-center", isActive ? "text-primary" : "text-gray-600 dark:text-gray-400")}>
                        {item.label}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </nav>
  );
}
