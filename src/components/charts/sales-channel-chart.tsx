"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from "recharts";
import { formatCurrency } from "@/lib/utils";

interface ChannelData {
  name: string;
  value: number;
  color: string;
}

interface SalesChannelChartProps {
  data: ChannelData[];
  height?: number;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg p-3">
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
        {label}
      </p>
      <p className="text-sm font-bold text-gray-900 dark:text-gray-100">
        {formatCurrency(payload[0].value)}
      </p>
    </div>
  );
}

export function SalesChannelChart({ data, height = 300 }: SalesChannelChartProps) {
  if (!data || data.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-sm text-gray-400"
        style={{ height }}
      >
        No channel data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 8, right: 24, left: 0, bottom: 0 }}
        barCategoryGap="25%"
      >
        <CartesianGrid
          strokeDasharray="3 3"
          horizontal={false}
          stroke="currentColor"
          className="stroke-gray-200 dark:stroke-gray-800"
        />
        <XAxis
          type="number"
          tick={{ fontSize: 11, fill: "currentColor" }}
          className="text-gray-400 dark:text-gray-500"
          axisLine={false}
          tickLine={false}
          tickFormatter={(value: number) => {
            if (value >= 1000000) return `${(value / 1000000).toFixed(0)}M`;
            if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
            return value.toString();
          }}
        />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fontSize: 12, fill: "currentColor" }}
          className="text-gray-600 dark:text-gray-400"
          axisLine={false}
          tickLine={false}
          width={100}
        />
        <Tooltip
          content={<CustomTooltip />}
          cursor={{ fill: "currentColor", className: "fill-gray-100 dark:fill-gray-800/50" }}
        />
        <Bar
          dataKey="value"
          radius={[0, 4, 4, 0]}
          maxBarSize={32}
        >
          {data.map((entry, index) => (
            <Cell key={index} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
