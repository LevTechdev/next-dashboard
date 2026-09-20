"use client";

import type { ComponentType, ReactNode } from "react";
import { motion } from "framer-motion";
import { TrendingUpIcon, TrendingDownIcon } from "lucide-animated";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { Sparkline } from "@/components/ui/sparkline";
import { useCurrency } from "@/components/currency-provider";
import { cn } from "@/lib/utils";

interface PremiumStatCardProps {
  title: string;
  endValue: number;
  icon: ComponentType<{ className?: string; size?: number }> | ReactNode;
  color: string;
  bg: string;
  change?: number;
  isCurrency?: boolean;
  formatter?: (v: number) => string;
  decimals?: number;
  delay?: number;
  sparkData?: number[];
}

/**
 * Uniform stat card used by every dashboard menu (overview, orders, customers,
 * affiliates, …). Matches the overview's `.stat-card-premium` look: icon chip,
 * optional trend pill, animated counter, and optional sparkline — always the
 * same height regardless of localized label length or presence of a sparkline.
 */
export function PremiumStatCard({
  title,
  endValue,
  icon: Icon,
  color,
  bg,
  change,
  isCurrency = false,
  formatter,
  decimals = 0,
  delay = 0,
  sparkData,
}: PremiumStatCardProps) {
  const { formatMoney } = useCurrency();
  const IconEl =
    typeof Icon === "function" || (typeof Icon === "object" && Icon && "render" in (Icon as object))
      ? (Icon as ComponentType<{ className?: string; size?: number }>)
      : null;
  const iconNode = IconEl ? (
    <IconEl size={20} className={cn("h-5 w-5", color)} />
  ) : (
    (Icon as ReactNode)
  );

  // Reserve the sparkline row for every card in a grid row so heights match
  // even when only some stats have spark data.
  const spark = sparkData && sparkData.length > 1 ? sparkData : null;

  // Currency cards: honor an explicit formatter, else fall back to the global
  // currency provider so the value renders as formatted money (never a bare
  // number) and follows the user's currency preference in Settings.
  const moneyFormatter =
    isCurrency || formatter ? (formatter ?? ((v: number) => formatMoney(v))) : undefined;
  const trend =
    typeof change === "number" ? (
      <div
        className={cn(
          "flex items-center text-xs font-medium gap-0.5 px-2 py-0.5 rounded-full shrink-0",
          change >= 0
            ? "text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/20"
            : "text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20",
        )}
      >
        {change >= 0 ? (
          <TrendingUpIcon size={12} className="h-3 w-3" />
        ) : (
          <TrendingDownIcon size={12} className="h-3 w-3" />
        )}
        {Math.abs(change)}%
      </div>
    ) : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="min-w-0"
    >
      <div className="stat-card-premium h-full min-w-0 flex flex-col overflow-hidden">
        {/* Icon + optional trend pill */}
        <div className="flex items-center justify-between min-h-[40px]">
          <div
            className={cn(
              "p-2.5 rounded-xl transition-all duration-300 hover:scale-110 shadow-sm",
              bg,
            )}
          >
            {iconNode}
          </div>
          {trend}
        </div>

        {/* Title + value */}
        <div className="mt-4 min-w-0">
          <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{title}</p>
          <div
            className="text-lg sm:text-xl xl:text-2xl font-bold truncate text-gray-900 dark:text-gray-100 mt-1 tracking-tight"
            title={moneyFormatter ? moneyFormatter(endValue) : String(endValue)}
          >
            {moneyFormatter ? (
              <AnimatedCounter end={endValue} duration={1600} formatter={moneyFormatter} />
            ) : (
              <AnimatedCounter end={endValue} duration={1600} decimals={decimals} />
            )}
          </div>
        </div>

        {/* Sparkline (fixed-height row, reserved when absent) */}
        <div className="mt-2 min-h-[30px] flex items-end">
          {spark && (
            <Sparkline
              data={spark}
              width={120}
              height={28}
              strokeColor={change === undefined || change >= 0 ? "#10b981" : "#ef4444"}
            />
          )}
        </div>
      </div>
    </motion.div>
  );
}
