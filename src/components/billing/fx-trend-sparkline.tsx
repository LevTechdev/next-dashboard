"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

/**
 * Thirty days of a currency pair as a line.
 *
 * The y axis is the rate itself (min..max of the observed window, padded), so
 * the shape IS the market: a flat stretch reads flat, a jump reads as a jump.
 * Only days that were actually recorded get a point — a gap means "not
 * captured", and the line BREAKS rather than interpolating across it, the
 * same honesty rule as the recovery sparkline. A snapshot missing one day is
 * normal (the app was not running at 03:00); inventing the rate it would
 * have had is the one thing a pricing surface must not do.
 */

export interface FxTrendPoint {
  day: string; // YYYY-MM-DD
  rate: number;
  movePct: number | null;
}

const WIDTH = 320;
const HEIGHT = 56;
const PAD_X = 4;
const PAD_Y = 8;

export function FxTrendSparkline({
  points,
  days = 30,
  className,
  dataTestId = "fx-trend-sparkline",
}: {
  points: FxTrendPoint[];
  days?: number;
  className?: string;
  dataTestId?: string;
}) {
  const t = useTranslations("pricingPage");
  const gradId = useId();

  // Slot per calendar day so the x axis is time, not row order.
  const today = new Date();
  const indexOf = (day: string): number => {
    const then = new Date(`${day}T00:00:00.000Z`);
    const start = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
    const diff = Math.round((start - then.getTime()) / 86_400_000);
    return days - 1 - diff;
  };

  const slotted: ((FxTrendPoint & { x: number; y: number }) | null)[] = Array.from(
    { length: days },
    () => null,
  );
  const rates = points.map((p) => p.rate);
  const min = Math.min(...rates);
  const max = Math.max(...rates);
  const span = max - min || Math.max(max * 0.001, 1e-6); // flat series still draws a line

  for (const p of points) {
    const i = indexOf(p.day);
    if (i < 0 || i >= days) continue;
    const x = PAD_X + (i / (days - 1)) * (WIDTH - PAD_X * 2);
    const y = PAD_Y + (1 - (p.rate - min) / span) * (HEIGHT - PAD_Y * 2);
    slotted[i] = { ...p, x, y };
  }

  // Segments between consecutive occupied slots; a hole ends the segment.
  const segments: string[] = [];
  let current: string[] = [];
  for (const s of slotted) {
    if (s) {
      current.push(`${current.length === 0 ? "M" : "L"}${s.x.toFixed(1)},${s.y.toFixed(1)}`);
    } else if (current.length > 1) {
      segments.push(current.join(" "));
      current = [];
    } else {
      current = [];
    }
  }
  if (current.length > 1) segments.push(current.join(" "));

  const last = [...slotted]
    .reverse()
    .find((s): s is FxTrendPoint & { x: number; y: number } => !!s);

  return (
    <div className={cn("w-full", className)} data-testid={dataTestId}>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-14 w-full"
        preserveAspectRatio="none"
        role="img"
        aria-label={t("fxTrendTitle", { days })}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" className="[stop-color:var(--primary)] [stop-opacity:0.25]" />
            <stop offset="100%" className="[stop-color:var(--primary)] [stop-opacity:0]" />
          </linearGradient>
        </defs>
        {segments.map((d, i) => (
          <path
            key={i}
            d={d}
            fill="none"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="stroke-[var(--primary)]"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {segments.map((d, i) => (
          <path
            key={`fill-${i}`}
            d={`${d} L${WIDTH - PAD_X},${HEIGHT} L${PAD_X},${HEIGHT} Z`}
            fill={`url(#${gradId})`}
            stroke="none"
          />
        ))}
        {last && (
          <circle
            cx={last.x}
            cy={last.y}
            r={3}
            className="fill-[var(--primary)]"
            data-testid={`${dataTestId}-last`}
          />
        )}
      </svg>
      <p className="mt-1 flex items-baseline gap-2 text-xs text-muted-foreground">
        <span className="tabular-nums font-medium text-foreground">
          {last ? last.rate.toLocaleString("en-US", { maximumFractionDigits: 2 }) : "—"}
        </span>
        <span data-testid={`${dataTestId}-move`}>
          {last?.movePct != null
            ? t("fxTrendMove", { pct: last.movePct.toFixed(2) })
            : t("fxTrendFirst")}
        </span>
      </p>
    </div>
  );
}
