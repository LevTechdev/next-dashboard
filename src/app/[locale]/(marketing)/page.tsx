"use client";

import { use, useState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { motion } from "framer-motion";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  TrendingUp,
  ShoppingCart,
  Users,
  Package,
  Shield,
  Zap,
  Globe,
  CreditCard,
  BarChart3,
  Lock,
  ArrowRight,
  Check,
  Activity,
  Layers,
  Key,
  Bell,
  ChevronRight,
  Star,
  BadgeCheck,
  Sparkles,
  RefreshCw,
  Webhook,
  Bot,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { FlipFadeText } from "@/components/ui/flip-fade-text";
import HeroFlow3D from "@/components/home/hero-flow-3d";

gsap.registerPlugin(ScrollTrigger);

// ─── Static demo data that mirrors the actual dashboard API shape ────────────

const DEMO_STATS = {
  totalRevenue: 284_750,
  totalOrders: 1_847,
  totalCustomers: 892,
  totalProducts: 156,
  revenueGrowth: 12.5,
  ordersGrowth: 8.3,
  customersGrowth: 15.2,
  productsGrowth: 5.1,
};

const DEMO_ORDERS = [
  {
    id: "ORD-2841",
    customer: "Sarah Johnson",
    amount: 249.99,
    status: "completed",
    channel: "Online Store",
  },
  {
    id: "ORD-2840",
    customer: "Michael Chen",
    amount: 89.5,
    status: "processing",
    channel: "Instagram",
  },
  {
    id: "ORD-2839",
    customer: "Emma Wilson",
    amount: 420.0,
    status: "completed",
    channel: "Shopify",
  },
  { id: "ORD-2838", customer: "James Park", amount: 175.25, status: "shipped", channel: "TikTok" },
  {
    id: "ORD-2837",
    customer: "Lisa Anderson",
    amount: 55.0,
    status: "completed",
    channel: "Facebook",
  },
];

const DEMO_PRODUCTS = [
  { name: "Premium Dashboard Pro", price: 299, orders: 482, growth: 24 },
  { name: "Analytics Suite", price: 149, orders: 361, growth: 18 },
  { name: "Team Collaboration Pack", price: 89, orders: 284, growth: 12 },
  { name: "API Integration Bundle", price: 199, orders: 203, growth: 9 },
];

const DEMO_CHANNELS = [
  { name: "Online Store", nameKey: "bento.onlineStore", value: 42, color: "#10B981" },
  { name: "Instagram", value: 24, color: "#EC4899" },
  { name: "Shopify", value: 18, color: "#059669" },
  { name: "TikTok", value: 10, color: "#F43F5E" },
  { name: "Facebook", value: 6, color: "#3B82F6" },
];

const DEMO_MONTHLY = [28, 45, 38, 62, 55, 78, 72, 88, 95, 82, 104, 118];
const MONTHS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

const INTEGRATIONS = [
  { name: "Stripe", descKey: "marquee.d0", color: "#635BFF", icon: "💳" },
  { name: "Midtrans", descKey: "marquee.d1", color: "#0084FF", icon: "🏦" },
  { name: "Shopify", descKey: "marquee.d2", color: "#059669", icon: "🛒" },
  { name: "Tokopedia", descKey: "marquee.d3", color: "#42B549", icon: "🛍️" },
  { name: "Instagram", descKey: "marquee.d4", color: "#E1306C", icon: "📸" },
  { name: "OpenAI", descKey: "marquee.d5", color: "#10A37F", icon: "🤖" },
  { name: "Supabase", descKey: "marquee.d6", color: "#3ECF8E", icon: "⚡" },
  { name: "Resend", descKey: "marquee.d7", color: "#000000", icon: "✉️" },
];

const STATUS_COLOR: Record<string, string> = {
  completed: "bg-emerald-100 text-emerald-700",
  processing: "bg-amber-100 text-amber-700",
  shipped: "bg-blue-100 text-blue-700",
  cancelled: "bg-red-100 text-red-700",
};

const TESTIMONIALS = [
  {
    name: "Ahmad Rizki",
    role: "CEO, TokoBaju.id",
    avatar: "AR",
    quoteKey: "stories.q1",
    stars: 5,
  },
  {
    name: "Jessica Wu",
    role: "Head of Growth, NexCommerce",
    avatar: "JW",
    quoteKey: "stories.q2",
    stars: 5,
  },
  {
    name: "Budi Santoso",
    role: "CTO, Startup Accelerator",
    avatar: "BS",
    quoteKey: "stories.q3",
    stars: 5,
  },
];

// ─── Animated Counter ────────────────────────────────────────────────────────

function AnimatedStat({
  value,
  prefix = "",
  suffix = "",
  decimals = 0,
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
}) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let start = 0;
    const end = value;
    const duration = 1800;
    const step = 16;
    const increment = (end / duration) * step;
    const timer = setInterval(() => {
      start = Math.min(start + increment, end);
      setDisplay(start);
      if (start >= end) clearInterval(timer);
    }, step);
    return () => clearInterval(timer);
  }, [value]);

  const formatted =
    decimals > 0
      ? display.toFixed(decimals)
      : display >= 1000
        ? (display / 1000).toFixed(1) + "k"
        : Math.round(display).toString();

  return (
    <span>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}

// ─── Mini Bar Chart ──────────────────────────────────────────────────────────

function MiniBarChart({ data, color = "#6366f1" }: { data: number[]; color?: string }) {
  const max = Math.max(...data);
  return (
    <div className="flex items-end gap-0.5 h-12 w-full">
      {data.map((v, i) => (
        <div key={i} className="flex-1 flex flex-col justify-end" title={`${MONTHS[i]}: ${v}`}>
          <div
            className="rounded-sm transition-all duration-700 opacity-80 hover:opacity-100"
            style={{ height: `${(v / max) * 100}%`, background: color }}
          />
        </div>
      ))}
    </div>
  );
}

// ─── Donut Chart (simple SVG) ────────────────────────────────────────────────

function DonutChart({ data }: { data: typeof DEMO_CHANNELS }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  let offset = 0;
  const r = 36;
  const circ = 2 * Math.PI * r;

  return (
    <svg viewBox="0 0 100 100" className="w-24 h-24" style={{ transform: "rotate(-90deg)" }}>
      {data.map((d) => {
        const pct = d.value / total;
        const dash = pct * circ;
        const gap = circ - dash;
        const el = (
          <circle
            key={d.name}
            cx="50"
            cy="50"
            r={r}
            fill="none"
            stroke={d.color}
            strokeWidth="14"
            strokeDasharray={`${dash} ${gap}`}
            strokeDashoffset={-offset}
          />
        );
        offset += dash;
        return el;
      })}
    </svg>
  );
}

// ─── Feature Bento Card ──────────────────────────────────────────────────────

function BentoCard({
  className,
  children,
  gradient = false,
}: {
  className?: string;
  children: React.ReactNode;
  gradient?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-background p-5 overflow-hidden relative group",
        gradient && "bg-gradient-to-br from-primary/5 to-primary/0",
        className,
      )}
    >
      {children}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MarketingPage({ params }: { params: Promise<{ locale: string }> }) {
  const t = useTranslations("homepage");
  const { locale } = use(params);
  const easeSmooth = [0.16, 1, 0.3, 1] as [number, number, number, number];

  return (
    <div className="bg-zinc-50 dark:bg-[#0b0c11] text-zinc-900 dark:text-zinc-100 overflow-x-hidden">
      {/* ───────────────────── 3D SCROLLABLE DAY/NIGHT HERO (GOOGLE FLOW) ───────────────────── */}
      <HeroFlow3D locale={locale} t={t} />

      {/* ─── INFINITE INTEGRATION MARQUEE — powered by the tools you use ─── */}

      <section
        aria-label="Integrations"
        className="relative border-y border-border/60 bg-background/40 py-7 overflow-hidden"
      >
        <div className="mx-auto max-w-7xl px-4 mb-5 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            {t("marquee.label")}
          </p>
        </div>
        <div className="relative overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_15%,black_85%,transparent)]">
          <div
            data-hero-marquee
            className="flex w-max animate-[hero-marquee_36s_linear_infinite] motion-reduce:animate-none"
          >
            {[0, 1].map((half) => (
              <div
                key={half}
                aria-hidden={half === 1}
                className="flex shrink-0 items-center gap-3 pr-3"
              >
                {INTEGRATIONS.map((intg) => (
                  <span
                    key={`${half}-${intg.name}`}
                    className="flex items-center gap-2.5 whitespace-nowrap rounded-full border border-border/70 bg-background/70 px-4 py-2 text-sm font-medium text-muted-foreground backdrop-blur"
                  >
                    <span aria-hidden="true" className="text-base leading-none">
                      {intg.icon}
                    </span>
                    <span className="text-foreground">{intg.name}</span>
                    <span className="hidden text-xs text-muted-foreground/80 md:inline">
                      {t(intg.descKey)}
                    </span>
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ──────── BENTO GRID ──────── */}
      <section id="features" className="px-4 sm:px-6 lg:px-12 py-12 max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, ease: easeSmooth }}
          className="text-center mb-12"
        >
          <p className="text-primary text-sm font-semibold uppercase tracking-widest mb-3">
            {t("bento.badge")}
          </p>
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-foreground mb-4">
            {t("bento.t1")}
            <br />
            {t("bento.t2")}
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">{t("bento.sub")}</p>
        </motion.div>

        {/* Bento grid — 12-column layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4 auto-rows-auto">
          {/* ── Revenue Chart (large, 7 cols) */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, ease: easeSmooth }}
            className="lg:col-span-7"
          >
            <BentoCard className="h-full min-h-[280px]">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-xs text-muted-foreground font-medium mb-0.5">
                    {t("bento.revenueEyebrow")}
                  </p>
                  <p className="text-2xl font-bold text-foreground">$284.7k</p>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-semibold flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" /> +12.5%
                </span>
              </div>
              <MiniBarChart data={DEMO_MONTHLY} color="hsl(var(--primary))" />
              <div className="flex justify-between mt-2">
                {MONTHS.map((m, i) => (
                  <span key={i} className="text-[9px] text-muted-foreground">
                    {m}
                  </span>
                ))}
              </div>
              <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-primary inline-block" />{" "}
                  {t("bento.monthlyLegend")}
                </span>
                <span className="flex items-center gap-1.5">
                  <RefreshCw className="h-3 w-3" /> {t("bento.liveLegend")}
                </span>
              </div>
            </BentoCard>
          </motion.div>

          {/* ── Sales by Channel (5 cols) */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, delay: 0.05, ease: easeSmooth }}
            className="lg:col-span-5"
          >
            <BentoCard className="h-full min-h-[280px]">
              <p className="text-xs text-muted-foreground font-medium mb-1">
                {t("bento.channelEyebrow")}
              </p>
              <p className="text-lg font-bold text-foreground mb-4">{t("bento.channelTitle")}</p>
              <div className="flex items-center gap-4">
                <DonutChart data={DEMO_CHANNELS} />
                <div className="space-y-2 flex-1">
                  {DEMO_CHANNELS.map((c) => (
                    <div key={c.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ background: c.color }}
                        />
                        <span className="text-xs text-foreground font-medium">
                          {c.nameKey ? t(c.nameKey) : c.name}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">{c.value}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </BentoCard>
          </motion.div>

          {/* ── Recent Orders (7 cols) */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, delay: 0.1, ease: easeSmooth }}
            className="lg:col-span-7"
          >
            <BentoCard className="h-full">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs text-muted-foreground font-medium mb-0.5">
                    {t("bento.ordersEyebrow")}
                  </p>
                  <p className="text-lg font-bold text-foreground">{t("demoOrders.title")}</p>
                </div>
                <Link
                  href={`/${locale}/login`}
                  className="text-xs text-primary font-medium flex items-center gap-1 hover:underline"
                >
                  {t("bento.viewAll")} <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
              <div className="space-y-2">
                {DEMO_ORDERS.map((order) => (
                  <div
                    key={order.id}
                    className="flex items-center justify-between py-2 border-b border-border last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                        {order.customer
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-foreground">{order.customer}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {order.id} · {order.channel}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "text-[10px] font-semibold px-2 py-0.5 rounded-full",
                          STATUS_COLOR[order.status],
                        )}
                      >
                        {t(`orderStatus.${order.status}`)}
                      </span>
                      <span className="text-xs font-bold text-foreground">${order.amount}</span>
                    </div>
                  </div>
                ))}
              </div>
            </BentoCard>
          </motion.div>

          {/* ── Top Products (5 cols) */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, delay: 0.15, ease: easeSmooth }}
            className="lg:col-span-5"
          >
            <BentoCard className="h-full">
              <div className="flex items-center gap-2 mb-4">
                <Package className="h-5 w-5 text-amber-500" />
                <div>
                  <p className="text-xs text-muted-foreground font-medium">{t("bento.catalog")}</p>
                  <p className="text-lg font-bold text-foreground">{t("bento.topTitle")}</p>
                </div>
              </div>
              <div className="space-y-3">
                {DEMO_PRODUCTS.map((p, i) => (
                  <div key={p.name} className="flex items-center gap-3">
                    <span className="text-xs font-bold text-muted-foreground w-4">#{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">{p.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full"
                            style={{ width: `${(p.orders / 500) * 100}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-muted-foreground">
                          {p.orders} {t("bento.ordersSuffix")}
                        </span>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-foreground">${p.price}</span>
                  </div>
                ))}
              </div>
            </BentoCard>
          </motion.div>

          {/* ── Payment Systems (4 cols) */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, delay: 0.2, ease: easeSmooth }}
            className="lg:col-span-4"
          >
            <BentoCard className="h-full gradient" gradient>
              <CreditCard className="h-8 w-8 text-primary mb-3" />
              <p className="text-lg font-bold text-foreground mb-1">{t("bento.gatewayTitle")}</p>
              <p className="text-sm text-muted-foreground mb-4">{t("bento.gatewayDesc")}</p>
              <div className="space-y-2">
                {[
                  {
                    name: "Stripe",
                    descKey: "bento.gwCardDesc",
                    badgeKey: "bento.gwBadgeGlobal",
                    color: "#635BFF",
                  },
                  {
                    name: "Midtrans",
                    descKey: "bento.gwMidDesc",
                    badgeKey: "bento.gwBadgeIndonesia",
                    color: "#0084FF",
                  },
                ].map((gw) => (
                  <div
                    key={gw.name}
                    className="flex items-center gap-3 p-2.5 rounded-xl bg-background border border-border"
                  >
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold"
                      style={{ background: gw.color }}
                    >
                      {gw.name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground">{gw.name}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{t(gw.descKey)}</p>
                    </div>
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
                      {t(gw.badgeKey)}
                    </span>
                  </div>
                ))}
              </div>
            </BentoCard>
          </motion.div>

          {/* ── 2FA Security (4 cols) */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, delay: 0.25, ease: easeSmooth }}
            className="lg:col-span-4"
          >
            <BentoCard className="h-full">
              <Shield className="h-8 w-8 text-emerald-500 mb-3" />
              <p className="text-lg font-bold text-foreground mb-1">{t("security.title")}</p>
              <p className="text-sm text-muted-foreground mb-4">{t("bento.secBody")}</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { icon: Lock, labelKey: "bento.s1l", subKey: "bento.s1s" },
                  { icon: Key, labelKey: "bento.s2l", subKey: "bento.s2s" },
                  { icon: BadgeCheck, labelKey: "bento.s3l", subKey: "bento.s3s" },
                  { icon: Activity, labelKey: "bento.s4l", subKey: "bento.s4s" },
                ].map(({ icon: Icon, labelKey, subKey }) => (
                  <div
                    key={labelKey}
                    className="flex items-center gap-2 p-2 rounded-xl bg-muted/50"
                  >
                    <Icon className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                    <div>
                      <p className="text-[11px] font-semibold text-foreground">{t(labelKey)}</p>
                      <p className="text-[9px] text-muted-foreground">{t(subKey)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </BentoCard>
          </motion.div>

          {/* ── AI Assistant (4 cols) */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, delay: 0.3, ease: easeSmooth }}
            className="lg:col-span-4"
          >
            <BentoCard className="h-full bg-foreground text-background dark:bg-zinc-900 dark:text-zinc-100">
              <Bot className="h-8 w-8 mb-3 opacity-80" />
              <p className="text-lg font-bold mb-1">{t("bento.aiTitle")}</p>
              <p className="text-sm opacity-70 mb-4">{t("bento.aiBody")}</p>
              <div className="space-y-2">
                {["bento.aiQ1", "bento.aiQ2", "bento.aiQ3"].map((qk) => (
                  <div
                    key={qk}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 dark:bg-white/5"
                  >
                    <span className="text-[10px] opacity-80">{t(qk)}</span>
                    <ArrowRight className="h-3 w-3 ml-auto flex-shrink-0 opacity-50" />
                  </div>
                ))}
              </div>
            </BentoCard>
          </motion.div>

          {/* ── Integrations (8 cols) */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, delay: 0.35, ease: easeSmooth }}
            className="lg:col-span-8"
          >
            <BentoCard className="h-full">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs text-muted-foreground font-medium mb-0.5">
                    {t("bento.ecoEyebrow")}
                  </p>
                  <p className="text-lg font-bold text-foreground">{t("bento.ecoTitle")}</p>
                </div>
                <Layers className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="grid grid-cols-4 gap-2">
                {INTEGRATIONS.map((intg) => (
                  <div
                    key={intg.name}
                    className="flex flex-col items-center text-center p-3 rounded-xl bg-muted/50 hover:bg-muted transition group cursor-default"
                  >
                    <span className="text-xl mb-1.5">{intg.icon}</span>
                    <p className="text-[11px] font-semibold text-foreground group-hover:text-primary transition">
                      {intg.name}
                    </p>
                    <p className="text-[9px] text-muted-foreground">{t(intg.descKey)}</p>
                  </div>
                ))}
              </div>
            </BentoCard>
          </motion.div>

          {/* ── API / Webhooks (4 cols) */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, delay: 0.4, ease: easeSmooth }}
            className="lg:col-span-4"
          >
            <BentoCard className="h-full">
              <Webhook className="h-8 w-8 text-violet-500 mb-3" />
              <p className="text-lg font-bold text-foreground mb-1">{t("bento.apiTitle")}</p>
              <p className="text-sm text-muted-foreground mb-4">{t("bento.apiBody")}</p>
              <div className="font-mono text-xs bg-muted rounded-xl p-3 space-y-1 text-muted-foreground">
                <p>
                  <span className="text-blue-500">GET</span> /api/v1/orders
                </p>
                <p>
                  <span className="text-emerald-500">POST</span> /api/v1/products
                </p>
                <p>
                  <span className="text-amber-500">PUT</span> /api/v1/customers/:id
                </p>
                <p>
                  <span className="text-violet-500">WH</span> order.completed
                </p>
              </div>
            </BentoCard>
          </motion.div>

          {/* ── Real-time (full width) */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, delay: 0.45, ease: easeSmooth }}
            className="lg:col-span-12"
          >
            <BentoCard className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Zap className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium mb-0.5">
                    {t("bento.rtEyebrow")}
                  </p>
                  <p className="text-lg font-bold text-foreground">{t("bento.rtTitle")}</p>
                  <p className="text-sm text-muted-foreground mt-1">{t("bento.rtBody")}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 flex-shrink-0">
                {["rt1", "rt2", "rt3", "rt4"].map((rtk) => (
                  <span
                    key={rtk}
                    className="px-3 py-1 rounded-full border border-border bg-muted text-xs font-medium text-foreground"
                  >
                    {t(`bento.${rtk}`)}
                  </span>
                ))}
              </div>
            </BentoCard>
          </motion.div>
        </div>
      </section>

      {/* ──────── FEATURES LIST ──────── */}
      <section id="methodology" className="px-4 sm:px-6 lg:px-12 py-20 max-w-7xl mx-auto">
        <div className="grid md:grid-cols-2 gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, x: -24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6, ease: easeSmooth }}
          >
            <p className="text-primary text-sm font-semibold uppercase tracking-widest mb-3">
              {t("why.badge")}
            </p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground mb-6 leading-tight">
              {t("why.t1")}
              <br />
              {t("why.t2")}
            </h2>
            <div className="space-y-4">
              {[
                { icon: Globe, titleKey: "why.f1t", descKey: "why.f1d" },
                { icon: BarChart3, titleKey: "why.f2t", descKey: "why.f2d" },
                { icon: Users, titleKey: "why.f3t", descKey: "why.f3d" },
                { icon: Bell, titleKey: "why.f4t", descKey: "why.f4d" },
              ].map(({ icon: Icon, titleKey, descKey }) => (
                <div key={titleKey} className="flex gap-4">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Icon className="h-4.5 w-4.5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{t(titleKey)}</p>
                    <p className="text-sm text-muted-foreground mt-0.5">{t(descKey)}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6, ease: easeSmooth }}
            className="grid grid-cols-2 gap-4"
          >
            {[
              { labelKey: "why.l1", value: "1.8M+", icon: ShoppingCart, color: "text-blue-500" },
              { labelKey: "why.l2", value: "$48M+", icon: TrendingUp, color: "text-emerald-500" },
              { labelKey: "why.l3", value: "<200ms", icon: Zap, color: "text-amber-500" },
              { labelKey: "why.l4", value: "99.9%", icon: Activity, color: "text-violet-500" },
            ].map(({ labelKey, value, icon: Icon, color }) => (
              <div
                key={labelKey}
                className="p-5 rounded-2xl border border-border bg-background text-center"
              >
                <Icon className={cn("h-6 w-6 mx-auto mb-2", color)} />
                <p className="text-2xl font-bold text-foreground">{value}</p>
                <p className="text-xs text-muted-foreground mt-1">{t(labelKey)}</p>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ──────── PRICING ──────── */}
      <section id="pricing" className="px-4 sm:px-6 lg:px-12 py-20 bg-background">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6, ease: easeSmooth }}
            className="text-center mb-12"
          >
            <p className="text-primary text-sm font-semibold uppercase tracking-widest mb-3">
              {t("plans.badge")}
            </p>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-foreground mb-4">
              {t("plans.t1")}
            </h2>
            <p className="text-muted-foreground text-lg">{t("plans.sub")}</p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Free */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, ease: easeSmooth }}
              className="rounded-2xl border border-border bg-background p-8 flex flex-col"
            >
              <h3 className="text-xl font-bold text-foreground mb-1">{t("plans.starterName")}</h3>
              <div className="flex items-baseline gap-1 mb-2">
                <span className="text-4xl font-bold text-foreground">$0</span>
                <span className="text-muted-foreground font-medium">{t("plans.month")}</span>
              </div>
              <p className="text-sm text-muted-foreground mb-6 pb-6 border-b border-border">
                {t("plans.starterDesc")}
              </p>
              <ul className="space-y-3 mb-8 flex-1">
                {["plans.f1", "plans.f2", "plans.f3", "plans.f4", "plans.f5"].map((fk) => (
                  <li key={fk} className="flex items-center gap-3 text-sm text-foreground">
                    <Check className="h-4 w-4 text-primary flex-shrink-0" /> {t(fk)}
                  </li>
                ))}
              </ul>
              <Link
                href={`/${locale}/register`}
                className="w-full py-3 rounded-full border border-border bg-background text-foreground text-sm font-semibold text-center hover:bg-muted transition"
              >
                {t("plans.ctaFree")}
              </Link>
            </motion.div>

            {/* Pro */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: 0.05, ease: easeSmooth }}
              className="rounded-2xl bg-foreground text-background p-8 flex flex-col relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-48 h-48 bg-primary/30 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none" />
              <div className="relative z-10">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-semibold mb-3">
                  <Sparkles className="h-3 w-3" /> {t("plans.popular")}
                </div>
                <h3 className="text-xl font-bold mb-1">{t("plans.proName")}</h3>
                <div className="flex items-baseline gap-1 mb-2">
                  <span className="text-4xl font-bold">$49</span>
                  <span className="opacity-60 font-medium">{t("plans.month")}</span>
                </div>
                <p className="text-sm opacity-70 mb-6 pb-6 border-b border-white/20">
                  {t("plans.proDesc")}
                </p>
                <ul className="space-y-3 mb-8 flex-1">
                  {[
                    "plans.pf1",
                    "plans.pf2",
                    "plans.pf3",
                    "plans.pf4",
                    "plans.pf5",
                    "plans.pf6",
                    "plans.pf7",
                    "plans.pf8",
                  ].map((fk) => (
                    <li key={fk} className="flex items-center gap-3 text-sm">
                      <Check className="h-4 w-4 text-primary flex-shrink-0" /> {t(fk)}
                    </li>
                  ))}
                </ul>
                <Link
                  href={`/${locale}/register`}
                  className="w-full py-3 rounded-full bg-white text-gray-900 text-sm font-semibold text-center hover:bg-gray-100 transition block"
                >
                  {t("plans.ctaTrial")}
                </Link>
              </div>
            </motion.div>
          </div>

          <div className="mt-6 p-4 rounded-2xl border border-border bg-muted/50 flex items-center justify-between">
            <p className="text-sm text-foreground font-medium">{t("plans.entQ")}</p>
            <Link
              href={`/${locale}/contact`}
              className="text-sm font-semibold text-primary hover:underline flex items-center gap-1"
            >
              {t("plans.entContact")} <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* ──────── TESTIMONIALS ──────── */}
      <section className="px-4 sm:px-6 lg:px-12 py-20 max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, ease: easeSmooth }}
          className="text-center mb-12"
        >
          <p className="text-primary text-sm font-semibold uppercase tracking-widest mb-3">
            {t("stories.badge")}
          </p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
            {t("stories.title")}
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6">
          {TESTIMONIALS.map((tm, i) => (
            <motion.div
              key={tm.name}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: i * 0.08, ease: easeSmooth }}
              className="rounded-2xl border border-border bg-background p-6 flex flex-col gap-4"
            >
              <div className="flex gap-0.5">
                {Array.from({ length: tm.stars }).map((_, j) => (
                  <Star key={j} className="h-4 w-4 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed flex-1">
                &ldquo;{t(tm.quoteKey)}&rdquo;
              </p>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                  {tm.avatar}
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{tm.name}</p>
                  <p className="text-xs text-muted-foreground">{tm.role}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ──────── FOOTER CTA ──────── */}
      <section className="px-4 sm:px-6 lg:px-12 pb-12 max-w-4xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, ease: easeSmooth }}
          className="rounded-3xl bg-foreground text-background p-12 relative overflow-hidden"
        >
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-48 bg-primary/40 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 leading-tight">{t("ctaTitle")}</h2>
            <p className="opacity-70 mb-8 text-lg">{t("ctaDesc")}</p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link
                href={`/${locale}/register`}
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-white text-gray-900 font-semibold hover:bg-gray-100 transition shadow-lg"
              >
                {t("final.getStarted")} <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href={`/${locale}/login`}
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full border border-white/30 text-background font-semibold hover:bg-white/10 transition"
              >
                {t("final.signIn")}
              </Link>
            </div>
          </div>
        </motion.div>
      </section>
    </div>
  );
}
