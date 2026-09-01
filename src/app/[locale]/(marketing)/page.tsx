"use client";

import { use, useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { motion } from "framer-motion";
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
  { name: "Online Store", value: 42, color: "#10B981" },
  { name: "Instagram", value: 24, color: "#EC4899" },
  { name: "Shopify", value: 18, color: "#059669" },
  { name: "TikTok", value: 10, color: "#F43F5E" },
  { name: "Facebook", value: 6, color: "#3B82F6" },
];

const DEMO_MONTHLY = [28, 45, 38, 62, 55, 78, 72, 88, 95, 82, 104, 118];
const MONTHS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

const INTEGRATIONS = [
  { name: "Stripe", desc: "Payments & billing", color: "#635BFF", icon: "💳" },
  { name: "Midtrans", desc: "Indonesia gateway", color: "#0084FF", icon: "🏦" },
  { name: "Shopify", desc: "E-commerce sync", color: "#059669", icon: "🛒" },
  { name: "Tokopedia", desc: "Marketplace orders", color: "#42B549", icon: "🛍️" },
  { name: "Instagram", desc: "Social commerce", color: "#E1306C", icon: "📸" },
  { name: "OpenAI", desc: "AI-powered insights", color: "#10A37F", icon: "🤖" },
  { name: "Supabase", desc: "Real-time data", color: "#3ECF8E", icon: "⚡" },
  { name: "Resend", desc: "Transactional email", color: "#000000", icon: "✉️" },
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
    text: "We went from manual spreadsheets to real-time dashboards in one afternoon. The multi-channel order management saved us 20+ hours per week.",
    stars: 5,
  },
  {
    name: "Jessica Wu",
    role: "Head of Growth, NexCommerce",
    avatar: "JW",
    text: "The Stripe + Midtrans dual-payment integration is a game-changer for our Indonesian market. Revenue reconciliation is now fully automated.",
    stars: 5,
  },
  {
    name: "Budi Santoso",
    role: "CTO, Startup Accelerator",
    avatar: "BS",
    text: "The 2FA, WebAuthn, and SSO enterprise features gave us SOC 2 compliance out of the box. Our security team was genuinely impressed.",
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
  const t = useTranslations('homepage');
  const { locale } = use(params);

  const easeSmooth = [0.16, 1, 0.3, 1] as [number, number, number, number];

  return (
    <div className="bg-zinc-50 dark:bg-[#0b0c11] text-zinc-900 dark:text-zinc-100 overflow-x-hidden">
      {/* ───────────────────── HERO ───────────────────── */}
      <section className="relative pt-28 pb-16 px-4 sm:px-6 lg:px-12 flex flex-col items-center text-center overflow-hidden">
        {/* Background glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-primary/8 rounded-full blur-[100px]" />
          <div className="absolute bottom-0 left-1/4 w-[400px] h-[300px] bg-violet-500/5 rounded-full blur-[80px]" />
        </div>

        {/* ── Text Block ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: easeSmooth }}
          className="relative z-10 max-w-4xl mx-auto"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-border bg-background/80 backdrop-blur-sm text-muted-foreground text-xs font-semibold mb-7 shadow-sm">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Business Management Platform
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.08] text-foreground">
            <FlipFadeText
              words={["Your Business, Fully Unified", "Manage Everything, Effortlessly", "Scale Fast, Stay Secure"]}
              interval={3000}
              className="min-h-[80px] sm:min-h-[100px] md:min-h-[120px]"
              textClassName="text-3xl sm:text-4xl md:text-5xl lg:text-6xl tracking-tight"
            />
          </h1>

          <p className="mt-4 text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            One platform to manage orders, customers, products, payments, and analytics — with
            real-time data, multi-channel integration, and enterprise-grade security built in.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 mt-8">
            <Link
              href={`/${locale}/register`}
              className="inline-flex items-center gap-2 px-7 py-3 rounded-full bg-foreground text-background text-sm font-semibold hover:opacity-90 transition shadow-lg hover:shadow-xl"
            >
              Get Started Free
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href={`/${locale}/login`}
              className="inline-flex items-center gap-2 px-7 py-3 rounded-full border border-border bg-background/60 backdrop-blur text-sm font-semibold text-foreground hover:bg-background transition"
            >
              Live Demo
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          </div>
        </motion.div>

        {/* ── Visual Showcase with Floating Stat Cards ── */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3, ease: easeSmooth }}
          className="relative z-10 mt-14 w-full max-w-5xl mx-auto"
        >
          <div className="relative">
            {/* Central dashboard preview */}
            <div className="relative rounded-2xl border border-border bg-background shadow-2xl shadow-black/5 dark:shadow-black/30 overflow-hidden aspect-[16/9] max-h-[420px]">
              {/* Simulated dashboard UI */}
              <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-muted/30 p-4 sm:p-6">
                {/* Title bar */}
                <div className="flex items-center gap-2 mb-4">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                  </div>
                  <div className="flex-1 h-5 rounded-md bg-muted/50 max-w-[200px] ml-3" />
                </div>

                {/* Sidebar + content */}
                <div className="flex gap-4 h-[calc(100%-40px)]">
                  {/* Mini sidebar */}
                  <div className="hidden sm:flex flex-col gap-2 w-[140px] shrink-0">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className={cn("h-7 rounded-lg", i === 0 ? "bg-primary/15" : "bg-muted/40")} />
                    ))}
                  </div>

                  {/* Content area */}
                  <div className="flex-1 flex flex-col gap-3">
                    {/* Mini stat cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {[
                        { color: "bg-emerald-500/20", w: "w-12" },
                        { color: "bg-blue-500/20", w: "w-10" },
                        { color: "bg-violet-500/20", w: "w-14" },
                        { color: "bg-amber-500/20", w: "w-11" },
                      ].map((s, i) => (
                        <div key={i} className="rounded-lg bg-muted/30 p-2.5">
                          <div className={cn("h-2 rounded-full mb-2", s.color, s.w)} />
                          <div className="h-4 rounded bg-muted/50 w-16" />
                        </div>
                      ))}
                    </div>

                    {/* Chart area */}
                    <div className="flex-1 rounded-xl bg-muted/20 p-3 flex items-end gap-1">
                      {DEMO_MONTHLY.map((v, i) => (
                        <div
                          key={i}
                          className="flex-1 rounded-sm bg-primary/20 hover:bg-primary/30 transition-colors"
                          style={{ height: `${(v / Math.max(...DEMO_MONTHLY)) * 100}%` }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Floating Stat Cards ── */}

            {/* Top-left: Uptime */}
            <motion.div
              initial={{ opacity: 0, x: -30, y: -20 }}
              animate={{ opacity: 1, x: 0, y: 0 }}
              transition={{ duration: 0.6, delay: 0.6, ease: easeSmooth }}
              className="absolute -top-6 -left-4 sm:-left-8 z-20"
            >
              <div className="rounded-2xl border border-border bg-background/95 backdrop-blur-sm shadow-xl shadow-black/5 p-4 min-w-[140px]">
                <p className="text-2xl sm:text-3xl font-bold text-foreground">
                  <AnimatedStat value={99.9} decimals={1} suffix="%" />
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">Guaranteed uptime SLA</p>
              </div>
            </motion.div>

            {/* Top-right: Rating */}
            <motion.div
              initial={{ opacity: 0, x: 30, y: -20 }}
              animate={{ opacity: 1, x: 0, y: 0 }}
              transition={{ duration: 0.6, delay: 0.75, ease: easeSmooth }}
              className="absolute -top-4 -right-2 sm:-right-6 z-20"
            >
              <div className="rounded-2xl border border-border bg-background/95 backdrop-blur-sm shadow-xl shadow-black/5 p-4 min-w-[130px]">
                <div className="flex items-center gap-1.5">
                  <p className="text-2xl sm:text-3xl font-bold text-foreground">4.8</p>
                  <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">Average customer rating</p>
              </div>
            </motion.div>

            {/* Bottom-left: Data points */}
            <motion.div
              initial={{ opacity: 0, x: -30, y: 20 }}
              animate={{ opacity: 1, x: 0, y: 0 }}
              transition={{ duration: 0.6, delay: 0.9, ease: easeSmooth }}
              className="absolute -bottom-6 -left-2 sm:-left-6 z-20"
            >
              <div className="rounded-2xl border border-border bg-background/95 backdrop-blur-sm shadow-xl shadow-black/5 p-4 min-w-[150px]">
                <p className="text-2xl sm:text-3xl font-bold text-foreground">
                  <AnimatedStat value={2.5} decimals={1} suffix="M+" />
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">Data points processed</p>
              </div>
            </motion.div>

            {/* Bottom-right: Feature tags */}
            <motion.div
              initial={{ opacity: 0, x: 30, y: 20 }}
              animate={{ opacity: 1, x: 0, y: 0 }}
              transition={{ duration: 0.6, delay: 1.05, ease: easeSmooth }}
              className="absolute -bottom-8 -right-2 sm:-right-4 z-20"
            >
              <div className="rounded-2xl border border-border bg-background/95 backdrop-blur-sm shadow-xl shadow-black/5 p-3">
                <div className="flex flex-wrap gap-1.5">
                  {["Analytics", "Payments", "Security", "API", "Multi-Channel"].map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex px-2.5 py-1 rounded-full border border-border bg-muted/50 text-[10px] sm:text-xs font-medium text-muted-foreground"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </motion.div>

        {/* ── Trust badges ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 1.2, ease: easeSmooth }}
          className="relative z-10 flex flex-wrap justify-center gap-4 mt-16 text-xs text-muted-foreground"
        >
          {[
            "No credit card required",
            "Deploy in minutes",
            "Multi-tenant ready",
            "SOC 2 compliant",
          ].map((b) => (
            <span key={b} className="flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 text-primary" />
              {b}
            </span>
          ))}
        </motion.div>
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
            Platform Features
          </p>
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-foreground mb-4">
            Everything You Need
            <br />
            to Run Your Business
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            From order management to enterprise security, every tool is built-in and ready to use.
          </p>
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
                    Revenue Overview
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
                  <span className="w-2 h-2 rounded-full bg-primary inline-block" /> Monthly Revenue
                </span>
                <span className="flex items-center gap-1.5">
                  <RefreshCw className="h-3 w-3" /> Live updates every 15s
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
              <p className="text-xs text-muted-foreground font-medium mb-1">Sales by Channel</p>
              <p className="text-lg font-bold text-foreground mb-4">Multi-Channel Commerce</p>
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
                        <span className="text-xs text-foreground font-medium">{c.name}</span>
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
                  <p className="text-xs text-muted-foreground font-medium mb-0.5">Orders</p>
                  <p className="text-lg font-bold text-foreground">{t('demoOrders.title')}</p>
                </div>
                <Link
                  href={`/${locale}/login`}
                  className="text-xs text-primary font-medium flex items-center gap-1 hover:underline"
                >
                  View all <ArrowRight className="h-3 w-3" />
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
                        {order.status}
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
                  <p className="text-xs text-muted-foreground font-medium">Catalog</p>
                  <p className="text-lg font-bold text-foreground">Top Products</p>
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
                        <span className="text-[10px] text-muted-foreground">{p.orders} orders</span>
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
              <p className="text-lg font-bold text-foreground mb-1">Dual Payment Gateway</p>
              <p className="text-sm text-muted-foreground mb-4">
                Stripe + Midtrans for global and Indonesian markets with automatic currency
                conversion.
              </p>
              <div className="space-y-2">
                {[
                  {
                    name: "Stripe",
                    desc: "Cards, Apple Pay, Google Pay",
                    badge: "Global",
                    color: "#635BFF",
                  },
                  {
                    name: "Midtrans",
                    desc: "DANA, GoPay, QRIS, Bank Transfer",
                    badge: "Indonesia",
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
                      <p className="text-[10px] text-muted-foreground truncate">{gw.desc}</p>
                    </div>
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
                      {gw.badge}
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
              <p className="text-lg font-bold text-foreground mb-1">{t('security.title')}</p>
              <p className="text-sm text-muted-foreground mb-4">
                TOTP 2FA, WebAuthn passkeys, SAML SSO, session management, and audit logs.
              </p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { icon: Lock, label: "2FA / TOTP", sub: "Google Authenticator" },
                  { icon: Key, label: "WebAuthn", sub: "Passkeys & biometrics" },
                  { icon: BadgeCheck, label: "SAML SSO", sub: "Enterprise IdP" },
                  { icon: Activity, label: "Audit Log", sub: "Full event trail" },
                ].map(({ icon: Icon, label, sub }) => (
                  <div key={label} className="flex items-center gap-2 p-2 rounded-xl bg-muted/50">
                    <Icon className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                    <div>
                      <p className="text-[11px] font-semibold text-foreground">{label}</p>
                      <p className="text-[9px] text-muted-foreground">{sub}</p>
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
              <p className="text-lg font-bold mb-1">AI Business Assistant</p>
              <p className="text-sm opacity-70 mb-4">
                Ask anything about your business in plain language. Powered by GPT-4.
              </p>
              <div className="space-y-2">
                {[
                  "What was our best-selling product last month?",
                  "Show pending orders from Instagram",
                  "Generate a revenue report for Q3",
                ].map((q) => (
                  <div
                    key={q}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 dark:bg-white/5"
                  >
                    <span className="text-[10px] opacity-80">{q}</span>
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
                  <p className="text-xs text-muted-foreground font-medium mb-0.5">Ecosystem</p>
                  <p className="text-lg font-bold text-foreground">Platform Integrations</p>
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
                    <p className="text-[9px] text-muted-foreground">{intg.desc}</p>
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
              <p className="text-lg font-bold text-foreground mb-1">REST API & Webhooks</p>
              <p className="text-sm text-muted-foreground mb-4">
                Full public API v1 with versioned endpoints, API key management, and webhook
                delivery logs.
              </p>
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
                    Real-Time Infrastructure
                  </p>
                  <p className="text-lg font-bold text-foreground">Live Dashboard Updates</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Server-Sent Events push order, inventory, and payment updates to every dashboard
                    tab — no refresh needed.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 flex-shrink-0">
                {["SSE streaming", "15s auto-poll", "Multi-tab sync", "Offline detection"].map(
                  (tag) => (
                    <span
                      key={tag}
                      className="px-3 py-1 rounded-full border border-border bg-muted text-xs font-medium text-foreground"
                    >
                      {tag}
                    </span>
                  ),
                )}
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
              Why Teams Choose Us
            </p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground mb-6 leading-tight">
              Built for Modern
              <br />
              Commerce Teams
            </h2>
            <div className="space-y-4">
              {[
                {
                  icon: Globe,
                  title: "Multi-Channel Order Management",
                  desc: "Sync orders from Shopify, Tokopedia, TikTok Shop, Instagram, and Facebook in one unified inbox.",
                },
                {
                  icon: BarChart3,
                  title: "Advanced Analytics & Reports",
                  desc: "Revenue cohort analysis, geographic breakdowns, conversion funnels, and retention heatmaps.",
                },
                {
                  icon: Users,
                  title: "Role-Based Access Control",
                  desc: "Granular RBAC with custom roles, team management, and per-feature permission control.",
                },
                {
                  icon: Bell,
                  title: "Smart Notifications",
                  desc: "Configurable alerts for low stock, order status changes, payment failures, and revenue milestones.",
                },
              ].map(({ icon: Icon, title, desc }) => (
                <div key={title} className="flex gap-4">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Icon className="h-4.5 w-4.5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{title}</p>
                    <p className="text-sm text-muted-foreground mt-0.5">{desc}</p>
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
              {
                label: "Orders processed",
                value: "1.8M+",
                icon: ShoppingCart,
                color: "text-blue-500",
              },
              {
                label: "Revenue tracked",
                value: "$48M+",
                icon: TrendingUp,
                color: "text-emerald-500",
              },
              { label: "Avg. response time", value: "<200ms", icon: Zap, color: "text-amber-500" },
              { label: "Uptime SLA", value: "99.9%", icon: Activity, color: "text-violet-500" },
            ].map(({ label, value, icon: Icon, color }) => (
              <div
                key={label}
                className="p-5 rounded-2xl border border-border bg-background text-center"
              >
                <Icon className={cn("h-6 w-6 mx-auto mb-2", color)} />
                <p className="text-2xl font-bold text-foreground">{value}</p>
                <p className="text-xs text-muted-foreground mt-1">{label}</p>
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
              Pricing
            </p>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-foreground mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-muted-foreground text-lg">Start free, scale when you need to.</p>
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
              <h3 className="text-xl font-bold text-foreground mb-1">Starter</h3>
              <div className="flex items-baseline gap-1 mb-2">
                <span className="text-4xl font-bold text-foreground">$0</span>
                <span className="text-muted-foreground font-medium">/month</span>
              </div>
              <p className="text-sm text-muted-foreground mb-6 pb-6 border-b border-border">
                Perfect for small businesses getting started.
              </p>
              <ul className="space-y-3 mb-8 flex-1">
                {[
                  "Up to 100 orders/month",
                  "2 sales channels",
                  "Basic analytics",
                  "Email support",
                  "API access (read-only)",
                ].map((f) => (
                  <li key={f} className="flex items-center gap-3 text-sm text-foreground">
                    <Check className="h-4 w-4 text-primary flex-shrink-0" /> {f}
                  </li>
                ))}
              </ul>
              <Link
                href={`/${locale}/register`}
                className="w-full py-3 rounded-full border border-border bg-background text-foreground text-sm font-semibold text-center hover:bg-muted transition"
              >
                Get Started Free
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
                  <Sparkles className="h-3 w-3" /> Most Popular
                </div>
                <h3 className="text-xl font-bold mb-1">Pro</h3>
                <div className="flex items-baseline gap-1 mb-2">
                  <span className="text-4xl font-bold">$49</span>
                  <span className="opacity-60 font-medium">/month</span>
                </div>
                <p className="text-sm opacity-70 mb-6 pb-6 border-b border-white/20">
                  For growing teams who need full power.
                </p>
                <ul className="space-y-3 mb-8 flex-1">
                  {[
                    "Unlimited orders",
                    "All sales channels",
                    "Advanced analytics & reports",
                    "2FA + SSO + WebAuthn",
                    "Stripe & Midtrans payments",
                    "AI assistant",
                    "API & webhooks (full access)",
                    "Priority support",
                  ].map((f) => (
                    <li key={f} className="flex items-center gap-3 text-sm">
                      <Check className="h-4 w-4 text-primary flex-shrink-0" /> {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href={`/${locale}/register`}
                  className="w-full py-3 rounded-full bg-white text-gray-900 text-sm font-semibold text-center hover:bg-gray-100 transition block"
                >
                  Start 14-Day Free Trial
                </Link>
              </div>
            </motion.div>
          </div>

          <div className="mt-6 p-4 rounded-2xl border border-border bg-muted/50 flex items-center justify-between">
            <p className="text-sm text-foreground font-medium">
              Need enterprise or custom volumes?
            </p>
            <Link
              href={`/${locale}/contact`}
              className="text-sm font-semibold text-primary hover:underline flex items-center gap-1"
            >
              Contact Sales <ArrowRight className="h-3.5 w-3.5" />
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
            Customer Stories
          </p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
            Trusted by Business Teams
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6">
          {TESTIMONIALS.map((t, i) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: i * 0.08, ease: easeSmooth }}
              className="rounded-2xl border border-border bg-background p-6 flex flex-col gap-4"
            >
              <div className="flex gap-0.5">
                {Array.from({ length: t.stars }).map((_, j) => (
                  <Star key={j} className="h-4 w-4 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed flex-1">
                &ldquo;{t.text}&rdquo;
              </p>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                  {t.avatar}
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.role}</p>
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
            <h2 className="text-3xl md:text-4xl font-bold mb-4 leading-tight">
              Start Running Your Business
              <br />
              Smarter Today
            </h2>
            <p className="opacity-70 mb-8 text-lg">
              Join thousands of businesses managing their operations on one unified platform.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link
                href={`/${locale}/register`}
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-white text-gray-900 font-semibold hover:bg-gray-100 transition shadow-lg"
              >
                Get Started Free <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href={`/${locale}/login`}
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full border border-white/30 text-background font-semibold hover:bg-white/10 transition"
              >
                Sign In
              </Link>
            </div>
          </div>
        </motion.div>
      </section>
    </div>
  );
}
