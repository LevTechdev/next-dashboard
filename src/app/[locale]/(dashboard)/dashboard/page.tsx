"use client";
import { FlipFadeText } from "@/components/ui/flip-fade-text";

import { useEffect, type ComponentProps, type ComponentType } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  RefreshCwIcon,
  ZapIcon,
  ArrowUpRightIcon,
  FileTextIcon,
  UsersIcon,
  DollarSignIcon,
} from "lucide-animated";
import {
  ShoppingCart,
  Package,
  BarChart3,
  PlusCircle,
  Megaphone,
  Ticket,
  Wallet,
} from "lucide-react";

import { ActivityFeed } from "@/components/activity-feed";
import { LinkedPlatformsBadge } from "@/components/linked-platforms-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDateTime, cn } from "@/lib/utils";
import { useCurrency } from "@/components/currency-provider";
import { useRealtimeData } from "@/hooks/use-realtime-data";
import { RealtimeIndicator } from "@/components/realtime-indicator";
import { useRealtime } from "@/components/realtime-provider";
import { useAppearance } from "@/hooks/use-appearance";
import { useAuth } from "@/hooks/use-auth";
import { RevenueChart, SalesChannelChart } from "@/components/charts";
import { PremiumStatCard as SharedStatCard } from "@/components/ui/premium-stat-card";
import {
  GlobalSalesMap,
  ConversionRadarWidget,
  StageBarsCard,
} from "@/components/dashboard/widgets";
import { motion } from "framer-motion";
import { OnboardingChecklist } from "@/components/onboarding/onboarding-checklist";

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
  sparklines?: {
    orders: number[];
    customers: number[];
    products: number[];
  };
  revenueData: { month: string; revenue: number }[];
}

// ─── Quick Actions ──────────────────────────────────────────────────────────

interface QuickAction {
  labelKey: string;
  descKey: string;
  icon: ComponentType<{ className?: string; size?: number }>;
  href: string;
  color: string;
  bg: string;
}

const quickActions: QuickAction[] = [
  {
    labelKey: "qaNewOrder",
    descKey: "qaNewOrderDesc",
    icon: PlusCircle,
    href: "/orders",
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-900/20",
  },
  {
    labelKey: "qaAddProduct",
    descKey: "qaAddProductDesc",
    icon: Package,
    href: "/products",
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-900/20",
  },
  {
    labelKey: "qaViewReports",
    descKey: "qaViewReportsDesc",
    icon: FileTextIcon,
    href: "/reports",
    color: "text-purple-600 dark:text-purple-400",
    bg: "bg-purple-50 dark:bg-purple-900/20",
  },
  {
    labelKey: "qaAnalytics",
    descKey: "qaAnalyticsDesc",
    icon: BarChart3,
    href: "/analytics",
    color: "text-orange-600 dark:text-orange-400",
    bg: "bg-orange-50 dark:bg-orange-900/20",
  },
  {
    labelKey: "qaCreateCampaign",
    descKey: "qaCreateCampaignDesc",
    icon: Megaphone,
    href: "/marketing",
    color: "text-rose-600 dark:text-rose-400",
    bg: "bg-rose-50 dark:bg-rose-900/20",
  },
  {
    labelKey: "qaDiscountCode",
    descKey: "qaDiscountCodeDesc",
    icon: Ticket,
    href: "/discounts",
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-900/20",
  },
];

// ─── Premium Quick Actions Grid ─────────────────────────────────────────────

function QuickActionsGrid({ locale }: { locale: string }) {
  const t = useTranslations("dashboard");
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <ZapIcon size={16} className="h-4 w-4 text-amber-500" />
          {t("quickActions")}
        </CardTitle>
        <CardDescription>{t("qaSubtitle")}</CardDescription>
      </CardHeader>
      <CardContent>
        {/* items-stretch + h-full tiles: every action card is the same size
            regardless of localized label length (long id/ja strings wrap). */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 items-stretch">
          {quickActions.map((action) => {
            const Icon = action.icon;
            const fullHref = `/${locale}${action.href}`;
            return (
              <motion.a
                key={action.labelKey}
                href={fullHref}
                whileHover={{ scale: 1.03, y: -2 }}
                whileTap={{ scale: 0.98 }}
                transition={{ type: "spring", stiffness: 300, damping: 17 }}
                className="group flex h-full flex-col items-center gap-2 p-3 rounded-xl border border-gray-100 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-all duration-200 bg-white dark:bg-gray-900"
              >
                <div
                  className={cn(
                    "p-2.5 rounded-xl transition-all duration-300 group-hover:shadow-md group-hover:scale-110",
                    action.bg,
                    "shadow-sm",
                  )}
                >
                  <Icon size={16} className={cn("h-4 w-4", action.color)} />
                </div>
                <div className="flex flex-1 flex-col items-center justify-start text-center">
                  <p className="text-xs font-medium text-gray-900 dark:text-gray-100 leading-tight line-clamp-2">
                    {t(action.labelKey)}
                  </p>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5 leading-tight line-clamp-2">
                    {t(action.descKey)}
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
// The overview now renders the shared PremiumStatCard directly — identical
// card geometry with every other dashboard menu (orders, customers, …).

function DashboardStatCard(props: ComponentProps<typeof SharedStatCard>) {
  return <SharedStatCard {...props} />;
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

// ─── SSE Connection Health Badge ────────────────────────────────────────────
// Removed: live connection state lives in the header's RealtimeConnectionBadge
// (navbar), so the dashboard page no longer duplicates it.

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { globalRefreshTrigger } = useRealtime();
  const pathname = usePathname();
  const locale = pathname?.split("/")[1] || "en";
  const tdash = useTranslations("dashboard");
  const tcommon = useTranslations("common");
  const { settings: appearance } = useAppearance();
  const { formatMoney } = useCurrency();
  const { user } = useAuth();
  const router = useRouter();

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

  const revenueSparkData = data.revenueData?.slice(-7).map((d: any) => d.revenue) || [];

  // Derived metrics (DashboardData carries no cost/COGS series, so Net Profit
  // uses a fixed assumed margin; Avg Order Value is exact).
  const netProfit = data.stats.totalRevenue * 0.65; // 35% assumed operating margin
  const avgOrderValue = data.stats.totalRevenue / Math.max(data.stats.totalOrders, 1);

  // Time-of-day greeting for the data hero (client component — stable between
  // hydration and first render because Date.now() only reads after mount).
  const hour = new Date().getHours();
  const greetingKey =
    hour < 12 ? "greetingMorning" : hour < 18 ? "greetingAfternoon" : "greetingEvening";

  const stats = [
    {
      title: tdash("totalRevenue"),
      endValue: data.stats.totalRevenue,
      change: data.stats.revenueGrowth,
      icon: DollarSignIcon,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-50 dark:bg-emerald-900/20",
      isCurrency: true,
      sparkData: revenueSparkData,
    },
    {
      title: tdash("metricProfit"),
      endValue: netProfit,
      change: data.stats.revenueGrowth,
      icon: Wallet,
      color: "text-teal-600 dark:text-teal-400",
      bg: "bg-teal-50 dark:bg-teal-900/20",
      isCurrency: true,
    },
    {
      title: tdash("totalOrders"),
      endValue: data.stats.totalOrders,
      change: data.stats.ordersGrowth,
      icon: ShoppingCart,
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-50 dark:bg-blue-900/20",
      sparkData: data.sparklines?.orders || [],
    },
    {
      title: tdash("totalCustomers"),
      endValue: data.stats.totalCustomers,
      change: data.stats.customersGrowth,
      icon: UsersIcon,
      color: "text-purple-600 dark:text-purple-400",
      bg: "bg-purple-50 dark:bg-purple-900/20",
      sparkData: data.sparklines?.customers || [],
    },
    {
      title: tdash("metricAvgOrder"),
      endValue: avgOrderValue,
      change: data.stats.revenueGrowth,
      icon: BarChart3,
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-50 dark:bg-amber-900/20",
      isCurrency: true,
    },
    {
      title: tdash("totalProducts"),
      endValue: data.stats.totalProducts,
      change: data.stats.productsGrowth,
      icon: Package,
      color: "text-orange-600 dark:text-orange-400",
      bg: "bg-orange-50 dark:bg-orange-900/20",
      sparkData: data.sparklines?.products || [],
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      {/* Data hero — personalized greeting + live workspace pulse */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 rounded-2xl border border-border/60 bg-gradient-to-br from-primary/[0.06] via-transparent to-primary/[0.04] p-5 sm:p-6"
      >
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {greetingKey ? tdash(greetingKey) : tdash("title")}
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100 mt-1 truncate">
            {user?.name ? user.name : tdash("subtitle")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1.5 flex items-center gap-1.5 flex-wrap">
            <span className="inline-flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {formatMoney(data.stats.totalRevenue)}
            </span>
            <span aria-hidden>·</span>
            <span>
              {data.stats.totalOrders.toLocaleString()} {tdash("totalOrders").toLowerCase()}
            </span>
            <span aria-hidden>·</span>
            <span>
              {data.recentOrders?.length ?? 0} {tdash("recentOrders").toLowerCase()}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
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
            <RefreshCwIcon
              size={14}
              className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")}
            />
            <span className="hidden sm:inline">{tcommon("refresh")}</span>
          </Button>
        </div>
      </motion.div>

      <OnboardingChecklist />

      {/* Premium Stats Cards */}
      <div className="tour-dashboard-metrics grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 items-stretch">
        {stats.map((stat, i) => (
          <DashboardStatCard key={stat.title} {...stat} delay={i * 0.08} />
        ))}
      </div>

      {/* Charts Row + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Chart - spans 2 cols on desktop */}
        {appearance.widgets.revenueChart && (
          <Card className="tour-revenue-chart lg:col-span-2 overflow-hidden">
            <CardHeader>
              <CardTitle>{tdash("revenueChart")}</CardTitle>
              <CardDescription>{tdash("revenueChartDesc")}</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Bars deep-link into Analytics scoped to the clicked month —
                  the row carries a mid-month ISO anchor for YYYY-MM. */}
              <RevenueChart
                data={data.revenueData}
                height={300}
                onClick={({ iso, month }) => {
                  if (iso) {
                    router.push(`/${locale}/analytics?month=${iso}`);
                  } else if (month) {
                    router.push(`/${locale}/analytics?label=${encodeURIComponent(month)}`);
                  }
                }}
              />
            </CardContent>
          </Card>
        )}

        {/* Quick Actions */}
        {appearance.widgets.quickActions && <QuickActionsGrid locale={locale} />}
      </div>

      {/* ─── CUSTOM WIDGET: Global Live Telemetry & Regional Map ─── */}
      <GlobalSalesMap />

      {/* ─── Stage Bars — the funnel as a list (Visits → Enterprise) ─── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
        <StageBarsCard />
        <ConversionRadarWidget />
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales by Channel */}
        {appearance.widgets.salesByChannel && (
          <Card className="lg:col-span-1 overflow-hidden">
            <CardHeader>
              <CardTitle>{tdash("salesByChannel")}</CardTitle>
              <CardDescription>{tdash("salesByChannelDesc")}</CardDescription>
            </CardHeader>
            <CardContent>
              <SalesChannelChart data={data.salesByChannel} height={260} />
            </CardContent>
          </Card>
        )}

        {/* Recent Orders */}
        {appearance.widgets.recentOrders && (
          <Card className="tour-recent-sales lg:col-span-1 overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-base">{tdash("recentOrders")}</CardTitle>
                <CardDescription>{tdash("recentOrdersDesc")}</CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <a href={`/${locale}/orders`} className="gap-1">
                  {tcommon("view")} <ArrowUpRightIcon size={12} className="h-3 w-3" />
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
                    className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all hover:shadow-sm min-w-0"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="p-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm shrink-0">
                        <ShoppingCart className="h-4 w-4 text-gray-500" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold truncate font-mono">
                          <Link
                            href={`/${locale}/orders/${order.id}`}
                            className="text-primary hover:underline transition-colors"
                          >
                            #{order.orderNumber}
                          </Link>
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {order.customer?.id ? (
                            <Link
                              href={`/${locale}/customers/${order.customer.id}`}
                              className="hover:text-primary transition-colors font-medium text-gray-700 dark:text-gray-300"
                            >
                              {order.customer.name}
                            </Link>
                          ) : (
                            order.customer?.name || "Guest"
                          )}{" "}
                          • {order.channel?.name || "N/A"}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <p
                        className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate"
                        title={formatMoney(order.grandTotal)}
                      >
                        {formatMoney(order.grandTotal)}
                      </p>
                      <p className="text-[10px] text-gray-500 whitespace-nowrap">
                        {formatDateTime(order.createdAt)}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Top Products */}
        {appearance.widgets.topProducts && (
          <Card className="lg:col-span-1 overflow-hidden">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{tdash("topProducts")}</CardTitle>
              <CardDescription>{tdash("topProductsDesc")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {data.topProducts.map((product: any, index: number) => (
                  <motion.div
                    key={product.id}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.06, duration: 0.3 }}
                    className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all hover:shadow-sm min-w-0"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary text-primary-foreground text-xs font-bold shadow-sm shrink-0">
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                          {product.name}
                          <LinkedPlatformsBadge
                            productId={product.id}
                            count={product.linkedCount || 0}
                            className="ml-1.5 shrink-0 inline-flex"
                          />
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {product.orderCount || 0} sold
                        </p>
                      </div>
                    </div>
                    <p
                      className="text-sm font-semibold text-gray-900 dark:text-gray-100 shrink-0 ml-3 truncate"
                      title={formatMoney(product.price)}
                    >
                      {formatMoney(product.price)}
                    </p>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Activity Feed - Full width real-time stream */}
      <ActivityFeed />
    </motion.div>
  );
}
