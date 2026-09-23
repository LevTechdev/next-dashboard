"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { GlassChartTooltip } from "@/components/charts/glass-tooltip";

/**
 * 30-day per-channel revenue trend — stacked areas, one per active channel.
 *
 * Rows come from /api/dashboard `channelTrend`: `{ date, [slug]: revenue }`.
 * Slugs carrying no revenue in the window are omitted server-side, so the
 * chart never draws six flat zero lines for dormant channels.
 */

export interface ChannelTrendRow {
  date: string;
  [channelSlug: string]: number | string;
}

export interface ChannelTrendSeries {
  slug: string;
  name: string;
  color: string;
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function dayLabel(dateKey: string): string {
  const d = new Date(`${dateKey}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return dateKey;
  return DAY_LABELS[d.getUTCDay()];
}

export function ChannelTrendArea({
  data,
  series,
  height = 300,
  formatValue,
}: {
  data: ChannelTrendRow[];
  series: ChannelTrendSeries[];
  height?: number;
  formatValue?: (v: number) => string;
}) {
  const fmt = formatValue ?? ((v: number) => v.toLocaleString("en-US"));
  const hasData =
    series.length > 0 && data.some((row) => series.some((s) => (Number(row[s.slug]) || 0) > 0));

  if (!hasData) {
    return (
      <div
        className="flex items-center justify-center text-sm text-muted-foreground"
        style={{ height }}
      >
        No channel activity in the last 30 days
      </div>
    );
  }

  return (
    <div data-testid="channel-trend-area" className="w-full">
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            {series.map((s) => (
              <linearGradient key={s.slug} id={`grad-${s.slug}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={s.color} stopOpacity={0.55} />
                <stop offset="95%" stopColor={s.color} stopOpacity={0.06} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={(v: string) => dayLabel(v)}
            tick={{ fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            minTickGap={24}
          />
          <YAxis
            tick={{ fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={70}
            tickFormatter={(v: number) => fmt(v)}
          />
          <Tooltip
            labelFormatter={(label: string) =>
              new Date(`${label}T00:00:00Z`).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                timeZone: "UTC",
              })
            }
            formatter={(value: number, name: string) => [fmt(value), name]}
            // Shared glass tooltip: white blur in light mode, elevated
            // popover surface in dark mode. contentStyle is dead weight
            // when a custom content component renders.
            content={(props) => <GlassChartTooltip {...(props as object)} />}
            // Point-following: stick to the cursor's position over the area.
            position={{ y: 0 }}
            offset={12}
            animationDuration={80}
          />
          {series.map((s) => (
            <Area
              key={s.slug}
              type="monotone"
              dataKey={s.slug}
              name={s.name}
              stroke={s.color}
              fill={`url(#grad-${s.slug})`}
              strokeWidth={2}
              stackId="channels"
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
