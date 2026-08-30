"use client";

import { useTranslations } from "next-intl";
import { useMemo } from "react";
import {
  RefreshCwIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  UsersIcon,
  DollarSignIcon,
  EyeIcon,
} from "lucide-animated";
import { Globe, Filter, BarChart3, ShoppingCart, ArrowDownRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, cn } from "@/lib/utils";
import { useRealtimeData } from "@/hooks/use-realtime-data";
import { RealtimeIndicator } from "@/components/realtime-indicator";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { RevenueChart, SalesChannelChart } from "@/components/charts";
import { LinkedPlatformsBadge } from "@/components/linked-platforms-badge";

interface StatData {
  totalRevenue: number;
  totalOrders: number;
  totalCustomers: number;
  revenueGrowth: number;
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
function generateFunnelData(orders: any[]) {
  const total = orders.length || 1;
  const visitors = Math.round(total * 12.5);
  const addToCart = Math.round(total * 4.2);
  const checkout = Math.round(total * 2.1);
  const purchase = total;
  return [
    { stage: "Visitors", count: visitors, rate: 100, color: "bg-blue-500" },
    {
      stage: "Add to Cart",
      count: addToCart,
      rate: Math.round((addToCart / visitors) * 100),
      color: "bg-indigo-500",
    },
    {
      stage: "Checkout",
      count: checkout,
      rate: Math.round((checkout / visitors) * 100),
      color: "bg-purple-500",
    },
    {
      stage: "Purchase",
      count: purchase,
      rate: Math.round((purchase / visitors) * 100),
      color: "bg-emerald-500",
    },
  ];
}

// Generate mock cohort retention data
function generateRetentionData() {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
  const cohorts = [
    "Jan Cohort",
    "Feb Cohort",
    "Mar Cohort",
    "Apr Cohort",
    "May Cohort",
    "Jun Cohort",
  ];
  return cohorts.map((cohort, i) => {
    const retention: number[] = [];
    for (let m = 0; m <= 5 - i; m++) {
      retention.push(Math.max(10, Math.round(100 - m * (12 + Math.random() * 8))));
    }
    return { cohort, retention, startMonth: months[i] };
  });
}

// Generate mock geographic data
function generateGeoData(orders: any[]) {
  const regions: Record<string, number> = {};
  const countries: Record<string, number> = {};
  const regionNames = [
    "North America",
    "Europe",
    "Asia Pacific",
    "Latin America",
    "Middle East",
    "Africa",
  ];
  const countryNames = [
    "United States",
    "United Kingdom",
    "Germany",
    "Japan",
    "Australia",
    "Canada",
    "France",
    "Brazil",
  ];

  regionNames.forEach((r) => {
    regions[r] = Math.round(Math.random() * 200 + 50);
  });
  countryNames.forEach((c) => {
    countries[c] = Math.round(Math.random() * 150 + 20);
  });

  return {
    regions: Object.entries(regions).sort(([, a], [, b]) => b - a),
    countries: Object.entries(countries).sort(([, a], [, b]) => b - a),
  };
}

export default function AnalyticsPage() {
  const tdash = useTranslations("dashboard");
  const tcommon = useTranslations("common");
  const { data, loading, lastUpdated, isRefreshing, refresh } = useRealtimeData<AnalyticsData>(
    "/api/dashboard",
    { interval: 20000 },
  );
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { data: orders } = useRealtimeData<any[]>("/api/orders", { interval: 30000 });

  const funnelData = useMemo(() => generateFunnelData(orders || []), [orders]);
  const retentionData = useMemo(() => generateRetentionData(), []);
  const geoData = useMemo(() => generateGeoData(orders || []), [orders]);

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{tdash("title")}</h1>
          <p className="text-sm text-gray-500 mt-1">{tdash("insights")}</p>
        </div>
        <div className="flex items-center gap-3">
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
            formatter: (v: number) => formatCurrency(v),
            duration: 1600,
            change: "+12.5%",
            icon: DollarSignIcon,
            color: "text-emerald-500",
            bg: "bg-emerald-50 dark:bg-emerald-900/20",
            positive: true,
          },
          {
            label: tdash("totalOrders"),
            endValue: data.stats.totalOrders,
            duration: 1400,
            change: "+8.3%",
            icon: ShoppingCart,
            color: "text-blue-500",
            bg: "bg-blue-50 dark:bg-blue-900/20",
            positive: true,
          },
          {
            label: tdash("totalCustomers"),
            endValue: data.stats.totalCustomers,
            duration: 1400,
            change: "+15.2%",
            icon: UsersIcon,
            color: "text-purple-500",
            bg: "bg-purple-50 dark:bg-purple-900/20",
            positive: true,
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
          <Card key={metric.label}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className={cn("p-2 rounded-lg", metric.bg)}>
                  <metric.icon size={20} className={cn("h-5 w-5", metric.color)} />
                </div>
                <span
                  className={cn(
                    "flex items-center text-xs font-medium",
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
              <p className="text-sm text-gray-500 mt-3">{metric.label}</p>
              <p className="text-2xl font-bold mt-1 tabular-nums">
                <AnimatedCounter
                  end={metric.endValue}
                  duration={metric.duration || 1600}
                  formatter={metric.formatter}
                  suffix={metric.suffix}
                />
              </p>
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
            <Filter className="h-3.5 w-3.5" />
            {tdash("funnel")}
          </TabsTrigger>
          <TabsTrigger value="retention" className="gap-1.5">
            <UsersIcon className="h-3.5 w-3.5" />
            {tdash("retention")}
          </TabsTrigger>
          <TabsTrigger value="geography" className="gap-1.5">
            <Globe className="h-3.5 w-3.5" />
            {tdash("geography")}
          </TabsTrigger>
          <TabsTrigger value="channels" className="gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" />
            {tdash("salesByChannel")}
          </TabsTrigger>
          <TabsTrigger value="products" className="gap-1.5">
            <ShoppingCart className="h-3.5 w-3.5" />
            {tdash("topProducts")}
          </TabsTrigger>
        </TabsList>

        {/* Conversion Funnel Tab */}
        <TabsContent value="funnel" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{tdash("funnel")}</CardTitle>
              <CardDescription>{tdash("funnelDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {funnelData.map((step, i) => {
                const width = Math.max(20, (step.count / funnelData[0].count) * 100);
                return (
                  <div key={step.stage} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 text-sm font-bold text-gray-600 dark:text-gray-400">
                          {i + 1}
                        </span>
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {step.stage === "Visitors"
                              ? tdash("funnelVisitors")
                              : step.stage === "Add to Cart"
                                ? tdash("funnelAddToCart")
                                : step.stage === "Checkout"
                                  ? tdash("funnelCheckout")
                                  : tdash("funnelPurchase")}
                          </p>
                          <p className="text-xs text-gray-500">
                            {step.count.toLocaleString()} {tcommon("total").toLowerCase()}
                          </p>
                        </div>
                      </div>
                      <Badge variant={i === funnelData.length - 1 ? "success" : "outline"}>
                        {step.rate}%
                      </Badge>
                    </div>
                    <div className="relative h-10 bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden">
                      <div
                        className={cn("h-full rounded-lg transition-all duration-700", step.color)}
                        style={{ width: `${width}%` }}
                      />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-xs font-semibold text-white drop-shadow-md">
                          {step.count.toLocaleString()}
                        </span>
                      </div>
                    </div>
                    {i < funnelData.length - 1 && (
                      <div className="flex items-center gap-2 pl-4">
                        <ArrowDownRight className="h-3 w-3 text-gray-400" />
                        <span className="text-xs text-gray-500">
                          {Math.round(((funnelData[i + 1].count - step.count) / step.count) * 100)}%{" "}
                          {tdash("growth")}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Cohort Retention Tab */}
        <TabsContent value="retention" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{tdash("retention")}</CardTitle>
              <CardDescription>{tdash("retentionDesc")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-3 px-2 text-xs font-medium text-gray-500">
                        Cohort
                      </th>
                      {[0, 1, 2, 3, 4, 5].map((m) => (
                        <th
                          key={m}
                          className="text-center py-3 px-2 text-xs font-medium text-gray-500"
                        >
                          Month {m}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {retentionData.map((row) => (
                      <tr
                        key={row.cohort}
                        className="border-b border-gray-100 dark:border-gray-800"
                      >
                        <td className="py-3 px-2 text-xs font-medium text-gray-700 dark:text-gray-300">
                          {row.cohort}
                        </td>
                        {Array.from({ length: 6 }, (_, m) => {
                          const val = row.retention[m];
                          const exists = val !== undefined;
                          const intensity = exists ? val / 100 : 0;
                          return (
                            <td key={m} className="py-3 px-2 text-center">
                              {exists ? (
                                <span
                                  className={cn(
                                    "inline-flex items-center justify-center w-12 h-8 rounded text-xs font-semibold",
                                    intensity > 0.7
                                      ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300"
                                      : intensity > 0.4
                                        ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
                                        : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300",
                                  )}
                                >
                                  {val}%
                                </span>
                              ) : (
                                <span className="inline-flex items-center justify-center w-12 h-8 rounded text-xs text-gray-300 dark:text-gray-600">
                                  —
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Geographic Breakdown Tab */}
        <TabsContent value="geography" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>{tdash("topRegions")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {geoData.regions.map(([region, count], i) => {
                  const maxVal = geoData.regions[0][1];
                  const width = Math.max(10, (count / maxVal) * 100);
                  return (
                    <div key={region} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          {region}
                        </span>
                        <span className="text-xs text-gray-500">{count} orders</span>
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
                {geoData.countries.map(([country, count], i) => {
                  const maxVal = geoData.countries[0][1];
                  const width = Math.max(10, (count / maxVal) * 100);
                  const flags: Record<string, string> = {
                    "United States": "🇺🇸",
                    "United Kingdom": "🇬🇧",
                    Germany: "🇩🇪",
                    Japan: "🇯🇵",
                    Australia: "🇦🇺",
                    Canada: "🇨🇦",
                    France: "🇫🇷",
                    Brazil: "🇧🇷",
                  };
                  return (
                    <div key={country} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          {flags[country] || ""} {country}
                        </span>
                        <span className="text-xs text-gray-500">{count} orders</span>
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
                    className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-sm font-bold">
                        {i + 1}
                      </span>
                      <div>
                        <p className="text-sm font-medium">
                          {p.name}
                          <LinkedPlatformsBadge
                            productId={p.id}
                            count={p.linkedCount || 0}
                            className="ml-1.5"
                          />
                        </p>
                        <p className="text-xs text-gray-500">{p.orderCount || 0} orders</p>
                      </div>
                    </div>
                    <span className="text-sm font-medium">{formatCurrency(p.price)}</span>
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
