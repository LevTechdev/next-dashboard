"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ArrowUpRight, ShoppingCart, Users, Package, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

/**
 * Live dashboard preview — the marketing page's product shot.
 *
 * A browser-framed mockup of the REAL dashboard whose numbers tick like the
 * actual product: KPI cards drift with realistic random-walk deltas, a
 * revenue sparkline extends point-by-point, recent orders stream in with
 * brand-channel badges, and channel bars re-sort as values update. Pure CSS/
 * interval animation — no external chart deps, no network, SSR-safe (the
 * first paint is the seeded baseline so hydration matches).
 */

const DEMO_ORDERS_POOL = [
  {
    id: "ORD-2842",
    customer: "Sarah Johnson",
    amount: 249.99,
    channel: "online-store",
    status: "completed",
  },
  {
    id: "ORD-2843",
    customer: "Michael Chen",
    amount: 89.5,
    channel: "instagram",
    status: "processing",
  },
  {
    id: "ORD-2844",
    customer: "Emma Wilson",
    amount: 420.0,
    channel: "shopify",
    status: "completed",
  },
  { id: "ORD-2845", customer: "James Park", amount: 175.25, channel: "tiktok", status: "shipped" },
  {
    id: "ORD-2846",
    customer: "Lisa Anderson",
    amount: 55.0,
    channel: "facebook",
    status: "completed",
  },
  {
    id: "ORD-2847",
    customer: "Budi Santoso",
    amount: 312.75,
    channel: "tokopedia",
    status: "processing",
  },
  {
    id: "ORD-2848",
    customer: "Dewi Lestari",
    amount: 148.5,
    channel: "shopee",
    status: "completed",
  },
];

const CHANNELS: Array<{
  key: string;
  label: string;
  color: string;
  base: number;
  value: number;
}> = [
  { key: "online-store", label: "Online Store", color: "#10B981", base: 42, value: 42 },
  { key: "instagram", label: "Instagram", color: "#E1306C", base: 24, value: 24 },
  { key: "shopify", label: "Shopify", color: "#95BF47", base: 18, value: 18 },
  { key: "tiktok", label: "TikTok", color: "#FE2C55", base: 10, value: 10 },
  { key: "facebook", label: "Facebook", color: "#1877F2", base: 6, value: 6 },
];

const STATUS_STYLES: Record<string, string> = {
  completed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  processing: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  shipped: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
};

/** Small random-walk step clamped to [min, max]. */
function drift(value: number, step: number, min: number, max: number): number {
  const next = value + (Math.random() - 0.45) * step;
  return Math.min(max, Math.max(min, next));
}

interface KpiState {
  revenue: number;
  orders: number;
  customers: number;
  products: number;
  revenueGrowth: number;
  ordersGrowth: number;
  customersGrowth: number;
  productsGrowth: number;
}

function kpiDelta(type: "revenue" | "orders" | "customers" | "products", k: KpiState): number {
  switch (type) {
    case "revenue":
      return k.revenueGrowth;
    case "orders":
      return k.ordersGrowth;
    case "customers":
      return k.customersGrowth;
    default:
      return k.productsGrowth;
  }
}

const KPI_ICONS = {
  revenue: DollarSign,
  orders: ShoppingCart,
  customers: Users,
  products: Package,
} as const;

export function LiveDashboardPreview() {
  const t = useTranslations("homepage");
  const [kpi, setKpi] = useState<KpiState>({
    revenue: 284_750,
    orders: 1_847,
    customers: 892,
    products: 156,
    revenueGrowth: 12.5,
    ordersGrowth: 8.3,
    customersGrowth: 15.2,
    productsGrowth: 5.1,
  });
  // Revenue sparkline — extends like the realtime chart. Seeded DETERMINISTICALLY
  // (no Math.random at first paint): the SSR pass and hydration must produce
  // identical points or React logs a hydration mismatch.
  const [spark, setSpark] = useState<number[]>(() =>
    Array.from({ length: 24 }, (_, i) => 40 + Math.sin(i / 2.4) * 18 + Math.sin(i / 1.7) * 6),
  );
  const [orders, setOrders] = useState(() => DEMO_ORDERS_POOL.slice(0, 4));
  const [channels, setChannels] = useState(CHANNELS);
  const [tick, setTick] = useState(0);
  const seqRef = useRef(4);

  // Live tick — a gentle random walk on every surface, like the SSE feed.
  useEffect(() => {
    const id = window.setInterval(() => {
      setTick((n) => n + 1);
      setKpi((prev) => ({
        revenue: drift(prev.revenue, 900, 250_000, 340_000),
        orders: prev.orders + (Math.random() > 0.55 ? 1 : 0),
        customers: prev.customers + (Math.random() > 0.75 ? 1 : 0),
        products: prev.products,
        revenueGrowth: Number(drift(prev.revenueGrowth, 0.8, 4, 24).toFixed(1)),
        ordersGrowth: Number(drift(prev.ordersGrowth, 0.8, 2, 18).toFixed(1)),
        customersGrowth: Number(drift(prev.customersGrowth, 0.8, 5, 26).toFixed(1)),
        productsGrowth: Number(drift(prev.productsGrowth, 0.6, 2, 12).toFixed(1)),
      }));
      setSpark((prev) => [...prev.slice(1), drift(prev[prev.length - 1], 18, 12, 92)]);
      setChannels((prev) =>
        prev.map((c) => ({ ...c, value: Math.max(2, drift(c.value, 3, 2, 48)) })),
      );
      // Occasionally stream a new order to the top of the feed.
      if (Math.random() > 0.5) {
        const source = DEMO_ORDERS_POOL[seqRef.current % DEMO_ORDERS_POOL.length];
        seqRef.current += 1;
        setOrders((prev) => [
          { ...source, id: `ORD-${2849 + (seqRef.current % 40)}` },
          ...prev.slice(0, 3),
        ]);
      }
    }, 2600);
    return () => window.clearInterval(id);
  }, []);

  // Sparkline path (viewBox 0 0 240 64).
  const maxV = Math.max(...spark, 1);
  const points = spark
    .map((v, i) => `${(i / (spark.length - 1)) * 240},${64 - (v / maxV) * 56 - 4}`)
    .join(" ");

  const kpis: Array<{ key: keyof typeof KPI_ICONS; label: string; value: string }> = [
    {
      key: "revenue",
      label: t("preview.kpiRevenue"),
      value: `$${(kpi.revenue / 1000).toFixed(1)}k`,
    },
    { key: "orders", label: t("preview.kpiOrders"), value: kpi.orders.toLocaleString() },
    { key: "customers", label: t("preview.kpiCustomers"), value: kpi.customers.toLocaleString() },
    { key: "products", label: t("preview.kpiProducts"), value: kpi.products.toLocaleString() },
  ];

  const channelTotal = channels.reduce((s, c) => s + c.value, 0) || 1;

  return (
    <div
      data-testid="live-dashboard-preview"
      className="relative mx-auto w-full max-w-5xl overflow-hidden rounded-2xl border border-border bg-background shadow-2xl shadow-primary/10"
    >
      {/* Browser chrome */}
      <div className="flex items-center gap-2 border-b border-border bg-muted/60 px-4 py-2.5">
        <span className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-red-400" />
          <span className="size-2.5 rounded-full bg-amber-400" />
          <span className="size-2.5 rounded-full bg-emerald-400" />
        </span>
        <span className="mx-auto flex max-w-md flex-1 items-center justify-center gap-1.5 rounded-md bg-background px-3 py-1 text-[11px] text-muted-foreground ring-1 ring-border">
          <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
          {t("preview.url")}
        </span>
      </div>

      {/* Dashboard body */}
      <div className="space-y-4 p-4 sm:p-5">
        {/* KPI row */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {kpis.map(({ key, label, value }) => {
            const Icon = KPI_ICONS[key];
            const delta = kpiDelta(key, kpi);
            return (
              <motion.div
                key={key}
                layout="position"
                transition={{ layout: { type: "spring", stiffness: 400, damping: 40 } }}
                className="rounded-xl border border-border/70 bg-card p-3"
                data-testid={`preview-kpi-${key}`}
              >
                <div className="flex items-center justify-between">
                  <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="size-3.5" />
                  </span>
                  <span
                    className={cn(
                      "flex items-center gap-0.5 text-[10px] font-semibold",
                      delta >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500",
                    )}
                  >
                    {delta >= 0 ? "↗" : "↘"} {Math.abs(delta).toFixed(1)}%
                  </span>
                </div>
                <p className="mt-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {label}
                </p>
                <motion.p
                  key={`${key}-${value}`}
                  initial={{ opacity: 0.35, y: -3 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-lg font-bold tabular-nums text-foreground"
                >
                  {value}
                </motion.p>
              </motion.div>
            );
          })}
        </div>

        {/* Revenue sparkline + channel mix */}
        <div className="grid gap-3 lg:grid-cols-5">
          <div className="rounded-xl border border-border/70 bg-card p-3 lg:col-span-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold text-foreground">{t("preview.liveRevenue")}</p>
              <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                LIVE
              </span>
            </div>
            <svg
              viewBox="0 0 240 64"
              className="h-20 w-full"
              preserveAspectRatio="none"
              aria-hidden
            >
              <defs>
                <linearGradient id="preview-spark" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
                </linearGradient>
              </defs>
              <polygon points={`0,64 ${points} 240,64`} fill="url(#preview-spark)" />
              <polyline
                points={points}
                fill="none"
                stroke="hsl(var(--primary))"
                strokeWidth="1.8"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            </svg>
          </div>

          <div className="rounded-xl border border-border/70 bg-card p-3 lg:col-span-2">
            <p className="mb-2 text-xs font-semibold text-foreground">
              {t("preview.liveChannels")}
            </p>
            <div className="space-y-2">
              {[...channels]
                .sort((a, b) => b.value - a.value)
                .map((c) => (
                  <div key={c.key} className="flex items-center gap-2">
                    <span className="w-16 shrink-0 truncate text-[10px] font-medium text-muted-foreground">
                      {c.label}
                    </span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ backgroundColor: c.color }}
                        animate={{ width: `${(c.value / channelTotal) * 100}%` }}
                        transition={{ type: "spring", stiffness: 160, damping: 26 }}
                      />
                    </div>
                    <span className="w-7 shrink-0 text-right text-[10px] font-semibold tabular-nums text-foreground">
                      {Math.round((c.value / channelTotal) * 100)}%
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </div>

        {/* Recent orders stream */}
        <div className="rounded-xl border border-border/70 bg-card p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold text-foreground">{t("preview.liveOrders")}</p>
            <ArrowUpRight className="size-3.5 text-muted-foreground" />
          </div>
          <div className="space-y-1.5">
            {orders.map((o) => (
              <motion.div
                key={o.id}
                layout
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 380, damping: 34 }}
                className="flex items-center justify-between gap-2 rounded-lg bg-muted/40 px-2.5 py-1.5"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="font-mono text-[11px] font-semibold text-primary">#{o.id}</span>
                  <span className="truncate text-[11px] text-muted-foreground">{o.customer}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.5 text-[9px] font-semibold capitalize",
                      STATUS_STYLES[o.status],
                    )}
                  >
                    {o.status}
                  </span>
                  <span className="text-[11px] font-semibold tabular-nums text-foreground">
                    ${o.amount.toFixed(2)}
                  </span>
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
      {/* Consumer of tick to keep lint quiet — value drives re-renders only */}
      <span className="hidden" data-preview-tick={tick} />
    </div>
  );
}
