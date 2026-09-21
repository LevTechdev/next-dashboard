"use client";

import { useTranslations } from "next-intl";

import { READINESS_RANK, onRecoveryLadder, type ReadinessLevel } from "@/lib/recovery-readiness";
import { cn } from "@/lib/utils";

/**
 * Thirty days of "could I still get in?" as a line.
 *
 * Readiness drifts — a recovery code gets spent, a spare device is wiped with
 * the phone it lived on — and a single number cannot show a slide. The line is
 * plotted on the ladder's rank, so a step DOWN is visibly a step down, and only
 * days that were actually measured get a point: a gap means "not recorded",
 * and the line BREAKS rather than interpolating across it. Drawing through a
 * hole would invent a reading, which is the one thing this panel must not do.
 */

export interface ReadinessPoint {
  day: string; // YYYY-MM-DD
  level: ReadinessLevel;
}

const WIDTH = 300;
const HEIGHT = 44;
const PAD_X = 3;
const PAD_Y = 5;

/** Ladder rank → y (covered at the top, locked out at the bottom). */
function yForRank(rank: number): number {
  const span = HEIGHT - PAD_Y * 2;
  return PAD_Y + (1 - rank / 3) * span;
}

function yFor(level: ReadinessLevel): number | null {
  if (!onRecoveryLadder(level)) return null;
  return yForRank(READINESS_RANK[level]);
}

/** Marker colour for a verdict. Token-based — never a hardcoded brand hue. */
function colorFor(level: ReadinessLevel): string {
  const rank = READINESS_RANK[level];
  if (rank === 3) return "text-primary";
  if (rank === 2) return "text-amber-500";
  return "text-destructive";
}

export function ReadinessSparkline({
  points,
  days = 30,
  className,
  dataTestId = "recovery-sparkline",
}: {
  points: ReadinessPoint[];
  days?: number;
  className?: string;
  dataTestId?: string;
}) {
  const t = useTranslations("security");

  // Slot per calendar day, so the x axis is time and not "row number" — two
  // measurements a week apart must not look adjacent.
  const today = new Date();
  const indexOf = (day: string): number => {
    const then = new Date(`${day}T00:00:00.000Z`);
    const start = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
    const diff = Math.round((start - then.getTime()) / 86_400_000);
    return days - 1 - diff;
  };

  const plotted = points
    .map((p) => ({ ...p, i: indexOf(p.day) }))
    .filter((p) => p.i >= 0 && p.i < days);

  const xFor = (i: number) => PAD_X + (i * (WIDTH - PAD_X * 2)) / Math.max(days - 1, 1);

  // Segments, not one polyline: a break is drawn wherever a day is missing, or
  // where the account left the recovery ladder entirely (2FA switched off).
  const segments: Array<Array<{ x: number; y: number }>> = [];
  let current: Array<{ x: number; y: number }> = [];
  let previousIndex: number | null = null;
  for (const p of plotted) {
    const y = yFor(p.level);
    const contiguous = previousIndex === null || p.i - previousIndex === 1;
    if (y === null || !contiguous) {
      if (current.length > 1) segments.push(current);
      current = [];
    }
    if (y !== null) current.push({ x: xFor(p.i), y });
    previousIndex = p.i;
  }
  if (current.length > 1) segments.push(current);

  const last = plotted[plotted.length - 1];

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={t("recoveryHistoryLabel", { days })}
      data-testid={dataTestId}
      data-points={plotted.length}
      className={cn("h-11 w-full", className)}
    >
      {/* Rank guides: covered, fragile, locked out. */}
      {[3, 2, 1].map((rank) => (
        <line
          key={rank}
          x1={0}
          x2={WIDTH}
          y1={yForRank(rank)}
          y2={yForRank(rank)}
          className={cn(
            "stroke-current",
            rank === 3 ? "text-foreground/[0.10]" : "text-foreground/[0.05]",
          )}
          strokeWidth={1}
          strokeDasharray={rank === 3 ? "3 3" : undefined}
          vectorEffect="non-scaling-stroke"
        />
      ))}

      {segments.map((seg, i) => (
        <polyline
          key={i}
          points={seg.map((p) => `${p.x},${p.y}`).join(" ")}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-primary"
          vectorEffect="non-scaling-stroke"
        />
      ))}

      {plotted.map((p, i) => {
        const y = yFor(p.level);
        const isLast = i === plotted.length - 1;
        return (
          <circle
            key={p.day}
            cx={xFor(p.i)}
            cy={y ?? HEIGHT - PAD_Y}
            r={isLast ? 3.2 : 2}
            className={colorFor(p.level)}
            fill="currentColor"
            data-day={p.day}
            data-level={p.level}
          >
            <title>{`${p.day} · ${t(`recoveryLevel_${p.level}`)}`}</title>
          </circle>
        );
      })}

      {last && yFor(last.level) !== null && (
        <circle
          cx={xFor(last.i)}
          cy={yFor(last.level)!}
          r={6}
          className={cn(colorFor(last.level), "opacity-20")}
          fill="currentColor"
        />
      )}
    </svg>
  );
}
