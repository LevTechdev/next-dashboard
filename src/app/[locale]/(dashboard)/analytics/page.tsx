"use client";
import React from "react";

import { useTranslations } from "next-intl";
import { useState, useMemo } from "react";
import {
  RefreshCwIcon,
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
import { ArrowDownRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, cn } from "@/lib/utils";
import { useCurrency } from "@/components/currency-provider";
import { useRealtimeData } from "@/hooks/use-realtime-data";
import { RealtimeIndicator } from "@/components/realtime-indicator";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { RevenueChart, SalesChannelChart } from "@/components/charts";
import { LinkedPlatformsBadge } from "@/components/linked-platforms-badge";
import { CohortRetentionHeatmap } from "@/components/analytics/cohort-retention-heatmap";

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
  revenueData: RevenuePoint[];
  topProducts: TopProduct[];
}

// Generate mock funnel data from orders
function generateFunnelData(orders: any[], activeStages: string[]) {
  const total = orders.length || 1;
  const visitors = Math.round(total * 12.5);
  const addToCart = Math.round(total * 4.2);
  const checkout = Math.round(total * 2.1);
  const purchase = total;
  
  const allStages = [
    { id: "visitors", stage: "Visitors", count: visitors, color: "bg-blue-500" },
    { id: "add_to_cart", stage: "Add to Cart", count: addToCart, color: "bg-indigo-500" },
    { id: "checkout", stage: "Checkout", count: checkout, color: "bg-purple-500" },
    { id: "purchase", stage: "Purchase", count: purchase, color: "bg-emerald-500" },
  ];

  const filtered = allStages.filter(s => activeStages.includes(s.id));
  const max = filtered.length > 0 ? filtered[0].count : 1;

  return filtered.map(s => ({
    ...s,
    rate: Math.round((s.count / max) * 100),
  }));
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
  const [activeFunnelStages, setActiveFunnelStages] = React.useState<string[]>([
    "visitors",
    "add_to_cart",
    "checkout",
    "purchase",
  ]);

  const funnelData = useMemo(() => generateFunnelData(ordersData || [], activeFunnelStages), [ordersData, activeFunnelStages]);
  const geoData = useMemo(() => generateGeoData(ordersData || []), [ordersData]);

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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold truncate">{tdash("title")}</h1>
          <p className="text-sm text-gray-500 mt-1">{tdash("insights")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
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
            </CardContent>
          </Card>
        ))}
      </div>

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
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>{tdash("funnel")}</CardTitle>
                <CardDescription>Conversion tracking across stages</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Custom Goals:</span>
                {[
                  { id: "visitors", label: "Viewed Product" },
                  { id: "add_to_cart", label: "Added to Cart" },
                  { id: "checkout", label: "Checkout Started" },
                  { id: "purchase", label: "Purchased" },
                ].map((stage) => (
                  <label key={stage.id} className="flex items-center gap-1.5 text-sm cursor-pointer border px-2 py-1 rounded-md bg-white dark:bg-slate-900 shadow-sm">
                    <input
                      type="checkbox"
                      checked={activeFunnelStages.includes(stage.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setActiveFunnelStages((prev) => [...prev, stage.id]);
                        } else {
                          setActiveFunnelStages((prev) => prev.filter((id) => id !== stage.id));
                        }
                      }}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    {stage.label}
                  </label>
                ))}
              </div>
            </CardHeader>
            <CardContent>
              {funnelData.length === 0 ? (
                <div className="text-center text-gray-500 py-10">No stages selected</div>
              ) : (
                <div className="space-y-6 max-w-3xl mx-auto py-6">
                  {funnelData.map((stage, i) => (
                    <div key={stage.id} className="flex items-center gap-4">
                      <div className="w-1/4 text-right">
                        <p className="text-sm font-medium">{stage.stage}</p>
                        <p className="text-xs text-gray-500">{stage.count} sessions</p>
                      </div>
                      <div className="flex-1 flex items-center">
                        <div
                          className={cn("h-12 rounded-r-md rounded-l-sm transition-all duration-500 relative flex items-center px-4", stage.color)}
                          style={{ width: `${stage.rate}%`, minWidth: 'fit-content' }}
                        >
                          <span className="text-white font-bold text-sm">{stage.rate}%</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
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
                          <span className="text-xs font-medium tabular-nums">{formatMoney(region.revenue)}</span>
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
                          <span className="text-xs font-medium tabular-nums">{formatMoney(country.revenue)}</span>
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
          <Card>
            <CardHeader>
              <CardTitle>{tdash("salesByChannel")}</CardTitle>
            </CardHeader>
            <CardContent>
              <SalesChannelChart data={data.salesByChannel} height={320} />
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


