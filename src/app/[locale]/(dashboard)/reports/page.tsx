"use client";

import { useTranslations } from "next-intl";
import { useState, useMemo } from "react";
import { TrendingUpIcon, UsersIcon, DollarSignIcon } from "lucide-animated";
import { Package, BarChart3, ArrowUpRight, ArrowDownRight, Minus, ShoppingBag } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency, getStatusColor, cn } from "@/lib/utils";
import { useRealtimeData } from "@/hooks/use-realtime-data";
import { RealtimeIndicator } from "@/components/realtime-indicator";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { RevenueChart, SalesChannelChart } from "@/components/charts";
import { DataExportButton } from "@/components/data-export-button";
import { DateRangeFilter, type DateRange } from "@/components/ui/date-range-filter";
import { motion } from "framer-motion";

export default function ReportsPage() {
  const treports = useTranslations("reports");
  const tcommon = useTranslations("common");
  const { data, loading, lastUpdated, isRefreshing } = useRealtimeData<any>("/api/dashboard", {
    interval: 30000,
  });

  const { data: orders } = useRealtimeData<any[]>("/api/orders", { interval: 30000 });
  const { data: customers } = useRealtimeData<any[]>("/api/customers", { interval: 30000 });

  const [activeTab, setActiveTab] = useState("overview");
  const [dateRange, setDateRange] = useState<DateRange>({ from: "", to: "" });
  const [revenuePeriod, setRevenuePeriod] = useState<"daily" | "weekly" | "monthly">("monthly");

  // Filter orders by date range
  const filteredOrders = useMemo(() => {
    if (!orders) return [];
    if (!dateRange.from && !dateRange.to) return orders;
    return orders.filter((o: any) => {
      const d = new Date(o.createdAt);
      if (dateRange.from && d < new Date(dateRange.from)) return false;
      if (dateRange.to) {
        const to = new Date(dateRange.to);
        to.setHours(23, 59, 59, 999);
        if (d > to) return false;
      }
      return true;
    });
  }, [orders, dateRange]);

  // Filter customers by date range
  const filteredCustomers = useMemo(() => {
    if (!customers) return [];
    if (!dateRange.from && !dateRange.to) return customers;
    return customers.filter((c: any) => {
      const d = new Date(c.createdAt);
      if (dateRange.from && d < new Date(dateRange.from)) return false;
      if (dateRange.to) {
        const to = new Date(dateRange.to);
        to.setHours(23, 59, 59, 999);
        if (d > to) return false;
      }
      return true;
    });
  }, [customers, dateRange]);

  // Stats from filtered data
  const stats = useMemo(() => {
    const totalRevenue = filteredOrders.reduce((s: number, o: any) => s + (o.grandTotal || 0), 0);
    const totalOrders = filteredOrders.length;
    const totalCustomers = filteredCustomers.length;
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    const statusCounts: Record<string, number> = {};
    filteredOrders.forEach((o: any) => {
      statusCounts[o.status] = (statusCounts[o.status] || 0) + 1;
    });

    return { totalRevenue, totalOrders, totalCustomers, avgOrderValue, statusCounts };
  }, [filteredOrders, filteredCustomers]);

  // Revenue by period for breakdown
  const revenueByPeriod = useMemo(() => {
    if (!filteredOrders.length) return [];

    const grouped: Record<string, number> = {};

    filteredOrders.forEach((o: any) => {
      const d = new Date(o.createdAt);
      let key: string;

      if (revenuePeriod === "daily") {
        key = d.toISOString().split("T")[0];
      } else if (revenuePeriod === "weekly") {
        const startOfWeek = new Date(d);
        startOfWeek.setDate(d.getDate() - d.getDay());
        key = startOfWeek.toISOString().split("T")[0];
      } else {
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      }

      grouped[key] = (grouped[key] || 0) + (o.grandTotal || 0);
    });

    return Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([period, revenue]) => ({ period, revenue }));
  }, [filteredOrders, revenuePeriod]);

  // Revenue by channel
  const revenueByChannel = useMemo(() => {
    const grouped: Record<string, number> = {};
    filteredOrders.forEach((o: any) => {
      const channel = o.channel?.name || "Unknown";
      grouped[channel] = (grouped[channel] || 0) + (o.grandTotal || 0);
    });

    const colors = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];
    return Object.entries(grouped)
      .sort(([, a], [, b]) => b - a)
      .map(([name, value], i) => ({
        name,
        value,
        color: colors[i % colors.length],
      }));
  }, [filteredOrders]);

  // Top customers by spend
  const topCustomers = useMemo(() => {
    const map: Record<string, { name: string; totalSpent: number; orders: number }> = {};
    filteredOrders.forEach((o: any) => {
      const name = o.customer?.name || "Guest";
      const id = o.customerId || name;
      if (!map[id]) map[id] = { name, totalSpent: 0, orders: 0 };
      map[id].totalSpent += o.grandTotal || 0;
      map[id].orders += 1;
    });
    return Object.values(map)
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 10);
  }, [filteredOrders]);

  const now = new Date().toISOString().split("T")[0];

  if (loading)
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-8 w-48 shimmer rounded" />
            <div className="h-4 w-64 shimmer rounded" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{treports("title")}</h1>
          <p className="text-sm text-gray-500 mt-1">{treports("subtitle")}</p>
        </div>
        <div className="flex items-center gap-3">
          <RealtimeIndicator lastUpdated={lastUpdated} isRefreshing={isRefreshing} />
          <DateRangeFilter value={dateRange} onChange={setDateRange} />
        </div>
      </div>

      <Tabs
        defaultValue="overview"
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-4"
      >
        <TabsList>
          <TabsTrigger value="overview">{treports("overview")}</TabsTrigger>
          <TabsTrigger value="revenue">{treports("revenueBreakdown")}</TabsTrigger>
          <TabsTrigger value="sales">{treports("salesReport")}</TabsTrigger>
          <TabsTrigger value="customers">{treports("customerReport")}</TabsTrigger>
          <TabsTrigger value="products">{treports("productReport")}</TabsTrigger>
        </TabsList>

        {/* ── Overview Tab ── */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                label: treports("revenueInRange"),
                end: stats.totalRevenue,
                icon: DollarSignIcon,
                color: "text-emerald-600 dark:text-emerald-400",
                bg: "bg-emerald-50 dark:bg-emerald-900/20",
                format: (v: number) => formatCurrency(v),
                vs: data?.stats?.totalRevenue,
              },
              {
                label: treports("ordersInRange"),
                end: stats.totalOrders,
                icon: ShoppingBag,
                color: "text-blue-600 dark:text-blue-400",
                bg: "bg-blue-50 dark:bg-blue-900/20",
                vs: data?.stats?.totalOrders,
              },
              {
                label: treports("avgOrderInRange"),
                end: stats.avgOrderValue,
                icon: BarChart3,
                color: "text-purple-600 dark:text-purple-400",
                bg: "bg-purple-50 dark:bg-purple-900/20",
                format: (v: number) => formatCurrency(v),
                vs: data?.stats?.totalRevenue / (data?.stats?.totalOrders || 1),
              },
              {
                label: treports("customersInRange"),
                end: stats.totalCustomers,
                icon: UsersIcon,
                color: "text-amber-600 dark:text-amber-400",
                bg: "bg-amber-50 dark:bg-amber-900/20",
                vs: data?.stats?.totalCustomers,
              },
            ].map((stat, i) => {
              const hasFilter = dateRange.from || dateRange.to;
              const vsValue = stat.vs || 0;
              const diff = hasFilter && vsValue > 0 ? ((stat.end - vsValue) / vsValue) * 100 : 0;

              return (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08, duration: 0.4 }}
                >
                  <Card className="group hover:shadow-md transition-all duration-300">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div
                          className={cn(
                            "p-2.5 rounded-lg transition-transform group-hover:scale-110 duration-300",
                            stat.bg,
                          )}
                        >
                          <stat.icon size={20} className={cn("h-5 w-5", stat.color)} />
                        </div>
                        {hasFilter && (
                          <div
                            className={cn(
                              "flex items-center gap-0.5 text-xs font-medium",
                              diff > 0
                                ? "text-emerald-600"
                                : diff < 0
                                  ? "text-red-600"
                                  : "text-gray-400",
                            )}
                          >
                            {diff > 0 ? (
                              <ArrowUpRight className="h-3 w-3" />
                            ) : diff < 0 ? (
                              <ArrowDownRight className="h-3 w-3" />
                            ) : (
                              <Minus className="h-3 w-3" />
                            )}
                            <span>{Math.abs(diff).toFixed(0)}%</span>
                          </div>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">{stat.label}</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                        <AnimatedCounter
                          end={stat.end}
                          duration={1400}
                          {...(stat.format ? { formatter: stat.format } : {})}
                        />
                      </p>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{treports("revenueByChannel")}</CardTitle>
              </CardHeader>
              <CardContent>
                <SalesChannelChart data={revenueByChannel} height={280} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{treports("orderStatusBreakdown")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(stats.statusCounts)
                    .sort(([, a], [, b]) => b - a)
                    .map(([status, count]) => {
                      const total = stats.totalOrders;
                      const pct = total > 0 ? (count / total) * 100 : 0;
                      return (
                        <div key={status} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className={cn("font-medium", getStatusColor(status))}>
                              {status}
                            </span>
                            <span className="text-gray-500">
                              {count} ({pct.toFixed(0)}%)
                            </span>
                          </div>
                          <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full bg-indigo-500 transition-all duration-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Top customers table */}
          {topCustomers.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{treports("topCustomers")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {topCustomers.map((c, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between py-2 border-b last:border-0"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-400 w-6 text-right">{i + 1}</span>
                        <div>
                          <p className="text-sm font-medium">{c.name}</p>
                          <p className="text-xs text-gray-500">{c.orders} orders</p>
                        </div>
                      </div>
                      <span className="text-sm font-medium tabular-nums">
                        {formatCurrency(c.totalSpent)}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Revenue Breakdown Tab ── */}
        <TabsContent value="revenue" className="space-y-4">
          <div className="flex items-center gap-2">
            {(["daily", "weekly", "monthly"] as const).map((p) => (
              <Button
                key={p}
                variant={revenuePeriod === p ? "default" : "outline"}
                size="sm"
                onClick={() => setRevenuePeriod(p)}
              >
                {treports(p)}
              </Button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-6">
                <DollarSignIcon size={20} className="h-5 w-5 text-emerald-500 mb-2" />
                <p className="text-sm text-gray-500">{treports("totalRevenue")}</p>
                <p className="text-2xl font-bold tabular-nums">
                  <AnimatedCounter
                    end={stats.totalRevenue}
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
                  <AnimatedCounter end={stats.totalOrders} duration={1400} />
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <DollarSignIcon size={20} className="h-5 w-5 text-purple-500 mb-2" />
                <p className="text-sm text-gray-500">{treports("avgOrderValue")}</p>
                <p className="text-2xl font-bold tabular-nums">
                  <AnimatedCounter
                    end={stats.avgOrderValue}
                    duration={1600}
                    formatter={(v) => formatCurrency(v)}
                  />
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">{treports("revenueByPeriod")}</CardTitle>
              <DataExportButton
                columns={[
                  { key: "period", header: treports("period") },
                  { key: "revenue", header: treports("revenueLabel") },
                ]}
                data={revenueByPeriod}
                filename={`revenue-${revenuePeriod}-${now}`}
                label={tcommon("export")}
                showColumnSelector={false}
              />
            </CardHeader>
            <CardContent>
              {revenueByPeriod.length > 0 ? (
                <RevenueChart
                  data={revenueByPeriod.map((r) => ({ month: r.period, revenue: r.revenue }))}
                  height={350}
                />
              ) : (
                <div className="flex items-center justify-center h-[350px] text-sm text-gray-400">
                  {treports("noDataInRange")}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Sales Report Tab ── */}
        <TabsContent value="sales" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-6">
                  <DollarSignIcon size={20} className="h-5 w-5 text-emerald-500 mb-2" />
                  <p className="text-sm text-gray-500">{treports("totalRevenue")}</p>
                  <p className="text-2xl font-bold tabular-nums">
                    <AnimatedCounter
                      end={stats.totalRevenue}
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
                    <AnimatedCounter end={stats.totalOrders} duration={1400} />
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <DollarSignIcon size={20} className="h-5 w-5 text-purple-500 mb-2" />
                  <p className="text-sm text-gray-500">{treports("avgOrderValue")}</p>
                  <p className="text-2xl font-bold tabular-nums">
                    <AnimatedCounter
                      end={stats.avgOrderValue}
                      duration={1600}
                      formatter={(v) => formatCurrency(v)}
                    />
                  </p>
                </CardContent>
              </Card>
            </div>
            <DataExportButton
              columns={[
                { key: "orderNumber", header: "Order #" },
                { key: (o: any) => o.customer?.name || "Guest", header: "Customer" },
                { key: (o: any) => o.channel?.name || "N/A", header: "Channel" },
                { key: "status", header: "Status" },
                { key: "paymentStatus", header: "Payment" },
                { key: (o: any) => o.grandTotal, header: "Grand Total" },
                { key: (o: any) => new Date(o.createdAt).toLocaleDateString(), header: "Date" },
              ]}
              data={filteredOrders}
              filename={`sales-report-${now}`}
              label={treports("export")}
              showColumnSelector
              successMessage={treports("ordersExported")}
              totalCount={orders?.length || 0}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {data?.salesByChannel ? treports("revenueByChannel") : treports("totalRevenue")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <SalesChannelChart data={data?.salesByChannel || revenueByChannel} height={300} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Customer Report Tab ── */}
        <TabsContent value="customers" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-6">
                  <UsersIcon size={20} className="h-5 w-5 text-blue-500 mb-2" />
                  <p className="text-sm text-gray-500">{treports("totalCustomers")}</p>
                  <p className="text-2xl font-bold tabular-nums">
                    <AnimatedCounter end={stats.totalCustomers} duration={1400} />
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <TrendingUpIcon size={20} className="h-5 w-5 text-green-500 mb-2" />
                  <p className="text-sm text-gray-500">{treports("growth")}</p>
                  <p className="text-2xl font-bold tabular-nums">
                    <AnimatedCounter
                      end={data?.stats?.customersGrowth || 0}
                      duration={1200}
                      suffix="%"
                      decimals={1}
                    />
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <DollarSignIcon size={20} className="h-5 w-5 text-orange-500 mb-2" />
                  <p className="text-sm text-gray-500">{treports("avgOrderValue")}</p>
                  <p className="text-2xl font-bold tabular-nums">
                    <AnimatedCounter
                      end={stats.totalRevenue / (stats.totalCustomers || 1)}
                      duration={1600}
                      formatter={(v) => formatCurrency(v)}
                    />
                  </p>
                </CardContent>
              </Card>
            </div>
            <DataExportButton
              columns={[
                { key: "name", header: "Name" },
                { key: "email", header: "Email" },
                { key: "phone", header: "Phone" },
                { key: "city", header: "City" },
                { key: "segment", header: "Segment" },
                { key: (c: any) => c.totalSpent || 0, header: "Total Spent" },
                { key: (c: any) => c._count?.orders || c.totalOrders || 0, header: "Orders" },
                {
                  key: (c: any) =>
                    c.lastOrderDate ? new Date(c.lastOrderDate).toLocaleDateString() : "N/A",
                  header: "Last Order",
                },
              ]}
              data={filteredCustomers}
              filename={`customers-report-${now}`}
              label={treports("export")}
              showColumnSelector
              successMessage={treports("customersExported")}
              totalCount={customers?.length || 0}
            />
          </div>

          {/* Top customers from filtered orders */}
          {topCustomers.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{treports("topCustomers")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 font-medium text-gray-500">#</th>
                        <th className="text-left py-2 font-medium text-gray-500">Name</th>
                        <th className="text-left py-2 font-medium text-gray-500">Orders</th>
                        <th className="text-right py-2 font-medium text-gray-500">Total Spent</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topCustomers.map((c, i) => (
                        <tr key={i} className="border-b last:border-0">
                          <td className="py-2 text-gray-400">{i + 1}</td>
                          <td className="py-2 font-medium">{c.name}</td>
                          <td className="py-2">{c.orders}</td>
                          <td className="py-2 text-right tabular-nums">
                            {formatCurrency(c.totalSpent)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Product Report Tab ── */}
        <TabsContent value="products" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-6">
                  <Package className="h-5 w-5 text-indigo-500 mb-2" />
                  <p className="text-sm text-gray-500">{treports("totalProducts")}</p>
                  <p className="text-2xl font-bold tabular-nums">
                    <AnimatedCounter end={data?.stats?.totalProducts || 0} duration={1400} />
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <TrendingUpIcon size={20} className="h-5 w-5 text-cyan-500 mb-2" />
                  <p className="text-sm text-gray-500">Top Product Orders</p>
                  <p className="text-2xl font-bold tabular-nums">
                    <AnimatedCounter
                      end={data?.topProducts?.[0]?.orderCount || 0}
                      duration={1400}
                    />
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <DollarSignIcon size={20} className="h-5 w-5 text-rose-500 mb-2" />
                  <p className="text-sm text-gray-500">{treports("avgProductPrice")}</p>
                  <p className="text-2xl font-bold tabular-nums">
                    <AnimatedCounter
                      end={
                        (data?.topProducts?.reduce((s: number, p: any) => s + p.price, 0) || 0) /
                        (data?.topProducts?.length || 1)
                      }
                      duration={1600}
                      formatter={(v) => formatCurrency(v)}
                    />
                  </p>
                </CardContent>
              </Card>
            </div>
            <DataExportButton
              columns={[
                { key: "name", header: "Product" },
                { key: "price", header: "Price" },
                { key: "stock", header: "Stock" },
                { key: "sku", header: "SKU" },
                { key: (p: any) => p.category?.name || "N/A", header: "Category" },
                { key: (p: any) => (p.isActive ? "Active" : "Inactive"), header: "Status" },
              ]}
              data={data?.topProducts || []}
              filename={`products-report-${now}`}
              label={treports("export")}
              showColumnSelector
              successMessage={treports("productsExported")}
              totalCount={data?.stats?.totalProducts || 0}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top Products by Orders</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {(data?.topProducts || []).map((p: any, i: number) => {
                  const maxOrders = data?.topProducts?.[0]?.orderCount || 1;
                  const pct = (p.orderCount / maxOrders) * 100;
                  return (
                    <div key={i} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{p.name}</span>
                        <div className="flex items-center gap-3 text-gray-500">
                          <span>{p.orderCount} orders</span>
                          <span className="tabular-nums">{formatCurrency(p.price)}</span>
                        </div>
                      </div>
                      <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-indigo-500 transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
