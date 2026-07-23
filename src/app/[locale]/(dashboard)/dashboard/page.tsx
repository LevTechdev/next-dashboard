"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  TrendingUp,
  TrendingDown,
  ShoppingCart,
  Users,
  Package,
  DollarSign,
  ArrowUpRight,
  RefreshCw,
  BarChart3,
  FileText,
  PlusCircle,
  Megaphone,
  Zap,
  Sparkles,
  Ticket,
  type LucideIcon,
} from "lucide-react";
import { ActivityFeed } from "@/components/activity-feed";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDateTime, cn } from "@/lib/utils";
import { useRealtimeData } from "@/hooks/use-realtime-data";
import { RealtimeIndicator } from "@/components/realtime-indicator";
import { useRealtime } from "@/components/realtime-provider";
import { RevenueChart, SalesChannelChart } from "@/components/charts";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { motion } from "framer-motion";

interface DashboardData {
  stats: {
    totalRevenue: number;
    totalOrders: number;
    totalCustomers: number;
    totalProducts: number;
    revenueGrowth: number;
    ordersGrowth: number;
    customersGrowth: number;
    productsGrowth: number;
  };
  recentOrders: any[];
  topProducts: any[];
  salesByChannel: { name: string; value: number; color: string }[];
  revenueData: { month: string; revenue: number }[];
}

// ─── Quick Actions ──────────────────────────────────────────────────────────

interface QuickAction {
  label: string;
  description: string;
  icon: LucideIcon;
  href: string;
  color: string;
  bg: string;
}

const quickActions: QuickAction[] = [
  {
    label: "New Order",
    description: "Create a new order manually",
    icon: PlusCircle,
    href: "/orders",
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-900/20",
  },
  {
    label: "Add Product",
    description: "Add a product to catalog",
    icon: Package,
    href: "/products",
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-900/20",
  },
  {
    label: "View Reports",
    description: "Open sales reports",
    icon: FileText,
    href: "/reports",
    color: "text-purple-600 dark:text-purple-400",
    bg: "bg-purple-50 dark:bg-purple-900/20",
  },
  {
    label: "Analytics",
    description: "Detailed analytics",
    icon: BarChart3,
    href: "/analytics",
    color: "text-orange-600 dark:text-orange-400",
    bg: "bg-orange-50 dark:bg-orange-900/20",
  },
  {
    label: "Create Campaign",
    description: "Start a marketing campaign",
    icon: Megaphone,
    href: "/marketing",
    color: "text-rose-600 dark:text-rose-400",
    bg: "bg-rose-50 dark:bg-rose-900/20",
  },
  {
    label: "Discount Code",
    description: "Create a new discount",
    icon: Ticket,
    href: "/discounts",
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-900/20",
  },
];

// ─── Premium Quick Actions Grid ─────────────────────────────────────────────

function QuickActionsGrid({ locale }: { locale: string }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Zap className="h-4 w-4 text-amber-500" />
          Quick Actions
        </CardTitle>
        <CardDescription>Frequently used operations</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {quickActions.map((action) => {
            const Icon = action.icon;
            const fullHref = `/${locale}${action.href}`;
            return (
              <motion.a
                key={action.label}
                href={fullHref}
                whileHover={{ scale: 1.03, y: -2 }}
                whileTap={{ scale: 0.98 }}
                transition={{ type: "spring", stiffness: 300, damping: 17 }}
                className="group flex flex-col items-center gap-2 p-3 rounded-xl border border-gray-100 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-all duration-200 bg-white dark:bg-gray-900"
              >
                <div
                  className={cn(
                    "p-2.5 rounded-xl transition-all duration-300 group-hover:shadow-md group-hover:scale-110",
                    action.bg,
                    "shadow-sm",
                  )}
                >
                  <Icon className={cn("h-4 w-4", action.color)} />
                </div>
                <div className="text-center">
                  <p className="text-xs font-medium text-gray-900 dark:text-gray-100 leading-tight">
                    {action.label}
                  </p>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5 leading-tight">
                    {action.description}
                  </p>
                </div>
              </motion.a>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Premium Stat Card ──────────────────────────────────────────────────────

function PremiumStatCard({
  title,
  endValue,
  change,
  icon: Icon,
  color,
  bg,
  isCurrency = false,
  delay = 0,
}: {
  title: string;
  endValue: number;
  change: number;
  icon: LucideIcon;
  color: string;
  bg: string;
  isCurrency?: boolean;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="stat-card-premium">
        <div className="flex items-center justify-between">
          <div
            className={cn(
              "p-2.5 rounded-xl transition-all duration-300 hover:scale-110",
              bg,
              "shadow-sm",
            )}
          >
            <Icon className={cn("h-5 w-5", color)} />
          </div>
          <span
            className={cn(
              "flex items-center text-xs font-medium gap-0.5 px-2 py-0.5 rounded-full",
              change >= 0
                ? "text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/20"
                : "text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20",
            )}
          >
            {change >= 0 ? (
              <TrendingUp className="h-3 w-3" />
            ) : (
              <TrendingDown className="h-3 w-3" />
            )}
            {Math.abs(change)}%
          </span>
        </div>
        <div className="mt-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
            {isCurrency ? (
              <AnimatedCounter
                end={endValue}
                duration={1600}
                formatter={(v) => formatCurrency(v)}
              />
            ) : (
              <AnimatedCounter end={endValue} duration={1600} />
            )}
          </p>
        </div>
        <p className="text-xs text-gray-400 mt-1.5 flex items-center gap-1">
          <Sparkles className="h-3 w-3" />
          vs. last month
        </p>
      </div>
    </motion.div>
  );
}

// ─── Skeleton with Shimmer ──────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-8 w-48 shimmer rounded" />
          <div className="h-4 w-64 shimmer rounded mt-2" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="h-12 w-12 shimmer rounded-lg mb-4" />
              <div className="h-4 w-24 shimmer rounded mb-2" />
              <div className="h-8 w-32 shimmer rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="h-[240px] shimmer rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { globalRefreshTrigger } = useRealtime();
  const pathname = usePathname();
  const locale = pathname?.split("/")[1] || "en";
  const tdash = useTranslations("dashboard");
  const tcommon = useTranslations("common");

  const { data, loading, lastUpdated, isRefreshing, refresh } = useRealtimeData<DashboardData>(
    "/api/dashboard",
    {
      interval: 15000,
      enabled: true,
    },
  );

  // Also refresh when global trigger fires
  useEffect(() => {
    if (globalRefreshTrigger > 0 && !loading) {
      refresh();
    }
  }, [globalRefreshTrigger, loading, refresh]);

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (!data) return null;

  const stats = [
    {
      title: tdash("totalRevenue"),
      endValue: data.stats.totalRevenue,
      change: data.stats.revenueGrowth,
      icon: DollarSign,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-50 dark:bg-emerald-900/20",
      isCurrency: true,
    },
    {
      title: tdash("totalOrders"),
      endValue: data.stats.totalOrders,
      change: data.stats.ordersGrowth,
      icon: ShoppingCart,
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-50 dark:bg-blue-900/20",
    },
    {
      title: tdash("totalCustomers"),
      endValue: data.stats.totalCustomers,
      change: data.stats.customersGrowth,
      icon: Users,
      color: "text-purple-600 dark:text-purple-400",
      bg: "bg-purple-50 dark:bg-purple-900/20",
    },
    {
      title: tdash("totalProducts"),
      endValue: data.stats.totalProducts,
      change: data.stats.productsGrowth,
      icon: Package,
      color: "text-orange-600 dark:text-orange-400",
      bg: "bg-orange-50 dark:bg-orange-900/20",
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{tdash("title")}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{tdash("subtitle")}</p>
        </div>
        <div className="flex items-center gap-3">
          <RealtimeIndicator
            lastUpdated={lastUpdated}
            isRefreshing={isRefreshing}
            className="hidden sm:flex"
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={refresh}
            disabled={isRefreshing}
            className="gap-1 rounded-xl"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")} />
            <span className="hidden sm:inline">{tcommon("save")}</span>
          </Button>
        </div>
      </motion.div>

      {/* Premium Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <PremiumStatCard key={stat.title} {...stat} delay={i * 0.08} />
        ))}
      </div>

      {/* Charts Row + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Chart - spans 2 cols on desktop */}
        <Card className="lg:col-span-2 overflow-hidden">
          <CardHeader>
            <CardTitle>{tdash("revenueChart")}</CardTitle>
            <CardDescription>Monthly revenue for the current year</CardDescription>
          </CardHeader>
          <CardContent>
            <RevenueChart data={data.revenueData} height={300} />
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <QuickActionsGrid locale={locale} />
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales by Channel */}
        <Card className="lg:col-span-1 overflow-hidden">
          <CardHeader>
            <CardTitle>{tdash("salesByChannel")}</CardTitle>
            <CardDescription>Distribution across channels</CardDescription>
          </CardHeader>
          <CardContent>
            <SalesChannelChart data={data.salesByChannel} height={260} />
          </CardContent>
        </Card>

        {/* Recent Orders */}
        <Card className="lg:col-span-1 overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base">{tdash("recentOrders")}</CardTitle>
              <CardDescription>Latest 5 orders</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <a href={`/${locale}/orders`} className="gap-1">
                {tcommon("view")} <ArrowUpRight className="h-3 w-3" />
              </a>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.recentOrders.slice(0, 5).map((order: any, i: number) => (
                <motion.div
                  key={order.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05, duration: 0.3 }}
                  className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all hover:shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm">
                      <ShoppingCart className="h-4 w-4 text-gray-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        #{order.orderNumber}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {order.customer?.name || "Guest"} • {order.channel?.name || "N/A"}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {formatCurrency(order.grandTotal)}
                    </p>
                    <p className="text-[10px] text-gray-500">{formatDateTime(order.createdAt)}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Top Products */}
        <Card className="lg:col-span-1 overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{tdash("topProducts")}</CardTitle>
            <CardDescription>Best selling products</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.topProducts.map((product: any, index: number) => (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.06, duration: 0.3 }}
                  className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all hover:shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-white text-xs font-bold shadow-sm">
                      {index + 1}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {product.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {product.orderCount || 0} sold
                      </p>
                    </div>
                  </div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {formatCurrency(product.price)}
                  </p>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Activity Feed - Full width real-time stream */}
      <ActivityFeed />
    </motion.div>
  );
}
