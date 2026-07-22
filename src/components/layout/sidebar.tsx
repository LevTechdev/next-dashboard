"use client";

import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { TransitionLink } from "@/components/transition-link";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  ShoppingCart,
  Users,
  Package,
  BarChart3,
  Megaphone,
  Tag,
  FileText,
  ShoppingBag,
  Box,
  Settings,
  Users2,
  ClipboardList,
  UserCircle,
  ChevronLeft,
  ChevronRight,
  Store,
  Shield,
  Globe,
  CreditCard,
  Bell,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { canAccessPage, getRole } from "@/lib/permissions";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  badge?: number;
}

function useLocale() {
  const params = useParams();
  return (params?.locale as string) || "en";
}

const navItems = [
  { label: "dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "analytics", href: "/analytics", icon: BarChart3 },
  { label: "sales", href: "/sales", icon: ShoppingCart },
  { label: "orders", href: "/orders", icon: ShoppingBag },
];

const managementItems = [
  { label: "customers", href: "/customers", icon: Users },
  { label: "products", href: "/products", icon: Package },
  { label: "inventory", href: "/inventory", icon: Box },
  { label: "marketing", href: "/marketing", icon: Megaphone },
  { label: "discounts", href: "/discounts", icon: Tag },
];

const insightsItems = [
  { label: "reports", href: "/reports", icon: FileText },
  { label: "auditLog", href: "/audit-log", icon: ClipboardList },
];

const adminItems = [
  { label: "roles", href: "/roles", icon: Shield },
  { label: "integrations", href: "/integrations", icon: Globe },
];

const settingsItems = [
  { label: "team", href: "/team", icon: Users2 },
  { label: "billing", href: "/billing", icon: CreditCard },
  { label: "notifications", href: "/notifications", icon: Bell },
  { label: "settings", href: "/settings", icon: Settings },
  { label: "profile", href: "/profile", icon: UserCircle },
];

const channelItems = [
  { name: "onlineStore", href: "/sales?channel=online-store", color: "text-emerald-500" },
  { name: "facebook", href: "/sales?channel=facebook", color: "text-blue-500" },
  { name: "facebookShop", href: "/sales?channel=facebook-shop", color: "text-blue-600" },
  { name: "instagram", href: "/sales?channel=instagram", color: "text-pink-500" },
  { name: "tiktok", href: "/sales?channel=tiktok", color: "text-rose-500" },
  { name: "shopify", href: "/sales?channel=shopify", color: "text-green-600" },
];

interface NavSectionProps {
  title: string;
  items: { label: string; href: string; icon: React.ElementType; badge?: number }[];
  collapsed: boolean;
  locale: string;
  t: (key: string) => string;
}

function NavSection({ title, items, collapsed, locale, t }: NavSectionProps) {
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
              className={cn(
                "sidebar-item",
                isActive
                  ? "sidebar-item-active"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              )}
              title={collapsed ? t(item.label) : undefined}
            >
              <Icon className="h-[18px] w-[18px] shrink-0" />
              {!collapsed && (
                <>
                  <span className="truncate">{t(item.label)}</span>
                  {item.badge && (
                    <span className="ml-auto bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-xs font-medium px-2 py-0.5 rounded-full">
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

export function Sidebar({ collapsed, onToggle, embedded }: { collapsed: boolean; onToggle: () => void; embedded?: boolean }) {
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
        embedded ? "w-72" : collapsed ? "w-[72px]" : "w-64"
      )}
    >
      {/* Logo (shared element — morphs smoothly across pages) */}
      <TransitionLink
        href={`/${locale}/dashboard`}
        viewTransitionName="nav-logo"
        className="flex items-center gap-3 h-16 px-4 border-b border-gray-200/70 dark:border-gray-800/50 hover:bg-gray-50/50 dark:hover:bg-gray-900/50 transition-colors group"
      >
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white shadow-lg shadow-indigo-500/20 dark:shadow-indigo-500/10 shrink-0 group-hover:scale-105 transition-transform">
          <LayoutDashboard className="h-5 w-5" />
        </div>
        {!collapsed && (
          <div className="flex flex-col">
            <span className="text-base font-bold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
              {tApp("name")}
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-900/40 text-[8px] font-bold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider">
                Pro
              </span>
            </span>
            <span className="text-[10px] text-gray-400 dark:text-gray-500 -mt-0.5">{tApp("tagline")}</span>
          </div>
        )}
      </TransitionLink>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto px-3 py-4 scrollbar-thin">
        <NavSection title="management" items={navItems.filter(i => canAccessPage(i.href.replace(/^\//, "") || "dashboard", role))} collapsed={collapsed} locale={locale} t={tnav} />
        <NavSection title="management" items={managementItems.filter(i => canAccessPage(i.href.replace(/^\//, ""), role))} collapsed={collapsed} locale={locale} t={tnav} />
        <NavSection title="insights" items={insightsItems.filter(i => canAccessPage(i.href.replace(/^\//, ""), role))} collapsed={collapsed} locale={locale} t={tnav} />
        <NavSection title="account" items={settingsItems.filter(i => canAccessPage(i.href.replace(/^\//, ""), role))} collapsed={collapsed} locale={locale} t={tnav} />
        <NavSection title="admin" items={adminItems.filter(i => canAccessPage(i.href.replace(/^\//, ""), role))} collapsed={collapsed} locale={locale} t={tnav} />

        {/* Sales Channels */}
        {!collapsed && (
          <div className="mb-2">
            <p className="px-3 mb-2 text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500/70">
              {tnav("channels")}
            </p>
            <div className="space-y-0.5">
              {channelItems.map((channel) => (
                <Link
                  key={channel.href}
                  href={`/${locale}${channel.href}`}
                  className={cn(
                    "sidebar-item",
                    pathname === channel.href
                      ? "sidebar-item-active text-indigo-600 dark:text-indigo-400"
                      : "text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                  )}
                >
                  <Store className={cn("h-[18px] w-[18px] shrink-0", channel.color)} />
                  <span className="truncate">{tsales(channel.name)}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Collapse button */}
      <div className="border-t border-gray-200/70 dark:border-gray-800/50 p-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggle}
          className={cn(
            "w-full justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300",
            collapsed ? "px-0" : ""
          )}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <>
              <ChevronLeft className="h-4 w-4 mr-1" />
              <span className="text-xs">{tcommon("collapse")}</span>
            </>
          )}
        </Button>
      </div>
    </aside>
  );
}
