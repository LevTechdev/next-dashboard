"use client";

import { use } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import {
  Heart,
  Users,
  Globe,
  TrendingUp,
  Sparkles,
  ArrowRight,
  Target,
  Shield,
  Lightbulb,
  LayoutDashboard,
} from "lucide-react";
import { cn } from "@/lib/utils";
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
    color: "text-indigo-500",
    bg: "bg-indigo-500/10",
  },
  {
    icon: Shield,
    titleKey: "v2Title",
    descKey: "v2Desc",
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
  },
  {
    icon: Users,
    titleKey: "v3Title",
    descKey: "v3Desc",
    color: "text-blue-500",
    bg: "bg-blue-500/10",
  },
  {
    icon: Globe,
    titleKey: "v4Title",
    descKey: "v4Desc",
    color: "text-purple-500",
    bg: "bg-purple-500/10",
  },
  {
    icon: TrendingUp,
    titleKey: "v5Title",
    descKey: "v5Desc",
    color: "text-amber-500",
    bg: "bg-amber-500/10",
  },
  {
    icon: Heart,
    titleKey: "v6Title",
    descKey: "v6Desc",
    color: "text-rose-500",
    bg: "bg-rose-500/10",
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

const easeSmooth = [0.16, 1, 0.3, 1] as [number, number, number, number];

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = use(params);
  const t = useTranslations("aboutPage");
  
  return (
    <div className="relative overflow-hidden bg-zinc-50 dark:bg-[#0b0c11] text-zinc-900 dark:text-zinc-100 min-h-screen">
      {/* ═══ HERO ═══ */}
      <section className="relative min-h-[70vh] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-primary/10 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto px-4 text-center pt-24 pb-20">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: easeSmooth }}
          >
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-primary/30 bg-primary/5 text-primary text-xs font-semibold mb-6 shadow-sm">
              <Sparkles size={14} className="h-3.5 w-3.5" />
              {t("badge")}
            </div>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.6, ease: easeSmooth }}
            className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight mb-4 text-foreground"
          >
            <span>{t("heroPrefix")} </span>
            <span className="text-primary inline-flex">
              <FlipFadeText
                words={[t("word1"), t("word2"), t("word3"), t("word4")]}
                className="!min-h-0 inline-flex"
                textClassName="!text-4xl sm:!text-5xl md:!text-6xl !font-bold text-primary"
              />
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6, ease: easeSmooth }}
            className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8 leading-relaxed"
          >
            {t("heroSubtitle")}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6, ease: easeSmooth }}
            className="flex items-center justify-center gap-3"
          >
            <Link
              href={`/${locale}/features`}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-foreground text-background text-sm font-semibold hover:opacity-90 transition-all"
            >
              {t("exploreFeatures")}
              <ArrowRight size={16} className="h-4 w-4" />
            </Link>
            <Link
              href={`/${locale}/contact`}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full border border-border bg-background text-foreground text-sm font-semibold hover:bg-muted transition-all"
            >
              {t("getInTouch")}
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ═══ STATS STRIP ═══ */}
      <section className="border-y border-border bg-background/50">
        <div className="max-w-7xl mx-auto px-4 py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, i) => (
              <motion.div
                key={stat.labelKey}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.5, ease: easeSmooth }}
                className="text-center"
              >
                <p className="text-3xl sm:text-4xl font-bold text-foreground">
                  {stat.prefix}
                  <AnimatedCounter end={stat.endValue} duration={2000} />
                  {stat.suffix}
                </p>
                <p className="text-sm text-muted-foreground mt-1 font-medium">{t(stat.labelKey)}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ STORY SECTION ═══ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 py-20 lg:py-28">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease: easeSmooth }}
          >
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-primary/30 bg-primary/5 text-primary text-xs font-semibold mb-4 shadow-sm">
              <Target className="h-3.5 w-3.5" />
              {t("missionBadge")}
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-6 leading-tight">
              {t("missionTitle")}{" "}
              <span className="text-primary">
                {t("missionTitleGradient")}
              </span>
            </h2>
            <div className="space-y-4 text-muted-foreground leading-relaxed">
              <p>{t("missionP1")}</p>
              <p>{t("missionP2")}</p>
              <p>{t("missionP3")}</p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease: easeSmooth }}
            className="relative"
          >
            {/* Visual timeline compact */}
            <div className="relative pl-8 border-l-2 border-border space-y-8">
              {milestones.slice(0, 4).map((m, i) => (
                <motion.div
                  key={m.year}
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1, duration: 0.4 }}
                  className="relative"
                >
                  <div className="absolute -left-[37px] w-4 h-4 rounded-full bg-primary border-4 border-background" />
                  <p className="text-xs font-mono font-semibold text-primary mb-1">
                    {m.year}
                  </p>
                  <p className="text-base font-bold text-foreground mb-1">
                    {t(m.titleKey)}
                  </p>
                  <p className="text-sm text-muted-foreground">{t(m.descKey)}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ═══ VALUES SECTION ═══ */}
      <section className="border-t border-border bg-background/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 py-20 lg:py-28">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-14"
          >
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-primary/30 bg-primary/5 text-primary text-xs font-semibold mb-4 shadow-sm">
              <Heart size={14} className="h-3.5 w-3.5" />
              {t("valuesBadge")}
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
              {t("valuesTitle")}
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              {t("valuesSubtitle")}
            </p>
          </motion.div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {values.map((value) => {
              const Icon = value.icon;
              return (
                <motion.div
                  key={value.titleKey}
                  variants={itemVariants}
                  className="p-6 rounded-2xl bg-background border border-border hover:border-primary/50 transition-colors group"
                >
                  <div
                    className={cn(
                      "p-3 w-fit rounded-xl mb-4",
                      value.bg,
                    )}
                  >
                    <Icon size={20} className={cn("h-5 w-5", value.color)} />
                  </div>
                  <h3 className="text-lg font-bold text-foreground mb-2">
                    {t(value.titleKey)}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {t(value.descKey)}
                  </p>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </section>

      {/* ═══ TEAM PREVIEW ═══ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 py-20 lg:py-28">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-14"
        >
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-primary/30 bg-primary/5 text-primary text-xs font-semibold mb-4 shadow-sm">
            <Users size={14} className="h-3.5 w-3.5" />
            {t("teamBadge")}
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
            {t("teamTitle")}
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">{t("teamSubtitle")}</p>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-6"
        >
          {teamMembers.map((member) => (
            <motion.div
              key={member.name}
              variants={itemVariants}
              className="text-center p-6 rounded-2xl bg-background border border-border"
            >
              <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center text-primary text-lg font-bold mb-4">
                {member.initials}
              </div>
              <h3 className="text-sm font-bold text-foreground">{member.name}</h3>
              <p className="text-xs text-muted-foreground mt-1 font-medium">{t(member.roleKey)}</p>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mt-10"
        >
          <p className="text-sm text-muted-foreground mb-4">{t("teamMore")}</p>
          <Link
            href={`/${locale}/contact`}
            className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:underline"
          >
            {t("teamJoin")} <ArrowRight size={14} className="h-3.5 w-3.5" />
          </Link>
        </motion.div>
      </section>

      {/* ═══ CTA ═══ */}
      <section className="px-4 sm:px-6 lg:px-12 pb-24 max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          transition={{ duration: 0.6, ease: easeSmooth }}
          className="rounded-3xl bg-foreground text-background p-12 text-center relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="relative z-10">
            <LayoutDashboard className="h-10 w-10 mx-auto mb-6 opacity-80 text-background" />
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">{t("ctaTitle")}</h2>
            <p className="text-base sm:text-lg opacity-80 max-w-2xl mx-auto mb-8">
              {t("ctaDesc")}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <Link
                href={`/${locale}/dashboard`}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-background text-foreground text-sm font-semibold hover:opacity-90 transition"
              >
                {t("ctaGetStarted")}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href={`/${locale}/pricing`}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full border border-background/20 bg-foreground text-background text-sm font-semibold hover:bg-background/10 transition"
              >
                {t("ctaViewPricing")}
              </Link>
            </div>
          </div>
        </motion.div>
      </section>
    </div>
  );
}
