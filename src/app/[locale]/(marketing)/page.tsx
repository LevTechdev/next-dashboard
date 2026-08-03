"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAnalytics } from "@/hooks/use-analytics";
import { motion, useMotionValue, AnimatePresence } from "framer-motion";
import { useTheme } from "next-themes";
import { useEffect, useState, useRef, useCallback } from "react";
import { ActivityIcon, RefreshCwIcon, BellIcon, ClockIcon } from "lucide-animated";
import {
  ArrowRight,
  BarChart3,
  ShoppingCart,
  Users,
  Shield,
  Sparkles,
  TrendingUp,
  Zap,
  Star,
  Layers,
  LineChart,
  CheckCircle2,
  ArrowUpRight,
  Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { RadialGlowButton } from "@/components/ui/radial-glow-button";
import { cn } from "@/lib/utils";
import { AnimateSection, AnimateUp, buttonTap } from "@/components/motion";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { AnimatedRays } from "@/components/ui/animated-rays";
import { AnimatedGridPattern } from "@/components/ui/animated-grid-pattern";
import { FlipFadeText } from "@/components/ui/flip-fade-text";
import { LogoSlider } from "@/components/ui/logo-slider";
import { Particles } from "@/components/ui/particles";

// ─── Spring presets ────────────────────────────────────────────────────────
const springGentle = { type: "spring" as const, stiffness: 100, damping: 20 };
const springSnap = { type: "spring" as const, stiffness: 200, damping: 15 };
const easeSmooth = [0.16, 1, 0.3, 1] as const;

// ─── Magnetic button ───────────────────────────────────────────
function MagneticButton({
  children,
  className,
  href,
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  href: string;
  onClick?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const rect = ref.current?.getBoundingClientRect();
      if (!rect) return;
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      x.set((e.clientX - cx) * 0.3);
      y.set((e.clientY - cy) * 0.3);
    },
    [x, y],
  );

  const handleMouseLeave = useCallback(() => {
    x.set(0);
    y.set(0);
  }, [x, y]);

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ x, y }}
      whileTap={{ scale: 0.97 }}
      whileHover={{ scale: 1.03 }}
      transition={springGentle}
    >
      <RadialGlowButton asChild className={className}>
        <Link href={href} onClick={onClick}>
          {children}
        </Link>
      </RadialGlowButton>
    </motion.div>
  );
}

// ─── Partner Logos ─────────────────────────────────────────────
const partnerLogos = [
  <svg key="stripe" viewBox="0 0 100 32" fill="currentColor">
    <path d="M16.2 11.3c0-1.2.8-1.7 2-1.7.6 0 1.2.1 1.9.3V6.9c-.7-.2-1.4-.3-2.1-.3-3.3 0-5.5 1.8-5.5 4.8 0 4.7 6.4 3.9 6.4 6 0 1.4-1 1.9-2.5 1.9-1.5 0-2.8-.4-4-1v3.5c1.2.3 2.4.5 3.6.5 3.8 0 6.3-1.8 6.3-5 0-5.3-6.1-4.3-6.1-6.1z" />
    <path d="M24.9 9.5l-.1 1.9c-.7-.9-1.7-1.4-2.8-1.4-2.6 0-4.6 2.4-4.6 5.3s2 5.3 4.6 5.3c1.1 0 2.1-.5 2.8-1.4l.1 1.2h3.3V9.5H24.9zm-.3 7.6c-.8 1-2 1.1-2.8.1-.4-.5-.6-1.2-.6-2 0-.7.2-1.4.6-1.9.8-1 2-1 2.8.1.4.5.6 1.2.6 1.9 0 .7-.2 1.4-.6 1.8z" />
    <path d="M36.6 9.5l-.1 1.9c-.7-.9-1.7-1.4-2.8-1.4-2.6 0-4.6 2.4-4.6 5.3s2 5.3 4.6 5.3c1.1 0 2.1-.5 2.8-1.4l.1 1.2h3.3V9.5H36.6zm-.3 7.6c-.8 1-2 1.1-2.8.1-.4-.5-.6-1.2-.6-2 0-.7.2-1.4.6-1.9.8-1 2-1 2.8.1.4.5.6 1.2.6 1.9 0 .7-.2 1.4-.6 1.8z" />
  </svg>,
  <svg key="shopify" viewBox="0 0 100 32" fill="currentColor">
    <path d="M23.5 6.7l-1.2-4.2c-.1-.4-.4-.6-.8-.5l-3.2.7c-.2-.5-.5-1-.9-1.4-.7-.6-1.5-.8-2.3-.6l-.3.1c-.1 0-.2 0-.2.1-1.4.3-2.4 1.3-2.9 2.8l-4.2.9c-.4.1-.7.4-.6.8l1.3 5.8c-1.1.5-1.8 1.4-1.8 2.5 0 .8.4 1.5 1.1 2.1-.4.2-.7.5-.9.9-.3.6-.3 1.3-.1 2.1.4 1.6 1.8 2.7 3.8 2.7 2.3 0 4.2-1.3 5.5-3.7l5.5-1.2c.4-.1.7-.4.6-.8l-.9-3.9z" />
  </svg>,
  <svg key="slack" viewBox="0 0 100 32" fill="currentColor">
    <path d="M12.5 3.2c-1.5 0-2.7 1.2-2.7 2.7s1.2 2.7 2.7 2.7h2.7V5.9c0-1.5-1.2-2.7-2.7-2.7zm0 7.2H5.9c-1.5 0-2.7 1.2-2.7 2.7s1.2 2.7 2.7 2.7h6.6c1.5 0 2.7-1.2 2.7-2.7s-1.2-2.7-2.7-2.7z" />
    <path d="M29.3 10.4c-1.5 0-2.7 1.2-2.7 2.7s1.2 2.7 2.7 2.7 2.7-1.2 2.7-2.7-1.2-2.7-2.7-2.7zm-7.2 0H15.5c-1.5 0-2.7 1.2-2.7 2.7s1.2 2.7 2.7 2.7h6.6c1.5 0 2.7-1.2 2.7-2.7s-1.2-2.7-2.7-2.7z" />
  </svg>,
  <svg key="posthog" viewBox="0 0 100 32" fill="currentColor">
    <path d="M12.5 5.5L8.2 9.8l-3-3L9.5 2.5c.4-.4 1-.4 1.4 0l1.6 1.6V5.5zm3.5 3.5l-4.3 4.3h2.8l4.3-4.3H16zm6.3 0l3.5 3.5c.4.4.4 1 0 1.4l-8.5 8.5L12.8 17l6.7-6.7 1.4-1.4H22.3zm-8.5 8.5l-1.4 1.4-2.8-2.8 1.4-1.4 2.8 2.8zm-4.2 4.2L6.1 19l4.3-4.3v-2.8L2.5 21.5c-.4.4-.4 1 0 1.4l1.6 1.6h10.2l1.8-1.8-4.2-4.2z" />
  </svg>,
];

// ─── Feature card with 21st.dev premium spotlight effect ────────
interface FeatureCardProps {
  title: string;
  description: string;
  icon: React.ElementType;
  className?: string;
  iconColor: string;
  borderColor: string;
  bgGradient: string;
  glowColor: string;
  tag: string;
  index: number;
  learnMoreLabel: string;
}

function FeatureCard({
  title,
  description,
  icon: Icon,
  className,
  iconColor,
  borderColor,
  bgGradient,
  glowColor,
  tag,
  index,
  learnMoreLabel,
}: FeatureCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.div
      initial={false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, delay: index * 0.12, ...springGentle }}
      className={cn(
        "spotlight-card vengeance-card relative p-7 lg:p-8 rounded-2xl border flex flex-col justify-between overflow-hidden group transition-all",
        className,
        borderColor,
        "bg-gradient-to-br",
        bgGradient,
      )}
      style={{ boxShadow: `0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02)` }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onPointerMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const px = ((e.clientX - rect.left) / rect.width) * 100;
        const py = ((e.clientY - rect.top) / rect.height) * 100;
        e.currentTarget.style.setProperty("--mouse-x", `${px}%`);
        e.currentTarget.style.setProperty("--mouse-y", `${py}%`);
      }}
    >
      {/* Hover glow overlay */}
      <motion.div
        className="absolute inset-0 pointer-events-none rounded-2xl"
        animate={{ opacity: isHovered ? 1 : 0 }}
        transition={{ duration: 0.5 }}
        style={{
          background: `radial-gradient(600px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), ${glowColor}, transparent 40%)`,
        }}
      />

      {/* Perpetual floating indicator */}
      <motion.div
        className="absolute top-3 right-3 w-1.5 h-1.5 rounded-full"
        animate={{
          scale: [1, 1.5, 1],
          opacity: [0.4, 0.8, 0.4],
        }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        style={{ backgroundColor: glowColor.replace("0.15)", "0.5)") }}
      />

      <div className="z-10 relative flex flex-col h-full">
        {/* Tag badge */}
        <div className="mb-3">
          <span className="badge-premium text-[10px]">{tag}</span>
        </div>

        {/* Icon with micro-interaction */}
        <motion.div
          className="feature-icon-wrap inline-flex p-2.5 rounded-xl bg-white/70 dark:bg-white/5 backdrop-blur-sm mb-4 border border-black/5 dark:border-white/5 w-fit transition-all"
          animate={{ y: isHovered ? -2 : 0 }}
          transition={springGentle}
        >
          <Icon size={20} className={cn("h-5 w-5", iconColor)} />
        </motion.div>

        {/* Content */}
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-2">{title}</h3>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-sm leading-relaxed flex-1">
          {description}
        </p>

        {/* Learn more arrow */}
        <motion.div
          className="flex items-center gap-1.5 mt-4 text-xs font-medium text-zinc-400 dark:text-zinc-500 transition-colors"
          animate={{ color: isHovered ? "#6366f1" : undefined }}
        >
          <span>{learnMoreLabel}</span>
          <motion.div animate={{ x: isHovered ? 4 : 0 }} transition={springGentle}>
            <ArrowRight className="h-3 w-3" />
          </motion.div>
        </motion.div>
      </div>

      {/* Subtle decorative gradient */}
      <div className="absolute bottom-0 right-0 w-32 h-32 bg-gradient-to-tl from-black/[0.02] dark:from-white/[0.02] to-transparent rounded-full pointer-events-none" />
    </motion.div>
  );
}

// ─── Infinite carousel metrics ──────────────────────────────────
function MetricsCarousel() {
  const t = useTranslations("homePage");
  const items = [
    { value: "12.4K", labelKey: "cOrders" },
    { value: "99.9%", labelKey: "cUptime" },
    { value: "2,847", labelKey: "cUsers" },
    { value: "15s", labelKey: "cRefresh" },
    { value: "47.2%", labelKey: "cGrowth" },
    { value: "8,431", labelKey: "cCustomers" },
  ];

  return (
    <div className="relative overflow-hidden py-8 border-t border-b border-border">
      <motion.div
        className="flex gap-16 items-center"
        animate={{ x: ["0%", "-50%"] }}
        transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
      >
        {[...items, ...items].map((item, i) => (
          <div key={i} className="flex items-center gap-4 shrink-0">
            <div className="text-right">
              <div className="text-2xl font-bold text-zinc-900 dark:text-white">{item.value}</div>
              <div className="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium uppercase tracking-wider">
                {t(item.labelKey)}
              </div>
            </div>
            <div className="w-px h-10 bg-zinc-200 dark:bg-zinc-800 last:hidden" />
          </div>
        ))}
      </motion.div>
    </div>
  );
}

// ─── Bento Grid: Live Status Card ───────────────────────────────
function LiveStatusCard() {
  const t = useTranslations("homePage");
  const statuses = [
    { name: "Stripe", statusKey: "statusLive", color: "text-emerald-500" },
    { name: "Shopify", statusKey: "statusLive", color: "text-emerald-500" },
    { name: "Slack", statusKey: "statusLive", color: "text-emerald-500" },
    { name: "SendGrid", statusKey: "statusActive", color: "text-emerald-500" },
  ];
  const [currentIdx, setCurrentIdx] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIdx((prev) => (prev + 1) % statuses.length);
    }, 2500);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="double-bezel h-full">
      <div className="double-bezel-inner flex flex-col">
        <div className="flex items-center gap-2 pb-3 border-b border-border mb-4">
          <div className="flex gap-1.5">
            <div className="w-2 h-2 rounded-full bg-rose-400/70" />
            <div className="w-2 h-2 rounded-full bg-amber-400/70" />
            <div className="w-2 h-2 rounded-full bg-emerald-400/70" />
          </div>
          <span className="text-[10px] font-mono text-zinc-400 dark:text-zinc-600 ml-2">
            system-status
          </span>
        </div>
        <div className="flex-1 space-y-3">
          {statuses.map((s) => (
            <div key={s.name} className="flex items-center justify-between">
              <span className="text-sm text-zinc-600 dark:text-zinc-300">{s.name}</span>
              <span className={cn("text-xs font-medium flex items-center gap-1.5", s.color)}>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                {t(s.statusKey)}
              </span>
            </div>
          ))}
        </div>
        {/* Rotating notification badge */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIdx}
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.9 }}
            transition={springSnap}
            className="mt-3 pt-3 border-t border-border"
          >
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                <Zap className="h-3 w-3 text-indigo-500" />
              </div>
              <div>
                <p className="text-xs font-medium text-zinc-700 dark:text-zinc-200">
                  {statuses[currentIdx].name} {t("connected")}
                </p>
                <p className="text-[10px] text-zinc-400 dark:text-zinc-500">{t("syncActive")}</p>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── Bento Grid: Growth Stats Card ──────────────────────────────
function GrowthStatsCard() {
  const t = useTranslations("homePage");
  const metrics = [
    {
      labelKey: "gRevenue",
      end: 89200,
      change: "+23.5%",
      up: true,
      format: (v: number) => `$${(v / 1000).toFixed(1)}K`,
    },
    {
      labelKey: "gOrders",
      end: 1847,
      change: "+14.2%",
      up: true,
      format: (v: number) => v.toLocaleString(),
    },
    {
      labelKey: "gConversion",
      end: 32,
      change: "+0.8%",
      up: true,
      format: (v: number) => `${(v / 10).toFixed(1)}%`,
    },
    {
      labelKey: "gAvgOrder",
      end: 4827,
      change: "-2.1%",
      up: false,
      format: (v: number) => `$${(v / 100).toFixed(2)}`,
    },
  ];

  return (
    <div className="double-bezel h-full">
      <div className="double-bezel-inner flex flex-col">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="h-4 w-4 text-emerald-500" />
          <h3 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
            {t("growthTitle")}
          </h3>
        </div>
        <div className="flex-1 space-y-3">
          {metrics.map((m) => (
            <div key={m.labelKey} className="flex items-center justify-between py-1.5">
              <span className="text-xs text-zinc-500 dark:text-zinc-400">{t(m.labelKey)}</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-zinc-800 dark:text-white font-mono">
                  <AnimatedCounter end={m.end} duration={1800} formatter={m.format} />
                </span>
                <span
                  className={cn(
                    "text-[10px] font-semibold",
                    m.up ? "text-emerald-500" : "text-rose-500",
                  )}
                >
                  {m.change}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Bento Grid: Intelligent List ───────────────────────────────
function IntelligentListCard() {
  const t = useTranslations("homePage");
  const items = [
    { id: 1, textKey: "q1", priority: 3 },
    { id: 2, textKey: "q2", priority: 1 },
    { id: 3, textKey: "q3", priority: 2 },
    { id: 4, textKey: "q4", priority: 4 },
    { id: 5, textKey: "q5", priority: 5 },
  ];
  const [sorted, setSorted] = useState(items);

  useEffect(() => {
    const timer = setInterval(() => {
      setSorted((prev) => {
        const shuffled = [...prev];
        const i = Math.floor(Math.random() * shuffled.length);
        const j = Math.floor(Math.random() * shuffled.length);
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        return shuffled;
      });
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="double-bezel h-full">
      <div className="double-bezel-inner flex flex-col">
        <div className="flex items-center gap-2 mb-4">
          <RefreshCwIcon size={16} className="h-4 w-4 text-indigo-500" />
          <h3 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
            {t("queueTitle")}
          </h3>
        </div>
        <div className="flex-1 space-y-2">
          <AnimatePresence mode="popLayout">
            {sorted.map((item) => (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={springGentle}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/30 border border-zinc-100 dark:border-zinc-800/40"
              >
                <div className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center shrink-0">
                  <span className="text-[9px] font-semibold text-indigo-600 dark:text-indigo-400">
                    {item.priority}
                  </span>
                </div>
                <span className="text-xs text-zinc-600 dark:text-zinc-300">{t(item.textKey)}</span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

// ─── Feature data ───────────────────────────────────────────────
const features = [
  {
    titleKey: "f1Title",
    descKey: "f1Desc",
    icon: BarChart3,
    className: "md:col-span-2 md:row-span-2",
    iconColor: "text-indigo-500 dark:text-indigo-400",
    borderColor: "border-indigo-200 dark:border-indigo-500/20",
    bgGradient:
      "from-indigo-50/80 via-white to-purple-50/50 dark:from-indigo-500/10 dark:to-purple-500/5",
    glowColor: "rgba(99,102,241,0.15)",
    tagKey: "f1Tag",
  },
  {
    titleKey: "f2Title",
    descKey: "f2Desc",
    icon: ShoppingCart,
    className: "",
    iconColor: "text-emerald-500 dark:text-emerald-400",
    borderColor: "border-emerald-200 dark:border-emerald-500/20",
    bgGradient: "from-emerald-50/60 to-white dark:from-emerald-500/5 dark:to-transparent",
    glowColor: "rgba(16,185,129,0.15)",
    tagKey: "f2Tag",
  },
  {
    titleKey: "f3Title",
    descKey: "f3Desc",
    icon: Users,
    className: "",
    iconColor: "text-purple-500 dark:text-purple-400",
    borderColor: "border-purple-200 dark:border-purple-500/20",
    bgGradient: "from-purple-50/60 to-white dark:from-purple-500/5 dark:to-transparent",
    glowColor: "rgba(168,85,247,0.15)",
    tagKey: "f3Tag",
  },
  {
    titleKey: "f4Title",
    descKey: "f4Desc",
    icon: Shield,
    className: "md:col-span-2",
    iconColor: "text-blue-500 dark:text-blue-400",
    borderColor: "border-blue-200 dark:border-blue-500/20",
    bgGradient: "from-blue-50/60 to-white dark:from-blue-500/5 dark:to-transparent",
    glowColor: "rgba(59,130,246,0.15)",
    tagKey: "f4Tag",
  },
];

const testimonials = [
  {
    quoteKey: "testi1Quote",
    name: "Sarah Chen",
    roleKey: "testi1Role",
  },
  {
    quoteKey: "testi2Quote",
    name: "Marcus Rivera",
    roleKey: "testi2Role",
  },
];

// ─── Stagger variants ───────────────────────────────────────────
const stagger = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.15 },
  },
};

const fadeUpItem = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: easeSmooth as any },
  },
};

// ─── Trusted by stats row ───────────────────────────────────────
const trustStats = [
  { icon: CheckCircle2, value: "2,000+", labelKey: "trustBusinesses" },
  { icon: Globe, value: "47", labelKey: "trustCountries" },
  { icon: ClockIcon, value: "99.9%", labelKey: "trustUptime" },
];

// ─── Main component ─────────────────────────────────────────────
export default function MarketingLandingPage() {
  const params = useParams();
  const locale = (params?.locale as string) || "en";
  const { theme } = useTheme();
  const { trackCTA } = useAnalytics();
  const t = useTranslations("homePage");
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const ctaHref = `/${locale}/dashboard`;

  return (
    <div className="pt-20 lg:pt-24">
      {/* ════════════════════════
          PREMIUM HERO with Particles + AnimatedRays + FlipFadeText
          ════════════════════════ */}
      <section className="relative overflow-hidden pb-16 lg:pb-24">
        {/* Particles background (21st.dev style) */}
        <Particles
          className="absolute inset-0 h-full w-full"
          quantity={80}
          size={0.4}
          staticity={40}
          ease={80}
          color={theme === "dark" ? "#6b7280" : "#6366f1"}
          refresh={false}
        />

        {/* AnimatedRays Background (Vengeance-style) */}
        <div className="absolute inset-0 h-[120%] opacity-30 dark:opacity-50">
          <AnimatedRays className="w-full h-full" />
        </div>

        {/* AnimatedGridPattern overlay */}
        <AnimatedGridPattern
          className="absolute inset-0 h-full w-full fill-gray-400/[0.03] stroke-gray-400/[0.04] dark:fill-white/[0.03] dark:stroke-white/[0.04]"
          numSquares={40}
          maxOpacity={0.08}
          duration={3}
          repeatDelay={1}
        />

        {/* Ambient background */}
        <div className="absolute inset-0 mesh-gradient-dark mesh-gradient-light pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 lg:pt-20">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* ── Left Content ── */}
            <motion.div initial={false} animate="visible" variants={stagger} className="max-w-2xl">
              <motion.div variants={fadeUpItem} className="mb-8">
                <div className="badge-premium inline-flex items-center gap-2">
                  <Sparkles className="h-3 w-3" />
                  <span>{t("badge")}</span>
                </div>
              </motion.div>

              <motion.h1
                variants={fadeUpItem}
                className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold tracking-tight leading-[1.05] mb-6 text-zinc-900 dark:text-white"
              >
                {t("heroPrefix")}&nbsp;
                {/* FlipFadeText for dynamic word cycling */}
                <span className="inline-flex">
                  <FlipFadeText
                    words={[t("word1"), t("word2"), t("word3"), t("word4")]}
                    interval={2800}
                    textClassName="!text-4xl sm:!text-5xl lg:!text-6xl xl:!text-7xl !text-transparent !bg-clip-text !bg-gradient-to-r !from-indigo-600 !via-purple-600 !to-pink-600 dark:!from-indigo-400 dark:!via-purple-400 dark:!to-pink-400 !font-bold !tracking-tight !leading-[1.05]"
                    className="!min-h-0 inline-flex"
                    staggerDelay={0.06}
                    letterDuration={0.4}
                  />
                </span>
              </motion.h1>

              <motion.p
                variants={fadeUpItem}
                className="text-base lg:text-lg text-zinc-500 dark:text-zinc-400 mb-10 max-w-lg leading-relaxed"
              >
                {t("heroSubtitle")}
              </motion.p>

              <motion.div
                variants={fadeUpItem}
                className="flex flex-col sm:flex-row items-start gap-3"
              >
                <MagneticButton
                  href={ctaHref}
                  onClick={() => trackCTA("enter_dashboard", { href: ctaHref })}
                  className="shadow-xl shadow-indigo-500/20"
                >
                  {t("ctaEnter")}
                  <ArrowRight className="h-4 w-4 inline-block align-middle ml-1.5" />
                </MagneticButton>

                <motion.div whileTap={buttonTap} whileHover={{ scale: 1.02 }}>
                  <RadialGlowButton asChild className="opacity-80 hover:opacity-100">
                    <Link
                      href={`/${locale}/features`}
                      onClick={() =>
                        trackCTA("view_documentation", { href: `/${locale}/features` })
                      }
                    >
                      {t("ctaDocs")}
                    </Link>
                  </RadialGlowButton>
                </motion.div>
              </motion.div>

              {/* Trust stats row */}
              <motion.div variants={fadeUpItem} className="mt-10 flex items-center gap-6">
                {trustStats.map((stat) => (
                  <div key={stat.labelKey} className="flex items-center gap-2">
                    <stat.icon size={16} className="h-4 w-4 text-indigo-500 dark:text-indigo-400" />
                    <div>
                      <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                        {stat.value}
                      </span>
                      <span className="text-xs text-zinc-400 dark:text-zinc-500 ml-1">
                        {t(stat.labelKey)}
                      </span>
                    </div>
                  </div>
                ))}
              </motion.div>
            </motion.div>

            {/* ── Right Visual ── */}
            <motion.div
              initial={false}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.3, ...springGentle }}
              className="relative"
            >
              <div className="double-bezel">
                <div className="double-bezel-inner !p-0 overflow-hidden">
                  {/* Fake OS window chrome */}
                  <div className="flex items-center gap-1.5 px-4 py-3 border-b border-border">
                    <div className="w-2.5 h-2.5 rounded-full bg-zinc-400 dark:bg-zinc-600" />
                    <div className="w-2.5 h-2.5 rounded-full bg-zinc-400 dark:bg-zinc-600" />
                    <div className="w-2.5 h-2.5 rounded-full bg-zinc-400 dark:bg-zinc-600" />
                    <span className="text-[10px] text-zinc-400 dark:text-zinc-500 ml-2 font-mono">
                      dashboard — Main Overview
                    </span>
                  </div>

                  {/* Mini dashboard content */}
                  <div className="p-5 space-y-5">
                    {/* Chart bars */}
                    <div className="flex items-end gap-2 h-28">
                      {[35, 65, 40, 80, 55, 75, 90, 60, 85, 50, 70, 45].map((h, i) => (
                        <motion.div
                          key={i}
                          className="w-full bg-gradient-to-t from-indigo-500/60 to-indigo-400/30 dark:from-indigo-500/60 dark:to-indigo-400/30 rounded-t-sm origin-bottom"
                          initial={false}
                          animate={{ scaleY: h / 100 }}
                          transition={{
                            duration: 1,
                            delay: 0.5 + i * 0.08,
                            ...springGentle,
                          }}
                        />
                      ))}
                    </div>

                    {/* Metric cards */}
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        {
                          labelKey: "mOrders",
                          end: 12400,
                          change: "+14%",
                          format: (v: number) => `${(v / 1000).toFixed(1)}K`,
                        },
                        {
                          labelKey: "mUsers",
                          end: 2847,
                          change: "+8.2%",
                          format: (v: number) => v.toLocaleString(),
                        },
                        {
                          labelKey: "mRevenue",
                          end: 89200,
                          change: "+23.5%",
                          format: (v: number) => `$${(v / 1000).toFixed(1)}K`,
                        },
                        {
                          labelKey: "mResponse",
                          end: 120,
                          change: "-40%",
                          format: (v: number) => `${(v / 100).toFixed(1)}s`,
                        },
                      ].map((metric, i) => (
                        <motion.div
                          key={metric.labelKey}
                          initial={false}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{
                            delay: 0.8 + i * 0.1,
                            duration: 0.5,
                            ease: easeSmooth as any,
                          }}
                          className="stat-card-premium !p-3.5"
                        >
                          <div className="text-[10px] text-zinc-500 dark:text-zinc-500 font-medium uppercase tracking-wider mb-1">
                            {t(metric.labelKey)}
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-lg font-bold text-zinc-800 dark:text-white tabular-nums">
                              <AnimatedCounter
                                end={metric.end}
                                duration={2000}
                                formatter={metric.format}
                              />
                            </span>
                            <span
                              className={cn(
                                "text-[10px] font-semibold",
                                metric.change.startsWith("+")
                                  ? "text-emerald-500 dark:text-emerald-400"
                                  : "text-rose-500 dark:text-rose-400",
                              )}
                            >
                              {metric.change}
                            </span>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ════════════════════════
          PARTNER LOGOS (LogoSlider)
          ════════════════════════ */}
      <AnimateSection>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <AnimateUp className="text-center mb-8">
            <p className="text-xs font-medium uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
              {t("partnersLabel")}
            </p>
          </AnimateUp>
          <LogoSlider
            logos={partnerLogos}
            speed={50}
            direction="left"
            showBlur={true}
            blurLayers={6}
            blurIntensity={0.8}
            pauseOnHover
          />
        </div>
      </AnimateSection>

      {/* ════════════════════════
          PERPETUAL METRICS CAROUSEL
          ════════════════════════ */}
      <MetricsCarousel />

      {/* ════════════════════════
          BENTO GRID FEATURES
          ════════════════════════ */}
      <AnimateSection className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimateUp className="max-w-2xl mb-16">
            <div className="badge-premium inline-flex items-center gap-2 mb-4">
              <ActivityIcon size={12} className="h-3 w-3" />
              <span>{t("featuresBadge")}</span>
            </div>
            <h2 className="text-3xl lg:text-4xl font-bold tracking-tight mb-4 text-zinc-900 dark:text-white">
              {t("featuresTitle")}
            </h2>
            <p className="text-zinc-500 dark:text-zinc-400 max-w-lg">{t("featuresSubtitle")}</p>
          </AnimateUp>

          <div className="bento-grid grid-cols-1 md:grid-cols-3 md:grid-rows-2 gap-4 lg:gap-5 auto-rows-[280px]">
            {features.map((feature, i) => (
              <FeatureCard
                key={feature.titleKey}
                title={t(feature.titleKey)}
                description={t(feature.descKey)}
                icon={feature.icon}
                className={feature.className}
                iconColor={feature.iconColor}
                borderColor={feature.borderColor}
                bgGradient={feature.bgGradient}
                glowColor={feature.glowColor}
                tag={t(feature.tagKey)}
                index={i}
                learnMoreLabel={t("learnMore")}
              />
            ))}
          </div>
        </div>
      </AnimateSection>

      {/* ════════════════════════
          BENTO 2.0: LIVE SYSTEM STATUS
          ════════════════════════ */}
      <AnimateSection className="py-16 bg-zinc-100 dark:bg-zinc-900/20 border-t border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimateUp className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-2xl lg:text-3xl font-bold tracking-tight mb-3 text-zinc-900 dark:text-white">
              {t("liveTitle")}
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">{t("liveSubtitle")}</p>
          </AnimateUp>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-5 auto-rows-[280px]">
            <div className="md:col-span-2">
              <LiveStatusCard />
            </div>
            <div>
              <GrowthStatsCard />
            </div>
            <div className="md:col-span-3">
              <IntelligentListCard />
            </div>
          </div>
        </div>
      </AnimateSection>

      {/* ════════════════════════
          TESTIMONIALS
          ════════════════════════ */}
      <AnimateSection className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimateUp className="text-center max-w-2xl mx-auto mb-12">
            <div className="badge-premium inline-flex items-center gap-2 mb-4 !bg-amber-500/10 !text-amber-600 !border-amber-200 dark:!border-amber-500/20 dark:!text-amber-400">
              <Star className="h-3 w-3" />
              <span>{t("testiBadge")}</span>
            </div>
            <h2 className="text-2xl lg:text-3xl font-bold tracking-tight mb-3 text-zinc-900 dark:text-white">
              {t("testiTitle")}
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">{t("testiSubtitle")}</p>
          </AnimateUp>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
            {testimonials.map((t2, i) => (
              <motion.div
                key={t2.name}
                initial={false}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  delay: i * 0.15,
                  duration: 0.6,
                  ease: easeSmooth as any,
                }}
                className="vengeance-card p-0.5"
              >
                <div className="rounded-[1.15rem] bg-white dark:bg-zinc-900 p-6">
                  <svg
                    className="h-6 w-6 text-zinc-300 dark:text-zinc-600 mb-4"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10H14.017zM0 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151C7.546 6.068 5.983 8.789 5.983 11H10v10H0z" />
                  </svg>
                  <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed mb-6">
                    &ldquo;{t(t2.quoteKey)}&rdquo;
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold">
                      {t2.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-zinc-900 dark:text-white">
                        {t2.name}
                      </div>
                      <div className="text-xs text-zinc-400 dark:text-zinc-500">
                        {t(t2.roleKey)}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </AnimateSection>

      {/* ════════════════════════
          PREMIUM CTA SECTION
          ════════════════════════ */}
      <AnimateSection className="py-24 lg:py-32 border-t border-border">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <motion.div
            className="gradient-border-card !rounded-[2rem] p-[1px]"
            whileHover={{ scale: 1.005 }}
            transition={{ duration: 0.3 }}
          >
            <div className="rounded-[calc(2rem-1px)] bg-white dark:bg-zinc-900 !py-16 px-8 relative overflow-hidden">
              {/* Ambient glow */}
              <div className="absolute inset-0 ambient-glow-indigo pointer-events-none" />
              <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-500/8 rounded-full blur-3xl pointer-events-none" />

              <div className="relative">
                <AnimateUp>
                  <h2 className="text-4xl lg:text-5xl font-bold tracking-tight text-zinc-900 dark:text-white mb-4">
                    {t("ctaTitle")}
                  </h2>
                  <p className="text-base lg:text-lg text-zinc-500 dark:text-zinc-400 mb-10 max-w-xl mx-auto leading-relaxed">
                    {t("ctaDesc")}
                  </p>
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                    <MagneticButton
                      href={ctaHref}
                      onClick={() => trackCTA("access_workspace", { href: ctaHref })}
                      className="shadow-xl shadow-indigo-500/25"
                    >
                      {t("ctaAccess")}
                      <ArrowRight className="h-4 w-4 inline-block align-middle ml-1.5" />
                    </MagneticButton>
                    <Link href={`/${locale}/contact`}>
                      <Button variant="outline" className="h-12 px-8 text-sm rounded-xl">
                        {t("ctaSales")}
                      </Button>
                    </Link>
                  </div>
                </AnimateUp>
              </div>
            </div>
          </motion.div>
        </div>
      </AnimateSection>
    </div>
  );
}
