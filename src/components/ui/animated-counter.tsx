"use client";

import { useAnimatedCounter } from "@/hooks/use-animated-counter";
import { cn } from "@/lib/utils";

interface AnimatedCounterProps {
  end: number;
  duration?: number;
  className?: string;
  formatter?: (value: number) => string;
  prefix?: string;
  suffix?: string;
  decimals?: number;
}

/**
 * Displays a number that smoothly animates from 0 to the target value.
 * Uses the useAnimatedCounter hook with requestAnimationFrame.
 */
export function AnimatedCounter({
  end,
  duration = 1500,
  className,
  formatter,
  prefix = "",
  suffix = "",
  decimals = 0,
}: AnimatedCounterProps) {
  const { value, isAnimating } = useAnimatedCounter(end, {
    duration,
    round: decimals === 0,
    formatFn: formatter,
  });

  return (
    <span
      className={cn(
        "tabular-nums transition-opacity",
        isAnimating && "opacity-90",
        className
      )}
    >
      {prefix}{formatter ? formatter(value) : value.toFixed(decimals)}{suffix}
    </span>
  );
}
