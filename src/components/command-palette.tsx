"use client";

import { useState, useEffect, useCallback, useRef, type ComponentType } from "react";
import { useRouter, useParams } from "next/navigation";
import { SearchIcon, ArrowRightIcon, UsersIcon } from "lucide-animated";
import { ShoppingBag, Package, Command, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ScrollContainer } from "@/components/ui/scroll-container";

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
  const [, setTotalItems] = useState(0);

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
      setTotalItems(0);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const data: SearchResult = await res.json();
      setResults(data);
      const count = data.orders.length + data.customers.length + data.products.length;
      setTotalItems(count);
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

  // ── Build flat item list ──

  const buildItems = (): ResultItem[] => {
    const items: ResultItem[] = [];
    if (!results) return items;

    results.orders.forEach((o) =>
      items.push({
        id: o.id,
        label: o.orderNumber,
        subtitle: `${o.customer?.name || "Guest"} · ${formatCurrency(o.grandTotal)}`,
        icon: ShoppingBag,
        iconBg: "bg-blue-50 dark:bg-blue-900/20",
        iconColor: "text-blue-600 dark:text-blue-400",
        href: `/${locale}/orders`,
      }),
    );

    results.customers.forEach((c) =>
      items.push({
        id: c.id,
        label: c.name,
        subtitle: `${c.email || "No email"} · ${c.city || "N/A"}`,
        icon: UsersIcon,
        iconBg: "bg-purple-50 dark:bg-purple-900/20",
        iconColor: "text-purple-600 dark:text-purple-400",
        href: `/${locale}/customers`,
      }),
    );

    results.products.forEach((p) =>
      items.push({
        id: p.id,
        label: p.name,
        subtitle: `${p.sku || "No SKU"} · ${formatCurrency(p.price)} · ${p.stock} in stock`,
        icon: Package,
        iconBg: "bg-orange-50 dark:bg-orange-900/20",
        iconColor: "text-orange-600 dark:text-orange-400",
        href: `/${locale}/products`,
      }),
    );

    return items;
  };

  const items = buildItems();

  // ── Keyboard navigation ──

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, items.length - 1));
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
    router.push(item.href);
  };

  // ── Group result indices for section headers ──

  const groupRanges = (() => {
    const ranges: { label: string; start: number; count: number }[] = [];
    let idx = 0;
    if (results?.orders.length) {
      ranges.push({ label: "Orders", start: idx, count: results.orders.length });
      idx += results.orders.length;
    }
    if (results?.customers.length) {
      ranges.push({ label: "Customers", start: idx, count: results.customers.length });
      idx += results.customers.length;
    }
    if (results?.products.length) {
      ranges.push({ label: "Products", start: idx, count: results.products.length });
    }
    return ranges;
  })();

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
