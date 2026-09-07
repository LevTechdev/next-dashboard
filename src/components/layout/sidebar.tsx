"use client";

import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { TransitionLink } from "@/components/transition-link";
import { cn } from "@/lib/utils";
import { ScrollContainer } from "@/components/ui/scroll-container";
import {
  LayoutGridIcon,
  SparklesIcon,
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
  WhatsAppBrandIcon,
  LazadaBrandIcon,
} from "@/components/ui/brand-icons";
import { Button } from "@/components/ui/button";
import { canAccessPage } from "@/lib/permissions";

function useLocale() {
  const params = useParams();
  return (params?.locale as string) || "en";
}

const navItems = [
  { label: "dashboard", href: "/dashboard", icon: LayoutGridIcon },
  { label: "aiGenerator", href: "/dashboard/generate", icon: SparklesIcon },
  { label: "projects", href: "/dashboard/projects", icon: ArchiveIcon },
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

const adminItems = [
  { label: "superAdmin", href: "/admin", icon: ShieldCheckIcon },
  { label: "roles", href: "/roles", icon: ShieldCheckIcon },
  { label: "integrations", href: "/integrations", icon: EarthIcon },
  { label: "sso", href: "/sso", icon: KeyIcon },
];

const settingsItems = [
  { label: "team", href: "/team", icon: UsersRoundIcon },
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
  {
    name: "whatsapp",
    href: "/sales?channel=whatsapp",
    icon: WhatsAppBrandIcon,
    color: "text-[#25D366]",
  },
  {
    name: "lazada",
    href: "/sales?channel=lazada",
    icon: LazadaBrandIcon,
    color: "text-indigo-600",
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
          const isActive = pathname === fullHref || pathname.startsWith(fullHref + "/");
          const Icon = item.icon;
          return (
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
              title={collapsed ? t(item.label) : undefined}
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
  const role = "ADMIN" as const;

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
          href={`/${locale}/dashboard`}
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
          items={navItems.filter((i) =>
            canAccessPage(i.href.replace(/^\//, "") || "dashboard", role),
          )}
          collapsed={collapsed}
          locale={locale}
          t={tnav}
          onNavigate={onNavigate}
        />
        <NavSection
          title="management"
          items={managementItems.filter((i) => canAccessPage(i.href.replace(/^\//, ""), role))}
          collapsed={collapsed}
          locale={locale}
          t={tnav}
          onNavigate={onNavigate}
        />
        <NavSection
          title="insights"
          items={insightsItems.filter((i) => canAccessPage(i.href.replace(/^\//, ""), role))}
          collapsed={collapsed}
          locale={locale}
          t={tnav}
          onNavigate={onNavigate}
        />
        <NavSection
          title="account"
          items={settingsItems.filter((i) => canAccessPage(i.href.replace(/^\//, ""), role))}
          collapsed={collapsed}
          locale={locale}
          t={tnav}
          onNavigate={onNavigate}
        />
        <NavSection
          title="admin"
          items={adminItems.filter((i) => canAccessPage(i.href.replace(/^\//, ""), role))}
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
