"use client";

import { use } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import {
  RefreshCw,
  Bell,
  ArrowRight,
  Fingerprint,
  TrendingUp,
  ShieldCheck,
  GitCommitHorizontal,
  Bug,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { AnimatedHeading, AnimatedSubtitle } from "@/components/ui/animated-heading";
import { FlipRevealText } from "@/components/ui/flip-reveal-text";

interface ChangelogEntry {
  version: string;
  date: string;
  tag: string;
  tagColor: string;
  items: {
    type: "feature" | "improvement" | "fix";
    text: string;
  }[];
}

export const typeConfig = {
  // A passkey, not a sparkle: features here are product capabilities, and the
  // fingerprint reads as capability at 14px without the generic-AI look.
  feature: {
    icon: Fingerprint,
    labelKey: "typeLabels.feature",
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
  },
  improvement: {
    icon: TrendingUp,
    labelKey: "typeLabels.improvement",
    color: "text-blue-500",
    bg: "bg-blue-500/10",
  },
  fix: {
    icon: Bug,
    labelKey: "typeLabels.fix",
    color: "text-amber-500",
    bg: "bg-amber-500/10",
  },
};

const easeSmooth = [0.16, 1, 0.3, 1] as [number, number, number, number];

// The hero-heading choreography (word-by-word rise + de-blur) now lives in the
// shared AnimatedHeading primitive, so every marketing page runs the same
// type-in animation as the about page.

export default function ChangelogPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = use(params);
  const t = useTranslations("changelogPage");
  const changelog = t.raw("entries") as ChangelogEntry[];
  const ctaHref = `/${locale}/dashboard`;
  // The release badge mirrors the newest entry so it can never drift from the data.
  const latest = changelog[0];

  return (
    <div className="relative overflow-hidden bg-zinc-50 dark:bg-[#0b0c11] text-zinc-900 dark:text-zinc-100 min-h-screen">
      {/* ════════════════════════
          CINEMATIC HEADER
          ════════════════════════ */}
      <section className="relative pt-24 pb-16 px-4 sm:px-6 lg:px-12 flex flex-col items-center text-center overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-primary/10 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto">
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
                  transition: { duration: 0.5, ease: easeSmooth },
                },
              }}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-primary/30 bg-primary/5 text-primary text-xs font-semibold mb-6 shadow-sm"
            >
              <RefreshCw size={14} className="h-3.5 w-3.5" />
              <span className="text-[11px] font-medium uppercase tracking-widest">
                {t("badge")}
              </span>
            </motion.div>

            <motion.h1
              variants={{
                hidden: { opacity: 0 },
                visible: {
                  opacity: 1,
                  transition: { duration: 0.6, ease: easeSmooth },
                },
              }}
              className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-foreground mb-4 max-w-4xl mx-auto"
            >
              <AnimatedHeading text={t("heroPrefix")} delay={0.2} />
              <br className="hidden sm:block" />
              <span className="inline-flex text-primary">
                <FlipRevealText
                  words={[t("word1"), t("word2"), t("word3"), t("word4")]}
                  interval={2800}
                  textClassName="!text-4xl sm:!text-5xl lg:!text-6xl text-primary !font-bold !tracking-tight"
                  className="!min-h-0 inline-flex"
                />
              </span>
            </motion.h1>

            <motion.p
              variants={{
                hidden: { opacity: 0, y: 20 },
                visible: {
                  opacity: 1,
                  y: 0,
                  transition: { duration: 0.5, ease: easeSmooth },
                },
              }}
              className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed"
            >
              <AnimatedSubtitle text={t("heroSubtitle")} delay={0.45} />
            </motion.p>
          </motion.div>
        </div>
      </section>

      {/* ════════════════════════
          RELEASE VERSION BADGE
          ════════════════════════ */}
      <section className="-mt-8 pb-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-border bg-background">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-medium text-muted-foreground">
              {t("latestVersion")}{" "}
              <span className="text-foreground font-semibold">{latest?.version ?? "2.6.0"}</span>
            </span>
            <span className="text-[10px] text-muted-foreground/50">—</span>
            <span className="text-[10px] text-muted-foreground">
              {latest?.date ?? t("released")}
            </span>
          </div>
        </div>
      </section>

      {/* ════════════════════════
          CHANGELOG TIMELINE
          ════════════════════════ */}
      <section className="pb-20 max-w-3xl mx-auto px-4 sm:px-6">
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-[11px] md:left-[19px] top-4 bottom-0 w-px bg-border" />

          <div className="space-y-12">
            {changelog.map((entry, idx) => (
              <motion.div
                key={entry.version}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{
                  duration: 0.6,
                  delay: idx * 0.1,
                  ease: easeSmooth,
                }}
                className="relative pl-12 md:pl-16"
              >
                {/* Timeline dot */}
                <div className="absolute left-[7.5px] md:left-[15.5px] top-4 w-2 h-2 rounded-full bg-primary ring-4 ring-background" />

                <div className="rounded-2xl border border-border bg-background p-6 lg:p-8 hover:border-primary/30 transition-colors">
                  {/* Version header */}
                  <div className="flex items-center gap-3 mb-6 flex-wrap border-b border-border pb-4">
                    <h3 className="text-lg font-bold text-foreground font-mono">
                      v{entry.version}
                    </h3>
                    <span
                      className={cn(
                        "text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full",
                        entry.tagColor,
                      )}
                    >
                      {entry.tag}
                    </span>
                    <span className="text-xs text-muted-foreground font-mono ml-auto">
                      {entry.date}
                    </span>
                  </div>

                  {/* Items */}
                  <div className="space-y-4">
                    {entry.items.map((item, itemIdx) => {
                      const config = typeConfig[item.type];
                      const Icon = config.icon;
                      return (
                        <motion.div
                          key={itemIdx}
                          initial={{ opacity: 0, y: 8 }}
                          whileInView={{ opacity: 1, y: 0 }}
                          viewport={{ once: true }}
                          transition={{
                            delay: 0.1 + itemIdx * 0.05,
                            duration: 0.4,
                            ease: easeSmooth,
                          }}
                          className="flex items-start gap-3"
                        >
                          <div
                            className={cn(
                              "flex-shrink-0 mt-0.5 inline-flex p-1.5 rounded-lg",
                              config.bg,
                            )}
                          >
                            <Icon size={14} className={cn("h-3.5 w-3.5", config.color)} />
                          </div>
                          <div className="min-w-0 pt-0.5">
                            <p className="text-sm text-muted-foreground leading-relaxed">
                              {item.text}
                            </p>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════
          RELEASE STATS with Animated Counters
          ════════════════════════ */}
      <section className="py-16 border-t border-border bg-background/50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { labelKey: "statReleases", end: 24, icon: GitCommitHorizontal, suffix: "+" },
              { labelKey: "statFeatures", end: 42, icon: ShieldCheck, suffix: "+" },
              { labelKey: "statImprovements", end: 128, icon: TrendingUp, suffix: "+" },
              { labelKey: "statFixes", end: 56, icon: Bug, suffix: "+" },
            ].map((stat, i) => {
              const Icon = stat.icon;
              return (
                <motion.div
                  key={stat.labelKey}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1, duration: 0.5, ease: easeSmooth }}
                  className="text-center"
                >
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-primary/10 mb-4 text-primary">
                    <Icon size={20} />
                  </div>
                  <div className="text-3xl font-bold text-foreground tabular-nums mb-1">
                    <AnimatedCounter end={stat.end} duration={2000} suffix={stat.suffix} />
                  </div>
                  <div className="text-sm font-medium text-muted-foreground">
                    {t(stat.labelKey)}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ════════════════════════
          SUBSCRIBE SECTION
          ════════════════════════ */}
      <section className="py-20 border-t border-border">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, ease: easeSmooth }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border bg-background mb-6">
              <Bell size={14} className="h-3.5 w-3.5 text-primary" />
              <span className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
                {t("subscribeBadge")}
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-4">
              {t("subscribeTitle")}
            </h2>
            <p className="text-base text-muted-foreground mb-8 max-w-md mx-auto">
              {t("subscribeDesc")}
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 max-w-md mx-auto">
              <input
                type="email"
                placeholder={t("emailPlaceholder")}
                className="w-full sm:flex-1 h-12 px-4 rounded-xl bg-background border border-border text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
              />
              <Button className="w-full sm:w-auto h-12 px-6 bg-foreground text-background font-medium hover:bg-muted transition-colors rounded-xl shrink-0">
                {t("subscribeBtn")}
                <ArrowRight size={16} className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ════════════════════════
          BOTTOM CTA
          ════════════════════════ */}
      <section className="px-4 sm:px-6 lg:px-12 pb-24 max-w-7xl mx-auto">
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
                href={ctaHref}
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
