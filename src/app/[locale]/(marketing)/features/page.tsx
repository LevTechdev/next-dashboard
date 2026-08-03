"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useAnalytics } from "@/hooks/use-analytics";
import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import {
  RefreshCwIcon,
  ClockIcon,
  ArrowRightIcon,
  UsersIcon,
  TrendingUpIcon,
  ZapIcon,
  FileTextIcon,
  UserCheckIcon,
  SparklesIcon,
  DownloadIcon,
} from "lucide-animated";
import {
  BarChart3,
  ShoppingCart,
  Package,
  Shield,
  LayoutDashboard,
  Megaphone,
  Tag,
  PieChart,
  CheckCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AnimateSection, AnimateUp, buttonTap } from "@/components/motion";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { AnimatedRays } from "@/components/ui/animated-rays";
import { AnimatedGridPattern } from "@/components/ui/animated-grid-pattern";
import { FlipRevealText } from "@/components/ui/flip-reveal-text";
import { TextAnimate } from "@/components/ui/text-animate";

interface FeatureGroup {
  titleKey: string;
  descKey: string;
  items: {
    titleKey: string;
    descKey: string;
    icon: React.ComponentType<{ className?: string; [key: string]: unknown }>;
    color: string;
    gradient: string;
    testId: string;
  }[];
}

const featureGroups: FeatureGroup[] = [
  {
    titleKey: "g1Title",
    descKey: "g1Desc",
    items: [
      {
        titleKey: "g1f1Title",
        descKey: "g1f1Desc",
        icon: LayoutDashboard,
        color: "text-indigo-500 dark:text-indigo-400",
        gradient: "from-indigo-500/20 to-indigo-500/5",
        testId: "icon-layoutdashboard",
      },
      {
        titleKey: "g1f2Title",
        descKey: "g1f2Desc",
        icon: BarChart3,
        color: "text-blue-500 dark:text-blue-400",
        gradient: "from-blue-500/20 to-blue-500/5",
        testId: "icon-barchart3",
      },
      {
        titleKey: "g1f3Title",
        descKey: "g1f3Desc",
        icon: FileTextIcon,
        color: "text-emerald-500 dark:text-emerald-400",
        gradient: "from-emerald-500/20 to-emerald-500/5",
        testId: "icon-filetext",
      },
      {
        titleKey: "g1f4Title",
        descKey: "g1f4Desc",
        icon: PieChart,
        color: "text-purple-500 dark:text-purple-400",
        gradient: "from-purple-500/20 to-purple-500/5",
        testId: "icon-piechart",
      },
    ],
  },
  {
    titleKey: "g2Title",
    descKey: "g2Desc",
    items: [
      {
        titleKey: "g2f1Title",
        descKey: "g2f1Desc",
        icon: ShoppingCart,
        color: "text-emerald-500 dark:text-emerald-400",
        gradient: "from-emerald-500/20 to-emerald-500/5",
        testId: "icon-shoppingcart",
      },
      {
        titleKey: "g2f2Title",
        descKey: "g2f2Desc",
        icon: UsersIcon,
        color: "text-purple-500 dark:text-purple-400",
        gradient: "from-purple-500/20 to-purple-500/5",
        testId: "icon-users",
      },
      {
        titleKey: "g2f3Title",
        descKey: "g2f3Desc",
        icon: Package,
        color: "text-amber-500 dark:text-amber-400",
        gradient: "from-amber-500/20 to-amber-500/5",
        testId: "icon-package",
      },
      {
        titleKey: "g2f4Title",
        descKey: "g2f4Desc",
        icon: ClockIcon,
        color: "text-cyan-500 dark:text-cyan-400",
        gradient: "from-cyan-500/20 to-cyan-500/5",
        testId: "icon-clock",
      },
    ],
  },
  {
    titleKey: "g3Title",
    descKey: "g3Desc",
    items: [
      {
        titleKey: "g3f1Title",
        descKey: "g3f1Desc",
        icon: Megaphone,
        color: "text-rose-500 dark:text-rose-400",
        gradient: "from-rose-500/20 to-rose-500/5",
        testId: "icon-megaphone",
      },
      {
        titleKey: "g3f2Title",
        descKey: "g3f2Desc",
        icon: Tag,
        color: "text-amber-500 dark:text-amber-400",
        gradient: "from-amber-500/20 to-amber-500/5",
        testId: "icon-tag",
      },
      {
        titleKey: "g3f3Title",
        descKey: "g3f3Desc",
        icon: TrendingUpIcon,
        color: "text-green-500 dark:text-green-400",
        gradient: "from-green-500/20 to-green-500/5",
        testId: "icon-trendingup",
      },
      {
        titleKey: "g3f4Title",
        descKey: "g3f4Desc",
        icon: DownloadIcon,
        color: "text-sky-500 dark:text-sky-400",
        gradient: "from-sky-500/20 to-sky-500/5",
        testId: "icon-download",
      },
    ],
  },
  {
    titleKey: "g4Title",
    descKey: "g4Desc",
    items: [
      {
        titleKey: "g4f1Title",
        descKey: "g4f1Desc",
        icon: Shield,
        color: "text-rose-500 dark:text-rose-400",
        gradient: "from-rose-500/20 to-rose-500/5",
        testId: "icon-shield",
      },
      {
        titleKey: "g4f2Title",
        descKey: "g4f2Desc",
        icon: UserCheckIcon,
        color: "text-violet-500 dark:text-violet-400",
        gradient: "from-violet-500/20 to-violet-500/5",
        testId: "icon-usercheck",
      },
      {
        titleKey: "g4f3Title",
        descKey: "g4f3Desc",
        icon: RefreshCwIcon,
        color: "text-indigo-500 dark:text-indigo-400",
        gradient: "from-indigo-500/20 to-indigo-500/5",
        testId: "icon-refreshcw",
      },
      {
        titleKey: "g4f4Title",
        descKey: "g4f4Desc",
        icon: ClockIcon,
        color: "text-zinc-500 dark:text-zinc-400",
        gradient: "from-zinc-500/20 to-zinc-500/5",
        testId: "icon-clock",
      },
    ],
  },
];

const performanceHighlights = [
  {
    titleKey: "perf1Title",
    descKey: "perf1Desc",
    icon: ZapIcon,
    color: "text-amber-500 dark:text-amber-400",
    glowColor: "rgba(245,158,11,0.12)",
  },
  {
    titleKey: "perf2Title",
    descKey: "perf2Desc",
    icon: CheckCircle,
    color: "text-emerald-500 dark:text-emerald-400",
    glowColor: "rgba(16,185,129,0.12)",
  },
  {
    titleKey: "perf3Title",
    descKey: "perf3Desc",
    icon: RefreshCwIcon,
    color: "text-indigo-500 dark:text-indigo-400",
    glowColor: "rgba(99,102,241,0.12)",
  },
];

export default function FeaturesPage() {
  const params = useParams();
  const locale = (params?.locale as string) || "en";
  const { theme } = useTheme();
  const { trackCTA } = useAnalytics();
  const t = useTranslations("featuresPage");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true); // eslint-disable-line react-hooks/set-state-in-effect
  }, []);

  const ctaHref = `/${locale}/dashboard`;
  const isDark = mounted && theme === "dark";

  return (
    <div className="pt-16 lg:pt-20">
      {/* ════════════════════════
          CINEMATIC HEADER with AnimatedRays + FlipFadeText
          ════════════════════════ */}
      <section className="relative overflow-hidden py-24 lg:py-28">
        {/* AnimatedRays Background */}
        <div className="absolute inset-0 h-[130%] opacity-30 dark:opacity-50">
          <AnimatedRays className="w-full h-full" />
        </div>

        {/* Magic UI AnimatedGridPattern overlay */}
        <AnimatedGridPattern
          className="absolute inset-0 h-full w-full fill-gray-400/[0.02] stroke-gray-400/[0.03] dark:fill-white/[0.02] dark:stroke-white/[0.03]"
          numSquares={30}
          maxOpacity={0.1}
          duration={3}
          repeatDelay={1}
        />

        <div className="absolute inset-0 mesh-gradient-dark dark:mesh-gradient-dark mesh-gradient-light pointer-events-none" />
        {mounted && isDark && (
          <>
            <div className="absolute top-0 left-1/3 w-72 h-72 bg-indigo-500/8 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-0 right-1/4 w-56 h-56 bg-purple-500/6 rounded-full blur-[100px] pointer-events-none" />
          </>
        )}

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
                visible: {
                  opacity: 1,
                  y: 0,
                  transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] },
                },
              }}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-indigo-200 dark:border-zinc-700/50 bg-indigo-50/50 dark:bg-zinc-800/30 backdrop-blur-sm mb-6"
            >
              <SparklesIcon
                size={14}
                className="h-3.5 w-3.5 text-indigo-500 dark:text-indigo-400"
              />
              <span className="text-[11px] font-medium text-indigo-600 dark:text-zinc-400 uppercase tracking-widest">
                {t("badge")}
              </span>
            </motion.div>

            <motion.h1
              variants={{
                hidden: { opacity: 0, y: 30 },
                visible: {
                  opacity: 1,
                  y: 0,
                  transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] },
                },
              }}
              className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-zinc-900 dark:text-white mb-4 max-w-4xl mx-auto"
            >
              {t("heroPrefix")}&nbsp;
              <span className="inline-flex">
                <FlipRevealText
                  words={[t("word1"), t("word2"), t("word3"), t("word4")]}
                  interval={3000}
                  textClassName="!text-4xl sm:!text-5xl lg:!text-6xl !text-transparent !bg-clip-text !bg-gradient-to-r !from-indigo-600 !via-purple-600 !to-pink-600 dark:!from-indigo-400 dark:!via-purple-400 dark:!to-pink-400 !font-bold !tracking-tight"
                  className="!min-h-0 inline-flex"
                />
              </span>
            </motion.h1>

            <TextAnimate
              animation="blurInUp"
              by="text"
              className="text-base lg:text-lg text-zinc-500 dark:text-zinc-400 max-w-2xl mx-auto"
              once
            >
              {t("heroSubtitle")}
            </TextAnimate>
          </motion.div>
        </div>
      </section>

      {/* ════════════════════════
          FEATURE GROUPS with MICRO-INTERACTIONS
          ════════════════════════ */}
      {featureGroups.map((group, groupIndex) => (
        <AnimateSection
          key={group.titleKey}
          className={cn(
            "py-20 lg:py-24",
            groupIndex % 2 === 1 && "bg-zinc-100 dark:bg-zinc-900/30 border-t border-border",
          )}
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <AnimateUp className="text-center max-w-2xl mx-auto mb-14">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-indigo-200 dark:border-zinc-700/50 bg-indigo-50/50 dark:bg-zinc-800/30 backdrop-blur-sm mb-3">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 dark:bg-indigo-400" />
                <span className="text-[10px] font-medium text-indigo-600 dark:text-zinc-400 uppercase tracking-widest">
                  {t(`groupBadge${groupIndex + 1}`)}
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white mb-3">
                {t(group.titleKey)}
              </h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">{t(group.descKey)}</p>
            </AnimateUp>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 lg:gap-6 max-w-5xl mx-auto">
              {group.items.map((feature, idx) => {
                const Icon = feature.icon;
                return (
                  <motion.div
                    key={feature.titleKey}
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-40px" }}
                    transition={{
                      duration: 0.5,
                      delay: idx * 0.08,
                      ease: [0.16, 1, 0.3, 1] as any,
                    }}
                    className="feature-card glow-border relative rounded-2xl border border-zinc-200 dark:border-zinc-800/60 p-0.5 group"
                    onPointerMove={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const x = ((e.clientX - rect.left) / rect.width) * 100;
                      const y = ((e.clientY - rect.top) / rect.height) * 100;
                      e.currentTarget.style.setProperty("--mouse-x", `${x}%`);
                      e.currentTarget.style.setProperty("--mouse-y", `${y}%`);
                    }}
                  >
                    {/* Hover glow overlay */}
                    <motion.div
                      className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-2xl"
                      style={{
                        background: `radial-gradient(600px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(99,102,241,0.08) 0%, transparent 40%)`,
                      }}
                    />
                    <div className="relative z-10 bg-gradient-to-br from-white via-zinc-50/80 to-white dark:from-zinc-900 dark:via-zinc-900/95 dark:to-zinc-900 rounded-[calc(1.5rem-2px)] p-5 flex gap-4 h-full transition-colors">
                      <div
                        className={cn(
                          "feature-icon-wrap flex-shrink-0 inline-flex p-3 rounded-xl bg-gradient-to-br h-fit",
                          feature.gradient,
                          "border border-black/5 dark:border-white/5",
                        )}
                      >
                        <Icon
                          size={20}
                          data-testid={feature.testId}
                          className={cn("h-5 w-5", feature.color)}
                        />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-zinc-900 dark:text-white mb-1.5">
                          {t(feature.titleKey)}
                        </h3>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                          {t(feature.descKey)}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </AnimateSection>
      ))}

      {/* ════════════════════════
          FEATURE HIGHLIGHTS
          ════════════════════════ */}
      <AnimateSection className="py-20 lg:py-24 border-t border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimateUp className="text-center max-w-2xl mx-auto mb-14">
            <h2 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white mb-3">
              {t("perfTitle")}
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">{t("perfSubtitle")}</p>
          </AnimateUp>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 auto-rows-[220px]">
            {performanceHighlights.map((item, i) => {
              const Icon = item.icon;
              return (
                <motion.div
                  key={item.titleKey}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{
                    delay: i * 0.1,
                    duration: 0.5,
                    ease: [0.16, 1, 0.3, 1] as any,
                  }}
                  className="feature-card glow-border relative rounded-2xl border border-zinc-200 dark:border-zinc-800/60 p-7 flex flex-col justify-between group overflow-hidden"
                  onPointerMove={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const x = ((e.clientX - rect.left) / rect.width) * 100;
                    const y = ((e.clientY - rect.top) / rect.height) * 100;
                    e.currentTarget.style.setProperty("--mouse-x", `${x}%`);
                    e.currentTarget.style.setProperty("--mouse-y", `${y}%`);
                  }}
                >
                  <motion.div
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-2xl"
                    style={{
                      background: `radial-gradient(600px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), ${item.glowColor}, transparent 40%)`,
                    }}
                  />
                  <div className="relative z-10">
                    <Icon
                      size={24}
                      data-testid={
                        item.icon === CheckCircle
                          ? "icon-checkcircle"
                          : item.icon === ZapIcon
                            ? "icon-zap"
                            : "icon-refreshcw"
                      }
                      className={cn("h-6 w-6 mb-3", item.color)}
                    />
                    <h3 className="text-sm font-semibold text-zinc-900 dark:text-white mb-1">
                      {t(item.titleKey)}
                    </h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                      {t(item.descKey)}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </AnimateSection>

      {/* ════════════════════════
          FEATURE STATS BAR with Animated Counters
          ════════════════════════ */}
      <AnimateSection className="border-t border-border bg-zinc-100/50 dark:bg-zinc-900/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
            {[
              { labelKey: "statFeatures", end: 48, suffix: "+", icon: LayoutDashboard },
              { labelKey: "statIntegrations", end: 70, suffix: "+", icon: ZapIcon },
              {
                labelKey: "statUsers",
                end: 2847,
                format: (v: number) => v.toLocaleString(),
                icon: UsersIcon,
              },
              { labelKey: "statCountries", end: 30, suffix: "+", icon: CheckCircle },
            ].map((stat, i) => {
              const Icon = stat.icon;
              return (
                <motion.div
                  key={stat.labelKey}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1, duration: 0.5, ease: [0.16, 1, 0.3, 1] as any }}
                  className="text-center"
                >
                  <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/20 mb-3">
                    <Icon size={16} className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div className="text-2xl lg:text-3xl font-bold text-zinc-900 dark:text-white tabular-nums">
                    <AnimatedCounter
                      end={stat.end}
                      duration={2000}
                      {...(stat.format ? { formatter: stat.format } : { suffix: stat.suffix })}
                    />
                  </div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-500 mt-1 font-medium">
                    {t(stat.labelKey)}
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
                    {t("ctaTitle")}
                  </h2>
                  <p className="text-base text-zinc-500 dark:text-zinc-400 max-w-xl mx-auto mb-8">
                    {t("ctaDesc")}
                  </p>
                  <Link href={ctaHref}>
                    <motion.div whileTap={buttonTap} whileHover={{ scale: 1.03 }}>
                      <Button
                        className="h-11 px-8 text-sm gap-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 rounded-xl font-medium press-scale shadow-xl shadow-zinc-900/20 dark:shadow-black/20"
                        onClick={() => trackCTA("go_to_dashboard_features", { href: ctaHref })}
                      >
                        {t("ctaButton")}
                        <ArrowRightIcon size={16} className="h-4 w-4" />
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
