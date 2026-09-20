"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { SalesChannelIcon } from "@/components/ui/brand-icons";
import { cn } from "@/lib/utils";

/**
 * Channel Activity Rings — Apple-Watch-style concentric goal rings.
 *
 * One ring per top channel (outer = top seller). A ring's progress is that
 * channel's revenue against the leading channel's revenue, so the outer ring
 * always closes and the rest show relative depth. Hovering a ring focuses it
 * (the others fade) and highlights its stat tile; the center shows the
 * focused channel's share of total revenue. Same channel palette as the
 * donut/bars so the tabs read as one system.
 */

export interface RingChannel {
  name: string;
  slug?: string;
  value: number;
  color: string;
}

export function ChannelActivityRings({
  data,
  formatValue,
  className,
}: {
  data: RingChannel[];
  formatValue?: (v: number) => string;
  className?: string;
}) {
  const t = useTranslations("dashboard");
  const fmt = formatValue ?? ((v: number) => v.toLocaleString("en-US"));
  const [hovered, setHovered] = useState<number | null>(null);

  const rings = useMemo(() => {
    const active = data.filter((d) => (d.value || 0) > 0).slice(0, 3);
    const max = active.length ? Math.max(...active.map((d) => d.value)) : 0;
    const total = active.reduce((s, d) => s + d.value, 0);
    return {
      channels: active.map((d) => ({ ...d, progress: max > 0 ? d.value / max : 0 })),
      total,
    };
  }, [data]);

  if (!rings.channels.length || rings.total === 0) {
    return (
      <div
        className={cn(
          "flex items-center justify-center text-sm text-muted-foreground py-8",
          className,
        )}
      >
        {t("ringsEmpty")}
      </div>
    );
  }

  // Ring geometry — outer ring first (Apple Watch stacking).
  const radii = [86, 68, 50];
  const CIRC = 2 * Math.PI;

  const focusedIdx = hovered ?? 0;
  const focused = rings.channels[focusedIdx];
  const focusedShare = Math.round((focused.value / rings.total) * 100);

  return (
    <div
      className={cn("flex flex-col items-center gap-4", className)}
      data-testid="channel-activity-rings"
    >
      {/* Rings stack */}
      <div className="relative">
        <svg viewBox="0 0 200 200" className="w-48 h-48 -rotate-90 select-none">
          {rings.channels.map((ring, i) => {
            const r = radii[i];
            const circ = CIRC * r;
            const dash = circ * ring.progress;
            return (
              <g key={ring.name}>
                {/* Track */}
                <circle
                  cx="100"
                  cy="100"
                  r={r}
                  fill="none"
                  strokeWidth="14"
                  className="stroke-muted/60"
                />
                {/* Progress */}
                <circle
                  cx="100"
                  cy="100"
                  r={r}
                  fill="none"
                  strokeWidth={hovered === i ? 16 : 14}
                  stroke={ring.color}
                  strokeLinecap="round"
                  strokeDasharray={`${dash} ${circ - dash}`}
                  className="transition-all duration-500"
                  opacity={hovered == null || hovered === i ? 1 : 0.3}
                  data-testid={`ring-${i}`}
                />
              </g>
            );
          })}
        </svg>
        {/* Center readout for the focused channel */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <SalesChannelIcon name={focused.slug || focused.name} size={18} />
          <p
            className="text-2xl font-bold tabular-nums leading-none mt-1"
            data-testid="rings-center-share"
          >
            {focusedShare}%
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5 max-w-24 truncate text-center">
            {focused.name}
          </p>
        </div>
        {/* Hover targets (on top, aligned to the unrotated ring circles) */}
        <div className="absolute inset-0">
          {rings.channels.map((ring, i) => (
            <button
              key={ring.name}
              type="button"
              aria-label={ring.name}
              className="absolute rounded-full"
              style={{
                // Ring band hover zone, rotated back to screen orientation.
                width: radii[i] * 2 + 16,
                height: radii[i] * 2 + 16,
                left: `calc(50% - ${radii[i] + 8}px)`,
                top: `calc(50% - ${radii[i] + 8}px)`,
                background: "transparent",
                border: "14px solid transparent",
                borderRadius: "50%",
                pointerEvents: "stroke",
              }}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            />
          ))}
        </div>
      </div>

      {/* Stat tiles below — value + share per channel */}
      <div className="grid grid-cols-3 gap-2 w-full">
        {rings.channels.map((ring, i) => (
          <button
            key={ring.name}
            type="button"
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
            className={cn(
              "rounded-xl border p-2.5 text-left transition-all",
              hovered === i ? "border-border bg-muted/60" : "border-border/60 bg-muted/25",
            )}
            data-testid={`ring-tile-${i}`}
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <span
                className="h-2 w-2 rounded-full shrink-0"
                style={{ backgroundColor: ring.color }}
              />
              <span className="text-[11px] font-medium text-muted-foreground truncate">
                {ring.name}
              </span>
            </div>
            <p className="text-sm font-bold tabular-nums mt-0.5">{fmt(ring.value)}</p>
            <p className="text-[10px] text-muted-foreground tabular-nums">
              {Math.round((ring.value / rings.total) * 100)}%
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
