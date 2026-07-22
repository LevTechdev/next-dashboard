"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useAnalytics } from "@/hooks/use-analytics";
import { motion, AnimatePresence } from "framer-motion";

import {
  Check,
  ArrowRight,
  X,
  Star,
  HelpCircle,
  BarChart3,
  Users,
  Globe,
  TrendingUp,
  Sparkles,
  Percent,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  AnimateSection,
  AnimateUp,
  buttonTap,
} from "@/components/motion";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { AnimatedRays } from "@/components/ui/animated-rays";
import { FlipFadeText } from "@/components/ui/flip-fade-text";
import { ShimmerButton } from "@/components/ui/shimmer-button";
import { AnimatedGridPattern } from "@/components/ui/animated-grid-pattern";
import { FaqAccordion, type FaqItem } from "@/components/ui/faq-accordion";

// ── Pricing Data ─────────────────────────────────────────────────────────
const PLAN_META = [
  {
    key: "starter",
    accent: "text-zinc-500 dark:text-zinc-300",
    gradient: "from-zinc-500/10 to-zinc-500/5",
    glowColor: "rgba(113,113,122,0.1)",
    monthly: 29,
    yearly: 23,
  },
  {
    key: "professional",
    popular: true,
    accent: "text-indigo-500 dark:text-indigo-400",
    gradient: "from-indigo-500/15 to-indigo-500/5",
    glowColor: "rgba(99,102,241,0.15)",
    monthly: 79,
    yearly: 63,
  },
  {
    key: "enterprise",
    accent: "text-purple-500 dark:text-purple-400",
    gradient: "from-purple-500/10 to-purple-500/5",
    glowColor: "rgba(168,85,247,0.1)",
    monthly: 199,
    yearly: 159,
  },
];

type FeatureEntry = string | { label: string; suffixKey: string };

const FEATURES_MAP: Record<string, { monthly: FeatureEntry[]; yearly: FeatureEntry[] }> = {
  starter: {
    monthly: [
      { label: "starterOrders", suffixKey: "featureOrders" },
      { label: "starterTeam", suffixKey: "featureTeam" },
      "featureAnalytics",
      "featureExport",
      "featureSupport",
    ],
    yearly: [
      { label: "starterOrders", suffixKey: "featureOrders" },
      { label: "starterTeam", suffixKey: "featureTeam" },
      "featureAnalytics",
      "featureExport",
      "featureSupport",
    ],
  },
  professional: {
    monthly: [
      { label: "proOrders", suffixKey: "featureOrders" },
      { label: "proTeam", suffixKey: "featureTeam" },
      "featureAdvancedAnalytics",
      "featurePrioritySupport",
      "featureMultiChannel",
      "featureReportsInsights",
      "featureRbacAll",
    ],
    yearly: [
      "proOrders",
      { label: "proTeam", suffixKey: "featureTeam" },
      "featureAdvancedAnalytics",
      "featurePrioritySupport",
      "featureMultiChannel",
      "featureReportsInsights",
      "featureRbacAll",
      "featureApi",
    ],
  },
  enterprise: {
    monthly: [
      "featureUnlimited",
      "featureTeamUnlimited",
      "featureAdvancedAnalytics",
      "featureDedicatedSupport",
      "featureMultiChannel",
      "featureReportsInsights",
      "featureAllRoles",
      "featureFullApi",
    ],
    yearly: [
      "featureUnlimited",
      "featureTeamUnlimited",
      "featureAdvancedAnalytics",
      "featureDedicatedSupport",
      "featureMultiChannel",
      "featureReportsInsights",
      "featureAllRoles",
      "featureFullApi",
      "featureCustomExports",
    ],
  },
};

// ── Feature Item ──────────────────────────────────────────────────────────
function FeatureItem({
  label,
  included,
  delay,
}: {
  label: string;
  included: boolean;
  delay: number;
}) {
  return (
    <motion.div
      className="flex items-start gap-3"
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.3 }}
    >
      {included ? (
        <Check className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400 mt-0.5 shrink-0" />
      ) : (
        <X className="h-3.5 w-3.5 text-zinc-300 dark:text-zinc-700 mt-0.5 shrink-0" />
      )}
      <span
        className={cn(
          "text-xs",
          included
            ? "text-zinc-600 dark:text-zinc-300"
            : "text-zinc-300 dark:text-zinc-600"
        )}
      >
        {label}
      </span>
    </motion.div>
  );
}

// ── Pricing Card ──────────────────────────────────────────────────────────
function PricingCard({
  meta,
  idx,
  isAnnual,
  t,
  ctaHref,
  trackCTA,
}: {
  meta: (typeof PLAN_META)[number];
  idx: number;
  isAnnual: boolean;
  t: (key: string) => string;
  ctaHref: string;
  trackCTA: (name: string, data: Record<string, string>) => void;
}) {
  const planT = () => t(`plan${meta.key.charAt(0).toUpperCase() + meta.key.slice(1)}`);
  const descT = () => t(`desc${meta.key.charAt(0).toUpperCase() + meta.key.slice(1)}`);
  const price = isAnnual ? meta.yearly : meta.monthly;
  const features = FEATURES_MAP[meta.key]?.[isAnnual ? "yearly" : "monthly"] ?? [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{
        duration: 0.6,
        delay: idx * 0.12,
        ease: [0.16, 1, 0.3, 1],
      }}
      className={cn(
        "feature-card glow-border relative rounded-2xl border border-zinc-200 dark:border-zinc-800/60 p-0.5 group",
        meta.popular
          ? "ring-1 ring-indigo-500/30 dark:ring-indigo-500/40"
          : ""
      )}
      onPointerMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        e.currentTarget.style.setProperty("--mouse-x", `${x}%`);
        e.currentTarget.style.setProperty("--mouse-y", `${y}%`);
      }}
    >
      {/* Popular badge */}
      {meta.popular && (
        <motion.div
          className="absolute -top-3 right-4 z-20"
          initial={{ y: -10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.4 }}
        >
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-[10px] font-semibold shadow-lg">
            <Star className="h-3 w-3 fill-white" />
            {t("popular")}
          </span>
        </motion.div>
      )}

      {/* Hover glow overlay */}
      <motion.div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-2xl z-10"
        style={{
          background: `radial-gradient(600px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), ${meta.glowColor}, transparent 40%)`,
        }}
      />

      <div className="relative z-20 bg-white dark:bg-zinc-900 rounded-[calc(1.5rem-2px)] p-6 flex flex-col flex-1 transition-colors">
        {/* Header */}
        <div className="mb-6">
          <h3 className="text-base font-semibold text-zinc-900 dark:text-white">
            {planT()}
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-500 mt-1">
            {descT()}
          </p>
        </div>

        {/* Price */}
        <AnimatePresence mode="wait">
          <motion.div
            key={isAnnual ? "annual" : "monthly"}
            className="mb-6"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="flex items-baseline gap-1">
              <motion.span
                className="text-3xl font-bold text-zinc-900 dark:text-white"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{
                  delay: 0.2 + idx * 0.12,
                  duration: 0.4,
                  ease: [0.25, 0.1, 0.25, 1],
                }}
              >
                ${price}
              </motion.span>
              <span className="text-xs text-zinc-400 dark:text-zinc-500">
                {isAnnual ? t("perYear") : t("perMonth")}
              </span>
              {/* Savings badge on yearly */}
              {isAnnual && (
                <motion.span
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.3, duration: 0.3 }}
                  className="inline-flex items-center gap-0.5 ml-1.5 px-1.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-[9px] font-semibold"
                >
                  <Percent className="h-2.5 w-2.5" />
                  {t("savePercent")}
                </motion.span>
              )}
            </div>
            <p className="text-[10px] text-zinc-400 dark:text-zinc-600 mt-1">
              {isAnnual ? t("billedYearly") : t("billedMonthly")}
            </p>
          </motion.div>
        </AnimatePresence>

        {/* CTA */}
        <Link href={ctaHref} className="mb-6 block">
          {meta.popular ? (
            <ShimmerButton
              className="w-full h-10 text-xs font-medium rounded-xl"
              shimmerColor="#ffffff"
              shimmerSize="0.05em"
              background="rgba(0,0,0,1)"
              onClick={() => trackCTA(`${meta.key}_${t("cta").toLowerCase().replace(/\s+/g, "_")}`, { href: ctaHref })}
            >
              <span className="flex items-center justify-center gap-1.5">
                {meta.key === "enterprise" ? t("ctaContact") : t("cta")}
                <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </ShimmerButton>
          ) : (
            <motion.div whileTap={buttonTap} whileHover={{ scale: 1.02 }}>
              <Button
                variant="glass"
                className="w-full h-10 text-xs font-medium rounded-xl"
                onClick={() => trackCTA(`${meta.key}_${t("cta").toLowerCase().replace(/\s+/g, "_")}`, { href: ctaHref })}
              >
                {meta.key === "enterprise" ? t("ctaContact") : t("cta")}
                <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
              </Button>
            </motion.div>
          )}
        </Link>

        {/* Features */}
        <div className="space-y-3 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-3">
            {t("includes")}
          </p>
          {features.map((feature: any, fIdx: number) => {
            const featureKey = typeof feature === "string" ? feature : feature.label;
            const suffixKey = typeof feature === "object" ? feature.suffixKey : null;
            let label: string;
            if (suffixKey) {
              label = `${t(featureKey)} ${t(suffixKey)}`;
            } else {
              label = t(featureKey);
            }
            return (
              <FeatureItem
                key={featureKey}
                label={label}
                included={true}
                delay={0.3 + fIdx * 0.04 + idx * 0.12}
              />
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────
export default function PricingPage() {
  const params = useParams();
  const locale = (params?.locale as string) || "en";
  const t = useTranslations("pricing");
  const { trackCTA } = useAnalytics();
  const [isAnnual, setIsAnnual] = useState(false);

  const ctaHref = `/${locale}/dashboard`;

  // FAQ items from translations
  const faqItems: FaqItem[] = [
    { question: t("faqQ1"), answer: t("faqA1") },
    { question: t("faqQ2"), answer: t("faqA2") },
    { question: t("faqQ3"), answer: t("faqA3") },
    { question: t("faqQ4"), answer: t("faqA4") },
  ];

  // Comparison table
  const comparisonRows = [
    [t("featureOrders"), "$29", "$79", t("featureUnlimited")],
    [t("featureTeam"), "3", "10", t("featureUnlimited")],
    ["Analytics", "Basic", "Advanced", "Real-time"],
    ["Support", "Email", "Priority", "24/7 Dedicated"],
    ["API Access", "—", "—", "Full"],
    ["Webhooks", "—", "—", "Full"],
  ];

  // Trust metrics
  const trustMetrics = [
    { label: t("trustBusinesses"), end: 2847, icon: BarChart3, format: (v: number) => v.toLocaleString() },
    { label: t("trustOrders"), end: 12400000, icon: TrendingUp, format: (v: number) => `${(v / 1000000).toFixed(1)}M` },
    { label: t("trustUsers"), end: 8431, icon: Users, format: (v: number) => v.toLocaleString() },
    { label: t("trustCountries"), end: 30, icon: Globe, suffix: "+" },
  ];

  return (
    <div className="min-h-screen pt-16 lg:pt-20">
      {/* ════════════════════════
          CINEMATIC HEADER
          ════════════════════════ */}
      <section className="relative overflow-hidden py-24 lg:py-28">
        <div className="absolute inset-0 h-[130%] opacity-30 dark:opacity-50">
          <AnimatedRays className="w-full h-full" />
        </div>
        <AnimatedGridPattern
          className="absolute inset-0 h-full w-full fill-gray-400/[0.02] stroke-gray-400/[0.03] dark:fill-white/[0.02] dark:stroke-white/[0.03]"
          numSquares={30}
          maxOpacity={0.1}
          duration={3}
          repeatDelay={1}
        />
        <div className="absolute inset-0 mesh-gradient-dark dark:mesh-gradient-dark mesh-gradient-light pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={{
              hidden: { opacity: 0 },
              visible: { transition: { staggerChildren: 0.12 } },
            }}
          >
            <motion.div
              variants={{
                hidden: { opacity: 0, y: 20 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
              }}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-indigo-200 dark:border-zinc-700/50 bg-indigo-50/50 dark:bg-zinc-800/30 backdrop-blur-sm mb-6"
            >
              <Sparkles className="h-3.5 w-3.5 text-indigo-500 dark:text-indigo-400" />
              <span className="text-[11px] font-medium text-indigo-600 dark:text-zinc-400 uppercase tracking-widest">
                {t("badge")}
              </span>
            </motion.div>

            <motion.h1
              variants={{
                hidden: { opacity: 0, y: 30 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } },
              }}
              className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-zinc-900 dark:text-white mb-4 max-w-4xl mx-auto"
            >
              {t("title")}&nbsp;
              <span className="inline-flex">
                <FlipFadeText
                  words={["scale.", "fit.", "grow.", "deliver."]}
                  interval={3000}
                  textClassName="!text-4xl sm:!text-5xl lg:!text-6xl !text-transparent !bg-clip-text !bg-gradient-to-r !from-indigo-600 !via-purple-600 !to-pink-600 dark:!from-indigo-400 dark:!via-purple-400 dark:!to-pink-400 !font-bold !tracking-tight"
                  className="!min-h-0 inline-flex"
                  staggerDelay={0.06}
                  letterDuration={0.4}
                />
              </span>
            </motion.h1>

            <motion.p
              variants={{
                hidden: { opacity: 0, y: 20 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
              }}
              className="text-base lg:text-lg text-zinc-500 dark:text-zinc-400 max-w-2xl mx-auto"
            >
              {t("subtitle")}
            </motion.p>
          </motion.div>

          {/* ── Billing Period Tabs ──────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="mt-10"
          >
            <div className="inline-flex items-center gap-3 p-1 rounded-2xl bg-zinc-100 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/50 shadow-sm backdrop-blur-sm">
              <button
                onClick={() => setIsAnnual(false)}
                className={cn(
                  "relative px-5 py-2 text-xs font-medium rounded-xl transition-all duration-300 press-scale",
                  !isAnnual
                    ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm"
                    : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
                )}
              >
                {t("monthly")}
              </button>
              <button
                onClick={() => setIsAnnual(true)}
                className={cn(
                  "relative px-5 py-2 text-xs font-medium rounded-xl transition-all duration-300 press-scale inline-flex items-center gap-1.5",
                  isAnnual
                    ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm"
                    : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
                )}
              >
                {t("yearly")}
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-[8px] font-semibold whitespace-nowrap">
                  <Percent className="h-2 w-2" />
                  {t("savePercent")}
                </span>
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ════════════════════════
          PRICING CARDS
          ════════════════════════ */}
      <AnimateSection className="-mt-8 pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 lg:gap-6 max-w-5xl mx-auto">
            {PLAN_META.map((meta, idx) => (
              <PricingCard
                key={meta.key}
                meta={meta}
                idx={idx}
                isAnnual={isAnnual}
                t={t}
                ctaHref={ctaHref}
                trackCTA={trackCTA}
              />
            ))}
          </div>
          <p className="text-xs text-zinc-400 dark:text-zinc-500 text-center mt-8">
            {t("compareSubtitle")}
          </p>
        </div>
      </AnimateSection>

      {/* ════════════════════════
          COMPARISON TABLE
          ════════════════════════ */}
      <AnimateSection className="py-16 border-t border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimateUp className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white mb-3">
              {t("compareTitle")}
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {t("compareSubtitle")}
            </p>
          </AnimateUp>

          <div className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800/60">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800/60">
                  <th className="text-left py-4 px-5 text-zinc-500 dark:text-zinc-400 font-medium text-xs uppercase tracking-wider">
                    Feature
                  </th>
                  {[t("planStarter"), t("planProfessional"), t("planEnterprise")].map((name) => (
                    <th
                      key={name}
                      className="text-center py-4 px-5 text-zinc-800 dark:text-white font-semibold text-xs"
                    >
                      {name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/40">
                {comparisonRows.map((row, i) => (
                  <tr key={i} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/20 transition-colors">
                    <td className="py-3.5 px-5 text-zinc-600 dark:text-zinc-300 text-xs">
                      {row[0]}
                    </td>
                    {row.slice(1).map((cell, j) => (
                      <td
                        key={j}
                        className={cn(
                          "text-center py-3.5 px-5 text-xs",
                          cell === "—"
                            ? "text-zinc-300 dark:text-zinc-700"
                            : "text-zinc-400 dark:text-zinc-400"
                        )}
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </AnimateSection>

      {/* ════════════════════════
          FAQ
          ════════════════════════ */}
      <AnimateSection className="py-20 border-t border-border">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimateUp className="flex items-center gap-2 justify-center mb-10">
            <HelpCircle className="h-4 w-4 text-indigo-500 dark:text-indigo-400" />
            <h2 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white">
              {t("faqTitle")}
            </h2>
          </AnimateUp>

          <FaqAccordion
            items={faqItems}
            title=""
            className="!py-0"
          />
        </div>
      </AnimateSection>

      {/* ════════════════════════
          TRUST METRICS
          ════════════════════════ */}
      <AnimateSection className="border-t border-border bg-zinc-50 dark:bg-[#0a0b10]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {trustMetrics.map((stat, i) => {
              const Icon = stat.icon;
              return (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1, duration: 0.5, ease: [0.16, 1, 0.3, 1] as any }}
                  className="text-center"
                >
                  <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/20 mb-3">
                    <Icon className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div className="text-2xl lg:text-3xl font-bold text-zinc-900 dark:text-white tabular-nums">
                    <AnimatedCounter
                      end={stat.end}
                      duration={2000}
                      {...(stat.format ? { formatter: stat.format } : { suffix: stat.suffix })}
                    />
                  </div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-500 mt-1 font-medium">
                    {stat.label}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </AnimateSection>

      {/* ════════════════════════
          BOTTOM CTA
          ════════════════════════ */}
      <AnimateSection className="py-20 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            className="double-bezel !rounded-[2rem]"
            whileHover={{ scale: 1.005 }}
            transition={{ duration: 0.3 }}
          >
            <div className="double-bezel-inner !rounded-[calc(2rem-0.375rem)] !py-16 relative overflow-hidden">
              <div className="absolute inset-0 mesh-gradient-dark dark:opacity-50 mesh-gradient-light pointer-events-none" />
              <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-500/8 rounded-full blur-3xl pointer-events-none" />

              <div className="relative text-center">
                <AnimateUp>
                  <h2 className="text-3xl sm:text-4xl font-bold text-zinc-900 dark:text-white mb-4">
                    {t("bottomTitle")}
                  </h2>
                  <p className="text-base text-zinc-500 dark:text-zinc-400 max-w-xl mx-auto mb-8">
                    {t("bottomSubtitle")}
                  </p>
                  <Link href={ctaHref}>
                    <motion.div whileTap={buttonTap} whileHover={{ scale: 1.03 }}>
                      <Button
                        className="h-11 px-8 text-sm gap-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 rounded-xl font-medium press-scale shadow-xl shadow-zinc-900/20 dark:shadow-black/20"
                        onClick={() => trackCTA("go_to_dashboard_pricing", { href: ctaHref })}
                      >
                        {t("bottomButton")}
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </motion.div>
                  </Link>
                </AnimateUp>
              </div>
            </div>
          </motion.div>
        </div>
      </AnimateSection>
    </div>
  );
}
