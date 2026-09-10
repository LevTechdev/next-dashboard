"use client";

import { use, useState, useEffect, useRef, useCallback } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";
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
  Star,
  BadgeCheck,
  Sparkles,
  RefreshCw,
  Webhook,
  Bot,
  Quote,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { FlipFadeText } from "@/components/ui/flip-fade-text";
import HeroOverview from "@/components/home/hero-overview";
import { ProductStory } from "@/components/home/product-story";
import { RevenueChart } from "@/components/charts/revenue-chart";
import {
  StripeBrandIcon,
  MidtransBrandIcon,
  ShopifyBrandIcon,
  TokopediaBrandIcon,
  InstagramBrandIcon,
  OpenAIBrandIcon,
  SupabaseBrandIcon,
  ResendBrandIcon,
  SalesChannelIcon,
} from "@/components/ui/brand-icons";

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

// Shape the monthly demo series for the real RevenueChart component.
const REVENUE_DATA = DEMO_MONTHLY.map((v, i) => ({ month: MONTHS[i], revenue: v * 1000 }));

const INTEGRATIONS = [
  { name: "Stripe", descKey: "marquee.d0", color: "#635BFF", Icon: StripeBrandIcon },
  { name: "Midtrans", descKey: "marquee.d1", color: "#0084FF", Icon: MidtransBrandIcon },
  { name: "Shopify", descKey: "marquee.d2", color: "#95BF47", Icon: ShopifyBrandIcon },
  {
    name: "Tokopedia",
    descKey: "marquee.d3",
    color: "#42B549",
    Icon: TokopediaBrandIcon,
    lockup: true, // wide official wordmark — rendered without the text label
  },
  { name: "Instagram", descKey: "marquee.d4", color: "#E1306C", Icon: InstagramBrandIcon },
  {
    name: "OpenAI",
    descKey: "marquee.d5",
    color: "#10A37F",
    Icon: OpenAIBrandIcon,
    iconScale: 1.35, // the hexagon glyph has whitespace — render it larger to read equally
  },
  { name: "Supabase", descKey: "marquee.d6", color: "#3ECF8E", Icon: SupabaseBrandIcon },
  { name: "Resend", descKey: "marquee.d7", color: "#475569", Icon: ResendBrandIcon },
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
    roleKey: "stories.r1",
    quoteKey: "stories.q1",
    company: "tokopedia",
    avatar: "AR",
    stars: 5,
    gradient: "from-rose-500 to-orange-500",
  },
  {
    name: "Jessica Wu",
    roleKey: "stories.r2",
    quoteKey: "stories.q2",
    company: "shopify",
    avatar: "JW",
    stars: 4.5,
    gradient: "from-sky-500 to-violet-500",
  },
  {
    name: "Budi Santoso",
    roleKey: "stories.r3",
    quoteKey: "stories.q3",
    company: "instagram",
    avatar: "BS",
    stars: 4.8,
    gradient: "from-emerald-500 to-teal-500",
  },
];

// Homepage pricing mirrors the dedicated /pricing plans (Starter / Professional / Enterprise)
const HOME_PLANS = [
  {
    key: "starter",
    nameKey: "plans.starterName",
    descKey: "plans.starterDesc",
    monthly: 29,
    yearly: 23,
    popular: false,
    featureKeys: ["plans.f1", "plans.f2", "plans.f3", "plans.f4", "plans.f5"],
    ctaKey: "plans.ctaFree",
  },
  {
    key: "professional",
    nameKey: "plans.proName",
    descKey: "plans.proDesc",
    monthly: 79,
    yearly: 63,
    popular: true,
    featureKeys: [
      "plans.pf1",
      "plans.pf2",
      "plans.pf3",
      "plans.pf4",
      "plans.pf5",
      "plans.pf6",
      "plans.pf7",
      "plans.pf8",
    ],
    ctaKey: "plans.ctaTrial",
  },
  {
    key: "enterprise",
    nameKey: "plans.entName",
    descKey: "plans.entDesc",
    monthly: 199,
    yearly: 159,
    popular: false,
    featureKeys: [
      "plans.ef1",
      "plans.ef2",
      "plans.ef3",
      "plans.ef4",
      "plans.ef5",
      "plans.ef6",
      "plans.ef7",
      "plans.ef8",
      "plans.ef9",
    ],
    ctaKey: "plans.entContact",
  },
];

// ─── Shared animation choreography (varied entrance patterns) ────────────────

const easeSmooth = [0.16, 1, 0.3, 1] as [number, number, number, number];

/** Bento tiles rise with a soft scale + de-blur instead of the flat y-only fade. */
const bentoEntrance = {
  hidden: { opacity: 0, y: 28, scale: 0.95, filter: "blur(4px)" },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    filter: "blur(0px)",
    transition: { duration: 0.55, delay: i * 0.05, ease: easeSmooth },
  }),
};

/** Testimonial cards fade in with a subtle 3D flip for depth. */
const testimonialEntrance = {
  hidden: { opacity: 0, y: 22, rotateX: 8 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    rotateX: 0,
    transition: { duration: 0.6, delay: i * 0.07, ease: easeSmooth },
  }),
};

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

// ─── Star Rating (supports half stars) ───────────────────────────────────────

function StarRating({ value }: { value: number }) {
  return (
    <div className="flex gap-0.5" aria-label={`${value} / 5`} role="img">
      {Array.from({ length: 5 }).map((_, i) => {
        const fill = Math.min(Math.max(value - i, 0), 1);
        return (
          <span key={i} className="relative inline-block h-4 w-4">
            <Star className="h-4 w-4 text-amber-400/20" />
            <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
              <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
            </span>
          </span>
        );
      })}
    </div>
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

// ─── Feature Bento Card (hover lift + cursor-following glow) ─────────────────

function BentoCard({
  className,
  children,
  gradient = false,
}: {
  className?: string;
  children: React.ReactNode;
  gradient?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [spot, setSpot] = useState({ x: 50, y: 50, visible: false });

  const onMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    setSpot({
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
      visible: true,
    });
  };

  return (
    <div
      ref={ref}
      onMouseMove={onMouseMove}
      onMouseLeave={() => setSpot((s) => ({ ...s, visible: false }))}
      className={cn(
        "group relative rounded-2xl border border-border bg-background p-5 overflow-hidden",
        "transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-2xl hover:shadow-primary/10 hover:border-primary/40",
        gradient && "bg-gradient-to-br from-primary/5 to-primary/0",
        className,
      )}
    >
      {/* Radial glow that follows the cursor */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 transition-opacity duration-300"
        style={{
          opacity: spot.visible ? 1 : 0,
          background: `radial-gradient(380px circle at ${spot.x}% ${spot.y}%, hsl(var(--primary) / 0.09), transparent 45%)`,
        }}
      />
      <div className="relative z-[1] h-full">{children}</div>
    </div>
  );
}

// ─── Browser-framed Dashboard Preview (visual proof under the hero) ──────────

/** Shared browser chrome — traffic lights, URL pill, LIVE badge. */
function BrowserChrome({ t }: { t: (key: string) => string }) {
  return (
    <div className="flex items-center gap-3 px-4 sm:px-5 py-3 border-b border-border bg-muted/30">
      <div className="flex gap-1.5" aria-hidden>
        <span className="w-3 h-3 rounded-full bg-red-400/90" />
        <span className="w-3 h-3 rounded-full bg-amber-400/90" />
        <span className="w-3 h-3 rounded-full bg-emerald-400/90" />
      </div>
      <div className="flex-1 max-w-xl mx-auto flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg bg-background/80 border border-border/70 text-[11px] text-muted-foreground font-mono truncate">
        <Lock className="h-3 w-3 text-primary shrink-0" />
        {t("preview.url")}
      </div>
      <span
        className="hidden sm:inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold"
        aria-hidden
      >
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        {t("hero.terminal.connected").replace("● ", "")}
      </span>
    </div>
  );
}

/** DOM fallback mockup — bento-styled cards + the real RevenueChart. */
function DashboardPreviewMock({ t }: { t: (key: string) => string }) {
  const kpis = [
    { labelKey: "preview.kpiRevenue", value: "$284.7k", delta: "+12.5%" },
    { labelKey: "preview.kpiOrders", value: "1,847", delta: "+8.3%" },
    { labelKey: "preview.kpiCustomers", value: "892", delta: "+15.2%" },
    { labelKey: "preview.kpiProducts", value: "156", delta: "+5.1%" },
  ];

  return (
    <div className="rounded-2xl sm:rounded-3xl border border-border bg-background overflow-hidden shadow-[0_30px_90px_-20px_rgba(0,0,0,0.35)] dark:shadow-[0_30px_90px_-20px_rgba(0,0,0,0.8)]">
      <BrowserChrome t={t} />

      {/* Dashboard body */}
      <div className="p-4 sm:p-6 space-y-4 bg-background">
        {/* KPI cards — bento-styled: backgound surface, primary ring on hover */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {kpis.map((kpi) => (
            <div
              key={kpi.labelKey}
              className="rounded-xl border border-border bg-background p-3 sm:p-4 transition-colors hover:border-primary/40"
            >
              <p className="text-[10px] text-muted-foreground font-medium truncate">
                {t(kpi.labelKey)}
              </p>
              <p className="text-lg sm:text-2xl font-bold text-foreground mt-1 tracking-tight">
                {kpi.value}
              </p>
              <p className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mt-1">
                <TrendingUp className="h-3 w-3" /> {kpi.delta}
              </p>
            </div>
          ))}
        </div>

        {/* Real RevenueChart + recent orders */}
        <div className="grid lg:grid-cols-5 gap-3 sm:gap-4">
          <div className="lg:col-span-3 rounded-xl border border-border bg-background p-4">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div>
                <p className="text-[10px] text-muted-foreground">{t("bento.revenueEyebrow")}</p>
                <p className="text-sm font-bold text-foreground">{t("bento.monthlyLegend")}</p>
              </div>
              <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                {t("bento.liveLegend")}
              </span>
            </div>
            <RevenueChart data={REVENUE_DATA} height={170} />
          </div>

          <div className="lg:col-span-2 rounded-xl border border-border bg-background p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-bold text-foreground">{t("demoOrders.title")}</p>
              <span className="text-[10px] font-semibold text-primary">{t("bento.viewAll")}</span>
            </div>
            <div className="space-y-3">
              {DEMO_ORDERS.slice(0, 3).map((order) => (
                <div key={order.id} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
                      {order.customer
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold text-foreground truncate">
                        {order.customer}
                      </p>
                      <p className="text-[9px] text-muted-foreground truncate">
                        {order.id} · {order.channel}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span
                      className={cn(
                        "text-[9px] font-semibold px-1.5 py-0.5 rounded-full",
                        STATUS_COLOR[order.status],
                      )}
                    >
                      {t(`orderStatus.${order.status}`)}
                    </span>
                    <p className="text-[10px] font-bold text-foreground mt-0.5">${order.amount}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* API status strip */}
        <div className="flex items-center justify-between gap-3 px-1 pt-1">
          <span className="text-[10px] text-muted-foreground font-mono hidden sm:inline">
            GET /api/v1/orders → 200 OK · 12ms
          </span>
          <span className="text-[10px] text-muted-foreground font-mono">
            SSE · order.completed · webhook ✓
          </span>
        </div>
      </div>
    </div>
  );
}

/** Live OG capture of the dashboard — served from /api/og/dashboard. */
function DashboardOgFrame({ t, onError }: { t: (key: string) => string; onError: () => void }) {
  return (
    <div className="rounded-2xl sm:rounded-3xl border border-border bg-background overflow-hidden shadow-[0_30px_90px_-20px_rgba(0,0,0,0.35)] dark:shadow-[0_30px_90px_-20px_rgba(0,0,0,0.8)]">
      <BrowserChrome t={t} />
      {/* eslint-disable-next-line @next/next/no-img-element -- the OG capture is a generated PNG served by our own route */}
      <img
        src="/api/og/dashboard"
        alt={t("preview.t1")}
        width={1200}
        height={630}
        onError={onError}
        className="block h-auto w-full"
      />
    </div>
  );
}

/** Only mounts its heavy children once the frame nears the viewport. */
function LazyFrame({
  children,
  minHeight = 560,
}: {
  children: React.ReactNode;
  minHeight?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: "320px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} style={{ minHeight }}>
      {inView ? (
        children
      ) : (
        <div
          aria-hidden
          className="rounded-2xl sm:rounded-3xl border border-border bg-background overflow-hidden"
        >
          <div className="h-12 border-b border-border bg-muted/30" />
          <div className="p-5 space-y-4 animate-pulse">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-20 rounded-xl bg-muted/60" />
              ))}
            </div>
            <div className="h-44 rounded-xl bg-muted/60" />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Cinematic Preloader ─────────────────────────────────────────────────────

const PRELOADER_SEEN_KEY = "dashboard-preloader-seen";

function CinematicPreloader({ t, onDone }: { t: (key: string) => string; onDone: () => void }) {
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Completing the boot (naturally, via Skip, or reduced-motion) is remembered
  // so returning visitors land straight on the hero.
  const markSeen = useCallback(() => {
    try {
      window.localStorage.setItem(PRELOADER_SEEN_KEY, "1");
    } catch {
      // storage unavailable — just play it again next time
    }
  }, []);

  // Jump straight to the end (content never blocked for reduced-motion users).
  const finish = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setProgress(100);
    markSeen();
    onDone();
  }, [markSeen, onDone]);

  useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduced) {
      // Near-instant boot: one tick so the 100% state is announced, then reveal.
      const fast = setTimeout(finish, 120);
      return () => clearTimeout(fast);
    }

    const steps = 30;
    let value = 0;
    timerRef.current = setInterval(() => {
      value += 100 / steps;
      if (value >= 100) {
        setProgress(100);
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        markSeen();
        onDone();
      } else {
        setProgress(Math.round(value));
      }
    }, 60);
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [finish, onDone]);

  return (
    <motion.div
      exit={{ opacity: 0, scale: 1.04 }}
      transition={{ duration: 0.55, ease: easeSmooth }}
      className="fixed inset-0 z-[999] bg-[#0b0c11] text-white flex flex-col items-center justify-center gap-6 px-6"
      role="status"
      aria-label={t("preloader.label")}
    >
      {/* Skip — lets any visitor (e.g. keyboard users) bypass the boot sequence */}
      <button
        onClick={finish}
        className="absolute top-4 right-4 z-10 px-3.5 py-1.5 rounded-full border border-white/15 bg-white/5 text-xs font-semibold text-white/80 hover:bg-white/15 hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer"
      >
        {t("preloader.skip")}
      </button>

      {/* Ambient glow */}
      <div
        aria-hidden
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] h-[520px] rounded-full bg-primary/15 blur-[130px] pointer-events-none"
      />

      {/* Orbit ring + brand mark (spin is disabled under prefers-reduced-motion) */}
      <div className="relative w-24 h-24" aria-hidden>
        <div
          className="absolute inset-0 rounded-full border border-primary/30 border-t-primary animate-spin motion-reduce:animate-none"
          style={{ animationDuration: "1.6s" }}
        />
        <div
          className="absolute inset-2 rounded-full border border-white/10 border-b-sky-400/60 animate-spin motion-reduce:animate-none"
          style={{ animationDuration: "2.4s", animationDirection: "reverse" }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-sky-400 flex items-center justify-center shadow-lg shadow-primary/30">
            <Zap className="h-6 w-6 text-white" />
          </div>
        </div>
      </div>

      <div className="text-center relative">
        <p className="text-sm font-semibold tracking-wide">{t("preloader.label")}</p>
        <p className="text-xs text-muted-foreground mt-1.5 font-mono">{t("preloader.status")}</p>
      </div>

      {/* Progress bar + counter */}
      <div className="w-56 relative">
        <div className="h-1 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary to-sky-400 rounded-full transition-[width] duration-150 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-right text-[11px] font-mono text-muted-foreground mt-2 tabular-nums">
          {String(progress).padStart(3, "0")}%
        </p>
      </div>
    </motion.div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MarketingPage({ params }: { params: Promise<{ locale: string }> }) {
  const t = useTranslations("homepage");
  const { locale } = use(params);
  const [isAnnual, setIsAnnual] = useState(false);

  // Cinematic boot sequence: the preloader plays on the first visit, then the
  // hero reveals. Returning visitors (flag already set) go straight to content.
  const [booted, setBooted] = useState(false);
  const [ogFailed, setOgFailed] = useState(false);
  const handleBoot = useCallback(() => setBooted(true), []);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(PRELOADER_SEEN_KEY) === "1") {
        setBooted(true);
      }
    } catch {
      // storage unavailable — play the sequence
    }
  }, []);

  // Gentle float parallax for the dashboard preview frame while scrolling
  const previewWrapRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: previewWrapRef,
    offset: ["start end", "end start"],
  });
  const previewFloatY = useTransform(scrollYProgress, [0, 1], [44, -44]);

  return (
    <div className="bg-zinc-50 dark:bg-[#0b0c11] text-zinc-900 dark:text-zinc-100 overflow-x-hidden">
      {/* ── Cinematic preloader overlay (fades out once booted) ── */}
      <AnimatePresence>
        {!booted && <CinematicPreloader t={t} onDone={handleBoot} />}
      </AnimatePresence>

      {/* ───────────────────── OVERVIEW HERO HUB (SIGNAL STRIP) ───────────────────── */}
      <HeroOverview locale={locale} t={t} revealed={booted} />

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
                    <intg.Icon
                      size={Math.round(16 * (intg.iconScale ?? 1))}
                      style={{ color: intg.color }}
                      className="shrink-0"
                    />
                    {!intg.lockup && <span className="text-foreground">{intg.name}</span>}
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

      {/* ──────── DASHBOARD PRODUCT PREVIEW (browser-framed mockup) ──────── */}
      <section
        ref={previewWrapRef}
        id="preview"
        className="relative scroll-mt-24 px-4 sm:px-6 lg:px-12 py-16 sm:py-24 max-w-7xl mx-auto"
      >
        {/* Ambient glow behind the frame */}
        <div
          aria-hidden
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[520px] rounded-full bg-primary/10 blur-[120px] pointer-events-none"
        />

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.15 }}
          transition={{ duration: 0.6, ease: easeSmooth }}
          className="text-center mb-12 relative"
        >
          <p className="text-primary text-sm font-semibold uppercase tracking-widest mb-3">
            {t("preview.badge")}
          </p>
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-foreground mb-4">
            {t("preview.t1")}
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">{t("preview.sub")}</p>
        </motion.div>

        <motion.div style={{ y: previewFloatY }} className="relative will-change-transform">
          <motion.div
            initial={{ opacity: 0, y: 56, scale: 0.97 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true, amount: 0.15 }}
            transition={{ duration: 0.85, ease: easeSmooth }}
          >
            <LazyFrame minHeight={560}>
              {ogFailed ? (
                <DashboardPreviewMock t={t} />
              ) : (
                <DashboardOgFrame t={t} onError={() => setOgFailed(true)} />
              )}
            </LazyFrame>
          </motion.div>

          {/* Floating CTA chip */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.35, duration: 0.5, ease: easeSmooth }}
            className="absolute -bottom-5 left-1/2 -translate-x-1/2"
          >
            <Link
              href={`/${locale}/login`}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-foreground text-background dark:bg-white dark:text-zinc-950 text-sm font-semibold shadow-xl hover:shadow-primary/30 hover:scale-105 active:scale-95 transition-all duration-300 whitespace-nowrap"
            >
              {t("preview.cta")} <ArrowRight className="h-4 w-4" />
            </Link>
          </motion.div>
        </motion.div>
      </section>

      {/* ──────── SCROLL-DRIVEN PRODUCT STORY (cosmos → control room) ──────── */}
      <ProductStory locale={locale} t={t} id="story" />

      {/* ──────── BENTO GRID ──────── */}
      <section id="features" className="px-4 sm:px-6 lg:px-12 py-12 max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.15 }}
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
            custom={0}
            variants={bentoEntrance}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.15 }}
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
            custom={1}
            variants={bentoEntrance}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.15 }}
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
            custom={2}
            variants={bentoEntrance}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.15 }}
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
            custom={3}
            variants={bentoEntrance}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.15 }}
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
            custom={4}
            variants={bentoEntrance}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.15 }}
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
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-white shrink-0"
                      style={{ background: gw.color }}
                    >
                      {gw.name === "Stripe" ? (
                        <StripeBrandIcon size={13} className="text-white" />
                      ) : (
                        <MidtransBrandIcon size={13} className="text-white" />
                      )}
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
            custom={5}
            variants={bentoEntrance}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.15 }}
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
            custom={6}
            variants={bentoEntrance}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.15 }}
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
            custom={7}
            variants={bentoEntrance}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.15 }}
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
                    {intg.lockup ? (
                      <intg.Icon size={13} className="mb-1.5" style={{ color: intg.color }} />
                    ) : (
                      <intg.Icon
                        size={Math.round(20 * (intg.iconScale ?? 1))}
                        className="mb-1.5 group-hover:scale-110 transition-transform"
                        style={{ color: intg.color }}
                      />
                    )}
                    {!intg.lockup && (
                      <p className="text-[11px] font-semibold text-foreground group-hover:text-primary transition">
                        {intg.name}
                      </p>
                    )}
                    <p className="text-[9px] text-muted-foreground">{t(intg.descKey)}</p>
                  </div>
                ))}
              </div>
            </BentoCard>
          </motion.div>

          {/* ── API / Webhooks (4 cols) */}
          <motion.div
            custom={8}
            variants={bentoEntrance}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.15 }}
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
            custom={9}
            variants={bentoEntrance}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.15 }}
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
            viewport={{ once: true, amount: 0.15 }}
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
            viewport={{ once: true, amount: 0.15 }}
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
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.15 }}
            transition={{ duration: 0.6, ease: easeSmooth }}
            className="text-center mb-8"
          >
            <p className="text-primary text-sm font-semibold uppercase tracking-widest mb-3">
              {t("plans.badge")}
            </p>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-foreground mb-4">
              {t("plans.t1")}
            </h2>
            <p className="text-muted-foreground text-lg">{t("plans.sub")}</p>
          </motion.div>

          {/* Billing toggle */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.15 }}
            transition={{ duration: 0.5, ease: easeSmooth }}
            className="flex justify-center mb-10"
          >
            <div className="inline-flex items-center gap-2 p-1.5 rounded-full bg-background border border-border shadow-sm">
              <button
                onClick={() => setIsAnnual(false)}
                className={cn(
                  "px-5 py-2 text-sm font-medium rounded-full transition-colors cursor-pointer",
                  !isAnnual
                    ? "bg-foreground text-background shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t("plans.monthly")}
              </button>
              <button
                onClick={() => setIsAnnual(true)}
                className={cn(
                  "px-5 py-2 text-sm font-medium rounded-full transition-colors inline-flex items-center gap-1.5 cursor-pointer",
                  isAnnual
                    ? "bg-foreground text-background shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t("plans.yearly")}
                <span
                  className={cn(
                    "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide",
                    isAnnual
                      ? "bg-emerald-500/20 text-emerald-300"
                      : "bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                  )}
                >
                  {t("plans.yearlyDiscount")}
                </span>
              </button>
            </div>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6 items-stretch">
            {HOME_PLANS.map((plan, i) => {
              const price = isAnnual ? plan.yearly : plan.monthly;
              const ctaHref =
                plan.key === "enterprise" ? `/${locale}/contact` : `/${locale}/register`;

              return (
                <motion.div
                  key={plan.key}
                  initial={{
                    opacity: 0,
                    y: i === 1 ? 28 : 0,
                    x: i === 0 ? -48 : i === 2 ? 48 : 0,
                    scale: i === 1 ? 0.95 : 1,
                  }}
                  whileInView={{ opacity: 1, y: 0, x: 0, scale: 1 }}
                  viewport={{ once: true, amount: 0.15 }}
                  transition={{ duration: 0.6, ease: easeSmooth }}
                  className={cn(
                    "rounded-2xl p-8 flex flex-col relative overflow-hidden border",
                    plan.popular
                      ? "bg-foreground text-background border-transparent shadow-2xl shadow-primary/10 md:-my-4"
                      : "border-border bg-background text-foreground",
                  )}
                >
                  {plan.popular && (
                    <div className="absolute top-0 right-0 w-52 h-52 bg-primary/30 rounded-full blur-3xl -mr-12 -mt-12 pointer-events-none" />
                  )}
                  <div className="relative z-10 flex flex-col flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xl font-bold mb-1">{t(plan.nameKey)}</h3>
                      {plan.popular && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wide mb-1">
                          <Sparkles className="h-3 w-3" /> {t("plans.popular")}
                        </span>
                      )}
                    </div>
                    <div className="flex items-baseline gap-1 mb-1">
                      <span className="text-4xl font-bold tracking-tight">${price}</span>
                      <span
                        className={cn(
                          "font-medium",
                          plan.popular ? "opacity-60" : "text-muted-foreground",
                        )}
                      >
                        {t("plans.month")}
                      </span>
                    </div>
                    <p
                      className={cn(
                        "text-sm mb-6 pb-6 border-b",
                        plan.popular
                          ? "opacity-70 border-white/20"
                          : "text-muted-foreground border-border",
                      )}
                    >
                      {t(plan.descKey)}
                    </p>
                    <ul className="space-y-3 mb-8 flex-1">
                      {plan.featureKeys.map((fk) => (
                        <li key={fk} className="flex items-center gap-3 text-sm">
                          <Check
                            className={cn(
                              "h-4 w-4 flex-shrink-0",
                              plan.popular ? "text-primary" : "text-primary",
                            )}
                          />
                          <span>{t(fk)}</span>
                        </li>
                      ))}
                    </ul>
                    <Link
                      href={ctaHref}
                      className={cn(
                        "w-full py-3 rounded-full text-sm font-semibold text-center transition",
                        plan.popular
                          ? "bg-white text-gray-900 hover:bg-gray-100"
                          : "bg-foreground text-background hover:opacity-90",
                      )}
                    >
                      {t(plan.ctaKey)}
                    </Link>
                  </div>
                </motion.div>
              );
            })}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.15 }}
            transition={{ duration: 0.5, ease: easeSmooth }}
            className="mt-10 flex flex-col sm:flex-row items-center justify-between gap-4 p-5 rounded-2xl border border-border bg-muted/50"
          >
            <p className="text-sm text-foreground font-medium text-center sm:text-left">
              {t("plans.entQ")}
            </p>
            <div className="flex items-center gap-6 shrink-0">
              <Link
                href={`/${locale}/pricing#comparison`}
                className="text-sm font-semibold text-primary hover:underline flex items-center gap-1"
              >
                {t("plans.compare")} <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <Link
                href={`/${locale}/contact`}
                className="text-sm font-semibold text-foreground hover:text-primary transition-colors flex items-center gap-1"
              >
                {t("plans.entContact")}
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ──────── TESTIMONIALS (auto-scrolling carousel) ──────── */}
      <section className="py-20 max-w-7xl mx-auto overflow-hidden">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.15 }}
          transition={{ duration: 0.6, ease: easeSmooth }}
          className="text-center mb-12 px-4"
        >
          <p className="text-primary text-sm font-semibold uppercase tracking-widest mb-3">
            {t("stories.badge")}
          </p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
            {t("stories.title")}
          </h2>
        </motion.div>

        <div className="relative [perspective:1200px]">
          <div className="relative overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_6%,black_94%,transparent)]">
            {/* Two copies of the track → the -50% keyframe loops seamlessly */}
            <div className="flex w-max gap-6 pr-6 animate-[hero-marquee_46s_linear_infinite] motion-reduce:animate-none hover:[animation-play-state:paused]">
              {[...TESTIMONIALS, ...TESTIMONIALS].map((tm, i) => (
                <motion.div
                  key={`${tm.name}-${i}`}
                  custom={i}
                  variants={testimonialEntrance}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, amount: 0.15 }}
                  className="group relative w-[340px] sm:w-[380px] shrink-0 rounded-2xl border border-border bg-background p-6 flex flex-col gap-4 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
                >
                  {/* Decorative quote mark */}
                  <Quote
                    aria-hidden
                    className="absolute top-5 right-5 h-9 w-9 text-primary/10 group-hover:text-primary/25 transition-colors"
                  />
                  <StarRating value={tm.stars} />
                  <p className="text-sm text-muted-foreground leading-relaxed flex-1">
                    &ldquo;{t(tm.quoteKey)}&rdquo;
                  </p>
                  <div className="flex items-center gap-3 pt-1 border-t border-border/60">
                    <div
                      className={cn(
                        "w-11 h-11 rounded-full bg-gradient-to-br flex items-center justify-center text-xs font-bold text-white shadow-md ring-2 ring-background shrink-0",
                        tm.gradient,
                      )}
                    >
                      {tm.avatar}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{tm.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{t(tm.roleKey)}</p>
                    </div>
                    <SalesChannelIcon
                      name={tm.company}
                      size={18}
                      className="opacity-50 group-hover:opacity-100 transition-opacity shrink-0"
                    />
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ──────── FOOTER CTA ──────── */}
      <section className="px-4 sm:px-6 lg:px-12 pb-12 max-w-4xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 28, scale: 0.94 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, amount: 0.15 }}
          transition={{ duration: 0.7, ease: easeSmooth }}
          className="rounded-3xl bg-foreground text-background p-12 relative overflow-hidden"
        >
          {/* Breathing glow behind the CTA */}
          <motion.div
            aria-hidden
            animate={{ opacity: [0.35, 0.7, 0.35], scale: [1, 1.12, 1] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -top-28 left-1/2 -translate-x-1/2 w-[560px] h-72 bg-primary/40 rounded-full blur-3xl pointer-events-none"
          />
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
