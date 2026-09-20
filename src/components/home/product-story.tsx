"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  CreditCard,
  Package,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { StackingCards } from "./stacking-cards";

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
 * Product journey — the four chapters of the product as a stacking deck.
 *
 * The section header now sits ABOVE the deck (it used to render under the
 * pinned stage, which read as a caption for the wrong thing), and the deck
 * itself uses the stacking-cards layout: each chapter pins near the top and the
 * next one slides over it, so the journey arrives one card at a time instead of
 * requiring the reader to sit through a pinned crossfade.
 *
 * Live numbers still come from /api/dashboard when a session exists; the demo
 * series keeps the story populated for signed-out visitors.
 */

const CHAPTERS: { key: string; icon: LucideIcon; accent: string }[] = [
  { key: "c1", icon: Package, accent: "#38bdf8" },
  { key: "c2", icon: CreditCard, accent: "#10b981" },
  { key: "c3", icon: BarChart3, accent: "#f59e0b" },
  { key: "c4", icon: Workflow, accent: "#a78bfa" },
];

interface StoryProps {
  locale: string;
  /** Anchor id so the hero Signal Strip can deep-link straight to the story. */
  id?: string;
  t: (key: string, values?: Record<string, string | number>) => string;
}

function ChapterCard({
  chapter,
  index,
  total,
  t,
  live,
}: {
  chapter: (typeof CHAPTERS)[number];
  index: number;
  total: number;
  t: (key: string, values?: Record<string, string | number>) => string;
  live: LiveStats | null;
}) {
  const Icon = chapter.icon;

  // Live stat chip per chapter — mirrors the real /api/dashboard numbers when a
  // session exists; demo counts otherwise (the page stays consistent).
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
    <article
      className="relative overflow-hidden rounded-3xl border border-border/70 bg-background/95 p-6 shadow-xl shadow-primary/5 backdrop-blur sm:p-8 lg:p-10"
      aria-labelledby={`story-${chapter.key}-title`}
    >
      {/* Chapter accent wash */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-24 h-48 opacity-40 blur-3xl"
        style={{
          background: `radial-gradient(ellipse at 20% 100%, ${chapter.accent}33, transparent 70%)`,
        }}
      />

      <div className="relative flex items-center gap-3">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
          style={{ background: `${chapter.accent}1f`, color: chapter.accent }}
        >
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p
            className="text-xs font-semibold uppercase tracking-[0.2em]"
            style={{ color: chapter.accent }}
          >
            {t(`story.${chapter.key}e`)}
          </p>
        </div>
        <span className="ml-auto font-mono text-[11px] text-muted-foreground">
          {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
        </span>
      </div>

      <h3
        id={`story-${chapter.key}-title`}
        className="relative mt-5 text-2xl font-bold tracking-tight text-foreground sm:text-3xl"
      >
        {t(`story.${chapter.key}t`)}
      </h3>
      <p className="relative mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
        {t(`story.${chapter.key}b`)}
      </p>

      <div className="relative mt-6 flex flex-wrap gap-2">
        {[1, 2, 3].map((f) => (
          <span
            key={f}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground"
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: chapter.accent }} />
            {t(`story.${chapter.key}f${f}`)}
          </span>
        ))}
      </div>

      {liveStat && (
        <p className="relative mt-6 inline-flex items-center gap-2 font-mono text-xs text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse motion-reduce:animate-none" />
          {liveStat}
        </p>
      )}
    </article>
  );
}

export function ProductStory({ locale, t, id }: StoryProps) {
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

  return (
    <section
      id={id}
      aria-label={t("story.aria")}
      className={cn("relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 py-16 sm:py-20 scroll-mt-24")}
    >
      {/* ── Section header (above the deck) ── */}
      <header className="mx-auto max-w-3xl text-center">
        <p className="text-primary text-xs sm:text-sm font-semibold uppercase tracking-widest">
          {t("story.badge")}
        </p>
        <h2 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
          {t("story.t1")} <span className="text-primary">{t("story.t2")}</span>
        </h2>
        <p className="mt-4 text-base text-muted-foreground sm:text-lg">{t("story.sub")}</p>
        <div className="mt-7">
          <Link
            href={`/${locale}/dashboard`}
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-all duration-300 hover:scale-105 active:scale-95 dark:bg-white dark:text-zinc-950"
          >
            {t("story.cta")} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </header>

      {/* ── The deck: chapters stack over one another as the reader scrolls ── */}
      <StackingCards className="mt-14" stickyTop={112} cardSlotClassName="h-[min(72vh,500px)]">
        {CHAPTERS.map((chapter, index) => (
          <ChapterCard
            key={chapter.key}
            chapter={chapter}
            index={index}
            total={CHAPTERS.length}
            t={t}
            live={live}
          />
        ))}
      </StackingCards>
    </section>
  );
}
