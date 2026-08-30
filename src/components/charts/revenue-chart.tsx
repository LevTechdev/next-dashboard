"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { formatCurrency } from "@/lib/utils";

interface RevenueData {
  month: string;
  revenue: number;
}

interface RevenueChartProps {
  data: RevenueData[];
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
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{label}</p>
      <p className="text-sm font-bold text-gray-900 dark:text-gray-100">
        {formatCurrency(payload[0].value)}
      </p>
    </div>
  );
}

export function RevenueChart({ data, height = 300 }: RevenueChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center text-sm text-gray-400" style={{ height }}>
        No revenue data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid
          strokeDasharray="3 3"
          vertical={false}
          stroke="currentColor"
          className="stroke-gray-200 dark:stroke-gray-800"
        />
        <XAxis
          dataKey="month"
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
          tickFormatter={(value: number) => {
            if (value >= 1000000) return `${(value / 1000000).toFixed(0)}M`;
            if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
            return value.toString();
          }}
        />
        <Tooltip
          content={<CustomTooltip />}
          cursor={{ fill: "currentColor", className: "fill-gray-100 dark:fill-gray-800/50" }}
        />
        <defs>
          <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity={0.9} />
            <stop offset="100%" stopColor="#818cf8" stopOpacity={0.6} />
          </linearGradient>
        </defs>
        <Bar dataKey="revenue" fill="url(#revenueGradient)" radius={[4, 4, 0, 0]} maxBarSize={48} />
      </BarChart>
    </ResponsiveContainer>
  );
}
