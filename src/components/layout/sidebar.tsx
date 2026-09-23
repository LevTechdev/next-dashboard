"use client";

import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { TransitionLink } from "@/components/transition-link";
import { cn } from "@/lib/utils";
import { ScrollContainer } from "@/components/ui/scroll-container";
import { Tooltip } from "@/components/ui/tooltip";
import {
  LayoutGridIcon,
  ChartBarIncreasingIcon,
  CartIcon,
  BoxesIcon,
  UsersIcon,
  BoxIcon,
  ArchiveIcon,
  RadioTowerIcon,
  LinkIcon,
  BadgePercentIcon,
  FileChartLineIcon,
  ClipboardCheckIcon,
  ShieldCheckIcon,
  EarthIcon,
  KeyIcon,
  UsersRoundIcon,
  CreditCardIcon,
  BellIcon,
  LockKeyholeIcon,
  SettingsIcon,
  UserIcon,
  PanelLeftOpenIcon,
  PanelLeftCloseIcon,
} from "lucide-animated";
import {
  OnlineStoreIcon,
  FacebookBrandIcon,
  InstagramBrandIcon,
  TikTokBrandIcon,
  ShopifyBrandIcon,
  ShopeeBrandIcon,
  TokopediaBrandIcon,
} from "@/components/ui/brand-icons";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { canAccessPageForTier, type Role, type ClientTier } from "@/lib/permissions";
import { rolePrefixForRole } from "@/lib/role-routes";

function useLocale() {
  const params = useParams();
  return (params?.locale as string) || "en";
}

/**
 * PAGE_ACCESS is keyed by the route's leaf segment (e.g. "/settings/team" →
 * "team", "/dashboard" → "dashboard"). Resolve the same way so deep links
 * like /settings/team are permission-checked against the right page.
 */
function pageKey(href: string): string {
  return href.replace(/^\//, "").split("/")[0];
}

/** Role-scope URL prefixes — every page is reachable at both its canonical
    (/en/orders) and role-scoped (/en/admin/orders) path. */
const ROLE_PREFIXES = ["admin", "manager", "staff", "client", "enterprise"] as const;

/**
 * Nav active state across both URL shapes. The drawer is opened from the
 * header hamburger at tablet/mobile widths, where the user may have arrived
 * through a role-scoped link — comparing only the canonical href left the
 * current page unhighlighted on every one of those pages.
 */
function isNavItemActive(pathname: string, locale: string, href: string): boolean {
  const clean = href.split(/[?#]/)[0];
  const candidates = [
    `/${locale}${clean}`,
    ...ROLE_PREFIXES.map((prefix) => `/${locale}/${prefix}${clean}`),
  ];
  return candidates.some((h) => pathname === h || pathname.startsWith(`${h}/`));
}

const navItems = [
  { label: "dashboard", href: "/dashboard", icon: LayoutGridIcon },
  { label: "analytics", href: "/analytics", icon: ChartBarIncreasingIcon },
  { label: "sales", href: "/sales", icon: CartIcon },
  { label: "orders", href: "/orders", icon: BoxesIcon },
];

const managementItems = [
  { label: "customers", href: "/customers", icon: UsersIcon },
  { label: "products", href: "/products", icon: BoxIcon },
  { label: "inventory", href: "/inventory", icon: ArchiveIcon },
  { label: "marketing", href: "/marketing", icon: RadioTowerIcon },
  { label: "affiliates", href: "/affiliates", icon: LinkIcon },
  { label: "discounts", href: "/discounts", icon: BadgePercentIcon },
];

const insightsItems = [
  { label: "reports", href: "/reports", icon: FileChartLineIcon },
  { label: "auditLog", href: "/audit-log", icon: ClipboardCheckIcon },
];

import { Code2, Building2, Activity } from "lucide-react";

const adminItems = [
  { label: "adminConsole", href: "/admin", icon: ShieldCheckIcon },
  // Consolidated operations console — admin-only (see PAGE_ACCESS).
  { label: "systemHealth", href: "/system-health", icon: Activity },
  { label: "roles", href: "/roles", icon: ShieldCheckIcon },
  { label: "integrations", href: "/integrations", icon: EarthIcon },
  // SSO is an enterprise-building surface — match the Building2 icon used by
  // the SSO settings page buttons.
  { label: "sso", href: "/sso", icon: Building2 },
  { label: "apiDocs", href: "/api-docs", icon: Code2 },
];

const settingsItems = [
  { label: "team", href: "/settings/team", icon: UsersRoundIcon },
  { label: "billing", href: "/billing", icon: CreditCardIcon },
  { label: "notifications", href: "/notifications", icon: BellIcon },
  { label: "security", href: "/security", icon: LockKeyholeIcon },
  { label: "settings", href: "/settings", icon: SettingsIcon },
  { label: "profile", href: "/profile", icon: UserIcon },
];

const channelItems = [
  {
    name: "onlineStore",
    href: "/sales?channel=online-store",
    icon: OnlineStoreIcon,
    color: "text-emerald-500",
  },
  {
    name: "facebook",
    href: "/sales?channel=facebook",
    icon: FacebookBrandIcon,
    color: "text-blue-500",
  },
  {
    name: "facebookShop",
    href: "/sales?channel=facebook-shop",
    icon: FacebookBrandIcon,
    color: "text-blue-600",
  },
  {
    name: "instagram",
    href: "/sales?channel=instagram",
    icon: InstagramBrandIcon,
    color: "text-pink-500",
  },
  { name: "tiktok", href: "/sales?channel=tiktok", icon: TikTokBrandIcon, color: "text-rose-500" },
  {
    name: "shopify",
    href: "/sales?channel=shopify",
    icon: ShopifyBrandIcon,
    color: "text-[#95BF47]",
  },
  {
    name: "shopee",
    href: "/sales?channel=shopee",
    icon: ShopeeBrandIcon,
    color: "text-[#EE4D2D]",
  },
  {
    name: "tokopedia",
    href: "/sales?channel=tokopedia",
    icon: TokopediaBrandIcon,
    color: "text-[#03AC0E]",
  },
];

interface NavSectionProps {
  title: string;
  items: { label: string; href: string; icon: React.ElementType; badge?: number }[];
  collapsed: boolean;
  locale: string;
  t: (key: string) => string;
  onNavigate?: () => void;
}

function NavSection({ title, items, collapsed, locale, t, onNavigate }: NavSectionProps) {
  const pathname = usePathname();

  return (
    <div className="mb-4">
      {!collapsed && (
        <p className="px-3 mb-2 text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500/70">
          {t(title)}
        </p>
      )}
      <div className="space-y-0.5">
        {items.map((item) => {
          const fullHref = `/${locale}${item.href}`;
          const isActive = isNavItemActive(pathname, locale, item.href);
          const Icon = item.icon;
          // Collapsed rail: boardui-style no-arrow tooltip instead of the
          // native title (which renders unstyled and is delay-locked).
          const link = (
            <Link
              key={fullHref}
              href={fullHref}
              onClick={() => onNavigate?.()}
              className={cn(
                "sidebar-item",
                isActive
                  ? "sidebar-item-active"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200",
              )}
            >
              <Icon size={18} className="h-[18px] w-[18px] shrink-0" />
              {!collapsed && (
                <>
                  <span className="truncate">{t(item.label)}</span>
                  {item.badge && (
                    <span className="ml-auto bg-primary/15 text-primary text-xs font-medium px-2 py-0.5 rounded-full">
                      {item.badge}
                    </span>
                  )}
                </>
              )}
            </Link>
          );
          return collapsed ? (
            <Tooltip key={fullHref} content={t(item.label)} side="right" delay={0}>
              {link}
            </Tooltip>
          ) : (
            link
          );
        })}
      </div>
    </div>
  );
}

export function Sidebar({
  collapsed,
  onToggle,
  embedded,
  onClose,
  onNavigate,
}: {
  collapsed: boolean;
  onToggle: () => void;
  embedded?: boolean;
  onClose?: () => void;
  onNavigate?: () => void;
}) {
  const locale = useLocale();
  const pathname = usePathname();
  const tnav = useTranslations("nav");
  const tsales = useTranslations("sales");
  const tApp = useTranslations("app");
  const tcommon = useTranslations("common");
  // Real role from the session — the nav must reflect what the user may open,
  // not a hardcoded ADMIN. Client tiers additionally unlock tier-gated pages.
  const { user, tierFeatures } = useAuth();
  const role: Role | null = (user?.role as Role) || null;
  const clientTier: ClientTier =
    role === "CLIENT" || role === "CLIENT_ENTERPRISE"
      ? ((tierFeatures?.tier as ClientTier) ??
        (role === "CLIENT_ENTERPRISE" ? "ENTERPRISE" : "REGULAR"))
      : null;
  const canSee = (page: string) => canAccessPageForTier(page, role, clientTier);

  return (
    <aside
      className={cn(
        "h-full bg-white dark:bg-gray-950/95 border-r border-gray-200 dark:border-gray-800/50 transition-all duration-300 flex flex-col",
        !embedded && "fixed left-0 top-0 z-40 h-screen",
        embedded ? "w-72" : collapsed ? "w-[72px]" : "w-64",
      )}
    >
      {/* Top Header: Logo + Brand on left, Close button on right (if onClose provided) */}
      <div
        className={cn(
          "flex items-center h-16 border-b border-gray-200/70 dark:border-gray-800/50",
          collapsed ? "justify-center px-0 w-full" : "justify-between px-4",
        )}
      >
        <TransitionLink
          // Hydration-stable: canonical while the session is unresolved (the
          // server render and the client's hydration pass both see user=null),
          // upgrading to the role-prefixed scope once the user loads.
          href={
            user ? `/${locale}/${rolePrefixForRole(user.role)}/dashboard` : `/${locale}/dashboard`
          }
          viewTransitionName="nav-logo"
          onClick={() => onNavigate?.()}
          className={cn(
            "flex items-center hover:bg-gray-50/50 dark:hover:bg-gray-900/50 transition-colors group min-w-0",
            collapsed ? "justify-center px-0 w-full" : "gap-3 flex-1",
          )}
        >
          <div className="flex items-center justify-center w-8 h-8 rounded-[10px] bg-gradient-to-br from-primary via-primary/95 to-primary/80 text-primary-foreground shadow-md shadow-primary/25 border border-primary/20 shrink-0 group-hover:scale-105 group-hover:shadow-primary/40 transition-all">
            <LayoutGridIcon size={16} className="h-4 w-4 shrink-0 m-auto" />
          </div>
          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <span className="text-base font-bold text-gray-900 dark:text-gray-100 flex items-center gap-1.5 leading-tight">
                {tApp("name")}
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-primary/15 text-[8px] font-bold text-primary uppercase tracking-wider border border-primary/20">
                  Pro
                </span>
              </span>
              <span className="text-[10px] text-gray-400 dark:text-gray-500 truncate">
                {tApp("tagline")}
              </span>
            </div>
          )}
        </TransitionLink>

        {onClose && (
          <button
            onClick={onClose}
            className="p-1.5 -mr-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors shrink-0 cursor-pointer"
            aria-label={tcommon("close") || "Close sidebar"}
          >
            <svg
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Navigation */}
      <ScrollContainer className="flex-1 px-3 py-4">
        <NavSection
          title="management"
          items={navItems.filter((i) => canSee(pageKey(i.href) || "dashboard"))}
          collapsed={collapsed}
          locale={locale}
          t={tnav}
          onNavigate={onNavigate}
        />
        <NavSection
          title="management"
          items={managementItems.filter((i) => canSee(pageKey(i.href)))}
          collapsed={collapsed}
          locale={locale}
          t={tnav}
          onNavigate={onNavigate}
        />
        <NavSection
          title="insights"
          items={insightsItems.filter((i) => canSee(pageKey(i.href)))}
          collapsed={collapsed}
          locale={locale}
          t={tnav}
          onNavigate={onNavigate}
        />
        <NavSection
          title="account"
          items={settingsItems.filter((i) => canSee(pageKey(i.href)))}
          collapsed={collapsed}
          locale={locale}
          t={tnav}
          onNavigate={onNavigate}
        />
        <NavSection
          title="admin"
          items={adminItems.filter((i) => canSee(pageKey(i.href)))}
          collapsed={collapsed}
          locale={locale}
          t={tnav}
          onNavigate={onNavigate}
        />

        {/* Sales Channels */}
        {!collapsed && (
          <div className="mb-2">
            <p className="px-3 mb-2 text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500/70">
              {tnav("channels")}
            </p>
            <div className="space-y-0.5">
              {channelItems.map((channel) => {
                const ChannelIcon = channel.icon;
                return (
                  <Link
                    key={channel.href}
                    href={`/${locale}${channel.href}`}
                    onClick={() => onNavigate?.()}
                    className={cn(
                      "sidebar-item",
                      pathname === channel.href
                        ? "sidebar-item-active"
                        : "text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200",
                    )}
                  >
                    <ChannelIcon className={cn("h-[18px] w-[18px] shrink-0", channel.color)} />
                    <span className="truncate">{tsales(channel.name)}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </ScrollContainer>

      {/* Collapse button */}
      <div className="border-t border-gray-200/70 dark:border-gray-800/50 p-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggle}
          className={cn(
            "w-full justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300",
            collapsed ? "px-0" : "",
          )}
        >
          {collapsed ? (
            <PanelLeftOpenIcon size={16} className="h-4 w-4" animateOnHover={false} />
          ) : (
            <>
              <PanelLeftCloseIcon size={16} className="h-4 w-4 mr-1" animateOnHover={false} />
              <span className="text-xs">{tcommon("collapse")}</span>
            </>
          )}
        </Button>
      </div>
    </aside>
  );
}
