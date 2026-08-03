"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState, useCallback, useMemo } from "react";
import { DownloadIcon, TrendingUpIcon, UsersIcon, DollarSignIcon } from "lucide-animated";
import { Package } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency } from "@/lib/utils";
import { useRealtimeData } from "@/hooks/use-realtime-data";
import { RealtimeIndicator } from "@/components/realtime-indicator";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { SalesChannelChart } from "@/components/charts";
import { downloadCsv } from "@/lib/csv";
import { toast } from "sonner";

export default function ReportsPage() {
  const treports = useTranslations("reports");
  const tdash = useTranslations("dashboard");
  const tcommon = useTranslations("common");
  const { data, loading, lastUpdated, isRefreshing, refresh } = useRealtimeData<any>(
    "/api/dashboard",
    { interval: 30000 },
  );

  const [activeReportTab, setActiveReportTab] = useState("sales");

  const handleExport = () => {
    const now = new Date().toISOString().split("T")[0];

    if (activeReportTab === "sales") {
      downloadCsv(
        [
          { key: "name", header: treports("channelLabel") },
          { key: "value", header: treports("revenueLabel") },
        ],
        data?.salesByChannel || [],
        `sales-report-${now}`,
        (rows) => rows.map((r: any) => ({ name: r.name, value: r.value })),
      );
      toast.success(treports("salesReportExported"));
    } else if (activeReportTab === "customers") {
      downloadCsv(
        [
          { key: "metric", header: treports("metricLabel") },
          { key: "value", header: treports("valueLabel") },
        ],
        [
          { metric: treports("totalCustomers"), value: data?.stats.totalCustomers || 0 },
          { metric: `${tdash("growth")}`, value: `${data?.stats.customersGrowth || 0}%` },
          {
            metric: treports("avgOrderValue"),
            value: data?.stats.totalRevenue / (data?.stats.totalCustomers || 1),
          },
        ],
        `customer-report-${now}`,
      );
      toast.success(treports("customerReportExported"));
    } else if (activeReportTab === "products") {
      downloadCsv(
        [
          { key: "metric", header: treports("metricLabel") },
          { key: "value", header: treports("valueLabel") },
        ],
        [
          { metric: treports("totalProducts"), value: data?.stats.totalProducts || 0 },
          { metric: tdash("topProducts"), value: data?.topProducts?.[0]?.orderCount || 0 },
          {
            metric: treports("avgProductPrice"),
            value:
              (data?.topProducts?.reduce((s: number, p: any) => s + p.price, 0) || 0) /
              (data?.topProducts?.length || 1),
          },
        ],
        `product-report-${now}`,
      );
      toast.success(treports("productReportExported"));
    }
  };

  const statMap = useMemo(() => {
    const revenue = data?.stats?.totalRevenue || 0;
    const orders = data?.stats?.totalOrders || 0;
    const customers = data?.stats?.totalCustomers || 0;
    const products = data?.stats?.totalProducts || 0;
    const growth = data?.stats?.customersGrowth || 0;
    const topOrders = data?.topProducts?.[0]?.orderCount || 0;
    const avgPrice =
      (data?.topProducts?.reduce((s: number, p: any) => s + p.price, 0) || 0) /
      (data?.topProducts?.length || 1);

    return { revenue, orders, customers, products, growth, topOrders, avgPrice };
  }, [data]);

  const { revenue, orders, customers, products, growth, topOrders, avgPrice } = statMap;

  if (loading)
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-8 w-48 shimmer rounded" />
            <div className="h-4 w-64 shimmer rounded" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="h-5 w-5 shimmer rounded mb-2" />
                <div className="h-3 w-24 shimmer rounded mb-2" />
                <div className="h-7 w-32 shimmer rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="h-[340px] shimmer rounded-lg" />
      </div>
    );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{treports("title")}</h1>
          <p className="text-sm text-gray-500 mt-1">{treports("subtitle")}</p>
        </div>
        <div className="flex items-center gap-3">
          <RealtimeIndicator lastUpdated={lastUpdated} isRefreshing={isRefreshing} />
          <Button variant="outline" onClick={handleExport}>
            <DownloadIcon size={16} className="h-4 w-4 mr-2" /> {treports("export")}
          </Button>
        </div>
      </div>

      <Tabs
        defaultValue="sales"
        value={activeReportTab}
        onValueChange={setActiveReportTab}
        className="space-y-4"
      >
        <TabsList>
          <TabsTrigger value="sales">{treports("salesReport")}</TabsTrigger>
          <TabsTrigger value="customers">{treports("customerReport")}</TabsTrigger>
          <TabsTrigger value="products">{treports("productReport")}</TabsTrigger>
        </TabsList>

        <TabsContent value="sales" className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-6">
                <DollarSignIcon size={20} className="h-5 w-5 text-emerald-500 mb-2" />
                <p className="text-sm text-gray-500">{treports("totalRevenue")}</p>
                <p className="text-2xl font-bold tabular-nums">
                  <AnimatedCounter
                    end={revenue}
                    duration={1600}
                    formatter={(v) => formatCurrency(v)}
                  />
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <TrendingUpIcon size={20} className="h-5 w-5 text-blue-500 mb-2" />
                <p className="text-sm text-gray-500">{treports("totalOrders")}</p>
                <p className="text-2xl font-bold tabular-nums">
                  <AnimatedCounter end={orders} duration={1400} />
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <DollarSignIcon size={20} className="h-5 w-5 text-purple-500 mb-2" />
                <p className="text-sm text-gray-500">{treports("avgOrderValue")}</p>
                <p className="text-2xl font-bold tabular-nums">
                  <AnimatedCounter
                    end={revenue / (orders || 1)}
                    duration={1600}
                    formatter={(v) => formatCurrency(v)}
                  />
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{tdash("salesByChannel")}</CardTitle>
            </CardHeader>
            <CardContent>
              <SalesChannelChart data={data?.salesByChannel || []} height={300} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="customers" className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-6">
                <UsersIcon size={20} className="h-5 w-5 text-blue-500 mb-2" />
                <p className="text-sm text-gray-500">{treports("totalCustomers")}</p>
                <p className="text-2xl font-bold tabular-nums">
                  <AnimatedCounter end={customers} duration={1400} />
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <TrendingUpIcon size={20} className="h-5 w-5 text-green-500 mb-2" />
                <p className="text-sm text-gray-500">{tdash("growth")}</p>
                <p className="text-2xl font-bold tabular-nums">
                  <AnimatedCounter end={growth} duration={1200} suffix="%" decimals={1} />
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <DollarSignIcon size={20} className="h-5 w-5 text-orange-500 mb-2" />
                <p className="text-sm text-gray-500">{treports("avgOrderValue")}</p>
                <p className="text-2xl font-bold tabular-nums">
                  <AnimatedCounter
                    end={revenue / (customers || 1)}
                    duration={1600}
                    formatter={(v) => formatCurrency(v)}
                  />
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="products" className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-6">
                <Package className="h-5 w-5 text-indigo-500 mb-2" />
                <p className="text-sm text-gray-500">{treports("totalProducts")}</p>
                <p className="text-2xl font-bold tabular-nums">
                  <AnimatedCounter end={products} duration={1400} />
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <TrendingUpIcon size={20} className="h-5 w-5 text-cyan-500 mb-2" />
                <p className="text-sm text-gray-500">{tdash("topProducts")}</p>
                <p className="text-2xl font-bold tabular-nums">
                  <AnimatedCounter end={topOrders} duration={1400} />
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <DollarSignIcon size={20} className="h-5 w-5 text-rose-500 mb-2" />
                <p className="text-sm text-gray-500">{treports("avgProductPrice")}</p>
                <p className="text-2xl font-bold tabular-nums">
                  <AnimatedCounter
                    end={avgPrice}
                    duration={1600}
                    formatter={(v) => formatCurrency(v)}
                  />
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
