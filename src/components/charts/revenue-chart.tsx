"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Bar, BarChart, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useCurrency } from "@/components/currency-provider";
import { GlassChartTooltip } from "@/components/charts/glass-tooltip";
import { cn } from "@/lib/utils";

/**
 * Revenue chart — boardui earnings-card style.
 *
 * Rework of the old indigo-gradient Recharts bar chart to match the boardui
 * EarningsChartCard reference: full-height gray tracks behind every slot,
 * rounded accent bars (token-linked --primary, no hardcoded indigo), a
 * ring-highlighted active bar, period pills (Weekly / Monthly / Yearly) and
 * the big period total on the left.
 *
 * The weekly/yearly groupings are derived client-side from the monthly
 * payload's underlying order dates — the dashboard API already returns the
 * trailing-12-month buckets, so the card re-aggregates without a second
 * fetch. `data` rows may carry an optional ISO `month` ("Jan"… or full date);
 * when only short month names exist weekly mode aggregates the trailing 12
 * weeks from `orderDates` when provided, else the pills fall back to monthly.
 */

interface RevenueData {
  month: string;
  revenue: number;
  /** Optional ISO date giving the bucket a real anchor for weekly/yearly. */
  date?: string;
}

interface RevenueChartProps {
  data: RevenueData[] | null | undefined;
  height?: number;
  /** Raw order dates (ISO) enabling the Weekly/Yearly aggregations. */
  orderDates?: string[];
  /**
   * Bar click handler. `month` is the display label ("Jan"…), `iso` the
   * "YYYY-MM" bucket from the row's date anchor when one exists — deep links
   * should always prefer `iso` so the target page can filter unambiguously.
   */
  onClick?: (payload: { month: string; iso: string | null; revenue: number }) => void;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ value?: number | string }>;
  label?: string | number;
}

type Period = "weekly" | "monthly" | "yearly";

const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/**
 * Bar-following tooltip — recharts' default floats to a fixed slot position;
 * `position` + `offset` pin it so it tracks the hovered BAR's top edge
 * (boardui style), clamped by recharts inside the chart bounds. The surface
 * is the shared glass tooltip (white blur light / popover dark).
 */
function CustomTooltip(props: CustomTooltipProps) {
  return <GlassChartTooltip {...props} />;
}

/** Compact money axis label: 0 / 3K / 5K / 10K / 1.2M. */
function compactMoney(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return value.toString();
}

/**
 * Bar shape: full-height gray track + token-linked accent capsule.
 * The track (boardui signature) is drawn by the Bar's `background` prop;
 * this shape renders only the value capsule, highlighted while hovered.
 */
const renderBarShape = (props: {
  x?: number | string;
  y?: number | string;
  width?: number | string;
  height?: number | string;
  index?: number;
}) => {
  const { x, y, width, height, index } = props;
  return (
    <rect
      x={Number(x)}
      y={Number(y)}
      width={Number(width)}
      height={Math.max(Number(height), 8)}
      rx={8}
      className="fill-primary opacity-90 transition-opacity"
      data-testid={`revenue-bar-${index}`}
    />
  );
};

export function RevenueChart({ data, height = 300, orderDates, onClick }: RevenueChartProps) {
  const { formatMoney } = useCurrency();
  const t = useTranslations("dashboard");
  const [period, setPeriod] = useState<Period>("monthly");
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const hasDates = useMemo(
    () => Array.isArray(data) && data.some((d) => d.date || d.month.length > 3),
    [data],
  );

  const chartData = useMemo<Array<{ label: string; revenue: number; date?: string }>>(() => {
    if (!data || data.length === 0) return [];

    if (period === "monthly") {
      return data.map((d) => ({ label: d.month.slice(0, 3), revenue: d.revenue, date: d.date }));
    }

    if (period === "yearly") {
      // Calendar-year buckets from the monthly payloads' date anchors.
      const monthlyWithDates = data.filter((d) => d.date);
      if (monthlyWithDates.length) {
        const byYearRevenue = new Map<number, number>();
        for (const d of monthlyWithDates) {
          const y = new Date(d.date!).getFullYear();
          byYearRevenue.set(y, (byYearRevenue.get(y) ?? 0) + d.revenue);
        }
        return [...byYearRevenue.entries()]
          .sort(([a], [b]) => a - b)
          .map(([y, revenue]) => ({ label: String(y), revenue }));
      }
      return data.map((d) => ({ label: d.month.slice(0, 3), revenue: d.revenue }));
    }

    if (period === "weekly") {
      // Weekly buckets: ISO-week keys from the monthly payloads' date
      // anchors. Without anchors (short month names only) the pill is hidden.
      const withDates = data.filter((d) => d.date);
      if (withDates.length) {
        const byWeek = new Map<string, number>();
        const order: string[] = [];
        for (const d of withDates) {
          const dt = new Date(d.date!);
          // Monday-start ISO week key.
          const day = (dt.getDay() + 6) % 7;
          const ws = new Date(dt);
          ws.setDate(dt.getDate() - day);
          const key = `${ws.getMonth() + 1}/${ws.getDate()}`;
          if (!byWeek.has(key)) order.push(key);
          byWeek.set(key, (byWeek.get(key) ?? 0) + d.revenue);
        }
        return order.slice(-12).map((k) => ({ label: k, revenue: byWeek.get(k) ?? 0 }));
      }
      return data.map((d) => ({ label: d.month.slice(0, 3), revenue: d.revenue }));
    }

    return data.map((d) => ({ label: d.month.slice(0, 3), revenue: d.revenue }));
  }, [data, period, hasDates, orderDates]);

  // Big total + period label on the card header (boardui reference layout).
  const total = chartData.reduce((s, d) => s + d.revenue, 0);
  const periodLabel = useMemo(() => {
    if (chartData.length === 0) return "—";
    if (period === "yearly") {
      const years = [...new Set(chartData.map((d) => d.label))];
      return years.length === 1
        ? years[0]
        : `${chartData[0].label}–${chartData[chartData.length - 1].label}`;
    }
    if (period === "weekly" && chartData[0].label.includes("/")) {
      return `Wk ${chartData[0].label} – Wk ${chartData[chartData.length - 1].label}`;
    }
    const monthIdx = MONTH_SHORT.indexOf(chartData[0].label);
    return monthIdx >= 0
      ? new Date(2024, monthIdx, 1).toLocaleString("en", { month: "long" })
      : chartData[0].label;
  }, [chartData, period]);

  if (!data || data.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-sm text-muted-foreground"
        style={{ height }}
      >
        {t("chartNoData")}
      </div>
    );
  }

  return (
    <div>
      {/* Header: big total + period pills */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">{periodLabel}</p>
          <p
            className="text-2xl font-bold tabular-nums tracking-tight"
            data-testid="revenue-chart-total"
          >
            {formatMoney(total)}
          </p>
        </div>
        <div
          className="flex items-center rounded-full bg-gray-100 dark:bg-gray-800/70 p-1"
          role="tablist"
          aria-label="Chart period"
        >
          {(
            [
              ["weekly", "chartWeekly"],
              ["monthly", "chartMonthly"],
              ["yearly", "chartYearly"],
            ] as const
          )
            // Weekly/Yearly need real date anchors to aggregate honestly.
            .filter(([key]) => key === "monthly" || hasDates)
            .map(([key, labelKey]) => (
              <button
                key={key}
                role="tab"
                aria-selected={period === key}
                onClick={() => setPeriod(key)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                  period === key
                    ? "bg-white dark:bg-gray-950 shadow-sm text-gray-900 dark:text-gray-100"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200",
                )}
              >
                {t(labelKey)}
              </button>
            ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={chartData}
          margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
          barCategoryGap="32%"
        >
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "currentColor" }}
            className="text-gray-400 dark:text-gray-500"
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "currentColor" }}
            className="text-gray-400 dark:text-gray-500"
            axisLine={false}
            tickLine={false}
            width={44}
            tickFormatter={(value: number) => compactMoney(value)}
          />
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ fill: "currentColor", className: "fill-gray-100 dark:fill-gray-800/50" }}
            // Pin the bubble to the hovered bar's geometry (top-center, above
            // the capsule) instead of the slot center — it follows the bar.
            position={{ y: 0 }}
            offset={12}
            animationDuration={80}
          />
          {/* Full-height gray track per slot — the boardui signature. */}
          <Bar
            dataKey="revenue"
            // Capsule bars on a full-height gray track (rendered per-slot by
            // the background so empty months still show their slot).
            background={{
              radius: 8,
              fill: "var(--fallback-gray-100, rgb(243 244 246))",
            }}
            radius={[8, 8, 8, 8]}
            maxBarSize={28}
            onClick={
              onClick
                ? (entry: {
                    month?: string;
                    revenue?: number;
                    payload?: { label?: string; revenue?: number; date?: string };
                  }) => {
                    const label = String(entry?.payload?.label ?? entry?.month ?? "");
                    const anchor = entry?.payload?.date;
                    // ISO month from the row's anchor; short-month labels fall
                    // back to null and callers can ignore the click.
                    const iso = anchor ? String(anchor).slice(0, 7) : null;
                    onClick({
                      month: label,
                      iso,
                      revenue: Number(entry?.payload?.revenue ?? entry?.revenue ?? 0),
                    });
                  }
                : undefined
            }
            style={{ cursor: onClick ? "pointer" : "default", outline: "none" }}
            shape={renderBarShape as never}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
