"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, useScroll, useTransform, MotionValue, MotionConfig } from "framer-motion";
import { Package, CreditCard, BarChart3, Workflow, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface LiveStats {
  stats?: {
    totalRevenue?: number;
    totalOrders?: number;
    totalCustomers?: number;
    totalProducts?: number;
  };
}

// Demo series — mirrors the homepage's marketing data. Used until a live
// /api/dashboard response replaces it (and always for signed-out visitors).
const DEMO_STATS: NonNullable<LiveStats["stats"]> = {
  totalRevenue: 284_750,
  totalOrders: 1_847,
  totalCustomers: 892,
  totalProducts: 156,
};

/** Compact "$284.7k"-style formatting for live revenue. */
function compactUsd(value: number) {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}k`;
  return `$${Math.round(value).toLocaleString("en-US")}`;
}

/**
 * Scroll-driven product story — connects the cosmic hero artwork to the
 * dashboard capabilities. A tall scroll container pins a full-viewport stage
 * where four "chapters" (Orders → Payments → Analytics → Automation)
 * crossfade as the user scrolls, beside a rotating orbit visual.
 */

const CHAPTERS = [
  { key: "c1", icon: Package, accent: "#38bdf8" },
  { key: "c2", icon: CreditCard, accent: "#10b981" },
  { key: "c3", icon: BarChart3, accent: "#f59e0b" },
  { key: "c4", icon: Workflow, accent: "#a78bfa" },
] as const;

interface StoryProps {
  locale: string;
  /** Anchor id so the hero Signal Strip can deep-link straight to the story. */
  id?: string;
  t: (key: string, values?: Record<string, string | number>) => string;
}

/** Crossfade window helpers for chapter i out of n */
function chapterWindow(i: number, n: number) {
  return [i / n, i / n + 0.05, (i + 1) / n - 0.05, (i + 1) / n] as const;
}

/**
 * Opacity input/output ranges for chapter i out of n. The LAST chapter never
 * fades out: clamping its tail to the window start keeps the final chapter
 * fully visible at the end of the pinned story instead of blanking to opacity
 * 0 exactly when the user reaches the features section below.
 */
function chapterOpacity(i: number, n: number) {
  const [w0, w1, w2, w3] = chapterWindow(i, n);
  return i === n - 1
    ? { input: [w0, w1], output: [0, 1] }
    : { input: [w0, w1, w2, w3], output: [0, 1, 1, 0] };
}

/** One chapter card: fades + slides in during its scroll window. */
function ChapterCard({
  progress,
  index,
  count,
  chapter,
  t,
  live,
}: {
  progress: MotionValue<number>;
  index: number;
  count: number;
  chapter: (typeof CHAPTERS)[number];
  t: (key: string, values?: Record<string, string | number>) => string;
  live: LiveStats | null;
}) {
  const { input, output } = chapterOpacity(index, count);
  const opacity = useTransform(progress, input, output);
  const y = useTransform(progress, [index / count, index / count + 0.05], [32, 0]);
  const Icon = chapter.icon;

  // Live stat chip per chapter — mirrors the real /api/dashboard numbers when
  // a session exists; demo counts otherwise (the page stays consistent).
  const liveStat = live?.stats
    ? t(
        `story.${chapter.key}live`,
        chapter.key === "c2"
          ? { value: compactUsd(live.stats.totalRevenue ?? 284_750) }
          : {
              count:
                (chapter.key === "c1"
                  ? live.stats.totalOrders
                  : chapter.key === "c3"
                    ? live.stats.totalCustomers
                    : live.stats.totalProducts
                )?.toLocaleString("en-US") ?? "—",
            },
      )
    : null;

  return (
    <motion.div
      style={{ opacity, y }}
      className="absolute inset-0 flex flex-col justify-center"
      aria-hidden={false}
    >
      <div className="flex items-center gap-2.5 mb-4">
        <span
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: `${chapter.accent}1f`, color: chapter.accent }}
        >
          <Icon className="h-4.5 w-4.5" />
        </span>
        <p
          className="text-xs font-semibold uppercase tracking-[0.2em]"
          style={{ color: chapter.accent }}
        >
          {t(`story.${chapter.key}e`)}
        </p>
        <span className="ml-auto font-mono text-[10px] text-muted-foreground">
          {String(index + 1).padStart(2, "0")} / {String(count).padStart(2, "0")}
        </span>
      </div>

      <h3 className="text-2xl md:text-4xl font-bold tracking-tight text-foreground mb-3">
        {t(`story.${chapter.key}t`)}
      </h3>
      <p className="text-sm md:text-base text-muted-foreground leading-relaxed max-w-xl mb-6">
        {t(`story.${chapter.key}b`)}
      </p>

      <div className="flex flex-wrap gap-2">
        {[1, 2, 3].map((f) => (
          <span
            key={f}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-background text-xs font-medium text-foreground"
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: chapter.accent }} />
            {t(`story.${chapter.key}f${f}`)}
          </span>
        ))}
      </div>

      {liveStat && (
        <p className="mt-5 inline-flex items-center gap-2 text-xs font-mono text-muted-foreground">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse motion-reduce:animate-none" />
          {liveStat}
        </p>
      )}
    </motion.div>
  );
}

/** One satellite orbiting the core — lit during its chapter window. */
function OrbitSatellite({
  progress,
  index,
  count,
  chapter,
  className,
}: {
  progress: MotionValue<number>;
  index: number;
  count: number;
  chapter: (typeof CHAPTERS)[number];
  className?: string;
}) {
  const { input, output } = chapterOpacity(index, count);
  const opacity = useTransform(
    progress,
    input,
    output.map((o) => (o === 0 ? 0.22 : o)),
  );
  const scale = useTransform(progress, [index / count, index / count + 0.05], [0.8, 1]);
  const Icon = chapter.icon;

  return (
    <motion.div
      style={{ opacity, scale }}
      className={cn("absolute flex flex-col items-center gap-1.5 text-center w-16", className)}
    >
      <span
        className="w-11 h-11 rounded-full border flex items-center justify-center shadow-lg"
        style={{
          borderColor: `${chapter.accent}66`,
          background: `${chapter.accent}14`,
          color: chapter.accent,
        }}
      >
        <Icon className="h-5 w-5" />
      </span>
      <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
        {`story.${chapter.key}e`}
      </span>
    </motion.div>
  );
}

/** The central command core — shows the eyebrow of the active chapter. */
function CoreLabel({
  progress,
  index,
  count,
  chapter,
  t,
}: {
  progress: MotionValue<number>;
  index: number;
  count: number;
  chapter: (typeof CHAPTERS)[number];
  t: (key: string) => string;
}) {
  const { input, output } = chapterOpacity(index, count);
  const opacity = useTransform(progress, input, output);

  return (
    <motion.p
      style={{ opacity }}
      className="absolute inset-0 flex items-center justify-center text-[10px] font-bold uppercase tracking-[0.16em] text-center"
    >
      {t(`story.${chapter.key}e`)}
    </motion.p>
  );
}

export function ProductStory({ locale, t, id }: StoryProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end end"],
  });

  // Mirror the real dashboard numbers (orders/revenue/customers/products) when
  // a session exists; signed-out visitors see the demo series instead — the
  // story always shows numbers, and they always reflect the live endpoint when
  // it can answer.
  const [live, setLive] = useState<LiveStats>({ stats: DEMO_STATS });
  useEffect(() => {
    let cancelled = false;
    fetch("/api/dashboard", { credentials: "include", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d?.stats) setLive(d);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const ringRotate = useTransform(scrollYProgress, [0, 1], [0, 360]);
  const coreGlow = useTransform(scrollYProgress, [0, 1], [0.55, 1.25]);

  return (
    <MotionConfig reducedMotion="user">
      <section
        ref={ref}
        id={id}
        className="relative h-[340vh] scroll-mt-24"
        aria-label={t("story.aria")}
      >
        <div className="sticky top-0 h-screen overflow-hidden flex flex-col justify-center">
          {/* Ambient nebula backdrop */}
          <div
            aria-hidden
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "radial-gradient(ellipse 60% 45% at 22% 50%, hsl(var(--primary) / 0.10), transparent 65%)",
            }}
          />

          <div className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 grid lg:grid-cols-2 gap-8 lg:gap-16 items-center">
            {/* ── Cosmic orbit visual (lg+) ── */}
            <div
              className="hidden lg:flex items-center justify-center relative h-[440px] select-none"
              aria-hidden
            >
              <motion.div
                style={{ scale: coreGlow }}
                className="absolute w-[380px] h-[380px] rounded-full bg-primary/10 blur-[100px] pointer-events-none"
              />
              <motion.div style={{ rotate: ringRotate }} className="relative w-[360px] h-[360px]">
                {/* Orbit rings */}
                <div className="absolute inset-0 rounded-full border border-primary/15" />
                <div className="absolute inset-[14%] rounded-full border border-primary/10 border-dashed" />
                {/* Satellites */}
                <OrbitSatellite
                  progress={scrollYProgress}
                  index={0}
                  count={4}
                  chapter={CHAPTERS[0]}
                  className="top-0 left-1/2 -translate-x-1/2 -translate-y-1/3"
                />
                <OrbitSatellite
                  progress={scrollYProgress}
                  index={1}
                  count={4}
                  chapter={CHAPTERS[1]}
                  className="right-0 top-1/2 translate-x-1/3 -translate-y-1/2"
                />
                <OrbitSatellite
                  progress={scrollYProgress}
                  index={2}
                  count={4}
                  chapter={CHAPTERS[2]}
                  className="bottom-0 left-1/2 -translate-x-1/2 translate-y-1/3"
                />
                <OrbitSatellite
                  progress={scrollYProgress}
                  index={3}
                  count={4}
                  chapter={CHAPTERS[3]}
                  className="left-0 top-1/2 -translate-x-1/3 -translate-y-1/2"
                />
              </motion.div>

              {/* Command core */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-[150px] h-[150px] rounded-3xl border border-border bg-background/80 backdrop-blur shadow-2xl shadow-primary/10 flex flex-col items-center justify-center gap-2 p-4">
                  <div className="relative w-14 h-14">
                    {CHAPTERS.map((c, i) => (
                      <CoreLabel
                        key={c.key}
                        progress={scrollYProgress}
                        index={i}
                        count={4}
                        chapter={c}
                        t={t}
                      />
                    ))}
                  </div>
                  <p className="text-[10px] font-mono text-muted-foreground text-center leading-tight">
                    {t("story.t1")}
                    <br />
                    {t("story.t2")}
                  </p>
                </div>
              </div>
            </div>

            {/* ── Chapter stack (all viewports) ── */}
            <div className="relative h-[460px] md:h-[420px]">
              {CHAPTERS.map((chapter, i) => (
                <ChapterCard
                  key={chapter.key}
                  progress={scrollYProgress}
                  index={i}
                  count={CHAPTERS.length}
                  chapter={chapter}
                  t={t}
                  live={live}
                />
              ))}
            </div>
          </div>

          {/* ── Header + CTA above the grid ── */}
          <div className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 mt-10">
            <p className="text-primary text-sm font-semibold uppercase tracking-widest mb-2">
              {t("story.badge")}
            </p>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-foreground mb-3">
              {t("story.t1")} <span className="text-primary">{t("story.t2")}</span>
            </h2>
            <p className="text-muted-foreground text-base md:text-lg max-w-2xl mb-6">
              {t("story.sub")}
            </p>
            <Link
              href={`/${locale}/dashboard`}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-foreground text-background dark:bg-white dark:text-zinc-950 text-sm font-semibold hover:scale-105 active:scale-95 transition-all duration-300"
            >
              {t("story.cta")} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </MotionConfig>
  );
}
