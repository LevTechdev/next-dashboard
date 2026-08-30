"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import {
  EyeIcon,
  HeartIcon,
  UsersIcon,
  EarthIcon,
  TrendingUpIcon,
  SparklesIcon,
  ArrowRightIcon,
} from "lucide-animated";
import { Target, Shield, Lightbulb, LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";
import { AnimatedRays } from "@/components/ui/animated-rays";
import { AnimatedGridPattern } from "@/components/ui/animated-grid-pattern";
import { FlipFadeText } from "@/components/ui/flip-fade-text";
import { AnimatedCounter } from "@/components/ui/animated-counter";

// ─── Company Values ──────────────────────────────────────────────────────────

interface Value {
  icon: React.ElementType;
  titleKey: string;
  descKey: string;
  color: string;
  bg: string;
}

const values: Value[] = [
  {
    icon: Lightbulb,
    titleKey: "v1Title",
    descKey: "v1Desc",
    color: "text-indigo-600 dark:text-indigo-400",
    bg: "bg-indigo-50 dark:bg-indigo-900/20",
  },
  {
    icon: Shield,
    titleKey: "v2Title",
    descKey: "v2Desc",
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-900/20",
  },
  {
    icon: UsersIcon,
    titleKey: "v3Title",
    descKey: "v3Desc",
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-900/20",
  },
  {
    icon: EarthIcon,
    titleKey: "v4Title",
    descKey: "v4Desc",
    color: "text-purple-600 dark:text-purple-400",
    bg: "bg-purple-50 dark:bg-purple-900/20",
  },
  {
    icon: TrendingUpIcon,
    titleKey: "v5Title",
    descKey: "v5Desc",
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-900/20",
  },
  {
    icon: HeartIcon,
    titleKey: "v6Title",
    descKey: "v6Desc",
    color: "text-rose-600 dark:text-rose-400",
    bg: "bg-rose-50 dark:bg-rose-900/20",
  },
];

// ─── Team Section ────────────────────────────────────────────────────────────

const teamMembers = [
  { name: "Alex Chen", roleKey: "roleCeo", initials: "AC" },
  { name: "Sarah Mitchell", roleKey: "roleCto", initials: "SM" },
  { name: "David Park", roleKey: "roleDesign", initials: "DP" },
  { name: "Lisa Ramirez", roleKey: "roleVpe", initials: "LR" },
];

// ─── Stats ───────────────────────────────────────────────────────────────────

const stats = [
  { labelKey: "statUsers", endValue: 50000, prefix: "", suffix: "+" },
  { labelKey: "statCountries", endValue: 50, prefix: "", suffix: "+" },
  { labelKey: "statTransactions", endValue: 10, prefix: "", suffix: "M+" },
  { labelKey: "statNps", endValue: 92, prefix: "", suffix: "" },
];

// ─── Timeline ────────────────────────────────────────────────────────────────

const milestones = [
  { year: "2020", titleKey: "m2020Title", descKey: "m2020Desc" },
  { year: "2021", titleKey: "m2021Title", descKey: "m2021Desc" },
  { year: "2022", titleKey: "m2022Title", descKey: "m2022Desc" },
  { year: "2023", titleKey: "m2023Title", descKey: "m2023Desc" },
  { year: "2024", titleKey: "m2024Title", descKey: "m2024Desc" },
  { year: "2025", titleKey: "m2025Title", descKey: "m2025Desc" },
];

// ─── Container Variants ──────────────────────────────────────────────────────

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as any } },
};

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function AboutPage() {
  const params = useParams();
  const locale = (params?.locale as string) || "en";
  const t = useTranslations("aboutPage");
  return (
    <div className="relative overflow-hidden bg-zinc-50 dark:bg-[#0b0c11]">
      {/* ═══ HERO ═══ */}
      <section className="relative min-h-[70vh] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0">
          <AnimatedRays />
          <AnimatedGridPattern
            numSquares={60}
            maxOpacity={0.05}
            duration={4}
            repeatDelay={1}
            className="opacity-50"
          />
        </div>

        <div className="absolute top-1/3 left-1/4 w-72 h-72 bg-indigo-500/10 dark:bg-indigo-500/8 rounded-full blur-[150px] pointer-events-none" />
        <div className="absolute bottom-1/3 right-1/4 w-80 h-80 bg-purple-500/8 dark:bg-purple-500/6 rounded-full blur-[160px] pointer-events-none" />

        <div className="relative z-10 max-w-4xl mx-auto px-4 text-center pt-24 pb-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-xs font-medium mb-6 border border-indigo-200 dark:border-indigo-800/50">
              <SparklesIcon size={14} className="h-3.5 w-3.5" />
              {t("badge")}
            </div>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-4"
          >
            <span className="text-zinc-800 dark:text-white">{t("heroPrefix")} </span>
            <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 dark:from-indigo-400 dark:via-purple-400 dark:to-pink-300 bg-clip-text text-transparent">
              <FlipFadeText
                words={[t("word1"), t("word2"), t("word3"), t("word4")]}
                className="!min-h-0"
                textClassName="!text-4xl sm:!text-5xl lg:!text-6xl !font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 dark:from-indigo-400 dark:via-purple-400 dark:to-pink-300 bg-clip-text text-transparent"
              />
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="text-lg text-zinc-500 dark:text-zinc-400 max-w-2xl mx-auto mb-8"
          >
            {t("heroSubtitle")}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="flex items-center justify-center gap-3"
          >
            <Link
              href={`/${locale}/features`}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-sm font-medium hover:opacity-90 transition-all press-scale"
            >
              {t("exploreFeatures")}
              <ArrowRightIcon size={16} className="h-4 w-4" />
            </Link>
            <Link
              href={`/${locale}/contact`}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all press-scale"
            >
              {t("getInTouch")}
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ═══ STATS STRIP ═══ */}
      <section className="border-y border-zinc-200 dark:border-zinc-800 bg-zinc-100/50 dark:bg-zinc-900/10">
        <div className="max-w-6xl mx-auto px-4 py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, i) => (
              <motion.div
                key={stat.labelKey}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="text-center"
              >
                <p className="text-3xl sm:text-4xl font-bold text-zinc-900 dark:text-white">
                  {stat.prefix}
                  <AnimatedCounter end={stat.endValue} duration={2000} />
                  {stat.suffix}
                </p>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">{t(stat.labelKey)}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ STORY SECTION ═══ */}
      <section className="max-w-6xl mx-auto px-4 py-20 lg:py-28">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-xs font-medium mb-4 border border-indigo-200 dark:border-indigo-800/50">
              <Target className="h-3.5 w-3.5" />
              {t("missionBadge")}
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-zinc-900 dark:text-white mb-6 leading-tight">
              {t("missionTitle")}{" "}
              <span className="bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400 bg-clip-text text-transparent">
                {t("missionTitleGradient")}
              </span>
            </h2>
            <div className="space-y-4 text-zinc-500 dark:text-zinc-400 leading-relaxed">
              <p>{t("missionP1")}</p>
              <p>{t("missionP2")}</p>
              <p>{t("missionP3")}</p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="relative"
          >
            {/* Visual timeline compact */}
            <div className="relative pl-8 border-l-2 border-indigo-200 dark:border-indigo-800 space-y-6">
              {milestones.slice(0, 4).map((m, i) => (
                <motion.div
                  key={m.year}
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1, duration: 0.4 }}
                  className="relative"
                >
                  <div className="absolute -left-[25px] w-4 h-4 rounded-full bg-indigo-500 border-2 border-white dark:border-zinc-900 shadow-sm" />
                  <p className="text-xs font-mono font-semibold text-indigo-600 dark:text-indigo-400 mb-0.5">
                    {m.year}
                  </p>
                  <p className="text-sm font-semibold text-zinc-900 dark:text-white">
                    {t(m.titleKey)}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">{t(m.descKey)}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ═══ VALUES SECTION ═══ */}
      <section className="border-t border-zinc-200 dark:border-zinc-800 bg-zinc-100/50 dark:bg-zinc-900/10">
        <div className="max-w-6xl mx-auto px-4 py-20 lg:py-28">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-14"
          >
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-xs font-medium mb-4 border border-indigo-200 dark:border-indigo-800/50">
              <HeartIcon size={14} className="h-3.5 w-3.5" />
              {t("valuesBadge")}
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-zinc-900 dark:text-white mb-4">
              {t("valuesTitle")}
            </h2>
            <p className="text-zinc-500 dark:text-zinc-400 max-w-xl mx-auto">
              {t("valuesSubtitle")}
            </p>
          </motion.div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
          >
            {values.map((value) => {
              const Icon = value.icon;
              return (
                <motion.div
                  key={value.titleKey}
                  variants={itemVariants}
                  className="glow-border group relative p-6 rounded-2xl bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 hover:shadow-lg hover:shadow-black/5 dark:hover:shadow-black/20 transition-all duration-300"
                >
                  <div
                    className={cn(
                      "p-3 w-fit rounded-xl mb-4 transition-transform group-hover:scale-110 duration-300",
                      value.bg,
                    )}
                  >
                    <Icon size={20} className={cn("h-5 w-5", value.color)} />
                  </div>
                  <h3 className="text-base font-semibold text-zinc-900 dark:text-white mb-2">
                    {t(value.titleKey)}
                  </h3>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
                    {t(value.descKey)}
                  </p>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </section>

      {/* ═══ TEAM PREVIEW ═══ */}
      <section className="max-w-6xl mx-auto px-4 py-20 lg:py-28">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-14"
        >
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-xs font-medium mb-4 border border-indigo-200 dark:border-indigo-800/50">
            {" "}
            <UsersIcon size={14} className="h-3.5 w-3.5" />
            {t("teamBadge")}
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-zinc-900 dark:text-white mb-4">
            {t("teamTitle")}
          </h2>
          <p className="text-zinc-500 dark:text-zinc-400 max-w-xl mx-auto">{t("teamSubtitle")}</p>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-5"
        >
          {teamMembers.map((member) => (
            <motion.div
              key={member.name}
              variants={itemVariants}
              className="text-center p-6 rounded-2xl bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 hover:shadow-md transition-all duration-300"
            >
              <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-lg font-bold mb-4 shadow-lg shadow-indigo-500/20">
                {member.initials}
              </div>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">{member.name}</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{t(member.roleKey)}</p>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mt-10"
        >
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">{t("teamMore")}</p>
          <Link
            href={`/${locale}/contact`}
            className="inline-flex items-center gap-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 transition-colors"
          >
            {t("teamJoin")} <ArrowRightIcon size={14} className="h-3.5 w-3.5" />
          </Link>
        </motion.div>
      </section>

      {/* ═══ CTA ═══ */}
      <section className="border-t border-zinc-200 dark:border-zinc-800">
        <div className="max-w-4xl mx-auto px-4 py-20 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 mb-6">
              <LayoutDashboard className="h-7 w-7 text-white" />
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-zinc-900 dark:text-white mb-4">
              {t("ctaTitle")}
            </h2>
            <p className="text-zinc-500 dark:text-zinc-400 max-w-lg mx-auto mb-8">{t("ctaDesc")}</p>
            <div className="flex items-center justify-center gap-3">
              <Link
                href={`/${locale}/dashboard`}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-sm font-medium hover:opacity-90 transition-all press-scale shadow-lg shadow-black/10 dark:shadow-white/10"
              >
                {t("ctaGetStarted")}
                <ArrowRightIcon size={16} className="h-4 w-4" />
              </Link>
              <Link
                href={`/${locale}/pricing`}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all press-scale"
              >
                {t("ctaViewPricing")}
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
