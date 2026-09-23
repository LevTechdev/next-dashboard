"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Activity } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip } from "@/components/ui/tooltip";
import { bucketValues } from "@/lib/heatmap-buckets";
import { cn } from "@/lib/utils";

/**
 * Activity heatmap — boardui "Heatmap Chart Card" pattern.
 *
 * The geometry is FIXED: a two-axis matrix (week columns × weekday rows, the
 * GitHub grid) of the user's real engagement, sourced from
 * /api/profile/activity (security events + orders merged per day). Switching
 * Weekly / Monthly / Yearly never reshapes the card — it only changes what the
 * colors mean:
 *
 *   weekly  → the day's own activity over the trailing year (1-year max)
 *   monthly → the total of the month that day belongs to
 *   yearly  → the day's own activity over five years, scaled against the
 *             5-year max (the week-column geometry scrolls horizontally).
 *             Year totals as cell values degenerate the ramp — with data in
 *             only one year, every active cell saturates and the rest go
 *             empty — so yearly colors days across a longer memory instead.
 *
 * Interactions follow the reference card:
 *   - hovering a cell rings it with the accent and darkens that cell's
 *     column (week) and row (weekday) labels;
 *   - the headline swaps from the summary to the hovered cell's value;
 *   - cells mix --primary into the chart track by value, so the ramp
 *     follows the theme accent in both light and dark modes.
 * Plain CSS grid/flex — no chart library.
 */

type Granularity = "weekly" | "monthly" | "yearly";

interface ActivityPayload {
  since: string;
  days: Record<string, number>;
  total: number;
  activeDays: number;
}

/** Shared cell shape for the rendering pass. */
interface GridCell {
  /** ISO day key (YYYY-MM-DD) — stable across ranges so cells keep identity. */
  key: string;
  /** Value used for the cell color in the active range. */
  v: number;
}

/** 5-step intensity ramp: accent mixed into the chart track by value. */
function levelClass(level: number): string {
  switch (level) {
    case 0:
      return "bg-muted";
    case 1:
      return "bg-primary/20";
    case 2:
      return "bg-primary/45";
    case 3:
      return "bg-primary/70";
    default:
      return "bg-primary";
  }
}

/**
 * RELATIVE intensity ramp — buckets scale to the observed max so each range
 * self-normalizes (day counts, month totals and year totals live on very
 * different scales).
 */
function levelOf(v: number, max: number): number {
  if (v <= 0 || max <= 0) return 0;
  const r = v / max;
  if (r <= 0.25) return 1;
  if (r <= 0.5) return 2;
  if (r <= 0.75) return 3;
  return 4;
}

const DOW_KEYS = ["dow0", "dow1", "dow2", "dow3", "dow4", "dow5", "dow6"] as const;

export function ActivityHeatmapCard() {
  const t = useTranslations("profile");
  const [data, setData] = useState<ActivityPayload | null>(null);
  const [gran, setGran] = useState<Granularity>("weekly");
  /** key of the hovered cell (column label = hovered cell's week, row = its weekday) */
  const [hoverKey, setHoverKey] = useState<string | null>(null);

  // Yearly colors need five years of day buckets to be meaningful; the other
  // ranges read the trailing 12 months. The API accepts ?years=1..5.
  useEffect(() => {
    let cancelled = false;
    const years = gran === "yearly" ? 5 : 1;
    fetch(`/api/profile/activity?years=${years}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: ActivityPayload | null) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [gran]);

  /**
   * One fixed matrix for every range: weekday rows × week columns, exactly the
   * same cells at the same positions. Only the value each cell is colored by
   * changes with the range, which is what makes the toggle feel like the
   * colors moving rather than the card being rebuilt.
   */
  const { columns, rowLabels, max } = useMemo((): {
    columns: GridCell[][];
    rowLabels: string[];
    max: number;
  } => {
    if (!data) return { columns: [], rowLabels: [], max: 0 };

    // Per-range cell values (weekly/yearly → day counts, monthly → month
    // totals) — shared with the member grids via the pure bucket module so
    // every surface reconciles identically.
    const values = bucketValues(data.days, gran);
    const cellValue = (key: string): number => values[key] ?? 0;

    const start = new Date(data.since);
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7)); // back to Monday
    // windowEnd derives from the API's server timestamp (data.since is 364×N
    // days before it) — keeping Date.now() out of render keeps the card
    // hydration-stable and the react-hooks purity rule happy.
    const end = new Date(data.since);
    end.setDate(end.getDate() + 364 * (gran === "yearly" ? 5 : 1));
    const windowEnd = new Date(Math.max(end.getTime(), start.getTime() + 52 * 7 * 86_400_000));
    const columns: GridCell[][] = [];
    let max = 0;
    const cursor = new Date(start);
    while (cursor <= windowEnd) {
      const col: GridCell[] = [];
      for (let d = 0; d < 7; d += 1) {
        const y = cursor.getFullYear();
        const m = String(cursor.getMonth() + 1).padStart(2, "0");
        const day = String(cursor.getDate()).padStart(2, "0");
        const key = `${y}-${m}-${day}`;
        const v = cellValue(key);
        max = Math.max(max, v);
        col.push({ key, v });
        cursor.setDate(cursor.getDate() + 1);
      }
      columns.push(col);
    }
    return { columns, rowLabels: DOW_KEYS.map((k) => t(k)), max };
  }, [data, gran, t]);

  // Column header labels on the same geometry: weekly ticks every fifth week,
  // monthly names the month a column's week opens, yearly marks year starts.
  const colLabels = useMemo(
    () =>
      columns.map((col, i) => {
        const first = col[0];
        if (!first) return "";
        const d = new Date(first.key + "T00:00:00");
        if (gran === "weekly") {
          return i % 5 === 0
            ? d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
            : "";
        }
        if (gran === "monthly") {
          return d.getDate() <= 7 ? d.toLocaleDateString(undefined, { month: "short" }) : "";
        }
        return d.getMonth() === 0 && d.getDate() <= 7 ? String(d.getFullYear()) : "";
      }),
    [columns, gran],
  );

  const total = data?.total ?? 0;
  const activeDays = data?.activeDays ?? 0;
  const hovered = hoverKey ? (columns.flat().find((c) => c.key === hoverKey) ?? null) : null;
  const hoveredWeekIdx = hovered ? columns.findIndex((w) => w.some((c) => c.key === hoverKey)) : -1;
  const hoveredRowIdx =
    hoveredWeekIdx >= 0 ? columns[hoveredWeekIdx].findIndex((c) => c.key === hoverKey) : -1;

  // The headline names the bucket that the hovered cell's color represents —
  // a plain date for weekly, the month/year total for the aggregates.
  const hoveredBucket = hovered ? new Date(hovered.key + "T00:00:00") : null;
  const hoveredLabel = hoveredBucket
    ? gran === "weekly"
      ? hoveredBucket.toLocaleDateString(undefined, { month: "short", day: "numeric" })
      : gran === "monthly"
        ? hoveredBucket.toLocaleDateString(undefined, { month: "long", year: "numeric" })
        : hoveredBucket.toLocaleDateString(undefined, {
            weekday: "short",
            month: "short",
            day: "numeric",
            year: "numeric",
          })
    : "";
  const headline = hovered
    ? gran === "monthly"
      ? t("activityBucketHeadline", { label: hoveredLabel, count: hovered.v })
      : t("activityCellHeadline", { count: hovered.v, date: hoveredLabel })
    : t("activitySummary", { total: total.toLocaleString(), days: activeDays.toLocaleString() });

  // Tooltip body: the shared ICUs, composed — no separate tooltip-only keys.
  const cellTooltip = (v: number, key: string) => {
    const d = new Date(key + "T00:00:00");
    if (gran === "weekly") {
      return t("activityCellHeadline", {
        count: v,
        date: d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }),
      });
    }
    if (gran === "monthly") {
      return t("activityBucketHeadline", {
        label: d.toLocaleDateString(undefined, { month: "long", year: "numeric" }),
        count: v,
      });
    }
    // Yearly colors days, so the tooltip names the day (with the year — the
    // window spans five of them).
    return t("activityCellHeadline", {
      count: v,
      date: d.toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
    });
  };

  return (
    <Card data-testid="activity-heatmap-card">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2">
        <div className="min-w-0">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary shrink-0" />
            {t("activityTitle")}
          </CardTitle>
          <CardDescription
            data-testid="activity-headline"
            className={cn("transition-colors", hovered && "text-foreground font-medium")}
          >
            {headline}
          </CardDescription>
        </div>
        {/* Same tab pills as the revenue overview chart — one switcher
            language across the dashboard. */}
        <div
          className="flex items-center rounded-full bg-gray-100 dark:bg-gray-800/70 p-1 text-xs shrink-0"
          role="tablist"
          aria-label={t("activityTitle")}
        >
          {(["weekly", "monthly", "yearly"] as const).map((g) => (
            <button
              key={g}
              role="tab"
              aria-selected={gran === g}
              onClick={() => {
                setGran(g);
                setHoverKey(null);
              }}
              className={cn(
                "rounded-full px-3 py-1 font-medium transition-colors cursor-pointer",
                gran === g
                  ? "bg-white dark:bg-gray-950 shadow-sm text-gray-900 dark:text-gray-100"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200",
              )}
              data-testid={`activity-gran-${g}`}
            >
              {t(`activityGran${g.charAt(0).toUpperCase() + g.slice(1)}`)}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto pb-1 scrollbar-auto-hide" data-testid="activity-heatmap">
          <div className="min-w-max">
            <div className="flex gap-[3px] pl-8">
              {colLabels.map((label, i) => (
                <div
                  key={i}
                  className="w-[11px] text-[9px] text-muted-foreground text-left overflow-visible whitespace-nowrap"
                >
                  {/* Collapsed columns render a fixed-width slot; the label
                      is allowed to overflow into the gutter like GitHub's. */}
                  <span
                    className={cn(
                      "inline-block transition-colors",
                      hoveredWeekIdx === i && "text-foreground font-semibold",
                    )}
                  >
                    {label}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex gap-[3px]">
              {/* Row labels (Mon..Sun) — darken the hovered cell's row */}
              <div className="flex flex-col gap-[3px] w-8 shrink-0">
                {rowLabels.map((label, d) => (
                  <span
                    key={`${label}-${d}`}
                    className={cn(
                      "h-[11px] w-8 flex items-center text-[9px] leading-none text-muted-foreground transition-colors",
                      hovered && hoveredRowIdx === d && "text-foreground font-semibold",
                    )}
                  >
                    {label}
                  </span>
                ))}
              </div>
              <div className="flex gap-[3px]">
                {columns.map((week, wi) => (
                  <div key={wi} className="flex flex-col gap-[3px]">
                    {week.map((cell, ri) => (
                      <Tooltip
                        key={`${cell.key}-${ri}`}
                        side="top"
                        delay={0}
                        content={
                          <span className="whitespace-nowrap tabular-nums">
                            {cellTooltip(cell.v, cell.key)}
                          </span>
                        }
                      >
                        <span
                          onMouseEnter={() => setHoverKey(cell.key)}
                          onMouseLeave={() => setHoverKey(null)}
                          onFocus={() => setHoverKey(cell.key)}
                          onBlur={() => setHoverKey(null)}
                          tabIndex={0}
                          className={cn(
                            // transition-colors (not transition-all): switching
                            // ranges should glide the ramp between values while
                            // every cell keeps its position and size.
                            "h-[11px] w-[11px] rounded-[3px] transition-colors duration-500 outline-offset-1",
                            levelClass(levelOf(cell.v, max)),
                            // Hover ring in the accent + darken siblings' labels
                            hoverKey === cell.key &&
                              "ring-2 ring-primary ring-offset-1 ring-offset-background",
                          )}
                          data-testid={`activity-cell-${cell.key}-${ri}`}
                        />
                      </Tooltip>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="mt-2 flex items-center justify-end gap-1.5 text-[11px] text-muted-foreground">
          <span>{t("activityLess")}</span>
          {[0, 1, 2, 3, 4].map((l) => (
            <span key={l} className={cn("h-[10px] w-[10px] rounded-[3px]", levelClass(l))} />
          ))}
          <span>{t("activityMore")}</span>
        </div>
      </CardContent>
    </Card>
  );
}
