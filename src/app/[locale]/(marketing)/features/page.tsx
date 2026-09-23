"use client";

import { use } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  BarChart3,
  ShoppingCart,
  Package,
  Shield,
  Globe,
  ArrowRight,
  Sparkles,
  LayoutGridIcon,
  QrCode,
  Landmark,
  RefreshCw,
  KeyRound,
  Fingerprint,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DiaTextReveal } from "@/components/sora-ui/texts/dia-text-reveal";
import { AnimatedHeading, AnimatedSubtitle } from "@/components/ui/animated-heading";
import { AnimatedCounter } from "@/components/ui/animated-counter";

const easeSmooth = [0.16, 1, 0.3, 1] as [number, number, number, number];

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
        "rounded-2xl border border-border bg-background p-5 overflow-hidden relative group transition-colors",
        gradient && "bg-gradient-to-br from-primary/5 to-primary/0",
        className,
      )}
    >
      {children}
    </div>
  );
}

// ─── Real platform numbers (mirrors the codebase, not marketing fluff) ───────
// 4 locales (en/id/ja/zh), 6 currencies, 50+ Indonesian banks, Code128 vector
// barcodes, ASPI QRIS NMID, SSE realtime, 40+ REST endpoints.
const PLATFORM_STATS = [
  { value: 4, suffix: "", labelKey: "stats.locales" },
  { value: 6, suffix: "", labelKey: "stats.currencies" },
  { value: 50, suffix: "+", labelKey: "stats.banks" },
  { value: 40, suffix: "+", labelKey: "stats.endpoints" },
];

const REALTIME_FEATURES = [
  { icon: RefreshCw, labelKey: "realtime.sse" },
  { icon: QrCode, labelKey: "realtime.qris" },
  { icon: Landmark, labelKey: "realtime.banks" },
  { icon: KeyRound, labelKey: "realtime.apiKeys" },
  { icon: Fingerprint, labelKey: "realtime.passkeys" },
  { icon: FileText, labelKey: "realtime.invoices" },
];

export default function FeaturesPage({ params }: { params: Promise<{ locale: string }> }) {
  const t = useTranslations("featuresPage");
  const { locale } = use(params);

  return (
    <div className="bg-zinc-50 dark:bg-[#0b0c11] text-zinc-900 dark:text-zinc-100 overflow-x-hidden min-h-screen">
      {/* ───────────────────── HERO ───────────────────── */}
      <section className="relative pt-24 pb-16 px-4 sm:px-6 lg:px-12 flex flex-col items-center text-center overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-primary/10 rounded-full blur-3xl" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: easeSmooth }}
          className="relative z-10"
        >
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-primary/30 bg-primary/5 text-primary text-xs font-semibold mb-6 shadow-sm">
            <Sparkles className="h-3.5 w-3.5" />
            {t("heroTag")}
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-[1.08] max-w-4xl mx-auto text-foreground">
            <AnimatedHeading text={t("heroPrefix")} delay={0.15} />
            <br className="hidden sm:block" />
            <span className="text-primary inline-flex">
              {/* Real hero copy, revealed by the chromatic sweep. */}
              <DiaTextReveal
                text={[t("heroWord1"), t("heroWord2"), t("heroWord3")]}
                repeat
                fixedWidth
                duration={1.1}
                holdDuration={1.9}
                colors={[
                  "hsl(var(--primary))",
                  "color-mix(in oklab, hsl(var(--primary)) 45%, #fff)",
                  "hsl(var(--primary))",
                ]}
                textColor="hsl(var(--primary))"
                className="text-4xl font-bold sm:text-5xl md:text-6xl"
              />
            </span>
          </h1>

          <p className="mt-5 text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            <AnimatedSubtitle text={t("heroSubtitle")} delay={0.45} />
          </p>
        </motion.div>
      </section>

      {/* ──────── PLATFORM NUMBERS (animated counters) ──────── */}
      <section className="px-4 sm:px-6 lg:px-12 pb-8 max-w-5xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {PLATFORM_STATS.map((stat, i) => (
            <motion.div
              key={stat.labelKey}
              initial={{ opacity: 0, y: 18, filter: "blur(4px)" }}
              whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.5, delay: i * 0.07, ease: easeSmooth }}
              className="stat-card-premium text-center"
            >
              <div className="text-3xl sm:text-4xl font-bold text-foreground tabular-nums tracking-tight">
                <AnimatedCounter end={stat.value} duration={1400} suffix={stat.suffix} />
              </div>
              <p className="mt-1.5 text-xs sm:text-sm text-muted-foreground font-medium">
                {t(stat.labelKey)}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ──────── CORE FEATURES ──────── */}
      {/* The marketing header's Features mega-menu deep-links to
          /features#analytics|security|automation|scale. Each id sits on the
          card closest to that menu item's meaning (dashboards/analytics,
          authentication/security, internationalization/global scale, and the
          developer API surface), so the links land on real content. */}
      <section className="px-4 sm:px-6 lg:px-12 py-12 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <motion.div
            id="analytics"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, delay: 0.1, ease: easeSmooth }}
            className="transition-transform duration-300 hover:-translate-y-1"
          >
            <BentoCard className="h-full">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110">
                <LayoutGridIcon className="h-5 w-5 text-blue-500" />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-2">
                {t("mainFeatures.dashboard.title")}
              </h3>
              <p className="text-sm text-muted-foreground">{t("mainFeatures.dashboard.desc")}</p>
            </BentoCard>
          </motion.div>

          <motion.div
            id="security"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, delay: 0.15, ease: easeSmooth }}
            className="transition-transform duration-300 hover:-translate-y-1"
          >
            <BentoCard className="h-full">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110">
                <ShoppingCart className="h-5 w-5 text-emerald-500" />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-2">
                {t("mainFeatures.auth.title")}
              </h3>
              <p className="text-sm text-muted-foreground">{t("mainFeatures.auth.desc")}</p>
            </BentoCard>
          </motion.div>

          <motion.div
            id="scale"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, delay: 0.2, ease: easeSmooth }}
            className="transition-transform duration-300 hover:-translate-y-1"
          >
            <BentoCard className="h-full">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110">
                <BarChart3 className="h-5 w-5 text-purple-500" />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-2">
                {t("mainFeatures.i18n.title")}
              </h3>
              <p className="text-sm text-muted-foreground">{t("mainFeatures.i18n.desc")}</p>
            </BentoCard>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, delay: 0.25, ease: easeSmooth }}
            className="transition-transform duration-300 hover:-translate-y-1"
          >
            <BentoCard className="h-full">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110">
                <Package className="h-5 w-5 text-amber-500" />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-2">{t("grid.items.0.title")}</h3>
              <p className="text-sm text-muted-foreground">{t("grid.items.0.desc")}</p>
            </BentoCard>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, delay: 0.3, ease: easeSmooth }}
            className="transition-transform duration-300 hover:-translate-y-1"
          >
            <BentoCard className="h-full">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110">
                <Shield className="h-5 w-5 text-rose-500" />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-2">{t("grid.items.1.title")}</h3>
              <p className="text-sm text-muted-foreground">{t("grid.items.1.desc")}</p>
            </BentoCard>
          </motion.div>

          <motion.div
            id="automation"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, delay: 0.35, ease: easeSmooth }}
            className="transition-transform duration-300 hover:-translate-y-1"
          >
            <BentoCard className="h-full">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110">
                <Globe className="h-5 w-5 text-cyan-500" />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-2">{t("grid.items.2.title")}</h3>
              <p className="text-sm text-muted-foreground">{t("grid.items.2.desc")}</p>
            </BentoCard>
          </motion.div>
        </div>
      </section>

      {/* ──────── REAL PLATFORM SURFACE (Indonesia-ready commerce strip) ──────── */}
      <section className="px-4 sm:px-6 lg:px-12 py-12 max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.15 }}
          transition={{ duration: 0.6, ease: easeSmooth }}
          className="text-center mb-10"
        >
          <p className="text-primary text-sm font-semibold uppercase tracking-widest mb-3">
            {t("surface.eyebrow")}
          </p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
            {t("surface.title")}
          </h2>
          <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">{t("surface.subtitle")}</p>
        </motion.div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {REALTIME_FEATURES.map((f, i) => {
            const Icon = f.icon;
            return (
              <motion.div
                key={f.labelKey}
                initial={{ opacity: 0, scale: 0.92 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.45, delay: i * 0.06, ease: easeSmooth }}
                whileHover={{ y: -4 }}
                className="flex flex-col items-center gap-2.5 rounded-2xl border border-border bg-background p-4 text-center transition-colors hover:border-primary/40"
              >
                <div className="p-2.5 rounded-xl bg-primary/10 text-primary transition-transform duration-300 group-hover:scale-110">
                  <Icon size={18} className="h-4.5 w-4.5" />
                </div>
                <p className="text-xs font-semibold text-foreground leading-tight">
                  {t(f.labelKey)}
                </p>
              </motion.div>
            );
          })}
        </div>

        {/* Developer CTA → API docs */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.15, ease: easeSmooth }}
          className="mt-8 flex justify-center"
        >
          <Link
            href={`/${locale}/docs/api`}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-border bg-background text-sm font-semibold text-foreground hover:border-primary/50 hover:text-primary transition-colors"
          >
            {t("surface.exploreApi")}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </motion.div>
      </section>

      {/* ──────── BOTTOM CTA ──────── */}
      <section className="px-4 sm:px-6 lg:px-12 py-24 max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: easeSmooth }}
          className="rounded-3xl bg-foreground text-background p-12 text-center relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">{t("ctaTitle")}</h2>
            <p className="text-base sm:text-lg opacity-80 max-w-2xl mx-auto mb-8">{t("ctaDesc")}</p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <Link
                href={`/${locale}/register`}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-background text-foreground text-sm font-semibold hover:opacity-90 transition"
              >
                {t("ctaButton")}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </motion.div>
      </section>
    </div>
  );
}
