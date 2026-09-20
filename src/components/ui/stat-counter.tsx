"use client";

import { useEffect, useRef, useState } from "react";
import { useInView } from "motion/react";
import { cn } from "@/lib/utils";

interface StatCounterProps {
  /** Final numeric value to animate to. */
  value: number;
  /** Decimals to keep while animating / formatting (e.g. 1 for $12.3k). */
  decimals?: number;
  /** Prefix such as "$" or "Rp". */
  prefix?: string;
  /** Suffix such as "%" or "+". */
  suffix?: string;
  /** Animation duration in ms. */
  duration?: number;
  /** Locale for digit grouping (pass the active next-intl locale). */
  locale?: string;
  className?: string;
  icon?: React.ReactNode;
}

function formatWithSuffix(value: number, decimals: number, locale?: string) {
  // Compact notation for large magnitudes — 12,400 → 12.4K (VengeanceUI style).
  if (Math.abs(value) >= 10_000) {
    const n = value / 1000;
    return `${n.toLocaleString(locale, {
      minimumFractionDigits: 0,
      maximumFractionDigits: decimals || 1,
    })}K`;
  }
  return value.toLocaleString(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Animated stat counter (reference: VengeanceUI) — counts up from 0 to
 * `value` with an ease-out curve the first time it scrolls into view.
 * Uses requestAnimationFrame only; no animation library dependency, and it
 * respects the user's reduced-motion preference by jumping to the final value.
 */
export function StatCounter({
  value,
  decimals = 0,
  prefix = "",
  suffix = "",
  duration = 1500,
  locale,
  className,
  icon,
}: StatCounterProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-40px" });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!isInView) return;

    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setDisplay(value);
      return;
    }

    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      setDisplay(value * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isInView, value, duration]);

  return (
    <span ref={ref} className={cn("tabular-nums", className)}>
      {icon}
      {prefix}
      {formatWithSuffix(display, decimals, locale)}
      {suffix}
    </span>
  );
}
