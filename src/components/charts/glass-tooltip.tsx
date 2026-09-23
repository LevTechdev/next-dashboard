"use client";

import { useCurrency } from "@/components/currency-provider";
import { cn } from "@/lib/utils";

/**
 * Shared glass tooltip for recharts surfaces (revenue bars, channel mix,
 * channel trend, radar, rings…).
 *
 * boardui-style: a white blur pill in light mode (translucent white with
 * backdrop-blur over the chart), and the elevated popover surface in dark
 * mode (pure white blur reads wrong on near-black charts). Currency-aware
 * formatting via useCurrency keeps every chart consistent.
 */

interface GlassTooltipPayloadItem {
  name?: string | number;
  value?: number | string;
  color?: string;
  dataKey?: string | number;
}

interface GlassTooltipProps {
  active?: boolean;
  payload?: GlassTooltipPayloadItem[];
  label?: string | number;
  /** Force plain number formatting instead of currency. */
  plainNumber?: boolean;
  /** Suffix appended after each value (e.g. "%"). */
  suffix?: string;
  className?: string;
}

export function GlassChartTooltip({
  active,
  payload,
  label,
  plainNumber = false,
  suffix,
  className,
}: GlassTooltipProps) {
  const { formatMoney, currency } = useCurrency();

  if (!active || !payload?.length) return null;

  const fmt = (v: number | string | undefined): string => {
    const n = Number(v ?? 0);
    if (plainNumber) return n.toLocaleString() + (suffix ?? "");
    if (suffix) return n.toLocaleString() + suffix;
    return formatMoney(n);
  };

  return (
    <div
      data-chart-tooltip="glass"
      className={cn(
        // Glass surface: translucent white + blur in light mode; elevated
        // card surface in dark mode (white glass is illegible there).
        // NOTE: this project defines `card`, not `popover`, in its theme.
        "rounded-xl border border-white/50 bg-white/70 text-gray-900 shadow-xl backdrop-blur-md",
        "dark:border-border dark:bg-card/95 dark:text-card-foreground",
        "px-3 py-2 tabular-nums pointer-events-none",
        className,
      )}
    >
      {label != null && label !== "" && (
        <p className="text-[11px] font-semibold text-gray-600 dark:text-muted-foreground mb-1">
          {label}
        </p>
      )}
      <div className="space-y-0.5">
        {payload.map((entry, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            {entry.color && (
              <span
                aria-hidden
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
            )}
            {entry.name != null && entry.name !== "" && (
              <span className="text-gray-500 dark:text-muted-foreground">{entry.name}</span>
            )}
            <span className="ml-auto font-bold">{fmt(entry.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
