"use client";

import { useState, useEffect, useCallback, useRef, useMemo, type ComponentType } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  SearchIcon,
  ArrowRightIcon,
  UsersIcon,
  LayoutGridIcon,
  ChartBarIncreasingIcon,
  CartIcon,
  BoxesIcon,
  BoxIcon,
  ArchiveIcon,
  ShieldCheckIcon,
  UsersRoundIcon,
  CreditCardIcon,
  SettingsIcon,
} from "lucide-animated";
import { ShoppingBag, Package, Command, Loader2, Sparkles, PlusCircle, Palette, Download } from "lucide-react";
import { useTheme } from "next-themes";

import { cn } from "@/lib/utils";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ScrollContainer } from "@/components/ui/scroll-container";
import { useAiCopilot } from "@/components/ai/ai-copilot-provider";

// ── Types ──

interface SearchResult {
  orders: SearchOrder[];
  customers: SearchCustomer[];
  products: SearchProduct[];
}

interface SearchOrder {
  id: string;
  orderNumber: string;
  status: string;
  grandTotal: number;
  customer?: { name: string } | null;
  channel?: { name: string } | null;
}

interface SearchCustomer {
  id: string;
  name: string;
  email: string | null;
  city: string | null;
  totalSpent: number;
  segment: string | null;
}

interface SearchProduct {
  id: string;
  name: string;
  sku: string | null;
  price: number;
  stock: number;
  category?: { name: string } | null;
}

interface ResultItem {
  id: string;
  label: string;
  subtitle: string;
  icon: ComponentType<{ className?: string; size?: number }>;
  iconBg: string;
  iconColor: string;
  href: string;
}

interface NavMenuItem {
  id: string;
  label: string;
  subtitle: string;
  href: string;
  keywords: string[];
  icon: ComponentType<{ className?: string; size?: number }>;
  iconBg: string;
  iconColor: string;
}

const DASHBOARD_MENUS: NavMenuItem[] = [
  {
    id: "nav-dashboard",
    label: "Dashboard",
    subtitle: "Real-time metrics, regional telemetry & financial overview",
    href: "/dashboard",
    keywords: ["home", "main", "metrics", "stats", "telemetry", "revenue"],
    icon: LayoutGridIcon,
    iconBg: "bg-indigo-50 dark:bg-indigo-900/30",
    iconColor: "text-indigo-600 dark:text-indigo-400",
  },
  {
    id: "nav-analytics",
    label: "Analytics",
    subtitle: "Conversion funnels, cohort retention & revenue projections",
    href: "/analytics",
    keywords: ["funnel", "cohort", "retention", "sankey", "traffic", "growth"],
    icon: ChartBarIncreasingIcon,
    iconBg: "bg-blue-50 dark:bg-blue-900/30",
    iconColor: "text-blue-600 dark:text-blue-400",
  },
  {
    id: "nav-sales",
    label: "Sales Management",
    subtitle: "Multi-channel orders, settlement streams & transactions",
    href: "/sales",
    keywords: ["sales", "revenue", "channels", "shopee", "tiktok", "instagram", "store"],
    icon: CartIcon,
    iconBg: "bg-emerald-50 dark:bg-emerald-900/30",
    iconColor: "text-emerald-600 dark:text-emerald-400",
  },
  {
    id: "nav-orders",
    label: "Orders",
    subtitle: "Fulfillment workflows, shipments & order management",
    href: "/orders",
    keywords: ["orders", "purchase", "invoice", "receipt", "tracking", "status"],
    icon: BoxesIcon,
    iconBg: "bg-sky-50 dark:bg-sky-900/30",
    iconColor: "text-sky-600 dark:text-sky-400",
  },
  {
    id: "nav-customers",
    label: "Customers",
    subtitle: "Directory, customer lifetime value & segments",
    href: "/customers",
    keywords: ["customers", "users", "clients", "buyers", "profiles", "ltv"],
    icon: UsersIcon,
    iconBg: "bg-purple-50 dark:bg-purple-900/30",
    iconColor: "text-purple-600 dark:text-purple-400",
  },
  {
    id: "nav-products",
    label: "Products",
    subtitle: "Catalog inventory, pricing, variants & catalog",
    href: "/products",
    keywords: ["products", "items", "inventory", "stock", "sku", "catalog"],
    icon: BoxIcon,
    iconBg: "bg-orange-50 dark:bg-orange-900/30",
    iconColor: "text-orange-600 dark:text-orange-400",
  },
  {
    id: "nav-inventory",
    label: "Inventory & Logistics",
    subtitle: "Stock levels, fleet tracking & supplier orders",
    href: "/inventory",
    keywords: ["inventory", "fleet", "shipping", "carriers", "stock", "warehouse", "logistics"],
    icon: ArchiveIcon,
    iconBg: "bg-amber-50 dark:bg-amber-900/30",
    iconColor: "text-amber-600 dark:text-amber-400",
  },
  {
    id: "nav-security",
    label: "Security Center",
    subtitle: "Fraud risk radar, active sessions & 2FA / Passkeys",
    href: "/security",
    keywords: ["security", "fraud", "radar", "sessions", "passkeys", "totp", "audit", "compliance"],
    icon: ShieldCheckIcon,
    iconBg: "bg-rose-50 dark:bg-rose-900/30",
    iconColor: "text-rose-600 dark:text-rose-400",
  },
  {
    id: "nav-team",
    label: "Team Management",
    subtitle: "Team members, roles, invitations & permissions",
    href: "/team",
    keywords: ["team", "members", "invites", "roles", "rbac", "staff", "admin"],
    icon: UsersRoundIcon,
    iconBg: "bg-teal-50 dark:bg-teal-900/30",
    iconColor: "text-teal-600 dark:text-teal-400",
  },
  {
    id: "nav-billing",
    label: "Billing & Subscriptions",
    subtitle: "Invoices, tax nexus, payment methods & plans",
    href: "/billing",
    keywords: ["billing", "tax", "nexus", "invoices", "payment", "subscription", "stripe"],
    icon: CreditCardIcon,
    iconBg: "bg-violet-50 dark:bg-violet-900/30",
    iconColor: "text-violet-600 dark:text-violet-400",
  },
  {
    id: "nav-settings",
    label: "Settings",
    subtitle: "Workspace preferences, appearance & notifications",
    href: "/settings",
    keywords: ["settings", "preferences", "appearance", "dark", "light", "theme", "color"],
    icon: SettingsIcon,
    iconBg: "bg-slate-50 dark:bg-slate-800",
    iconColor: "text-slate-600 dark:text-slate-400",
  },
];

interface QuickActionItem {
  id: string;
  label: string;
  subtitle: string;
  icon: ComponentType<{ className?: string; size?: number }>;
  iconBg: string;
  iconColor: string;
  keywords: string[];
  action: "navigate" | "inline";
  href?: string;
  inlineAction?: string;
}

const QUICK_ACTIONS: QuickActionItem[] = [
  {
    id: "qa-create-product",
    label: "Create Product",
    subtitle: "Add a new product to your catalog",
    icon: PlusCircle,
    iconBg: "bg-emerald-50 dark:bg-emerald-900/30",
    iconColor: "text-emerald-600 dark:text-emerald-400",
    keywords: ["create", "add", "new", "product"],
    action: "navigate",
    href: "/products?action=create",
  },
  {
    id: "qa-create-order",
    label: "Create Order",
    subtitle: "Start a new order manually",
    icon: CartIcon,
    iconBg: "bg-blue-50 dark:bg-blue-900/30",
    iconColor: "text-blue-600 dark:text-blue-400",
    keywords: ["create", "add", "new", "order"],
    action: "navigate",
    href: "/orders?action=create",
  },
  {
    id: "qa-invite-member",
    label: "Invite Team Member",
    subtitle: "Send an invitation to join your workspace",
    icon: UsersRoundIcon,
    iconBg: "bg-teal-50 dark:bg-teal-900/30",
    iconColor: "text-teal-600 dark:text-teal-400",
    keywords: ["invite", "team", "member", "add", "staff"],
    action: "navigate",
    href: "/team?action=invite",
  },
  {
    id: "qa-toggle-theme",
    label: "Toggle Theme",
    subtitle: "Switch between light, dark, and system theme",
    icon: Palette,
    iconBg: "bg-violet-50 dark:bg-violet-900/30",
    iconColor: "text-violet-600 dark:text-violet-400",
    keywords: ["theme", "dark", "light", "mode", "appearance", "color"],
    action: "inline",
    inlineAction: "toggle-theme",
  },
  {
    id: "qa-ai-copilot",
    label: "Open AI Copilot",
    subtitle: "Ask AI to help with tasks and analysis",
    icon: Sparkles,
    iconBg: "bg-amber-50 dark:bg-amber-900/30",
    iconColor: "text-amber-600 dark:text-amber-400",
    keywords: ["ai", "copilot", "assistant", "help", "chat"],
    action: "inline",
    inlineAction: "open-copilot",
  },
  {
    id: "qa-install-app",
    label: "Install App",
    subtitle: "Install this dashboard as a desktop/mobile app",
    icon: Download,
    iconBg: "bg-pink-50 dark:bg-pink-900/30",
    iconColor: "text-pink-600 dark:text-pink-400",
    keywords: ["install", "pwa", "app", "download", "desktop"],
    action: "inline",
    inlineAction: "install-pwa",
  },
];

// ── Helpers ──

function formatCurrency(n: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

// ── Component ──

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const router = useRouter();
  const params = useParams();
  const locale = (params?.locale as string) || "en";

  // Reset search state whenever the palette closes (any path).
  const closePalette = useCallback(() => {
    setOpen(false);
    setQuery("");
    setResults(null);
    setSelectedIndex(0);
  }, []);

  // ── ⌘K / Ctrl+K toggle ──

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape") closePalette();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [closePalette]);

  // Focus input when dialog opens
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(timer);
  }, [open]);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // ── Search / debounce ──

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults(null);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const data: SearchResult = await res.json();
      setResults(data);
      setSelectedIndex(0);
    } catch {
      setResults(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const onQueryChange = (value: string) => {
    setQuery(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(value), 250);
  };

  const { open: openCopilot } = useAiCopilot();
  const { theme, setTheme } = useTheme();

  // ── Build grouped item list ──

  const { items, groupRanges } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const allItems: ResultItem[] = [];
    const ranges: { label: string; start: number; count: number }[] = [];

    // Filter dashboard menus
    const matchingMenus =
      q.length > 0
        ? DASHBOARD_MENUS.filter(
            (m) =>
              m.label.toLowerCase().includes(q) ||
              m.keywords.some((k) => k.includes(q)) ||
              m.subtitle.toLowerCase().includes(q),
          )
        : DASHBOARD_MENUS;

    // 1. Navigation items (always show on empty query, or when query matches menus)
    if (matchingMenus.length > 0) {
      const start = allItems.length;
      matchingMenus.forEach((m) =>
        allItems.push({
          id: m.id,
          label: m.label,
          subtitle: m.subtitle,
          icon: m.icon,
          iconBg: m.iconBg,
          iconColor: m.iconColor,
          href: `/${locale}${m.href}`,
        }),
      );
      ranges.push({ label: "Navigation", start, count: matchingMenus.length });
    }

    // 1.5 Quick Actions
    const matchingActions = q.length > 0
      ? QUICK_ACTIONS.filter(
          (a) =>
            a.label.toLowerCase().includes(q) ||
            a.keywords.some((k) => k.includes(q)) ||
            a.subtitle.toLowerCase().includes(q),
        )
      : QUICK_ACTIONS;

    if (matchingActions.length > 0) {
      const start = allItems.length;
      matchingActions.forEach((a) =>
        allItems.push({
          id: a.id,
          label: a.label,
          subtitle: a.subtitle,
          icon: a.icon,
          iconBg: a.iconBg,
          iconColor: a.iconColor,
          href: a.action === "navigate" ? `/${locale}${a.href}` : `#${a.inlineAction}`,
        }),
      );
      ranges.push({ label: "Quick Actions", start, count: matchingActions.length });
    }

    // 2. Orders from database search
    if (results?.orders.length) {
      const start = allItems.length;
      results.orders.forEach((o) =>
        allItems.push({
          id: o.id,
          label: o.orderNumber,
          subtitle: `${o.customer?.name || "Guest"} · ${formatCurrency(o.grandTotal)}`,
          icon: ShoppingBag,
          iconBg: "bg-blue-50 dark:bg-blue-900/20",
          iconColor: "text-blue-600 dark:text-blue-400",
          href: `/${locale}/orders`,
        }),
      );
      ranges.push({ label: "Orders", start, count: results.orders.length });
    }

    // 3. Customers from database search
    if (results?.customers.length) {
      const start = allItems.length;
      results.customers.forEach((c) =>
        allItems.push({
          id: c.id,
          label: c.name,
          subtitle: `${c.email || "No email"} · ${c.city || "N/A"}`,
          icon: UsersIcon,
          iconBg: "bg-purple-50 dark:bg-purple-900/20",
          iconColor: "text-purple-600 dark:text-purple-400",
          href: `/${locale}/customers`,
        }),
      );
      ranges.push({ label: "Customers", start, count: results.customers.length });
    }

    // 4. Products from database search
    if (results?.products.length) {
      const start = allItems.length;
      results.products.forEach((p) =>
        allItems.push({
          id: p.id,
          label: p.name,
          subtitle: `${p.sku || "No SKU"} · ${formatCurrency(p.price)} · ${p.stock} in stock`,
          icon: Package,
          iconBg: "bg-orange-50 dark:bg-orange-900/20",
          iconColor: "text-orange-600 dark:text-orange-400",
          href: `/${locale}/products`,
        }),
      );
      ranges.push({ label: "Products", start, count: results.products.length });
    }

    return { items: allItems, groupRanges: ranges };
  }, [query, results, locale]);

  // ── Keyboard navigation ──

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, Math.max(0, items.length - 1)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" && items[selectedIndex]) {
      e.preventDefault();
      navigateTo(items[selectedIndex]);
    }
  };

  const navigateTo = (item: ResultItem) => {
    closePalette();
    if (item.href === "#open-copilot" || item.href === "#ai-copilot") {
      openCopilot();
      return;
    }
    if (item.href === "#toggle-theme") {
      const next = theme === "dark" ? "light" : theme === "light" ? "system" : "dark";
      setTheme(next);
      return;
    }
    if (item.href === "#install-pwa") {
      window.dispatchEvent(new Event("open-pwa-install"));
      return;
    }
    router.push(item.href);
  };

  // ── Render ──

  const hasResults = items.length > 0;

  return (
    <>
      {/* Hidden button to make dialog accessible */}
      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (v) setOpen(true);
          else closePalette();
        }}
      >
        <DialogContent
          className="top-[15%] sm:top-[20%] translate-y-0 max-w-xl p-0 gap-0 rounded-xl shadow-2xl border-gray-200 dark:border-gray-800 overflow-hidden"
          onKeyDown={onKeyDown}
        >
          {/* Search input */}
          <div className="flex items-center gap-3 px-4 h-14 border-b border-gray-200 dark:border-gray-800">
            {loading ? (
              <Loader2 className="h-5 w-5 text-gray-400 animate-spin shrink-0" />
            ) : (
              <SearchIcon size={20} className="h-5 w-5 text-gray-400 shrink-0" />
            )}
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder="Search orders, customers, products..."
              className="flex-1 bg-transparent border-0 outline-none text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400"
              autoComplete="off"
              autoFocus
            />
            <kbd className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-[10px] font-mono text-gray-400">
              ESC
            </kbd>
          </div>

          {/* Results */}
          <ScrollContainer className="max-h-[360px] py-2">
            {loading && query.length >= 2 && (
              <div className="flex items-center justify-center py-8 text-sm text-gray-400">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Searching...
              </div>
            )}

            {!loading && query.length >= 2 && !hasResults && (
              <div className="py-8 text-center">
                <SearchIcon
                  size={32}
                  className="h-8 w-8 text-gray-300 dark:text-gray-600 mx-auto mb-2"
                />
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No results found for &ldquo;{query}&rdquo;
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  Try searching by order number, customer name, or product name
                </p>
              </div>
            )}

            {!loading && query.length < 2 && (
              <div className="py-8 text-center">
                <Command className="h-8 w-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Type at least 2 characters to search
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  Search across orders, customers, and products
                </p>
              </div>
            )}

            {hasResults &&
              groupRanges.map((group) => (
                <div key={group.label}>
                  <div className="px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                    {group.label}
                  </div>
                  {items.slice(group.start, group.start + group.count).map((item, i) => {
                    const globalIdx = group.start + i;
                    const Icon = item.icon;
                    const isSelected = globalIdx === selectedIndex;
                    return (
                      <button
                        key={item.id}
                        className={cn(
                          "flex items-center gap-3 w-full px-4 py-2.5 text-left transition-colors",
                          isSelected
                            ? "bg-indigo-50 dark:bg-indigo-900/20"
                            : "hover:bg-gray-50 dark:hover:bg-gray-800/50",
                        )}
                        onClick={() => navigateTo(item)}
                        onMouseEnter={() => setSelectedIndex(globalIdx)}
                      >
                        <div className={cn("flex-shrink-0 p-2 rounded-lg", item.iconBg)}>
                          <Icon size={16} className={cn("h-4 w-4", item.iconColor)} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                            {item.label}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {item.subtitle}
                          </p>
                        </div>
                        <ArrowRightIcon
                          size={16}
                          className={cn(
                            "h-4 w-4 shrink-0 transition-opacity",
                            isSelected
                              ? "text-indigo-500 opacity-100"
                              : "text-gray-300 dark:text-gray-600 opacity-0",
                          )}
                        />
                      </button>
                    );
                  })}
                </div>
              ))}
          </ScrollContainer>

          {/* Footer hints */}
          <div className="flex items-center gap-4 px-4 h-10 border-t border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50">
            <span className="flex items-center gap-1 text-[11px] text-gray-400">
              <kbd className="px-1 py-0.5 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-[10px] font-mono">
                ↑↓
              </kbd>
              <span>Navigate</span>
            </span>
            <span className="flex items-center gap-1 text-[11px] text-gray-400">
              <kbd className="px-1 py-0.5 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-[10px] font-mono">
                ↵
              </kbd>
              <span>Open</span>
            </span>
            <span className="flex items-center gap-1 text-[11px] text-gray-400 ml-auto">
              <kbd className="px-1 py-0.5 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-[10px] font-mono">
                ⌘K
              </kbd>
              <span>Toggle</span>
            </span>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
