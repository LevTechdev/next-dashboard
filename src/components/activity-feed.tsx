"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useParams } from "next/navigation";
import {
  ClockIcon,
  BellIcon,
  RefreshCwIcon,
  DollarSignIcon,
  DownloadIcon,
  SparklesIcon,
  UsersIcon,
} from "lucide-animated";
import {
  ShoppingCart,
  Package,
  AlertTriangle,
  Megaphone,
  Gift,
  BellRing,
  Filter,
  ExternalLink,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ScrollContainer } from "@/components/ui/scroll-container";
import { useRealtime, type NotificationType } from "@/components/realtime-provider";
import { motion, AnimatePresence } from "framer-motion";
import { useScrollFocusedIntoView } from "@/hooks/use-scroll-focused-into-view";

// ── Types ──

type ActivityType = NotificationType;

interface ActivityItem {
  id: string;
  type: ActivityType;
  title: string;
  description: string;
  timestamp: Date;
  read?: boolean;
  isNew?: boolean;
  /** Epoch ms the item arrived via real-time; drives the "New" badge / count windows. */
  arrivedAt?: number;
}

interface ApiNotification {
  id: string;
  type: string;
  title: string;
  description: string | null;
  createdAt: string;
  read: boolean;
}

// ── Constants ──

const TYPE_CONFIG: Record<
  ActivityType,
  {
    icon: React.ComponentType<{ className?: string; size?: number }>;
    color: string;
    bg: string;
    label: string;
  }
> = {
  order: {
    icon: ShoppingCart,
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-900/20",
    label: "Orders",
  },
  customer: {
    icon: UsersIcon,
    color: "text-purple-600 dark:text-purple-400",
    bg: "bg-purple-50 dark:bg-purple-900/20",
    label: "Customers",
  },
  product: {
    icon: Package,
    color: "text-orange-600 dark:text-orange-400",
    bg: "bg-orange-50 dark:bg-orange-900/20",
    label: "Products",
  },
  revenue: {
    icon: DollarSignIcon,
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-900/20",
    label: "Revenue",
  },
  inventory: {
    icon: AlertTriangle,
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-900/20",
    label: "Inventory",
  },
  discount: {
    icon: ClockIcon,
    color: "text-rose-600 dark:text-rose-400",
    bg: "bg-rose-50 dark:bg-rose-900/20",
    label: "Discounts",
  },
  campaign: {
    icon: Megaphone,
    color: "text-pink-600 dark:text-pink-400",
    bg: "bg-pink-50 dark:bg-pink-900/20",
    label: "Campaigns",
  },
  milestone: {
    icon: Gift,
    color: "text-yellow-600 dark:text-yellow-400",
    bg: "bg-yellow-50 dark:bg-yellow-900/20",
    label: "Milestones",
  },
  alert: {
    icon: BellRing,
    color: "text-red-600 dark:text-red-400",
    bg: "bg-red-50 dark:bg-red-900/20",
    label: "Alerts",
  },
};

const FILTER_ORDER: (ActivityType | "all")[] = [
  "all",
  "order",
  "customer",
  "inventory",
  "campaign",
  "discount",
  "alert",
  "milestone",
  "revenue",
  "product",
];

const MAX_VISIBLE = 15;

// How long real-time arrivals keep their "New" badge / count contribution.
const NEW_BADGE_MS = 5000;
const NEW_COUNT_MS = 8000;

// ── Helpers ──

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 10) return "Just now";
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

// ── Component ──

export function ActivityFeed({ className }: { className?: string }) {
  const params = useParams();
  const locale = (params?.locale as string) || "en";
  const { notifications: realtimeNotifications, connectionStatus } = useRealtime();

  // Single source of truth: the whole feed (fetched + real-time arrivals in
  // arrival order, capped). Everything else — the visible list, filter
  // counts, "New" badges and the "+N new" counter — derives from it during
  // render.
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ActivityType | "all">("all");
  const [paused, setPaused] = useState(false);
  // Clock tick that re-renders when the oldest "New" badge / count expires,
  // so the derived markers disappear on schedule.
  const [now, setNow] = useState(() => Date.now());
  const activityListRef = useRef<HTMLDivElement>(null);
  const filterRowRef = useRef<HTMLDivElement>(null);

  // Keyboard focus can land on a filter pill clipped by the overflow-x row;
  // scroll it into view.
  useScrollFocusedIntoView(filterRowRef);

  // ── Fetch initial activities from API ──
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/notifications?limit=15");
        if (!res.ok) throw new Error("Failed to fetch");
        const data = await res.json();
        if (cancelled) return;
        const items: ActivityItem[] = (data.notifications || []).map((n: ApiNotification) => ({
          id: n.id,
          type: n.type as ActivityType,
          title: n.title,
          description: n.description || "",
          timestamp: new Date(n.createdAt),
          read: n.read,
        }));
        setItems(items);
      } catch {
        // keep empty state
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Real-time arrivals: derive what's new, then merge it into the feed ──
  const itemsIds = useMemo(() => new Set(items.map((i) => i.id)), [items]);
  const newArrivals = useMemo(
    () => realtimeNotifications.filter((n) => !itemsIds.has(n.id)),
    [realtimeNotifications, itemsIds],
  );

  // React's "adjusting state during render" pattern (docs: storing info from
  // previous renders) — merge unseen arrivals into the single source of
  // truth. Guarded, so it converges in one extra render instead of looping.
  if (newArrivals.length > 0) {
    setItems((prev) => {
      const prevIds = new Set(prev.map((i) => i.id));
      const fresh = newArrivals.filter((n) => !prevIds.has(n.id));
      if (fresh.length === 0) return prev;
      const arrivals: ActivityItem[] = fresh.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        description: n.description,
        timestamp: n.timestamp,
        isNew: true,
        arrivedAt: n.timestamp.getTime(),
      }));
      return [...arrivals, ...prev].slice(0, MAX_VISIBLE);
    });
  }

  // While paused, arrivals are hidden from the feed but still counted.
  const visibleItems = paused ? items.filter((a) => a.arrivedAt === undefined) : items;

  // Derived "New" badges / "+N new" counter from arrival timestamps.
  const arrivalItems = useMemo(() => items.filter((a) => a.arrivedAt != null), [items]);
  const newIds = useMemo(
    () => new Set(arrivalItems.filter((a) => now - a.arrivedAt! < NEW_BADGE_MS).map((a) => a.id)),
    [arrivalItems, now],
  );
  const newCount = useMemo(
    () => arrivalItems.filter((a) => now - a.arrivedAt! < NEW_COUNT_MS).length,
    [arrivalItems, now],
  );

  // Re-render at the next expiry so the derived markers disappear on time
  // (setState inside a timer callback is fine).
  useEffect(() => {
    if (arrivalItems.length === 0) return;
    const nextExpiry = Math.min(
      ...arrivalItems.map((a) => a.arrivedAt! + NEW_BADGE_MS),
      ...arrivalItems.map((a) => a.arrivedAt! + NEW_COUNT_MS),
    );
    const delay = nextExpiry - now;
    if (delay <= 0) return;
    const timer = setTimeout(() => setNow(Date.now()), delay);
    return () => clearTimeout(timer);
  }, [arrivalItems, now]);

  // ── Filter ──
  const filtered = filter === "all" ? visibleItems : visibleItems.filter((a) => a.type === filter);

  const countByType = (type: ActivityType | "all") => {
    if (type === "all") return visibleItems.length;
    return visibleItems.filter((a) => a.type === type).length;
  };

  // ── Pause / Resume: hiding is a render-time filter, so nothing to flush ──
  const handlePauseToggle = () => setPaused((p) => !p);

  // ── Scroll to top of feed ──
  const handleScrollToTop = () => {
    activityListRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ── Export data ──
  const exportActivities = () => {
    const csvRows = [
      ["Type", "Title", "Description", "Timestamp"].join(","),
      ...visibleItems.map((a) =>
        [a.type, `"${a.title}"`, `"${a.description}"`, new Date(a.timestamp).toISOString()].join(
          ",",
        ),
      ),
    ];
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `activity-feed-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className={cn("flex flex-col overflow-hidden", className)}>
      {/* Header */}
      <CardHeader className="pb-3 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "p-1.5 rounded-lg transition-colors",
                connectionStatus === "connected"
                  ? "bg-emerald-50 dark:bg-emerald-900/20"
                  : connectionStatus === "connecting"
                    ? "bg-yellow-50 dark:bg-yellow-900/20"
                    : "bg-red-50 dark:bg-red-900/20",
              )}
            >
              {connectionStatus === "connected" ? (
                <ActivityDot className="text-emerald-500" />
              ) : connectionStatus === "connecting" ? (
                <RefreshCwIcon size={16} className="h-4 w-4 text-yellow-500 animate-spin" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-red-500" />
              )}
            </div>
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                Activity Feed
                {newCount > 0 && (
                  <motion.span
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.5, opacity: 0 }}
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold"
                  >
                    <SparklesIcon size={10} className="h-2.5 w-2.5" />+{newCount} new
                  </motion.span>
                )}
              </CardTitle>
              <CardDescription>Real-time system activity stream</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {paused && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-indigo-500 animate-pulse"
                onClick={handlePauseToggle}
                title="Resume live updates"
                aria-label="Resume live updates"
              >
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-500" />
                </span>
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-gray-400 hover:text-gray-600"
              onClick={exportActivities}
              title="Export as CSV"
              aria-label="Export activity feed as CSV"
            >
              <DownloadIcon size={14} className="h-3.5 w-3.5" />
            </Button>
            <a
              href={`/${locale}/notifications`}
              className="inline-flex items-center gap-1 text-[10px] text-indigo-500 hover:text-indigo-600 hover:underline px-1.5 py-0.5 rounded"
            >
              View all
              <ExternalLink className="h-2.5 w-2.5" />
            </a>
          </div>
        </div>
      </CardHeader>

      {/* Connection + Filter Bar */}
      <div className="flex items-center justify-between px-4 py-1.5 border-y border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 shrink-0">
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              "w-1.5 h-1.5 rounded-full",
              connectionStatus === "connected"
                ? "bg-emerald-500"
                : connectionStatus === "connecting"
                  ? "bg-yellow-500 animate-pulse"
                  : "bg-red-500",
            )}
          />
          <span className="text-[10px] text-gray-400 font-medium">
            {connectionStatus === "connected"
              ? "Live"
              : connectionStatus === "connecting"
                ? "Connecting..."
                : "Disconnected"}
          </span>
          {visibleItems.length > 0 && (
            <span className="text-[10px] text-gray-300 dark:text-gray-600 mx-1">·</span>
          )}
          {visibleItems.length > 0 && (
            <span className="text-[10px] text-gray-400">
              {filtered.length} of {visibleItems.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {paused ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-[10px] text-indigo-500 gap-1 px-2"
              onClick={handlePauseToggle}
            >
              <RefreshCwIcon size={12} className="h-3 w-3" />
              Resume
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-[10px] text-gray-400 gap-1 px-2"
              onClick={() => {
                setPaused(true);
              }}
            >
              <span className="w-2 h-2 rounded-full bg-gray-400" />
              Pause
            </Button>
          )}
        </div>
      </div>

      {/* Type Filter Pills — scrollbar hidden via the real scrollbar-none
          utility (like the tabs bar and notification panel); hiding never
          disables scrolling. */}
      <div
        ref={filterRowRef}
        className="flex gap-1.5 px-4 py-2 overflow-x-auto border-b border-gray-100 dark:border-gray-800 scrollbar-none shrink-0"
      >
        {FILTER_ORDER.map((t) => {
          const count = countByType(t);
          const config = t !== "all" ? TYPE_CONFIG[t] : null;
          const isActive = filter === t;
          return (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium whitespace-nowrap transition-all shrink-0",
                isActive
                  ? "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-300 dark:ring-indigo-700"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700",
              )}
            >
              {config && <config.icon size={12} className={cn("h-3 w-3", config.color)} />}
              {t === "all" ? "All" : config?.label || t}
              {count > 0 && (
                <span
                  className={cn(
                    "ml-0.5 px-1 py-0.5 rounded-full text-[8px] font-bold",
                    isActive
                      ? "bg-indigo-200 dark:bg-indigo-800 text-indigo-800 dark:text-indigo-200"
                      : "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400",
                  )}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Activity List */}
      <ScrollContainer
        ref={activityListRef}
        className="flex-1 min-h-[200px] max-h-[380px]"
        role="log"
        aria-live="polite"
        aria-label="Live activity feed"
        onScroll={() => {
          // Auto-resume when user scrolls to top after pause
          if (paused && (activityListRef.current?.scrollTop ?? 0) <= 2) {
            setPaused(false);
          }
        }}
      >
        {/* Loading State */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <div className="relative h-8 w-8 mb-3">
              <div className="absolute inset-0 rounded-full border-2 border-gray-200 dark:border-gray-700" />
              <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-indigo-500 animate-spin" />
            </div>
            <p className="text-sm font-medium">Loading activity...</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && visibleItems.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <BellIcon size={40} className="h-10 w-10 mb-3 opacity-30" />
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">No activity yet</p>
            <p className="text-xs text-gray-400 mt-1">Real-time updates will appear here</p>
            <p className="text-xs text-gray-300 dark:text-gray-600 mt-3 max-w-[200px] text-center leading-relaxed">
              Activities like orders, new customers, and system alerts show up as they happen.
            </p>
          </div>
        )}

        {/* Filtered Empty */}
        {!loading && visibleItems.length > 0 && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <Filter className="h-8 w-8 mb-2 opacity-30" />
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
              No matching activity
            </p>
            <p className="text-xs text-gray-400 mt-1">Try a different filter</p>
          </div>
        )}

        {/* Activity Items */}
        {!loading && filtered.length > 0 && (
          <AnimatePresence initial={false} mode="popLayout">
            {filtered.slice(0, MAX_VISIBLE).map((item, index) => {
              const config = TYPE_CONFIG[item.type] || TYPE_CONFIG.alert;
              const Icon = config.icon;
              const isNewItem = newIds.has(item.id);

              return (
                <motion.div
                  key={item.id}
                  initial={isNewItem ? { opacity: 0, y: -20, scale: 0.95 } : { opacity: 1, y: 0 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{
                    opacity: 0,
                    height: 0,
                    marginTop: 0,
                    marginBottom: 0,
                    overflow: "hidden",
                  }}
                  transition={{
                    type: "spring",
                    stiffness: 500,
                    damping: 35,
                    mass: 0.8,
                  }}
                  layout
                  className={cn(
                    "flex items-start gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors group relative overflow-hidden",
                    isNewItem && "bg-indigo-50/60 dark:bg-indigo-900/15",
                  )}
                >
                  {/* New item glow indicator */}
                  {isNewItem && (
                    <motion.div
                      initial={{ opacity: 1 }}
                      animate={{ opacity: 0 }}
                      transition={{ delay: 4, duration: 1 }}
                      className="absolute inset-0 pointer-events-none"
                    >
                      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-indigo-400 to-transparent" />
                    </motion.div>
                  )}

                  {/* Icon */}
                  <div
                    className={cn(
                      "flex-shrink-0 p-2 rounded-lg transition-transform group-hover:scale-110 duration-200",
                      config.bg,
                      isNewItem && "ring-2 ring-indigo-300 dark:ring-indigo-600",
                    )}
                  >
                    <Icon size={16} className={cn("h-4 w-4", config.color)} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p
                        className={cn(
                          "text-sm truncate",
                          isNewItem
                            ? "font-semibold text-gray-900 dark:text-gray-100"
                            : "font-medium text-gray-900 dark:text-gray-100",
                        )}
                      >
                        {item.title}
                      </p>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[8px] px-1 py-0 h-4 capitalize shrink-0",
                          isNewItem &&
                            "border-indigo-300 dark:border-indigo-600 text-indigo-600 dark:text-indigo-400",
                        )}
                      >
                        {item.type}
                      </Badge>
                      {isNewItem && (
                        <motion.span
                          initial={{ scale: 0.8, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0.8, opacity: 0 }}
                          transition={{ type: "spring", stiffness: 500, damping: 30 }}
                          className="inline-flex items-center px-1 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider bg-indigo-500 text-white"
                        >
                          New
                        </motion.span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
                      {item.description}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-1 flex items-center gap-1.5">
                      <span>{formatTimeAgo(item.timestamp)}</span>
                      {index === 0 && newIds.size === 0 && (
                        <span className="flex items-center gap-1 text-[10px] text-emerald-500">
                          <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                          latest
                        </span>
                      )}
                    </p>
                  </div>

                  {/* Unread indicator */}
                  {isNewItem && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 500, damping: 20 }}
                      className="w-2 h-2 rounded-full bg-indigo-500 shrink-0 mt-2"
                    />
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}

        {/* Scroll-to-top hint when scrolled down */}
        {!loading && filtered.length > 5 && (
          <div className="sticky bottom-0 flex justify-center pb-2 pt-1 bg-gradient-to-t from-white dark:from-gray-950 via-white/80 dark:via-gray-950/80 to-transparent pointer-events-none">
            <button
              onClick={handleScrollToTop}
              className="pointer-events-auto inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-medium text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow transition-all"
            >
              <RefreshCwIcon size={10} className="h-2.5 w-2.5" />
              Scroll to top
            </button>
          </div>
        )}
      </ScrollContainer>
    </Card>
  );
}

// ── Activity Dot Sub-component ──

function ActivityDot({ className }: { className?: string }) {
  return (
    <span className={cn("relative flex h-4 w-4 items-center justify-center", className)}>
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-20" />
      <span className="relative inline-flex rounded-full h-2 w-2 bg-current" />
    </span>
  );
}
