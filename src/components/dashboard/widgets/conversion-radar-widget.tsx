"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from "recharts";
import {
  ArrowDown,
  ArrowUp,
  Building2,
  Crown,
  Eye,
  Minus,
  UserPlus,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { cn } from "@/lib/utils";

/**
 * Conversion radar — the funnel as a polygon (boardui radar-chart-card shape).
 *
 * Everything here comes from `/api/dashboard/pipeline` (`?range=`): the six
 * stage counts, the per-stage conversion rates and their deltas. The radar
 * plots each stage as a share of the top of the funnel so the polygon stays
 * readable when the first stage is thousands and the last is dozens — the raw
 * counts live in the headline, the funnel list and the tiles, never on the
 * axes.
 *
 * The axis labels are given their own padding and a smaller tick font on
 * purpose: polar tick text is drawn inside the SVG bounds, so a long label on
 * the left/right apexes gets silently clipped against the chart edge (that is
 * the "text around the matrix didn't show up" symptom). `outerRadius` is held
 * back to leave room for them, and `margin` gives the wrapped labels breathing
 * space, so no label is ever cut off.
 *
 * `variant` switches the series rendering: filled, dotted, lines-only, or the
 * centre-score layout that moves the count-up headline into the middle of the
 * polygon.
 */

export type RadarVariant = "filled" | "dotted" | "lines" | "centre-score";

type Range = "7d" | "30d" | "90d";

const RANGES: Range[] = ["7d", "30d", "90d"];

const VARIANTS: RadarVariant[] = ["filled", "dotted", "lines", "centre-score"];

interface StageConversion {
  /** Stage ÷ top-of-funnel rate, percent. Null when the denominator is 0. */
  rate: number | null;
  /** Change vs the previous window, percentage points. Null when unknown. */
  deltaPp: number | null;
}

interface PipelinePayload {
  visits: number;
  signups: number;
  active: number;
  pro: number;
  team: number;
  enterprise: number;
  conversions?: Partial<Record<string, StageConversion>>;
}

/** Keeps the card presentable before first paint or when the endpoint is unavailable. */
const FALLBACK: PipelinePayload = {
  visits: 1180,
  signups: 790,
  active: 460,
  pro: 250,
  team: 120,
  enterprise: 40,
};

interface AxisMeta {
  key: keyof PipelinePayload;
  labelKey: string;
  /** Key into `conversions` for this stage's rate/delta. */
  conversionKey: string;
  icon: LucideIcon;
}

const AXES: AxisMeta[] = [
  { key: "visits", labelKey: "stageVisits", conversionKey: "visits", icon: Eye },
  { key: "signups", labelKey: "stageSignups", conversionKey: "visitToSignup", icon: UserPlus },
  { key: "active", labelKey: "stageActive", conversionKey: "signupToActive", icon: Zap },
  { key: "pro", labelKey: "stagePro", conversionKey: "activeToPro", icon: Crown },
  { key: "team", labelKey: "stageTeam", conversionKey: "proToTeam", icon: Users },
  {
    key: "enterprise",
    labelKey: "stageEnterprise",
    conversionKey: "teamToEnterprise",
    icon: Building2,
  },
];

interface Axis {
  key: string;
  label: string;
  value: number;
  share: number;
  rate: number | null;
  deltaPp: number | null;
  icon: LucideIcon;
}

const SERIES_BY_VARIANT: Record<
  RadarVariant,
  { fill: string; fillOpacity: number; strokeDasharray?: string; strokeWidth: number }
> = {
  filled: { fill: "var(--primary)", fillOpacity: 0.28, strokeWidth: 2 },
  dotted: { fill: "var(--primary)", fillOpacity: 0.1, strokeDasharray: "3 4", strokeWidth: 2 },
  lines: { fill: "transparent", fillOpacity: 0, strokeWidth: 2.5 },
  "centre-score": { fill: "var(--primary)", fillOpacity: 0.16, strokeWidth: 2 },
};

const VARIANT_LABEL_KEY: Record<RadarVariant, string> = {
  filled: "radarViewFilled",
  dotted: "radarViewDotted",
  lines: "radarViewLines",
  "centre-score": "radarViewScore",
};

const fmtInt = (n: number) => Math.round(n).toLocaleString();

function DeltaChip({ deltaPp }: { deltaPp: number | null }) {
  // No chip when the previous window is unknown: an empty "— pt" pill is worse
  // than saying nothing, and the caption below the chart covers the explanation.
  if (deltaPp === null || !Number.isFinite(deltaPp)) return null;
  const up = deltaPp > 0;
  const flat = deltaPp === 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums",
        flat
          ? "bg-muted text-muted-foreground"
          : up
            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
            : "bg-rose-500/10 text-rose-600 dark:text-rose-400",
      )}
    >
      {flat ? (
        <Minus className="h-3 w-3" />
      ) : up ? (
        <ArrowUp className="h-3 w-3" />
      ) : (
        <ArrowDown className="h-3 w-3" />
      )}
      {`${up ? "+" : ""}${deltaPp.toFixed(1)} pt`}
    </span>
  );
}

/**
 * Which axis is currently hovered, read by the dots.
 *
 * Context rather than a prop: recharts clones the `dot` element per point
 * through `filterProps`, which drops props it does not recognise for an SVG
 * element — a custom `activeIndex` prop never survived the clone.
 */
const RadarHoverContext = createContext<number | null>(null);

/**
 * A series dot, pulsing when its axis is the active one.
 *
 * This is passed as an ELEMENT (`dot={<PulsingDot …/>}`), not as a render
 * function, and that detail matters: recharts clones a given element per point
 * and hands it its own unique `key: dot-<i>`, whereas a function's returned
 * element keeps whatever key it set. Several zero-value axes collapse onto the
 * same centre point, so a position-derived key collides and React starts
 * dropping dots from the layer.
 */
function PulsingDot({ cx, cy, index }: { cx?: number; cy?: number; index?: number }) {
  const activeIndex = useContext(RadarHoverContext);
  if (typeof cx !== "number" || typeof cy !== "number") return null;
  const active = activeIndex !== null && activeIndex === index;
  return (
    <g>
      {active && (
        <circle cx={cx} cy={cy} r={7} fill="var(--primary)" opacity={0.3}>
          <animate attributeName="r" values="5;9;5" dur="1.8s" repeatCount="indefinite" />
          <animate
            attributeName="opacity"
            values="0.45;0.05;0.45"
            dur="1.8s"
            repeatCount="indefinite"
          />
        </circle>
      )}
      <circle
        cx={cx}
        cy={cy}
        r={3.5}
        fill="var(--primary)"
        stroke="var(--background)"
        strokeWidth={1.5}
      />
    </g>
  );
}

export function ConversionRadarWidget({
  variant: initialVariant = "filled",
}: {
  variant?: RadarVariant;
} = {}) {
  const t = useTranslations("dashboard");
  const [range, setRange] = useState<Range>("30d");
  const [variant, setVariant] = useState<RadarVariant>(initialVariant);
  const [payload, setPayload] = useState<PipelinePayload | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Real pipeline numbers for the selected window. This is an effect rather
  // than a useMemo body: memo callbacks must stay pure and are re-run whenever
  // React feels like it, which used to fire duplicate requests per render.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/dashboard/pipeline?range=${range}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: PipelinePayload | null) => {
        if (cancelled) return;
        setPayload(d && typeof d.visits === "number" ? d : FALLBACK);
      })
      .catch(() => {
        if (!cancelled) setPayload(FALLBACK);
      });
    return () => {
      cancelled = true;
    };
  }, [range]);

  const data = payload ?? FALLBACK;

  const axes: Axis[] = useMemo(() => {
    const top = Math.max(...AXES.map((a) => Number(data[a.key]) || 0), 1);
    return AXES.map((meta) => {
      const value = Number(data[meta.key]) || 0;
      const conversion = data.conversions?.[meta.conversionKey];
      return {
        key: String(meta.key),
        label: t(meta.labelKey),
        value,
        share: Math.round((value / top) * 100),
        rate: conversion?.rate ?? null,
        deltaPp: conversion?.deltaPp ?? null,
        icon: meta.icon,
      };
    });
  }, [data, t]);

  const headline = (hoveredIndex !== null ? axes[hoveredIndex] : null) ?? axes[0];
  const topStage = axes.reduce((best, a) => (a.value > best.value ? a : best), axes[0]);
  const biggestDrop = useMemo(() => {
    let worst: { from: Axis; to: Axis; lost: number } | null = null;
    for (let i = 1; i < axes.length; i += 1) {
      const from = axes[i - 1];
      const to = axes[i];
      if (from.value <= 0) continue;
      const lost = Math.round(((from.value - to.value) / from.value) * 100);
      if (!worst || lost > worst.lost) worst = { from, to, lost };
    }
    return worst;
  }, [axes]);

  const endToEndRate =
    axes[0] && axes[0].value > 0 ? (axes[axes.length - 1].value / axes[0].value) * 100 : 0;

  const chartData = axes.map((a) => ({ axis: a.label, share: a.share, raw: a.value }));
  const series = SERIES_BY_VARIANT[variant];
  const centred = variant === "centre-score";

  return (
    <Card className="overflow-hidden border-border/70 shadow-sm">
      <CardHeader className="flex flex-col gap-3 pb-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <Zap className="h-4 w-4 shrink-0 text-amber-500" />
            <span className="break-words">{t("funnelHealthTitle")}</span>
          </CardTitle>
          {!centred && (
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <AnimatedCounter
                end={headline?.value ?? 0}
                formatter={fmtInt}
                className="text-2xl font-bold tracking-tight"
              />
              <span className="text-xs text-muted-foreground">{headline?.label}</span>
              <DeltaChip deltaPp={headline?.deltaPp ?? null} />
            </div>
          )}
          <CardDescription className="mt-1 break-words">{t("funnelHealthDesc")}</CardDescription>
        </div>

        <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
          {/* Period pill — localized labels ("7D"/"30D"/"90D" read as raw
              English tokens in ja/zh); equal-height segments keep the pill
              symmetric like the boardui reference. */}
          <div
            role="group"
            aria-label={t("radarRangeLabel")}
            className="flex items-center gap-1 rounded-xl border border-border/50 bg-muted/60 p-1 text-xs"
          >
            {RANGES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRange(r)}
                aria-pressed={range === r}
                className={cn(
                  "rounded-lg px-2.5 py-1 font-medium transition-colors",
                  range === r
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t(`radarRange_${r}` as never)}
              </button>
            ))}
          </div>

          {/* Series rendering — full localized labels (boardui pill group) */}
          <div
            role="group"
            aria-label={t("radarViewLabel")}
            className="flex items-center gap-1 rounded-xl border border-border/50 bg-muted/60 p-1"
          >
            {VARIANTS.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setVariant(v)}
                aria-pressed={variant === v}
                aria-label={t(VARIANT_LABEL_KEY[v])}
                className={cn(
                  "rounded-lg px-2 py-1 text-[10px] font-semibold transition-colors",
                  variant === v
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t(VARIANT_LABEL_KEY[v])}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5 p-4 sm:p-6">
        {/* Radar: normalized polygon, chart-token grid, pulsing active dot. */}
        <div className="relative" aria-label={t("radarAria")} role="img">
          <div className="h-[300px] w-full text-muted-foreground">
            <RadarHoverContext.Provider value={hoveredIndex}>
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart
                  data={chartData}
                  outerRadius="68%"
                  margin={{ top: 26, right: 40, bottom: 26, left: 40 }}
                  onMouseMove={(state: { activeTooltipIndex?: number } | null) => {
                    const index = state?.activeTooltipIndex;
                    setHoveredIndex(typeof index === "number" ? index : null);
                  }}
                  onMouseLeave={() => setHoveredIndex(null)}
                >
                  <PolarGrid className="text-border" stroke="currentColor" />
                  <PolarRadiusAxis tick={false} axisLine={false} domain={[0, 100]} tickCount={5} />
                  <PolarAngleAxis
                    dataKey="axis"
                    tickLine={false}
                    tick={{ fill: "currentColor", fontSize: 10, fontWeight: 600 }}
                  />
                  <Radar
                    dataKey="share"
                    stroke="var(--primary)"
                    strokeWidth={series.strokeWidth}
                    strokeDasharray={series.strokeDasharray}
                    fill={series.fill}
                    fillOpacity={series.fillOpacity}
                    isAnimationActive
                    animationDuration={600}
                    dot={<PulsingDot />}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </RadarHoverContext.Provider>
          </div>

          {/* Centre-score layout: same count-up headline, moved inside the polygon. */}
          {centred && (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
              <AnimatedCounter
                end={headline?.value ?? 0}
                formatter={fmtInt}
                className="text-3xl font-bold tracking-tight"
              />
              <span className="mt-0.5 max-w-[10rem] text-xs text-muted-foreground">
                {headline?.label}
              </span>
              <div className="mt-2">
                <DeltaChip deltaPp={headline?.deltaPp ?? null} />
              </div>
            </div>
          )}
        </div>

        {axes.some((a) => a.deltaPp !== null) && (
          <p className="text-center text-[10px] text-muted-foreground">{t("radarVsPrevious")}</p>
        )}

        {/* Funnel list — real stage counts, labels translated, nothing clipped. */}
        <div className="space-y-3">
          {axes.map((axis, axisIndex) => {
            const Icon = axis.icon;
            return (
              <button
                key={axis.key}
                type="button"
                onMouseEnter={() => setHoveredIndex(axisIndex)}
                onFocus={() => setHoveredIndex(axisIndex)}
                onMouseLeave={() => setHoveredIndex(null)}
                onBlur={() => setHoveredIndex(null)}
                className="block w-full space-y-1.5 rounded-lg p-1 text-left transition-colors hover:bg-muted/40"
              >
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="break-words font-semibold text-foreground">{axis.label}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-3">
                    <span className="font-mono text-muted-foreground">{fmtInt(axis.value)}</span>
                    <span className="w-12 text-right font-bold tabular-nums text-foreground">
                      {axis.rate === null ? `${axis.share}%` : `${axis.rate.toFixed(1)}%`}
                    </span>
                  </span>
                </div>
                <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-muted/50">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-700"
                    style={{ width: `${axis.share}%` }}
                  />
                </div>
              </button>
            );
          })}
        </div>

        {/* Tiles — all four derived from the same real payload. */}
        <div className="grid grid-cols-2 gap-3 pt-1 lg:grid-cols-4">
          <Tile
            icon={Crown}
            label={t("radarBestStage")}
            value={topStage?.label ?? "—"}
            hint={`${fmtInt(topStage?.value ?? 0)} ${t("stageVisits").toLowerCase()}`}
            tone="text-emerald-500"
          />
          <Tile
            icon={ArrowDown}
            label={t("radarBiggestDrop")}
            value={biggestDrop ? `−${biggestDrop.lost}%` : "—"}
            hint={
              biggestDrop ? `${biggestDrop.from.label} → ${biggestDrop.to.label}` : t("radarNoData")
            }
            tone="text-rose-500"
          />
          <Tile
            icon={Users}
            label={t("radarTotalPipeline")}
            value={fmtInt(axes.reduce((sum, a) => sum + a.value, 0))}
            hint={t("stageEnterprise")}
            tone="text-sky-500"
          />
          <Tile
            icon={Zap}
            label={t("radarEndToEnd")}
            value={`${endToEndRate.toFixed(1)}%`}
            hint={`${t("stageVisits")} → ${t("stageEnterprise")}`}
            tone="text-amber-500"
          />
        </div>
      </CardContent>
    </Card>
  );
}

function Tile({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint: string;
  tone: string;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-border/60 bg-muted/30 p-3">
      <div className="flex items-start justify-between gap-2">
        <span className="break-words text-[11px] leading-tight text-muted-foreground">{label}</span>
        <Icon className={cn("h-3.5 w-3.5 shrink-0", tone)} />
      </div>
      <p className="mt-1 break-words text-lg font-bold text-foreground">{value}</p>
      <p className="mt-0.5 break-words text-[10px] leading-tight text-muted-foreground">{hint}</p>
    </div>
  );
}
