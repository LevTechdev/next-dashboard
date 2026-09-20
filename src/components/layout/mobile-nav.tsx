"use client";

import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { useState, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import { useViewTransition } from "@/components/view-transition-provider";
import { useAnalytics } from "@/hooks/use-analytics";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion } from "framer-motion";
import { CheckIcon, UsersIcon, EarthIcon } from "lucide-animated";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  MoreHorizontal,
  BarChart3,
  LineChart,
  Boxes,
  Megaphone,
  FileText,
  CreditCard,
  ClipboardCheck,
  ShieldCheck,
  Building2,
  Code2,
  UsersRound,
  Bell,
  LockKeyhole,
  Settings,
  BadgePercent,
  Link2,
  Activity,
} from "lucide-react";
import { useRealtime } from "@/components/realtime-provider";
import { useAuth } from "@/hooks/use-auth";
import { rolePrefixForRole } from "@/lib/role-routes";
import { canAccessPageForTier, type Role, type ClientTier } from "@/lib/permissions";

const LANGUAGES = [
  { code: "en", label: "EN", name: "English", flag: "🇬🇧" },
  { code: "id", label: "ID", name: "Bahasa Indonesia", flag: "🇮🇩" },
  { code: "zh", label: "中文", name: "简体中文", flag: "🇨🇳" },
  { code: "ja", label: "日本語", name: "日本語", flag: "🇯🇵" },
];

const moreNavItems = [
  { label: "Analytics", href: "/analytics", icon: BarChart3, key: "analytics" },
  { label: "Sales", href: "/sales", icon: LineChart, key: "sales" },
  { label: "Inventory", href: "/inventory", icon: Boxes, key: "inventory" },
  { label: "Marketing", href: "/marketing", icon: Megaphone, key: "marketing" },
  { label: "Affiliates", href: "/affiliates", icon: Link2, key: "affiliates" },
  { label: "Discounts", href: "/discounts", icon: BadgePercent, key: "discounts" },
  { label: "Reports", href: "/reports", icon: FileText, key: "reports" },
  { label: "Audit Log", href: "/audit-log", icon: ClipboardCheck, key: "auditLog" },
  { label: "Billing", href: "/billing", icon: CreditCard, key: "billing" },
];

/** Admin surfaces — same grouping as the sidebar's ADMIN section. */
const moreAdminItems = [
  { label: "Admin Console", href: "/admin", icon: ShieldCheck, key: "adminConsole" },
  { label: "System Health", href: "/system-health", icon: Activity, key: "systemHealth" },
  { label: "Roles", href: "/roles", icon: ShieldCheck, key: "roles" },
  { label: "Integrations", href: "/integrations", icon: Boxes, key: "integrations" },
  { label: "SSO", href: "/sso", icon: Building2, key: "sso" },
  { label: "API Docs", href: "/api-docs", icon: Code2, key: "apiDocs" },
];

/** Settings surfaces — mirrors the sidebar's ACCOUNT section minus Profile,
    which was deliberately removed from the dock More drawer. */
const moreSettingsItems = [
  { label: "Team", href: "/settings/team", icon: UsersRound, key: "team" },
  { label: "Notifications", href: "/notifications", icon: Bell, key: "notifications" },
  { label: "Security", href: "/security", icon: LockKeyhole, key: "security" },
  { label: "Settings", href: "/settings", icon: Settings, key: "settings" },
];

const mobileNavItems = [
  { label: "Home", labelKey: "home", href: "/dashboard", icon: LayoutDashboard, key: "dashboard" },
  { label: "Orders", labelKey: "orders", href: "/orders", icon: ShoppingCart, key: "orders" },
  {
    label: "Customers",
    labelKey: "customers",
    href: "/customers",
    icon: UsersIcon,
    key: "customers",
  },
  { label: "Products", labelKey: "products", href: "/products", icon: Package, key: "products" },
];

/** Spring curve for dock icon magnification */
const DOCK_SPRING = "transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)";

/** Role-scope URL prefixes — a page is reachable at both the canonical
    (/en/orders) and the role-scoped (/en/admin/orders) path, so nav active
    state must match either. */
const ROLE_PREFIXES = ["admin", "manager", "staff", "client", "enterprise"] as const;

/** Every URL that should light up a nav item with this href. */
function navHrefVariants(locale: string, href: string): string[] {
  return [`/${locale}${href}`, ...ROLE_PREFIXES.map((prefix) => `/${locale}/${prefix}${href}`)];
}

/**
 * Segment-aware active check: exact match, or the href followed by `/`.
 * A bare startsWith would light up `/en/orders` while on `/en/ordersx` and
 * silently miss the role-scoped `/en/admin/orders` (which is why the drawer
 * highlight used to disappear depending on which layout you entered from).
 */
function isPathActive(pathname: string, href: string): boolean {
  const clean = href.split(/[?#]/)[0];
  return pathname === clean || pathname.startsWith(`${clean}/`);
}

export function MobileNav() {
  const scrollTimer = useRef<number | null>(null);
  const pathname = usePathname();
  const params = useParams();
  const locale = (params?.locale as string) || "en";
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const { unreadCount } = useRealtime();
  const { push: pushWithTransition } = useViewTransition();
  const { trackLanguageSwitch } = useAnalytics();
  const tnav = useTranslations("nav");

  // Role-gate the More drawer exactly like the sidebar: same permission
  // layer, same client-tier resolution, so mobile users never see a tile
  // their role cannot open.
  const { user, tierFeatures } = useAuth();
  const role: Role | null = (user?.role as Role) || null;
  const clientTier: ClientTier =
    role === "CLIENT" || role === "CLIENT_ENTERPRISE"
      ? ((tierFeatures?.tier as ClientTier) ??
        (role === "CLIENT_ENTERPRISE" ? "ENTERPRISE" : "REGULAR"))
      : null;
  const canSee = (page: string) => canAccessPageForTier(page, role, clientTier);

  // Highlight the More button while the current page lives in its drawer, so
  // the dock still shows where you are when the active surface is a "More"
  // destination (Settings, Billing, Admin…) instead of one of the four tiles.
  const moreActive = [...moreNavItems, ...moreAdminItems, ...moreSettingsItems].some(
    (item) =>
      canSee(item.href.replace(/^\//, "").split("/")[0]) &&
      navHrefVariants(locale, item.href).some((h) => isPathActive(pathname, h)),
  );

  const switchLocale = (newLocale: string) => {
    if (newLocale === locale) return;
    setShowMoreMenu(false);
    trackLanguageSwitch(locale, newLocale);
    const newPath = pathname.replace(/^\/[a-z]{2}(?:-\w{2})?/, `/${newLocale}`);
    localStorage.setItem("dashboard-locale", newLocale);
    pushWithTransition(newPath);
  };

  const currentLang = LANGUAGES.find((l) => l.code === locale) || LANGUAGES[0];

  // Auto-hide scrollbar: reveal the thin 4px thumb only while the drawer is
  // being scrolled (covers touch devices where :hover never fires), then
  // fade it back out after the scroll settles.
  const [drawerScrolling, setDrawerScrolling] = useState(false);
  const handleDrawerScroll = useCallback(() => {
    setDrawerScrolling(true);
    if (scrollTimer.current) window.clearTimeout(scrollTimer.current);
    scrollTimer.current = window.setTimeout(() => setDrawerScrolling(false), 700);
  }, []);

  const handleNavTap = () => {
    if (navigator.vibrate) {
      navigator.vibrate(10);
    }
  };

  return (
    <nav
      data-testid="mobile-dock"
      className="fixed bottom-0 left-0 right-0 z-50 lg:hidden pointer-events-none"
    >
      {/* Floating glass dock pill — same frosted surface as the More drawer
          so both light and dark modes carry the profile-dropdown blur.

          NOTE: deliberately NO `--glass-filter` here. The liquid-glass SVG
          displacement warps everything inside the filtered element — it smeared
          the rounded corners (visible seams where the two sides met) and skewed
          the five dock labels so they read as italics. Frost (blur + saturate),
          tint, border and sheen remain; only the refraction is gone. */}
      <div
        className={cn(
          "liquid-glass-surface",
          // Strict 5-column grid: every dock slot is exactly one fifth of the
          // bar, so icons sit on a precise vertical rhythm instead of the
          // slight drift justify-around produces with mixed content widths.
          "grid grid-cols-5 items-stretch",
          "h-14 mx-3 mb-2 px-1.5 py-1",
          "rounded-[20px]",
          "bg-white/80 dark:bg-zinc-950/80 backdrop-blur-2xl backdrop-saturate-150",
          "border border-white/40 dark:border-white/10",
          "shadow-lg shadow-black/5 dark:shadow-black/20",
          "safe-area-bottom pointer-events-auto",
        )}
        style={
          {
            "--glass-blur": "12px",
          } as React.CSSProperties
        }
      >
        {mobileNavItems.map((item) => {
          // Hydration-stable home link: canonical while the session is
          // unresolved (server render == hydration pass), role-prefixed once
          // the user loads.
          const fullHref =
            item.href === "/dashboard"
              ? user
                ? `/${locale}/${rolePrefixForRole(user.role)}/dashboard`
                : `/${locale}/dashboard`
              : `/${locale}${item.href}`;
          const isActive = navHrefVariants(locale, item.href).some((h) =>
            isPathActive(pathname, h),
          );
          const Icon = item.icon;

          return (
            <Link
              key={fullHref}
              href={fullHref}
              onClick={handleNavTap}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 px-1 py-0.5 min-w-0 w-full relative cursor-pointer",
                "transition-colors duration-200",
                isActive
                  ? "text-primary"
                  : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300",
              )}
            >
              <div
                className={cn(
                  "flex items-center justify-center w-8 h-8 rounded-lg",
                  isActive && "bg-primary/10",
                )}
                style={{ transition: DOCK_SPRING }}
              >
                <Icon size={18} className="h-[18px] w-[18px]" />
              </div>
              <span className="block max-w-full truncate text-center text-[9px] font-medium leading-none">
                {tnav(item.labelKey)}
              </span>
              {/* Active indicator — subtle glow dot */}
              {isActive && (
                <span
                  className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary"
                  style={{ boxShadow: "0 0 6px 2px var(--color-primary, hsl(var(--primary)))" }}
                />
              )}
            </Link>
          );
        })}

        {/* More Button (Far Right) — language picker lives inside this menu */}
        <button
          onClick={() => {
            handleNavTap();
            setShowMoreMenu(!showMoreMenu);
          }}
          className={cn(
            "flex flex-col items-center justify-center gap-0.5 px-1 py-0.5 min-w-0 w-full relative cursor-pointer",
            "transition-colors duration-200",
            showMoreMenu || moreActive
              ? "text-primary"
              : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 active:text-primary",
          )}
        >
          <div
            className={cn(
              "flex items-center justify-center w-8 h-8 rounded-lg relative",
              (showMoreMenu || moreActive) && "bg-primary/10",
            )}
            style={{ transition: DOCK_SPRING }}
          >
            <MoreHorizontal size={18} className="h-[18px] w-[18px]" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border border-white/50" />
            )}
          </div>
          <span className="block max-w-full truncate text-center text-[9px] font-medium leading-none">
            {tnav("more")}
          </span>
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
              onScroll={handleDrawerScroll}
              className={cn(
                "fixed bottom-0 left-0 right-0 z-[52] rounded-t-[26px] p-3 safe-area-bottom overflow-y-auto max-h-[85vh] pointer-events-auto outline-none scrollbar-auto-hide bg-white/80 dark:bg-zinc-950/80 backdrop-blur-2xl backdrop-saturate-150 border border-white/40 dark:border-white/10 shadow-[0_-20px_50px_rgba(0,0,0,0.18)] dark:shadow-[0_-20px_50px_rgba(0,0,0,0.5)]",
                drawerScrolling && "scrolling",
              )}
              data-testid="mobile-dock-drawer"
            >
              <div className="relative">
                <div className="flex justify-center mb-3 cursor-grab active:cursor-grabbing">
                  <div className="w-10 h-1 bg-gray-300/80 dark:bg-gray-700 rounded-full" />
                </div>

                {/* Full menu surface, grouped like the sidebar (MANAGEMENT /
                  INSIGHTS / ADMIN / ACCOUNT) and role-gated by the same
                  permission layer. Sales-channel icons stay sidebar-only. */}
                {(
                  [
                    { items: moreNavItems, labelKey: null },
                    { items: moreAdminItems, labelKey: "admin" },
                    { items: moreSettingsItems, labelKey: "account" },
                  ] as const
                ).map((group) => {
                  const visible = group.items.filter((item) =>
                    canSee(item.href.replace(/^\//, "").split("/")[0]),
                  );
                  if (visible.length === 0) return null;
                  return (
                    <div key={group.labelKey ?? "main"} className="mb-2">
                      {group.labelKey && (
                        <p className="px-1 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {tnav(group.labelKey)}
                        </p>
                      )}
                      <div className="grid grid-cols-3 auto-rows-fr gap-1.5">
                        {visible.map((item) => {
                          const Icon = item.icon;
                          const fullHref = `/${locale}${item.href}`;
                          const isActive = navHrefVariants(locale, item.href).some((h) =>
                            isPathActive(pathname, h),
                          );
                          return (
                            <Link
                              key={item.key}
                              href={fullHref}
                              onClick={() => {
                                handleNavTap();
                                setShowMoreMenu(false);
                              }}
                              className={cn(
                                "flex h-full min-h-[64px] flex-col items-center justify-center gap-1 p-2 rounded-2xl transition-colors outline-none",
                                isActive
                                  ? "bg-primary/10 text-primary"
                                  : "hover:bg-black/[0.05] dark:hover:bg-white/[0.08] active:bg-primary/5 dark:active:bg-primary/10 focus:ring-2 focus:ring-primary/20",
                              )}
                            >
                              <div className="relative shrink-0">
                                <Icon
                                  size={20}
                                  className={
                                    isActive ? "text-primary" : "text-gray-600 dark:text-gray-300"
                                  }
                                />
                              </div>
                              <span
                                className={cn(
                                  "text-[10px] font-medium text-center line-clamp-2 leading-tight",
                                  isActive ? "text-primary" : "text-gray-600 dark:text-gray-400",
                                )}
                              >
                                {tnav(item.key)}
                              </span>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                {/* Language switcher — docked inside the More menu to keep the
                  bottom bar to 5 slots (Home/Orders/Customers/Products/More). */}
                <div className="pt-3 border-t border-black/[0.06] dark:border-white/10">
                  <div className="flex items-center justify-between mb-2 px-1">
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                      {tnav("language")}
                    </p>
                    <span className="flex items-center gap-1 text-[9px] font-semibold text-primary">
                      <EarthIcon size={12} className="h-3 w-3" />
                      {currentLang.label}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {LANGUAGES.map((lang) => {
                      const isSelected = locale === lang.code;
                      return (
                        <button
                          key={lang.code}
                          onClick={() => switchLocale(lang.code)}
                          className={cn(
                            "flex items-center gap-2 px-2 py-2 rounded-2xl border transition-colors cursor-pointer",
                            isSelected
                              ? "bg-primary/10 border-primary/30 text-primary font-medium"
                              : "border-black/[0.06] dark:border-white/10 text-foreground hover:bg-black/[0.05] dark:hover:bg-white/[0.08]",
                          )}
                        >
                          <span className="text-sm shrink-0">{lang.flag}</span>
                          <span className="flex-1 text-left min-w-0">
                            <span className="block text-[11px] leading-tight">{lang.label}</span>
                            <span className="block text-[9px] text-muted-foreground leading-tight mt-0.5 truncate">
                              {lang.name}
                            </span>
                          </span>
                          {isSelected && (
                            <CheckIcon size={12} className="h-3 w-3 text-primary shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </nav>
  );
}
