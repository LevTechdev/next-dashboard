"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { SalesChannelIcon, getChannelConfig } from "@/components/ui/brand-icons";
import { GlassChartTooltip } from "@/components/charts/glass-tooltip";

/**
 * Channel-mix donut — share of revenue per sales channel.
 *
 * Complements the SalesChannelChart bars: the donut answers "where does the
 * revenue concentrate", with official brand glyphs in the legend so each
 * slice is instantly attributable to its channel.
 */

export interface ChannelMixDatum {
  name: string;
  slug?: string;
  value: number;
  color: string;
}

function renderLegendItem(value: string, entry: { payload?: { slug?: string; color?: string } }) {
  const payload = entry?.payload ?? {};
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-foreground">
      <SalesChannelIcon name={payload.slug || value} size={12} />
      <span style={{ color: payload.color }}>{value}</span>
    </span>
  );
}

export function ChannelMixDonut({
  data,
  height = 260,
  formatValue,
}: {
  data: ChannelMixDatum[];
  height?: number;
  formatValue?: (v: number) => string;
}) {
  const fmt = formatValue ?? ((v: number) => v.toLocaleString("en-US"));
  const total = data.reduce((sum, d) => sum + (d.value || 0), 0);
  const slices = data.filter((d) => (d.value || 0) > 0);

  if (slices.length === 0 || total === 0) {
    return (
      <div
        className="flex items-center justify-center text-sm text-muted-foreground"
        style={{ height }}
      >
        No channel revenue recorded yet
      </div>
    );
  }

  return (
    <div data-testid="channel-mix-donut" className="w-full">
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={slices}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius="55%"
            outerRadius="80%"
            paddingAngle={2}
            strokeWidth={0}
          >
            {slices.map((d) => (
              <Cell key={d.slug || d.name} fill={d.color} />
            ))}
          </Pie>
          <Tooltip cursor={{ stroke: "hsl(var(--border))" }} content={<GlassChartTooltip />} />
          <Legend
            content={(props) => (
              <div className="flex flex-wrap justify-center gap-3">
                {props.payload?.map((entry: any, i: number) => (
                  <span key={i}>{renderLegendItem(entry.value, entry)}</span>
                ))}
              </div>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
      {/* Center total — recharts has no native donut label that stays put */}
      <p className="text-center text-xs text-muted-foreground -mt-10 pointer-events-none">
        Total {fmt(total)}
      </p>
    </div>
  );
}
