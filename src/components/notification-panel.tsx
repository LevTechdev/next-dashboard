"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { BellIcon, XIcon, CheckCheckIcon } from "lucide-animated";
import { BellRing, FlaskConical, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollContainer } from "@/components/ui/scroll-container";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useScrollFocusedIntoView } from "@/hooks/use-scroll-focused-into-view";
import {
  useRealtime,
  type NotificationType,
  type RealtimeNotification,
} from "@/components/realtime-provider";
import {
  NOTIFICATION_EMOJI,
  notificationStatusForType,
  typeLabelKey,
} from "@/lib/notification-taxonomy";
import { Badge } from "@/components/ui/badge";
import { AnimatePresence, motion } from "framer-motion";

const notificationIcons: Record<NotificationType, string> = NOTIFICATION_EMOJI as Record<
  NotificationType,
  string
>;

type FilterType = NotificationType | "all";

export function NotificationPanel() {
  const t = useTranslations("notifications");
  const {
    notifications,
    unreadCount,
    markAllRead,
    clearNotifications,
    addNotification,
    connectionStatus,
  } = useRealtime();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<FilterType>("all");
  const ref = useRef<HTMLDivElement>(null);
  const filterRowRef = useRef<HTMLDivElement>(null);
  // Compact = tablet/mobile. On those widths the panel is a viewport-anchored
  // sheet and is PORTALED to <body>: the header shell and motion wrappers can
  // create a containing block for `position: fixed`, which pinned the panel
  // far off-screen at phone widths. Portaling escapes any such ancestor.
  const [compact, setCompact] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const mq = window.matchMedia("(max-width: 1023px)");
    const sync = () => setCompact(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const typeLabels: Record<string, string> = useMemo(
    () => ({
      all: t("filterAll"),
      order: t("typeOrder"),
      customer: t("typeCustomer"),
      product: t("typeProduct"),
      revenue: t("typeRevenue"),
      inventory: t("typeInventory"),
      discount: t("typeDiscount"),
      campaign: t("typeCampaign"),
      milestone: t("typeMilestone"),
      alert: t("typeAlert"),
    }),
    [t],
  );

  // Keyboard focus can land on a filter pill clipped by the overflow-x row;
  // scroll it into view.
  useScrollFocusedIntoView(filterRowRef);

  // Close on click outside (pointerdown so a press that opens another menu
  // closes this one in the same gesture) and on Escape.
  useEffect(() => {
    if (!open) return;
    const handlePointer = (e: PointerEvent) => {
      const target = e.target as Node;
      // The portaled surface lives outside `ref` on compact widths — treat
      // the portaled panel itself as "inside" via the data-testid marker.
      if (ref.current?.contains(target)) return;
      if (target instanceof Element && target.closest('[data-testid="notification-panel"]')) return;
      if (target instanceof Element && target.closest("[data-notif-trigger]")) return;
      setOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", handlePointer, true);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("pointerdown", handlePointer, true);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  // The avatar dropdown's Notifications item (visible below lg) opens this
  // panel, since the standalone bell is hidden on those breakpoints.
  useEffect(() => {
    const handleOpenEvent = () => setOpen(true);
    window.addEventListener("dashboard:open-notifications", handleOpenEvent);
    return () => window.removeEventListener("dashboard:open-notifications", handleOpenEvent);
  }, []);

  const filtered =
    filter === "all" ? notifications : notifications.filter((n) => n.type === filter);

  const unreadByType = (type: FilterType) =>
    type === "all" ? unreadCount : notifications.filter((n) => n.type === type && !n.read).length;

  // Mark-everything-read in the feed AND persist server-side, so the unread
  // count survives reloads and other tabs (matches the feed page's batch API).
  const handleMarkAllRead = () => {
    markAllRead();
    void fetch("/api/notifications/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark-all-read" }),
    }).catch(() => {
      // Offline / expired session — the in-memory state is already updated;
      // the feed page re-syncs unread counts on its next fetch.
    });
  };

  const handleSimulateNotification = () => {
    const types: NotificationType[] = [
      "order",
      "customer",
      "product",
      "inventory",
      "discount",
      "campaign",
      "milestone",
      "billing",
      "alert",
      "revenue",
    ];
    const type = types[Math.floor(Math.random() * types.length)];
    const testNotif: RealtimeNotification = {
      id: `test-${Date.now()}`,
      title: getTestTitle(type),
      description: getTestDescription(type),
      type,
      timestamp: new Date(),
    };
    addNotification(testNotif);
  };

  const surface = (
    <div ref={ref} className="relative">
      <Tooltip side="bottom" content={t("panelTitle")}>
        <Button
          variant="ghost"
          size="icon"
          data-notif-trigger
          className="text-gray-500 relative hidden lg:inline-flex"
          onClick={() => setOpen(!open)}
          aria-label={t("panelTitle")}
        >
          {unreadCount > 0 ? (
            <BellRing className="h-5 w-5 animate-pulse" />
          ) : (
            <BellIcon size={20} className="h-5 w-5" />
          )}
          <AnimatePresence>
            {unreadCount > 0 && (
              <motion.span
                key="badge"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-red-500 rounded-full ring-2 ring-white dark:ring-gray-950"
              >
                {unreadCount > 99 ? "99+" : unreadCount}
              </motion.span>
            )}
          </AnimatePresence>
        </Button>
      </Tooltip>

      {open && (
        <div
          role="dialog"
          data-testid="notification-panel"
          aria-label={t("panelTitle")}
          className="fixed left-1/2 top-16 z-50 flex max-h-[75dvh] w-[min(420px,calc(100vw-24px))] -translate-x-1/2 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900 lg:absolute lg:left-auto lg:right-0 lg:top-full lg:mt-2 lg:max-h-[80vh] lg:w-[400px] lg:max-w-[420px] lg:translate-x-0"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {t("panelTitle")}
              </h3>
              {unreadCount > 0 && (
                <span className="text-[10px] font-medium text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded-full">
                  {t("newCount", { count: unreadCount })}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Tooltip side="bottom" content={t("simulateTooltip")}>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 text-[10px] text-gray-400 hover:text-primary transition-colors"
                  onClick={handleSimulateNotification}
                >
                  <FlaskConical className="h-3 w-3" />
                  {t("testSimulate")}
                </Button>
              </Tooltip>
              {notifications.length > 0 && (
                <Tooltip side="bottom" content={t("markAllRead")}>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t("markAllRead")}
                    className="h-7 w-7 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    onClick={handleMarkAllRead}
                  >
                    <CheckCheckIcon size={16} className="h-4 w-4" />
                  </Button>
                </Tooltip>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                onClick={() => setOpen(false)}
                aria-label={t("closePanel")}
              >
                <XIcon size={16} className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Connection + Filter Bar */}
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
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
              <span className="text-[10px] text-gray-400">
                {connectionStatus === "connected"
                  ? t("connectionLive")
                  : connectionStatus === "connecting"
                    ? t("connectionConnecting")
                    : t("connectionDisconnected")}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Filter className="h-3 w-3 text-gray-400" />
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as FilterType)}
                className="text-[10px] bg-transparent border-none text-gray-500 focus:outline-none cursor-pointer"
              >
                <option value="all">{t("filterAll")}</option>
                {Object.entries(typeLabels)
                  .filter(([k]) => k !== "all")
                  .map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {/* Type filter pills */}
          <div
            ref={filterRowRef}
            className="flex gap-1.5 px-3 py-2 overflow-x-auto border-b border-gray-100 dark:border-gray-800 scrollbar-none"
          >
            {(
              [
                "all",
                "order",
                "customer",
                "inventory",
                "campaign",
                "discount",
                "alert",
              ] as FilterType[]
            ).map((ft) => {
              const count = unreadByType(ft);
              return (
                <button
                  key={ft}
                  onClick={() => setFilter(ft)}
                  className={cn(
                    "flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium whitespace-nowrap transition-all",
                    filter === ft
                      ? "bg-primary/10 text-primary dark:bg-primary/20 font-semibold"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300",
                  )}
                >
                  {ft !== "all" && <span>{notificationIcons[ft as NotificationType]}</span>}
                  {typeLabels[ft]}
                  {count > 0 && (
                    <span
                      className={cn(
                        "ml-0.5 px-1 py-0.5 rounded-full text-[8px] font-bold",
                        filter === ft
                          ? "bg-primary/20 text-primary font-bold"
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

          {/* Notifications List */}
          <ScrollContainer className="flex-1 min-h-[200px] max-h-[400px]">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                <BellIcon size={40} className="h-10 w-10 mb-3 opacity-30" />
                <p className="text-sm font-medium">{t("emptyTitle")}</p>
                <p className="text-xs mt-1">{t("emptyDesc")}</p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-4 text-xs text-primary hover:text-primary/80 gap-1 font-medium"
                  onClick={handleSimulateNotification}
                >
                  <FlaskConical className="h-3 w-3" />
                  {t("simulateTooltip")}
                </Button>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                <Filter className="h-8 w-8 mb-2 opacity-30" />
                <p className="text-sm font-medium">
                  {t("emptyFilteredTitle", { type: typeLabels[filter] || "" })}
                </p>
                <p className="text-xs mt-1">{t("emptyFilteredDesc")}</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {filtered.map((n) => (
                  <div
                    key={n.id}
                    className={cn(
                      "flex items-start gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors",
                      !n.read && "bg-primary/5 dark:bg-primary/10",
                    )}
                  >
                    <span className="text-lg shrink-0 mt-0.5">
                      {notificationIcons[n.type] || "🔔"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                          {n.title}
                        </p>
                        <Badge
                          variant="outline"
                          className="text-[8px] px-1 py-0 h-4 capitalize shrink-0"
                        >
                          {n.type}
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
                        {n.description}
                      </p>
                      <p className="text-[10px] text-gray-400 mt-1">{formatTimeAgo(n.timestamp)}</p>
                    </div>
                    {!n.read && (
                      <span className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5 animate-pulse" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollContainer>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="p-2 border-t border-gray-100 dark:border-gray-800 flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="flex-1 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                onClick={clearNotifications}
              >
                {t("clearAll")}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="flex-shrink-0 text-xs text-primary hover:text-primary/80 gap-1 font-medium"
                onClick={handleSimulateNotification}
              >
                <FlaskConical className="h-3 w-3" />
                {t("testSimulate")}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );

  // Portal on compact so no ancestor can capture the fixed positioning; on
  // desktop the panel stays anchored to the (visible) bell in the header.
  return mounted && compact ? createPortal(surface, document.body) : surface;

  function formatTimeAgo(date: Date): string {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 10) return t("justNow");
    if (seconds < 60) return t("secondsAgo", { s: seconds });
    if (seconds < 3600) return t("minutesAgo", { m: Math.floor(seconds / 60) });
    if (seconds < 86400) return t("hoursAgo", { h: Math.floor(seconds / 3600) });
    return t("daysAgo", { d: Math.floor(seconds / 86400) });
  }
}

function getTestTitle(type: NotificationType): string {
  const titles: Record<NotificationType, string> = {
    order: "🛒 New Order Received",
    customer: "👤 New Customer Signed Up",
    product: "📦 New Product Added",
    revenue: "💰 Revenue Milestone Reached",
    inventory: "⚠️ Low Stock Alert",
    discount: "⏰ Discount Expiring Soon",
    campaign: "📢 Campaign Budget Alert",
    milestone: "🎉 Goal Achievement!",
    billing: "💳 Quota Alert",
    alert: "🔔 System Alert",
  };
  return titles[type];
}

function getTestDescription(type: NotificationType): string {
  const descriptions: Record<NotificationType, string> = {
    order: "Order #ORD-5678 from John Doe ($249.00) via Online Store",
    customer: "Sarah Williams has created an account. Total: 1,234 customers",
    product: "Premium Yoga Mat (SKU: SPRT-003) — $39.99 — 50 in stock",
    revenue: "You've reached $75,000 in total revenue this month!",
    inventory: "Yoga Mat Premium (8 left), Sunglasses Aviator (12 left) need restocking",
    discount: "HOLIDAY15 expires in 2 days — 67 uses so far",
    campaign: "Summer Sale has used 85% of its $15,000 budget",
    milestone: "🎊 Congratulations! 500 orders milestone achieved!",
    billing: "API keys usage is at 2/2 (100%) on the Starter plan",
    alert: "CPU usage exceeded 90% on the production server",
  };
  return descriptions[type];
}
