"use client";

import { useTranslations } from "next-intl";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Users,
  ShoppingCart,
  DollarSign,
  Eye,
  RefreshCw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency, cn } from "@/lib/utils";
import { useRealtimeData } from "@/hooks/use-realtime-data";
import { RealtimeIndicator } from "@/components/realtime-indicator";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { RevenueChart, SalesChannelChart } from "@/components/charts";

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
}

interface AnalyticsData {
  stats: StatData;
  salesByChannel: SalesChannel[];
  revenueData: RevenuePoint[];
  topProducts: TopProduct[];
}

export default function AnalyticsPage() {
  const tdash = useTranslations("dashboard");
  const tcommon = useTranslations("common");
  const { data, loading, lastUpdated, isRefreshing, refresh } = useRealtimeData<AnalyticsData>(
    "/api/dashboard",
    {
      interval: 20000,
    },
  );

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

  const insights = generateInsights(data, tdash);

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
            <RefreshCw className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")} />
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
            icon: DollarSign,
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
            icon: Users,
            color: "text-purple-500",
            bg: "bg-purple-50 dark:bg-purple-900/20",
            positive: true,
          },
          {
            label: tdash("salesByChannel"),
            endValue: 3.2,
            suffix: "%",
            decimals: 1,
            duration: 1200,
            change: "-0.5%",
            icon: Eye,
            color: "text-orange-500",
            bg: "bg-orange-50 dark:bg-orange-900/20",
            positive: false,
          },
        ].map((metric) => (
          <Card key={metric.label}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className={cn("p-2 rounded-lg", metric.bg)}>
                  <metric.icon className={cn("h-5 w-5", metric.color)} />
                </div>
                <span
                  className={cn(
                    "flex items-center text-xs font-medium",
                    metric.positive ? "text-emerald-600" : "text-red-600",
                  )}
                >
                  {metric.positive ? (
                    <TrendingUp className="h-3 w-3 mr-0.5" />
                  ) : (
                    <TrendingDown className="h-3 w-3 mr-0.5" />
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

      {/* Insights Grid */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">{tdash("insights")}</TabsTrigger>
          <TabsTrigger value="channels">{tdash("salesByChannel")}</TabsTrigger>
          <TabsTrigger value="products">{tdash("topProducts")}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {insights.map((insight, i) => (
              <Card key={i}>
                <CardContent className="p-5 flex items-start gap-4">
                  <div className={cn("p-2 rounded-lg shrink-0", insight.bg)}>
                    <insight.icon className={cn("h-5 w-5", insight.color)} />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-100">{insight.title}</p>
                    <p className="text-sm text-gray-500 mt-1">{insight.description}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

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
                        <p className="text-sm font-medium">{p.name}</p>
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

function generateInsights(data: AnalyticsData, tdash: (key: string) => string) {
  return [
    {
      title: tdash("revenueChart"),
      description: tdash("growth"),
      icon: TrendingUp,
      color: "text-emerald-600",
      bg: "bg-emerald-50 dark:bg-emerald-900/20",
    },
    {
      title: tdash("totalCustomers"),
      description: tdash("insights"),
      icon: Users,
      color: "text-blue-600",
      bg: "bg-blue-50 dark:bg-blue-900/20",
    },
    {
      title: tdash("totalOrders"),
      description: tdash("quickActions"),
      icon: ShoppingCart,
      color: "text-purple-600",
      bg: "bg-purple-50 dark:bg-purple-900/20",
    },
    {
      title: tdash("salesByChannel"),
      description: tdash("liveView"),
      icon: BarChart3,
      color: "text-orange-600",
      bg: "bg-orange-50 dark:bg-orange-900/20",
    },
  ];
}
