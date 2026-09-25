"use client";
import React from "react";

import { useTranslations } from "next-intl";
import { useState, useMemo } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { toast } from "sonner";
import {
  RefreshCwIcon,
  DownloadIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  UsersIcon,
  DollarSignIcon,
  EyeIcon,
  LayersIcon,
  MapPinIcon,
  ChartBarIncreasingIcon,
  CartIcon,
} from "lucide-animated";
import { ArrowDownRight, ImageDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, cn } from "@/lib/utils";
import { useCurrency } from "@/components/currency-provider";
import { useRealtimeData } from "@/hooks/use-realtime-data";
import { useNow } from "@/hooks/use-now";
import { RealtimeIndicator } from "@/components/realtime-indicator";
import { LiveFxBadge } from "@/components/currency/live-fx-badge";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { Sparkline } from "@/components/ui/sparkline";
import {
  RevenueChart,
  SalesChannelChart,
  ChannelMixDonut,
  ChannelTrendArea,
  ChannelActivityRings,
} from "@/components/charts";
import {
  buildRingsShareSvg,
  downloadRingsShare,
  downloadRingsSharePng,
} from "@/components/charts/rings-image-export";
import { LinkedPlatformsBadge } from "@/components/linked-platforms-badge";
import { CohortRetentionHeatmap } from "@/components/analytics/cohort-retention-heatmap";
import { DateRangeFilter, type DateRange } from "@/components/ui/date-range-filter";
import { Tooltip } from "@/components/ui/tooltip";
import { useLocale } from "next-intl";

interface StatData {
  totalRevenue: number;
  totalOrders: number;
  totalCustomers: number;
  revenueGrowth: number;
  ordersGrowth: number;
  customersGrowth: number;
}

interface SalesChannel {
  name: string;
  slug?: string;
  value: number;
  color: string;
}

interface RevenuePoint {
  month: string;
  revenue: number;
}

interface TopProduct {
  id: string;
  name: string;
  price: number;
  orderCount?: number;
  linkedCount?: number;
}

interface AnalyticsData {
  stats: StatData;
  salesByChannel: SalesChannel[];
  channelTrend?: Array<{ date: string; [channelSlug: string]: number | string }>;
  revenueData: RevenuePoint[];
  topProducts: TopProduct[];
  sparklines?: {
    orders: number[];
    customers: number[];
  };
}

/**
 * Keep only orders whose createdAt falls inside the ?month=YYYY-MM bucket.
 * Without a filter (or an unparseable value) the list passes through — the
 * analytics page never narrows itself silently.
 */
function filterOrdersByMonth(orders: any[], month: string | null): any[] {
  if (!month || !/^\d{4}-\d{2}$/.test(month)) return orders;
  return orders.filter((o) => {
    const created = o?.createdAt ? new Date(o.createdAt) : null;
    if (!created || Number.isNaN(created.getTime())) return false;
    const key = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, "0")}`;
    return key === month;
  });
}

/**
 * Keep only orders whose createdAt falls inside the header date-range picker
 * window (inclusive on both endpoints). An empty range passes through.
 */
function filterOrdersByRange(orders: any[], range: DateRange | null): any[] {
  if (!range || (!range.from && !range.to)) return orders;
  const fromMs = range.from ? new Date(`${range.from}T00:00:00`).getTime() : null;
  const toMs = range.to ? new Date(`${range.to}T23:59:59.999`).getTime() : null;
  return orders.filter((o) => {
    const created = o?.createdAt ? new Date(o.createdAt) : null;
    if (!created || Number.isNaN(created.getTime())) return false;
    const ms = created.getTime();
    if (fromMs !== null && ms < fromMs) return false;
    if (toMs !== null && ms > toMs) return false;
    return true;
  });
}

// Generate mock funnel data from orders
function generateFunnelData(orders: any[], activeStages: string[]) {
  const total = orders.length || 1;
  const visitors = Math.round(total * 12.5);
  const addToCart = Math.round(total * 4.2);
  const checkout = Math.round(total * 2.1);
  const purchase = total;

  // Stages carry ids + counts only: the card renders localized labels from the
  // `dashboard` namespace and paints every bar with the --primary token, so no
  // hardcoded palette or unlocalized copy lives in this data.
  const allStages = [
    { id: "visitors", count: visitors },
    { id: "add_to_cart", count: addToCart },
    { id: "checkout", count: checkout },
    { id: "purchase", count: purchase },
  ];

  const filtered = allStages.filter((s) => activeStages.includes(s.id));
  const max = filtered.length > 0 ? filtered[0].count : 1;

  return filtered.map((s) => ({
    ...s,
    rate: Math.round((s.count / max) * 100),
  }));
}

/** Funnel goal toggles — ids match `generateFunnelData`'s stage ids. */
const FUNNEL_GOALS = [
  { id: "visitors", labelKey: "funnelVisitors" },
  { id: "add_to_cart", labelKey: "funnelAddToCart" },
  { id: "checkout", labelKey: "funnelCheckout" },
  { id: "purchase", labelKey: "funnelPurchase" },
] as const;

/** Period pill presets (days) for the funnel window. */
const FUNNEL_PERIODS = [7, 30, 90] as const;

const fmtInt = (n: number) => Math.round(n).toLocaleString();

/** Percentage-point delta chip — hidden when the previous window is unknown. */
function FunnelDeltaChip({ deltaPct }: { deltaPct: number | null }) {
  if (deltaPct === null || !Number.isFinite(deltaPct)) return null;
  const up = deltaPct > 0;
  const flat = deltaPct === 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums",
        flat
          ? "bg-muted text-muted-foreground"
          : up
            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
            : "bg-rose-500/10 text-rose-600 dark:text-rose-400",
      )}
    >
      {up ? (
        <TrendingUpIcon size={12} className="h-3 w-3" />
      ) : (
        <TrendingDownIcon size={12} className="h-3 w-3" />
      )}
      {`${up ? "+" : ""}${deltaPct.toFixed(1)}%`}
    </span>
  );
}

function generateGeoData(orders: any[]) {
  const regions: Record<string, { count: number; revenue: number }> = {};
  const countries: Record<string, { count: number; revenue: number }> = {};

  if (!orders || orders.length === 0) {
    return { regions: [], countries: [] };
  }

  orders.forEach((o) => {
    const country = o.shippingAddress?.country || o.customer?.country || "Unknown Country";
    const city = o.shippingAddress?.city || o.customer?.city || "Unknown City";
    const revenue = o.grandTotal || 0;

    if (!regions[city]) regions[city] = { count: 0, revenue: 0 };
    regions[city].count += 1;
    regions[city].revenue += revenue;

    if (!countries[country]) countries[country] = { count: 0, revenue: 0 };
    countries[country].count += 1;
    countries[country].revenue += revenue;
  });

  return {
    regions: Object.entries(regions)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
    countries: Object.entries(countries)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
  };
}

export default function AnalyticsPage() {
  const tdash = useTranslations("dashboard");
  const tcommon = useTranslations("common");
  const { formatMoney, formatCompactMoney, currency } = useCurrency();
  const { data, loading, lastUpdated, isRefreshing, refresh } = useRealtimeData<AnalyticsData>(
    "/api/dashboard",
    { interval: 20000 },
  );
  const { data: ordersData } = useRealtimeData<any[]>("/api/orders", { interval: 30000 });
  // Period-over-period windows end "now" when the range is open-ended. Read
  // through the hook rather than `Date.now()` in the memos below, which is an
  // impure read during render.
  const now = useNow();

  // Deep-link month filter (dashboard revenue bars link here with ?month=YYYY-MM).
  // Scoped by router.replace removal — the X chip strips the param without a
  // history entry, matching how the rest of the dashboard dismisses filters.
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const monthFilter = searchParams.get("month");
  const labelFilter = searchParams.get("label");
  const clearMonthFilter = React.useCallback(() => {
    router.replace(pathname);
  }, [router, pathname]);
  const locale = useLocale();
  // Date range lives in the URL (?from=&to=) so filtered views are shareable
  // and survive navigation — same contract as the ?month= deep-link chip.
  const urlFrom = searchParams.get("from") || "";
  const urlTo = searchParams.get("to") || "";
  const dateRange = React.useMemo<DateRange>(
    () => ({ from: urlFrom, to: urlTo }),
    [urlFrom, urlTo],
  );
  const setDateRange = React.useCallback(
    (next: DateRange) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next.from) params.set("from", next.from);
      else params.delete("from");
      if (next.to) params.set("to", next.to);
      else params.delete("to");
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [searchParams, router, pathname],
  );
  const [activeFunnelStages, setActiveFunnelStages] = React.useState<string[]>([
    "visitors",
    "add_to_cart",
    "checkout",
    "purchase",
  ]);

  // The month deep-link and the range picker compose: both may be active at
  // once, and the stricter of the two wins per order.
  const scopedOrders = useMemo(
    () => filterOrdersByRange(filterOrdersByMonth(ordersData || [], monthFilter), dateRange),
    [ordersData, monthFilter, dateRange],
  );

  const funnelData = useMemo(
    () => generateFunnelData(scopedOrders, activeFunnelStages),
    [scopedOrders, activeFunnelStages],
  );
  const geoData = useMemo(() => generateGeoData(scopedOrders), [scopedOrders]);

  // Previous-period comparison: the window immediately before the active
  // range with the same length. Orders outside any range make deltas
  // meaningless, so the bar only renders when a range is active.
  const comparison = useMemo(() => {
    if (!dateRange.from && !dateRange.to) return null;
    const toMs = dateRange.to ? new Date(`${dateRange.to}T23:59:59.999`).getTime() : now;
    const fromMs = dateRange.from
      ? new Date(`${dateRange.from}T00:00:00`).getTime()
      : toMs - 30 * 86400000;
    const len = Math.max(toMs - fromMs, 86400000);
    const prevTo = fromMs - 1;
    const prevFrom = prevTo - len;
    const all = ordersData || [];
    const inWindow = (lo: any, a: number, b: number) => {
      const t = new Date(lo.createdAt).getTime();
      return t >= a && t <= b;
    };
    const cur = all.filter((lo) => inWindow(lo, fromMs, toMs));
    const prev = all.filter((lo) => inWindow(lo, prevFrom, prevTo));
    const sum = (arr: typeof all, pick: (o: (typeof all)[number]) => number) =>
      arr.reduce((s, o) => s + pick(o), 0);
    const pct = (c: number, p: number): number | null =>
      p === 0 ? (c === 0 ? 0 : null) : ((c - p) / p) * 100;
    return {
      revenueDelta: pct(
        sum(cur, (o) => Number(o.grandTotal) || 0),
        sum(prev, (o) => Number(o.grandTotal) || 0),
      ),
      ordersDelta: pct(cur.length, prev.length),
      customersDelta: pct(
        new Set(cur.map((o) => o.customerId).filter(Boolean)).size,
        new Set(prev.map((o) => o.customerId).filter(Boolean)).size,
      ),
    };
  }, [ordersData, dateRange, now]);

  // ── Funnel card shell state (boardui pattern, same shell as the radar widget) ──
  // The active pill is DERIVED from the URL range rather than stored: the
  // funnel window is the shareable date range, so the pill simply reflects it.
  const activeFunnelPeriod = useMemo(() => {
    if (!dateRange.from || !dateRange.to) return null;
    const len = Math.round(
      (new Date(dateRange.to).getTime() - new Date(dateRange.from).getTime()) / 86400000,
    );
    return FUNNEL_PERIODS.find((p) => Math.abs(p - len) <= 1) ?? null;
  }, [dateRange]);

  const applyFunnelPeriod = (days: number) => {
    const to = new Date();
    const from = new Date(to.getTime() - days * 86400000);
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    setDateRange({ from: iso(from), to: iso(to) });
  };

  const toggleFunnelGoal = (id: string) => {
    setActiveFunnelStages((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );
  };

  // Top-of-funnel count for the count-up headline, plus its previous-window
  // delta — computed from the same order series the funnel itself uses.
  const funnelTopCount = funnelData[0]?.count ?? 0;
  const funnelTopDelta = useMemo(() => {
    if (!dateRange.from && !dateRange.to) return null;
    const toMs = dateRange.to ? new Date(`${dateRange.to}T23:59:59.999`).getTime() : now;
    const fromMs = dateRange.from
      ? new Date(`${dateRange.from}T00:00:00`).getTime()
      : toMs - 30 * 86400000;
    const len = Math.max(toMs - fromMs, 86400000);
    const prevTo = fromMs - 1;
    const prevFrom = prevTo - len;
    const prev = (ordersData || []).filter((lo: any) => {
      const t = new Date(lo.createdAt).getTime();
      return t >= prevFrom && t <= prevTo;
    });
    const prevStages = generateFunnelData(prev, activeFunnelStages);
    const prevTop = prevStages[0]?.count ?? 0;
    if (!prevTop) return null;
    const top = funnelData[0]?.count ?? 0;
    return ((top - prevTop) / prevTop) * 100;
  }, [ordersData, dateRange, activeFunnelStages, funnelData, now]);

  const funnelStageLabel = (id: string) => {
    const goal = FUNNEL_GOALS.find((g) => g.id === id);
    return goal ? tdash(goal.labelKey) : id;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-8 w-48 shimmer rounded" />
            <div className="h-4 w-64 shimmer rounded" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="h-10 w-10 shimmer rounded-lg" />
                  <div className="h-4 w-14 shimmer rounded" />
                </div>
                <div className="h-3 w-24 shimmer rounded mb-2" />
                <div className="h-7 w-28 shimmer rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="h-[340px] shimmer rounded-xl" />
      </div>
    );
  }

  if (!data) return null;

  // Export current view — forwards the active URL range to the tier-gated
  // Enterprise CSV export; a 402 challenge means the plan doesn't include it.
  const handleExportView = async () => {
    try {
      const params = new URLSearchParams();
      if (dateRange.from) params.set("from", dateRange.from);
      if (dateRange.to) params.set("to", dateRange.to);
      const qs = params.toString();
      const res = await fetch(`/api/export/orders${qs ? `?${qs}` : ""}`);
      if (res.ok) {
        const blob = await res.blob();
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download =
          res.headers.get("content-disposition")?.match(/filename="?([^";]+)"?/)?.[1] ||
          "orders.csv";
        a.click();
        URL.revokeObjectURL(a.href);
        toast.success(tdash("exportSuccess"));
      } else if (res.status === 402 || res.status === 403) {
        toast.error(tdash("exportDenied"));
      } else {
        toast.error(tcommon("error"));
      }
    } catch {
      toast.error(tcommon("error"));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold truncate">{tdash("analyticsTitle")}</h1>
          <p className="text-sm text-gray-500 mt-1 max-w-2xl">{tdash("analyticsDesc")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <DateRangeFilter value={dateRange} onChange={setDateRange} />
          {(dateRange.from || dateRange.to) && (
            <Tooltip content={tdash("exportViewDesc")} side="bottom">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => void handleExportView()}
              >
                <DownloadIcon size={14} className="h-3.5 w-3.5" />
                <span className="hidden md:inline">{tdash("exportView")}</span>
              </Button>
            </Tooltip>
          )}
          {/* Revenue, AOV, and the funnel's gross value are all converted at the
              live mid-market rate; name the rate and its age here. */}
          <LiveFxBadge className="hidden lg:inline-flex" />
          <RealtimeIndicator lastUpdated={lastUpdated} isRefreshing={isRefreshing} />
          <Button
            variant="ghost"
            size="sm"
            onClick={refresh}
            disabled={isRefreshing}
            className="gap-1"
          >
            <RefreshCwIcon
              size={14}
              className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")}
            />
            <span className="hidden sm:inline">{tcommon("view")}</span>
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: tdash("totalRevenue"),
            endValue: data.stats.totalRevenue,
            formatter: (v: number) =>
              currency === "IDR" && v > 1000000 ? formatCompactMoney(v) : formatMoney(v),
            duration: 1600,
            change:
              data.stats.revenueGrowth >= 0
                ? `+${data.stats.revenueGrowth}%`
                : `${data.stats.revenueGrowth}%`,
            icon: DollarSignIcon,
            color: "text-emerald-500",
            bg: "bg-emerald-50 dark:bg-emerald-900/20",
            positive: data.stats.revenueGrowth >= 0,
            sparkData: data.revenueData?.slice(-7).map((d) => d.revenue) || [],
          },
          {
            label: tdash("totalOrders"),
            endValue: data.stats.totalOrders,
            duration: 1400,
            change:
              data.stats.ordersGrowth >= 0
                ? `+${data.stats.ordersGrowth}%`
                : `${data.stats.ordersGrowth}%`,
            icon: CartIcon,
            color: "text-blue-500",
            bg: "bg-blue-50 dark:bg-blue-900/20",
            positive: data.stats.ordersGrowth >= 0,
            sparkData: data.sparklines?.orders || [],
          },
          {
            label: tdash("totalCustomers"),
            endValue: data.stats.totalCustomers,
            duration: 1400,
            change:
              data.stats.customersGrowth >= 0
                ? `+${data.stats.customersGrowth}%`
                : `${data.stats.customersGrowth}%`,
            icon: UsersIcon,
            color: "text-purple-500",
            bg: "bg-purple-50 dark:bg-purple-900/20",
            positive: data.stats.customersGrowth >= 0,
            sparkData: data.sparklines?.customers || [],
          },
          {
            label: tdash("funnelRate"),
            endValue: 3.2,
            suffix: "%",
            decimals: 1,
            duration: 1200,
            change: "-0.5%",
            icon: EyeIcon,
            color: "text-orange-500",
            bg: "bg-orange-50 dark:bg-orange-900/20",
            positive: false,
          },
        ].map((metric) => (
          <Card key={metric.label} className="min-w-0 overflow-hidden">
            <CardContent className="p-5 sm:p-6 min-w-0 overflow-hidden">
              <div className="flex items-center justify-between">
                <div className={cn("p-2 rounded-lg shrink-0", metric.bg)}>
                  <metric.icon size={20} className={cn("h-5 w-5", metric.color)} />
                </div>
                <span
                  className={cn(
                    "flex items-center text-xs font-medium shrink-0",
                    metric.positive ? "text-emerald-600" : "text-red-600",
                  )}
                >
                  {metric.positive ? (
                    <TrendingUpIcon size={12} className="h-3 w-3 mr-0.5" />
                  ) : (
                    <TrendingDownIcon size={12} className="h-3 w-3 mr-0.5" />
                  )}
                  {metric.change}
                </span>
              </div>
              <p className="text-sm text-gray-500 mt-3 truncate">{metric.label}</p>
              <div
                className="text-lg sm:text-xl xl:text-2xl font-bold truncate mt-1 tabular-nums truncate tracking-tight"
                title={
                  metric.formatter
                    ? metric.formatter(metric.endValue)
                    : `${metric.endValue}${metric.suffix || ""}`
                }
              >
                <AnimatedCounter
                  end={metric.endValue}
                  duration={metric.duration || 1600}
                  formatter={metric.formatter}
                  suffix={metric.suffix}
                />
              </div>
              {"sparkData" in metric && metric.sparkData && metric.sparkData.length > 1 && (
                <div className="mt-2">
                  <Sparkline
                    data={metric.sparkData}
                    width={120}
                    height={28}
                    strokeColor={metric.positive ? "#10b981" : "#ef4444"}
                    strokeWidth={1.5}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Month filter chip — shown when deep-linked from a dashboard bar. */}
      {(monthFilter || labelFilter) && (
        <div
          className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/[0.06] px-3 py-1.5 text-sm"
          data-testid="analytics-month-chip"
        >
          <span className="text-primary font-medium">
            {tdash("filteredMonth", {
              month: labelFilter
                ? labelFilter
                : new Date(`${monthFilter}-15T00:00:00`).toLocaleString(locale, {
                    month: "long",
                    year: "numeric",
                  }),
            })}
          </span>
          <button
            type="button"
            onClick={clearMonthFilter}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label={tcommon("close")}
          >
            ✕
          </button>
        </div>
      )}

      {/* Previous-period comparison — same window length immediately before
          the active range, with per-metric deltas. Only when a range is set. */}
      {(dateRange.from || dateRange.to) && comparison && (
        <div
          className="rounded-xl border border-border bg-muted/30 px-4 py-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm"
          data-testid="analytics-comparison-bar"
        >
          <span className="font-medium text-foreground">{tdash("comparePrev")}</span>
          {(
            [
              ["revenue", comparison.revenueDelta],
              ["orders", comparison.ordersDelta],
              ["customers", comparison.customersDelta],
            ] as const
          ).map(([key, delta]) => (
            <span
              key={key}
              className="inline-flex items-center gap-1.5"
              data-testid={`analytics-delta-${key}`}
            >
              <span className="text-muted-foreground capitalize">
                {key === "revenue"
                  ? tdash("totalRevenue")
                  : key === "orders"
                    ? tdash("totalOrders")
                    : tdash("totalCustomers")}
              </span>
              {delta === null ? (
                <span className="text-muted-foreground">{tdash("noPrevData")}</span>
              ) : (
                <span
                  className={cn(
                    "inline-flex items-center gap-0.5 font-semibold tabular-nums",
                    delta >= 0 ? "text-emerald-600" : "text-red-600",
                  )}
                >
                  {delta >= 0 ? (
                    <TrendingUpIcon size={12} className="h-3 w-3" />
                  ) : (
                    <TrendingDownIcon size={12} className="h-3 w-3" />
                  )}
                  {delta >= 0 ? "+" : ""}
                  {delta.toFixed(1)}%
                </span>
              )}
            </span>
          ))}
        </div>
      )}

      {/* Revenue Chart */}
      <Card>
        <CardHeader>
          <CardTitle>{tdash("revenueChart")}</CardTitle>
          <CardDescription>{tdash("growth")}</CardDescription>
        </CardHeader>
        <CardContent>
          <RevenueChart data={data.revenueData} height={300} />
        </CardContent>
      </Card>

      {/* Enhanced Tabs */}
      <Tabs defaultValue="funnel" className="space-y-4">
        <TabsList>
          <TabsTrigger value="funnel" className="gap-1.5">
            <LayersIcon size={14} className="h-3.5 w-3.5" />
            {tdash("funnel")}
          </TabsTrigger>
          <TabsTrigger value="retention" className="gap-1.5">
            <UsersIcon size={14} className="h-3.5 w-3.5" />
            {tdash("retention")}
          </TabsTrigger>
          <TabsTrigger value="geography" className="gap-1.5">
            <MapPinIcon size={14} className="h-3.5 w-3.5" />
            {tdash("geography")}
          </TabsTrigger>
          <TabsTrigger value="channels" className="gap-1.5">
            <ChartBarIncreasingIcon size={14} className="h-3.5 w-3.5" />
            {tdash("salesByChannel")}
          </TabsTrigger>
          <TabsTrigger value="products" className="gap-1.5">
            <CartIcon size={14} className="h-3.5 w-3.5" />
            {tdash("topProducts")}
          </TabsTrigger>
        </TabsList>

        {/* Conversion Funnel Tab */}
        <TabsContent value="funnel" className="space-y-4">
          {/* Boardui card shell — the same one the conversion radar uses:
              title + icon, count-up headline with a previous-window delta chip,
              a localized period pill, and a segmented pill group for the goal
              filters. All bars paint with design tokens (no hardcoded palette,
              no unlocalized copy).
              `data-testid="analytics-funnel"` is preserved for the analytics
              tab specs. */}
          <Card
            data-testid="analytics-funnel"
            className="overflow-hidden border-border/70 shadow-sm"
          >
            <CardHeader className="flex flex-col gap-3 pb-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <CardTitle className="flex items-center gap-2 text-base">
                  <LayersIcon size={16} className="h-4 w-4 shrink-0 text-primary" />
                  <span className="break-words">{tdash("funnel")}</span>
                </CardTitle>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <AnimatedCounter
                    end={funnelTopCount}
                    formatter={fmtInt}
                    className="text-2xl font-bold tracking-tight"
                  />
                  <span className="text-xs text-muted-foreground">{tdash("funnelVisitors")}</span>
                  <FunnelDeltaChip deltaPct={funnelTopDelta} />
                </div>
                <CardDescription className="mt-1 break-words">
                  {tdash("funnelDesc")}
                </CardDescription>
              </div>

              <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
                {/* Period pill — writes the shared URL date range, so the
                    funnel window stays shareable and matches the header filter. */}
                <div
                  role="group"
                  aria-label={tdash("radarRangeLabel")}
                  className="flex items-center gap-1 rounded-xl border border-border/50 bg-muted/60 p-1 text-xs"
                >
                  {FUNNEL_PERIODS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => applyFunnelPeriod(p)}
                      aria-pressed={activeFunnelPeriod === p}
                      className={cn(
                        "rounded-lg px-2.5 py-1 font-medium transition-colors",
                        activeFunnelPeriod === p
                          ? "bg-background text-foreground shadow-xs"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {p === 7
                        ? tdash("radarRange_7d")
                        : p === 30
                          ? tdash("radarRange_30d")
                          : tdash("radarRange_90d")}
                    </button>
                  ))}
                </div>

                {/* Goal filters as a segmented pill group (was a row of
                    checkbox labels with hardcoded copy). */}
                <div
                  role="group"
                  aria-label={tdash("funnelGoalsLabel")}
                  className="flex flex-wrap items-center gap-1 rounded-xl border border-border/50 bg-muted/60 p-1"
                >
                  {FUNNEL_GOALS.map((goal) => {
                    const on = activeFunnelStages.includes(goal.id);
                    return (
                      <button
                        key={goal.id}
                        type="button"
                        onClick={() => toggleFunnelGoal(goal.id)}
                        aria-pressed={on}
                        className={cn(
                          "rounded-lg px-2 py-1 text-[10px] font-semibold transition-colors",
                          on
                            ? "bg-background text-foreground shadow-xs"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {tdash(goal.labelKey)}
                      </button>
                    );
                  })}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 p-4 sm:p-6">
              {funnelData.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  {tdash("funnelEmpty")}
                </p>
              ) : (
                <ol className="mx-auto max-w-3xl space-y-4">
                  {funnelData.map((stage, i) => (
                    <li
                      key={stage.id}
                      className="rounded-xl border border-border/60 bg-muted/30 p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 font-mono text-xs font-bold text-primary">
                            {i + 1}
                          </span>
                          <span className="text-sm font-semibold text-foreground">
                            {funnelStageLabel(stage.id)}
                          </span>
                          <span className="font-mono text-xs text-muted-foreground">
                            ({stage.count.toLocaleString()} {tdash("funnelSessions")})
                          </span>
                        </div>
                        <Badge
                          variant="outline"
                          className="border-primary/30 bg-primary/5 font-mono text-xs font-bold text-primary"
                        >
                          <TrendingUpIcon size={12} className="mr-1 inline h-3 w-3" />
                          {stage.rate}%
                        </Badge>
                      </div>
                      <div className="mt-3 h-3 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary transition-all duration-700"
                          style={{ width: `${Math.max(12, stage.rate)}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Cohort Retention Tab */}
        <TabsContent value="retention" className="space-y-4">
          <CohortRetentionHeatmap />
        </TabsContent>

        {/* Geographic Breakdown Tab */}
        <TabsContent value="geography" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>{tdash("topRegions")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {geoData.regions.map((region) => {
                  const maxVal = geoData.regions[0]?.count || 1;
                  const width = Math.max(10, (region.count / maxVal) * 100);
                  return (
                    <div key={region.name} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          {region.name}
                        </span>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-500">{region.count} orders</span>
                          <span className="text-xs font-medium tabular-nums">
                            {formatMoney(region.revenue)}
                          </span>
                        </div>
                      </div>
                      <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                          style={{ width: `${width}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{tdash("topCountries")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {geoData.countries.map((country) => {
                  const maxVal = geoData.countries[0]?.count || 1;
                  const width = Math.max(10, (country.count / maxVal) * 100);
                  const flags: Record<string, string> = {
                    "United States": "ðŸ‡ºðŸ‡¸",
                    "United Kingdom": "ðŸ‡¬ðŸ‡§",
                    Germany: "ðŸ‡©ðŸ‡ª",
                    Japan: "ðŸ‡¯ðŸ‡µ",
                    Australia: "ðŸ‡¦ðŸ‡º",
                    Canada: "ðŸ‡¨ðŸ‡¦",
                    France: "ðŸ‡«ðŸ‡·",
                    Brazil: "ðŸ‡§ðŸ‡·",
                  };
                  return (
                    <div key={country.name} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          {flags[country.name] || ""} {country.name}
                        </span>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-500">{country.count} orders</span>
                          <span className="text-xs font-medium tabular-nums">
                            {formatMoney(country.revenue)}
                          </span>
                        </div>
                      </div>
                      <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                          style={{ width: `${width}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Sales Channel Tab */}
        <TabsContent value="channels" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>{tdash("salesByChannel")}</CardTitle>
              </CardHeader>
              <CardContent>
                <SalesChannelChart data={data.salesByChannel} height={320} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{tdash("channelMix")}</CardTitle>
              </CardHeader>
              <CardContent>
                <ChannelMixDonut
                  data={data.salesByChannel}
                  height={260}
                  formatValue={formatCompactMoney}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{tdash("channelRingsTitle")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <ChannelActivityRings data={data.salesByChannel} formatValue={formatCompactMoney} />
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-1.5"
                  data-testid="rings-share"
                  onClick={async () => {
                    const svg = buildRingsShareSvg(
                      data.salesByChannel || [],
                      tdash("channelRingsTitle"),
                      tdash("channelMix"),
                    );
                    // PNG first (widely paste-able); SVG fallback when the
                    // browser refuses the canvas path.
                    await downloadRingsSharePng(svg, "channel-activity-rings.png");
                    downloadRingsShare(svg, "channel-activity-rings.svg");
                    toast.success(tdash("ringsShareToast"));
                  }}
                >
                  <ImageDown size={14} className="h-3.5 w-3.5" />
                  {tdash("ringsShare")}
                </Button>
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{tdash("channelTrendTitle")}</CardTitle>
            </CardHeader>
            <CardContent>
              <ChannelTrendArea
                data={data.channelTrend || []}
                series={(data.salesByChannel || [])
                  .filter((c) => c.value > 0)
                  .slice(0, 6)
                  .map((c) => ({
                    slug: (c as any).slug || c.name.toLowerCase().replace(/\s+/g, "-"),
                    name: c.name,
                    color: c.color,
                  }))}
                height={300}
                formatValue={formatCompactMoney}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Top Products Tab */}
        <TabsContent value="products" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{tdash("topProducts")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {data.topProducts.map((p: TopProduct, i: number) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 min-w-0"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-sm font-bold shrink-0">
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">
                          {p.name}
                          <LinkedPlatformsBadge
                            productId={p.id}
                            count={p.linkedCount || 0}
                            className="ml-1.5 shrink-0 inline-flex"
                          />
                        </p>
                        <p className="text-xs text-gray-500 truncate">{p.orderCount || 0} orders</p>
                      </div>
                    </div>
                    <span
                      className="text-sm font-medium shrink-0 ml-3 truncate"
                      title={formatMoney(p.price)}
                    >
                      {formatMoney(p.price)}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
