"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useTranslations } from "next-intl";
import {
  Filter,
  TrendingDown,
  TrendingUp,
  Clock,
  Sparkles,
  ArrowRight,
  Smartphone,
  Laptop,
  Tablet as TabletIcon,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Eye,
  ShoppingCart,
  CreditCard,
  Check,
  Share2,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCurrency } from "@/components/currency-provider";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import {
  FunnelAnalyticsResponse,
  FunnelStage,
  computeFunnelAnalytics,
} from "@/lib/funnel-analytics";

export function FunnelConversionIntelligence() {
  const t = useTranslations("funnelIntelligence");
  const { formatMoney } = useCurrency();

  const [device, setDevice] = useState<"all" | "mobile" | "desktop" | "tablet">("all");
  const [period, setPeriod] = useState<"7d" | "30d" | "90d">("30d");
  const [activeView, setActiveView] = useState<"funnel" | "sankey">("funnel");
  const [selectedStage, setSelectedStage] = useState<string | null>(null);
  const [hoveredLink, setHoveredLink] = useState<{
    source: string;
    target: string;
    value: number;
    rate?: number | string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<FunnelAnalyticsResponse>(() =>
    computeFunnelAnalytics(2480, 78.5, "all", "30d"),
  );

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    fetch(`/api/analytics/funnel?device=${device}&period=${period}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (isMounted && json) {
          setData(json);
        }
      })
      .catch(() => {
        if (isMounted) {
          setData(computeFunnelAnalytics(2480, 78.5, device, period));
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [device, period]);

  const handleDispatchAction = (alertId: string) => {
    toast.success(t("actionDispatched"), {
      description: "AI Copilot optimization rule applied to live routing mesh.",
    });
  };

  // Stage name mapping helper
  const getStageTitle = (id: string) => {
    switch (id) {
      case "impressions":
        return t("stageImpressions");
      case "product_views":
        return t("stageProductViews");
      case "add_to_cart":
        return t("stageAddToCart");
      case "checkout":
        return t("stageCheckout");
      case "purchase":
        return t("stagePurchase");
      default:
        return id;
    }
  };

  return (
    <div className="space-y-6">
      {/* ─── Header & Top Controls ─── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              <Share2 className="h-5 w-5 text-sky-500 animate-pulse" />
              {t("title")}
            </h2>
            <Badge
              variant="outline"
              className="text-[10px] font-mono border-sky-500/30 text-sky-600 dark:text-cyan-400 bg-sky-50/50 dark:bg-cyan-950/40"
            >
              REAL-TIME FORENSICS
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            {t("subtitle")}
          </p>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
            <button
              onClick={() => setActiveView("funnel")}
              className={cn(
                "px-2.5 py-1 rounded-md font-medium transition cursor-pointer flex items-center gap-1.5",
                activeView === "funnel"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-semibold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white",
              )}
            >
              <span>{t("tabFunnel")}</span>
            </button>
            <button
              onClick={() => setActiveView("sankey")}
              className={cn(
                "px-2.5 py-1 rounded-md font-medium transition cursor-pointer flex items-center gap-1.5",
                activeView === "sankey"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-semibold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white",
              )}
            >
              <span>{t("tabSankey")}</span>
            </button>
          </div>

          {/* Device Segment Selector */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
            <button
              onClick={() => setDevice("all")}
              className={cn(
                "px-2 py-1 rounded-md transition cursor-pointer",
                device === "all"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold shadow-xs"
                  : "text-slate-600 dark:text-slate-400",
              )}
              title={t("deviceAll")}
            >
              {t("deviceAll")}
            </button>
            <button
              onClick={() => setDevice("mobile")}
              className={cn(
                "px-2 py-1 rounded-md transition cursor-pointer flex items-center gap-1",
                device === "mobile"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold shadow-xs"
                  : "text-slate-600 dark:text-slate-400",
              )}
              title={t("deviceMobile")}
            >
              <Smartphone className="h-3 w-3" />
            </button>
            <button
              onClick={() => setDevice("desktop")}
              className={cn(
                "px-2 py-1 rounded-md transition cursor-pointer flex items-center gap-1",
                device === "desktop"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold shadow-xs"
                  : "text-slate-600 dark:text-slate-400",
              )}
              title={t("deviceDesktop")}
            >
              <Laptop className="h-3 w-3" />
            </button>
            <button
              onClick={() => setDevice("tablet")}
              className={cn(
                "px-2 py-1 rounded-md transition cursor-pointer flex items-center gap-1",
                device === "tablet"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold shadow-xs"
                  : "text-slate-600 dark:text-slate-400",
              )}
              title={t("deviceTablet")}
            >
              <TabletIcon className="h-3 w-3" />
            </button>
          </div>

          {/* Timeframe Selector */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
            {(["7d", "30d", "90d"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={cn(
                  "px-2 py-1 rounded-md transition cursor-pointer font-medium",
                  period === p
                    ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white",
                )}
              >
                {p === "7d" ? t("time7d") : p === "30d" ? t("time30d") : t("time90d")}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Executive KPI Cards ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border/70 shadow-xs">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                {t("totalVisitors")}
              </span>
              <div className="p-1.5 rounded-lg bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400">
                <Eye className="h-4 w-4" />
              </div>
            </div>
            <div className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-2 font-mono">
              {data.summary.totalVisitors.toLocaleString()}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Top of funnel top-level impressions
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-xs">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                {t("totalConversions")}
              </span>
              <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4" />
              </div>
            </div>
            <div className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400 mt-2 font-mono">
              {data.summary.totalConversions.toLocaleString()}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Successful settlements
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-xs">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                {t("overallRate")}
              </span>
              <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
                <TrendingUp className="h-4 w-4" />
              </div>
            </div>
            <div className="text-2xl font-bold tracking-tight text-indigo-600 dark:text-indigo-400 mt-2 font-mono">
              {data.summary.overallConversionRate}%
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Avg time to convert: {data.summary.avgFunnelVelocityMin} min
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-xs">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate">
                {t("abandonedCartVal")}
              </span>
              <div className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
                <ShoppingCart className="h-4 w-4" />
              </div>
            </div>
            <div
              className="text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400 mt-2 font-mono truncate"
              title={formatMoney(data.summary.abandonedCartValue)}
            >
              {formatMoney(data.summary.abandonedCartValue)}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Recoverable cart pipeline
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ─── Main Interactive Visual Area: Funnel or Sankey ─── */}
      <AnimatePresence mode="wait">
        {activeView === "funnel" ? (
          <motion.div
            key="funnel"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <Card className="border-border/70 shadow-sm overflow-hidden">
              <CardHeader className="pb-3 border-b border-border/50">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                      <span>{t("tabFunnel")}</span>
                      <span className="text-xs text-slate-500 font-normal">
                        ({data.stages.length} Verified Milestones)
                      </span>
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Inspect stage conversion throughput, drop-off percentages, and stage duration
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-5 space-y-4">
                {data.stages.map((stage, idx) => {
                  const maxCount = data.stages[0].count;
                  const widthPercent = Math.max(16, (stage.count / maxCount) * 100);
                  const isSelected = selectedStage === stage.id;

                  return (
                    <div
                      key={stage.id}
                      onClick={() => setSelectedStage(isSelected ? null : stage.id)}
                      className={cn(
                        "p-4 rounded-xl border transition-all cursor-pointer",
                        isSelected
                          ? "border-sky-500 bg-sky-50/40 dark:bg-sky-950/20 shadow-xs"
                          : "border-border/60 hover:border-border bg-slate-50/50 dark:bg-slate-900/40 hover:bg-slate-50 dark:hover:bg-slate-900/70",
                      )}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5">
                        <div className="flex items-center gap-2.5">
                          <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300 font-mono">
                            {idx + 1}
                          </span>
                          <div>
                            <span className="text-sm font-bold text-slate-900 dark:text-white">
                              {getStageTitle(stage.id)}
                            </span>
                            <span className="text-xs text-slate-500 dark:text-slate-400 ml-2 font-mono">
                              ({stage.count.toLocaleString()} sessions)
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-start sm:self-auto text-xs">
                          {idx > 0 && (
                            <Badge
                              variant="outline"
                              className={cn(
                                "font-mono font-bold text-xs",
                                stage.conversionRate >= 50
                                  ? "text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-50/60 dark:bg-emerald-950/30"
                                  : "text-amber-600 dark:text-amber-400 border-amber-500/30 bg-amber-50/60 dark:bg-amber-950/30",
                              )}
                            >
                              <TrendingUp className="h-3 w-3 mr-1 inline" />
                              {stage.conversionRate}% {t("convFromPrev")}
                            </Badge>
                          )}
                          {idx > 0 && (
                            <span className="text-[11px] font-mono text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 px-2 py-0.5 rounded">
                              -{stage.dropoffRate}% {t("dropoff")} (
                              {stage.dropoffCount.toLocaleString()})
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Visual Funnel Bar */}
                      <div className="w-full bg-slate-200/70 dark:bg-slate-800 rounded-full h-3 overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all duration-700",
                            idx === 0
                              ? "bg-sky-500"
                              : idx === 1
                                ? "bg-blue-500"
                                : idx === 2
                                  ? "bg-indigo-500"
                                  : idx === 3
                                    ? "bg-purple-500"
                                    : "bg-emerald-500",
                          )}
                          style={{ width: `${widthPercent}%` }}
                        />
                      </div>

                      {/* Deep-dive details when clicked */}
                      {isSelected && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="pt-3 mt-3 border-t border-border/50 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs"
                        >
                          <div>
                            <span className="text-slate-500 text-[11px] block">
                              {t("avgDuration")}
                            </span>
                            <span className="font-bold text-slate-900 dark:text-white font-mono flex items-center gap-1 mt-0.5">
                              <Clock className="h-3 w-3 text-slate-400" />
                              {stage.avgDurationSec}s
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500 text-[11px] block">
                              {t("estimatedValue")}
                            </span>
                            <span
                              className="font-bold text-slate-900 dark:text-white font-mono mt-0.5 block truncate"
                              title={formatMoney(stage.valueEstimate)}
                            >
                              {formatMoney(stage.valueEstimate)}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500 text-[11px] block">
                              Overall Conversion
                            </span>
                            <span className="font-bold text-sky-600 dark:text-cyan-400 font-mono mt-0.5 block">
                              {stage.overallRate}%
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500 text-[11px] block">
                              Pipeline Leakage
                            </span>
                            <span className="font-bold text-rose-600 dark:text-rose-400 font-mono mt-0.5 block">
                              {stage.dropoffCount.toLocaleString()} dropped
                            </span>
                          </div>
                        </motion.div>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <motion.div
            key="sankey"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <Card className="border-border/70 shadow-sm overflow-hidden">
              <CardHeader className="pb-3 border-b border-border/50">
                <CardTitle className="text-base font-bold flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <Share2 className="h-4 w-4 text-sky-500" />
                    {t("tabSankey")}
                  </span>
                  <span className="text-xs font-mono font-normal text-slate-500">
                    {t("sankeyHeaderSummary", { channels: 5, stages: 3, outcomes: 2 })}
                  </span>
                </CardTitle>
                <CardDescription className="text-xs">{t("sankeySubHeader")}</CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 overflow-x-auto">
                {/* Interactive link hover status bar */}
                {hoveredLink && (
                  <div className="mb-3 px-3.5 py-2 rounded-lg bg-slate-900/95 dark:bg-slate-800/95 text-white text-xs flex flex-wrap items-center justify-between gap-2 shadow-md border border-slate-700/80 animate-in fade-in duration-150">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sky-400">{hoveredLink.source}</span>
                      <ArrowRight className="h-3 w-3 text-slate-400" />
                      <span className="font-semibold text-slate-100">{hoveredLink.target}</span>
                    </div>
                    <div className="flex items-center gap-3 font-mono text-[11px]">
                      <span>
                        {t("sankeyFlowTooltipVolume")}:{" "}
                        <strong className="text-white">{hoveredLink.value.toLocaleString()}</strong>
                      </span>
                      {hoveredLink.rate !== undefined && (
                        <span className="text-emerald-400 font-bold">({hoveredLink.rate}%)</span>
                      )}
                    </div>
                  </div>
                )}

                <div className="min-w-[760px]">
                  {(() => {
                    const totalVisitors = data.stages[0]?.count || 1000;
                    const stage1 = data.stages[1] || {
                      count: 0,
                      conversionRate: 0,
                      dropoffCount: 0,
                    };
                    const stage2 = data.stages[2] || {
                      count: 0,
                      conversionRate: 0,
                      dropoffCount: 0,
                    };
                    const stage3 = data.stages[3] || {
                      count: 0,
                      conversionRate: 0,
                      dropoffCount: 0,
                    };
                    const stage4 = data.stages[4] || {
                      count: 0,
                      conversionRate: 0,
                      dropoffCount: 0,
                    };
                    const bouncedCount = Math.max(0, totalVisitors - stage4.count);

                    const channels = [
                      {
                        id: "organic",
                        label: t("sankeyOrganic"),
                        pct: 32,
                        color: "#10b981",
                        grad: "grad-organic",
                        y: 26,
                        h: 44,
                      },
                      {
                        id: "social",
                        label: t("sankeySocial"),
                        pct: 28,
                        color: "#06b6d4",
                        grad: "grad-tiktok",
                        y: 86,
                        h: 42,
                      },
                      {
                        id: "paid",
                        label: t("sankeyPaid"),
                        pct: 22,
                        color: "#3b82f6",
                        grad: "grad-google",
                        y: 144,
                        h: 40,
                      },
                      {
                        id: "direct",
                        label: t("sankeyDirect"),
                        pct: 11,
                        color: "#8b5cf6",
                        grad: "grad-direct",
                        y: 200,
                        h: 36,
                      },
                      {
                        id: "email",
                        label: t("sankeyEmail"),
                        pct: 7,
                        color: "#f59e0b",
                        grad: "grad-email",
                        y: 252,
                        h: 32,
                      },
                    ].map((ch) => ({
                      ...ch,
                      count: Math.round((totalVisitors * ch.pct) / 100),
                    }));

                    return (
                      <svg viewBox="0 0 880 340" className="w-full h-auto select-none">
                        <defs>
                          <linearGradient id="grad-organic" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#10b981" stopOpacity="0.75" />
                            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.5" />
                          </linearGradient>
                          <linearGradient id="grad-tiktok" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.75" />
                            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.5" />
                          </linearGradient>
                          <linearGradient id="grad-google" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.75" />
                            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.5" />
                          </linearGradient>
                          <linearGradient id="grad-direct" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.75" />
                            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.5" />
                          </linearGradient>
                          <linearGradient id="grad-email" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.75" />
                            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.5" />
                          </linearGradient>
                          <linearGradient id="grad-cart" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.65" />
                            <stop offset="100%" stopColor="#818cf8" stopOpacity="0.65" />
                          </linearGradient>
                          <linearGradient id="grad-checkout" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#818cf8" stopOpacity="0.65" />
                            <stop offset="100%" stopColor="#c084fc" stopOpacity="0.65" />
                          </linearGradient>
                          <linearGradient id="grad-converted" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#c084fc" stopOpacity="0.7" />
                            <stop offset="100%" stopColor="#10b981" stopOpacity="0.9" />
                          </linearGradient>
                          <linearGradient id="grad-dropped" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#f87171" stopOpacity="0.45" />
                            <stop offset="100%" stopColor="#ef4444" stopOpacity="0.75" />
                          </linearGradient>
                        </defs>

                        {/* ─── Column 0: Inflow Channels ─── */}
                        {channels.map((ch, i) => (
                          <g key={ch.id} className="cursor-pointer">
                            <rect
                              x="16"
                              y={ch.y}
                              width="138"
                              height={ch.h}
                              rx="8"
                              fill={ch.color}
                              fillOpacity="0.12"
                              stroke={ch.color}
                              strokeWidth="1.5"
                              className="transition-all hover:fill-opacity-25"
                              onMouseEnter={() =>
                                setHoveredLink({
                                  source: ch.label,
                                  target: t("sankeyStageCatalog"),
                                  value: ch.count,
                                  rate: ch.pct,
                                })
                              }
                              onMouseLeave={() => setHoveredLink(null)}
                            />
                            <text
                              x="26"
                              y={ch.y + ch.h / 2 + 4}
                              fontSize="11"
                              fontWeight="bold"
                              fill="currentColor"
                              className="text-slate-800 dark:text-slate-100 pointer-events-none"
                            >
                              {ch.label}
                            </text>
                            <text
                              x="146"
                              y={ch.y + ch.h / 2 + 4}
                              textAnchor="end"
                              fontSize="10"
                              fontFamily="monospace"
                              fontWeight="bold"
                              fill={ch.color}
                              className="pointer-events-none"
                            >
                              {ch.pct}%
                            </text>

                            {/* Inflow Ribbons curving to Catalog Node */}
                            <path
                              d={`M 154 ${ch.y + ch.h / 2} C 215 ${ch.y + ch.h / 2}, 225 ${68 + i * 26}, 285 ${68 + i * 26}`}
                              fill="none"
                              stroke={`url(#${ch.grad})`}
                              strokeWidth={Math.max(5, Math.round(ch.pct * 0.55))}
                              strokeLinecap="round"
                              className="opacity-70 hover:opacity-100 transition-opacity cursor-pointer"
                              onMouseEnter={() =>
                                setHoveredLink({
                                  source: ch.label,
                                  target: t("sankeyStageCatalog"),
                                  value: ch.count,
                                  rate: ch.pct,
                                })
                              }
                              onMouseLeave={() => setHoveredLink(null)}
                            />
                          </g>
                        ))}

                        {/* ─── Column 1: Catalog & PDP Node ─── */}
                        <g>
                          <rect
                            x="285"
                            y="40"
                            width="110"
                            height="180"
                            rx="10"
                            fill="#38bdf8"
                            fillOpacity="0.14"
                            stroke="#38bdf8"
                            strokeWidth="2"
                          />
                          <text
                            x="340"
                            y="70"
                            textAnchor="middle"
                            fontSize="12"
                            fontWeight="bold"
                            fill="currentColor"
                            className="text-slate-900 dark:text-white"
                          >
                            {t("sankeyStageCatalog")}
                          </text>
                          <text
                            x="340"
                            y="92"
                            textAnchor="middle"
                            fontSize="11"
                            fontFamily="monospace"
                            fill="#0284c7"
                            fontWeight="bold"
                          >
                            {stage1.count.toLocaleString()} {t("sankeyViews")}
                          </text>

                          {/* Conversion Flow from Catalog to Cart */}
                          <path
                            d="M 395 95 C 435 95, 435 95, 475 95"
                            fill="none"
                            stroke="url(#grad-cart)"
                            strokeWidth={Math.max(
                              8,
                              Math.min(36, Math.round((stage2.count / (stage1.count || 1)) * 40)),
                            )}
                            strokeLinecap="round"
                            className="opacity-75 hover:opacity-100 transition-opacity cursor-pointer"
                            onMouseEnter={() =>
                              setHoveredLink({
                                source: t("sankeyStageCatalog"),
                                target: t("sankeyStageCart"),
                                value: stage2.count,
                                rate: stage2.conversionRate,
                              })
                            }
                            onMouseLeave={() => setHoveredLink(null)}
                          />

                          {/* Leakage Flow from Catalog curving to Bounced */}
                          <path
                            d="M 395 175 C 455 175, 520 250, 620 250 C 700 250, 730 230, 795 230"
                            fill="none"
                            stroke="url(#grad-dropped)"
                            strokeWidth={Math.max(
                              5,
                              Math.min(
                                26,
                                Math.round((stage1.dropoffCount / (stage1.count || 1)) * 32),
                              ),
                            )}
                            strokeLinecap="round"
                            className="opacity-55 hover:opacity-95 transition-opacity cursor-pointer"
                            onMouseEnter={() =>
                              setHoveredLink({
                                source: t("sankeyStageCatalog"),
                                target: t("sankeyOutcomeBounced"),
                                value: stage1.dropoffCount,
                                rate: (100 - stage1.conversionRate).toFixed(1),
                              })
                            }
                            onMouseLeave={() => setHoveredLink(null)}
                          />
                        </g>

                        {/* ─── Column 2: Cart & Bag Node ─── */}
                        <g>
                          <rect
                            x="475"
                            y="55"
                            width="105"
                            height="110"
                            rx="10"
                            fill="#818cf8"
                            fillOpacity="0.14"
                            stroke="#818cf8"
                            strokeWidth="2"
                          />
                          <text
                            x="527"
                            y="85"
                            textAnchor="middle"
                            fontSize="12"
                            fontWeight="bold"
                            fill="currentColor"
                            className="text-slate-900 dark:text-white"
                          >
                            {t("sankeyStageCart")}
                          </text>
                          <text
                            x="527"
                            y="107"
                            textAnchor="middle"
                            fontSize="11"
                            fontFamily="monospace"
                            fill="#6366f1"
                            fontWeight="bold"
                          >
                            {stage2.count.toLocaleString()} {t("sankeyAdds")}
                          </text>

                          {/* Conversion Flow from Cart to Checkout */}
                          <path
                            d="M 580 95 C 615 95, 620 95, 655 95"
                            fill="none"
                            stroke="url(#grad-checkout)"
                            strokeWidth={Math.max(
                              6,
                              Math.min(28, Math.round((stage3.count / (stage2.count || 1)) * 34)),
                            )}
                            strokeLinecap="round"
                            className="opacity-75 hover:opacity-100 transition-opacity cursor-pointer"
                            onMouseEnter={() =>
                              setHoveredLink({
                                source: t("sankeyStageCart"),
                                target: t("sankeyStageCheckout"),
                                value: stage3.count,
                                rate: stage3.conversionRate,
                              })
                            }
                            onMouseLeave={() => setHoveredLink(null)}
                          />

                          {/* Leakage Flow from Cart curving to Bounced */}
                          <path
                            d="M 580 135 C 640 135, 700 260, 795 260"
                            fill="none"
                            stroke="url(#grad-dropped)"
                            strokeWidth={Math.max(
                              4,
                              Math.min(
                                22,
                                Math.round((stage2.dropoffCount / (stage2.count || 1)) * 26),
                              ),
                            )}
                            strokeLinecap="round"
                            className="opacity-55 hover:opacity-95 transition-opacity cursor-pointer"
                            onMouseEnter={() =>
                              setHoveredLink({
                                source: t("sankeyStageCart"),
                                target: t("sankeyOutcomeBounced"),
                                value: stage2.dropoffCount,
                                rate: (100 - stage2.conversionRate).toFixed(1),
                              })
                            }
                            onMouseLeave={() => setHoveredLink(null)}
                          />
                        </g>

                        {/* ─── Column 3: Checkout Node ─── */}
                        <g>
                          <rect
                            x="655"
                            y="50"
                            width="95"
                            height="95"
                            rx="10"
                            fill="#c084fc"
                            fillOpacity="0.14"
                            stroke="#c084fc"
                            strokeWidth="2"
                          />
                          <text
                            x="702"
                            y="80"
                            textAnchor="middle"
                            fontSize="12"
                            fontWeight="bold"
                            fill="currentColor"
                            className="text-slate-900 dark:text-white"
                          >
                            {t("sankeyStageCheckout")}
                          </text>
                          <text
                            x="702"
                            y="102"
                            textAnchor="middle"
                            fontSize="11"
                            fontFamily="monospace"
                            fill="#a855f7"
                            fontWeight="bold"
                          >
                            {stage3.count.toLocaleString()}
                          </text>

                          {/* Conversion Flow from Checkout to Orders */}
                          <path
                            d="M 750 75 C 775 75, 775 65, 795 65"
                            fill="none"
                            stroke="url(#grad-converted)"
                            strokeWidth={Math.max(
                              6,
                              Math.min(22, Math.round((stage4.count / (stage3.count || 1)) * 26)),
                            )}
                            strokeLinecap="round"
                            className="opacity-85 hover:opacity-100 transition-opacity cursor-pointer"
                            onMouseEnter={() =>
                              setHoveredLink({
                                source: t("sankeyStageCheckout"),
                                target: t("sankeyOutcomeOrders"),
                                value: stage4.count,
                                rate: stage4.conversionRate,
                              })
                            }
                            onMouseLeave={() => setHoveredLink(null)}
                          />

                          {/* Leakage Flow from Checkout to Bounced */}
                          <path
                            d="M 750 115 C 775 115, 775 195, 795 195"
                            fill="none"
                            stroke="url(#grad-dropped)"
                            strokeWidth={Math.max(
                              4,
                              Math.min(
                                16,
                                Math.round((stage3.dropoffCount / (stage3.count || 1)) * 20),
                              ),
                            )}
                            strokeLinecap="round"
                            className="opacity-55 hover:opacity-95 transition-opacity cursor-pointer"
                            onMouseEnter={() =>
                              setHoveredLink({
                                source: t("sankeyStageCheckout"),
                                target: t("sankeyOutcomeBounced"),
                                value: stage3.dropoffCount,
                                rate: (100 - stage3.conversionRate).toFixed(1),
                              })
                            }
                            onMouseLeave={() => setHoveredLink(null)}
                          />
                        </g>

                        {/* ─── Column 4: Outcome Terminus Nodes ─── */}
                        {/* Converted Orders */}
                        <g className="cursor-pointer">
                          <rect
                            x="795"
                            y="30"
                            width="68"
                            height="72"
                            rx="10"
                            fill="#10b981"
                            fillOpacity="0.18"
                            stroke="#10b981"
                            strokeWidth="2"
                            className="transition-all hover:fill-opacity-30"
                            onMouseEnter={() =>
                              setHoveredLink({
                                source: t("sankeyStageCheckout"),
                                target: t("sankeyOutcomeOrders"),
                                value: stage4.count,
                                rate: data.summary.overallConversionRate,
                              })
                            }
                            onMouseLeave={() => setHoveredLink(null)}
                          />
                          <text
                            x="829"
                            y="56"
                            textAnchor="middle"
                            fontSize="11"
                            fontWeight="bold"
                            fill="#059669"
                            className="pointer-events-none"
                          >
                            {t("sankeyOutcomeOrders")}
                          </text>
                          <text
                            x="829"
                            y="76"
                            textAnchor="middle"
                            fontSize="11"
                            fontFamily="monospace"
                            fontWeight="bold"
                            fill="#059669"
                            className="pointer-events-none"
                          >
                            {stage4.count.toLocaleString()}
                          </text>
                          <text
                            x="829"
                            y="92"
                            textAnchor="middle"
                            fontSize="9"
                            fontFamily="monospace"
                            fill="#047857"
                            className="pointer-events-none font-bold"
                          >
                            {data.summary.overallConversionRate}%
                          </text>
                        </g>

                        {/* Bounced / Dropped Terminus */}
                        <g className="cursor-pointer">
                          <rect
                            x="795"
                            y="165"
                            width="68"
                            height="145"
                            rx="10"
                            fill="#ef4444"
                            fillOpacity="0.14"
                            stroke="#ef4444"
                            strokeWidth="1.5"
                            className="transition-all hover:fill-opacity-25"
                            onMouseEnter={() =>
                              setHoveredLink({
                                source: "Funnel Drop-offs",
                                target: t("sankeyOutcomeBounced"),
                                value: bouncedCount,
                                rate: (100 - data.summary.overallConversionRate).toFixed(1),
                              })
                            }
                            onMouseLeave={() => setHoveredLink(null)}
                          />
                          <text
                            x="829"
                            y="225"
                            textAnchor="middle"
                            fontSize="11"
                            fontWeight="bold"
                            fill="#dc2626"
                            className="pointer-events-none"
                          >
                            {t("sankeyOutcomeBounced")}
                          </text>
                          <text
                            x="829"
                            y="248"
                            textAnchor="middle"
                            fontSize="10"
                            fontFamily="monospace"
                            fontWeight="bold"
                            fill="#dc2626"
                            className="pointer-events-none"
                          >
                            {bouncedCount.toLocaleString()}
                          </text>
                          <text
                            x="829"
                            y="266"
                            textAnchor="middle"
                            fontSize="9"
                            fontFamily="monospace"
                            fill="#b91c1c"
                            className="pointer-events-none font-bold"
                          >
                            {(100 - data.summary.overallConversionRate).toFixed(1)}%
                          </text>
                        </g>
                      </svg>
                    );
                  })()}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── AI Bottleneck Diagnostics & Copilot Prescriptions ─── */}
      <Card className="border-sky-500/30 bg-gradient-to-r from-sky-50/40 via-background to-indigo-50/30 dark:from-sky-950/20 dark:via-background dark:to-indigo-950/20 shadow-xs">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-sky-500 text-white">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-base font-bold">{t("aiDiagnosticsTitle")}</CardTitle>
                <CardDescription className="text-xs">{t("aiDiagnosticsDesc")}</CardDescription>
              </div>
            </div>
            <Badge className="bg-sky-600 text-white font-mono text-[10px]">AI COPILOT ACTIVE</Badge>
          </div>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 space-y-3">
          {data.leakageAlerts.map((alert) => (
            <div
              key={alert.id}
              className="p-3.5 rounded-xl border border-border/80 bg-background/90 backdrop-blur-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition hover:border-sky-500/50"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px] font-mono font-bold",
                      alert.severity === "critical"
                        ? "text-rose-600 border-rose-500/40 bg-rose-50 dark:bg-rose-950/40"
                        : "text-amber-600 border-amber-500/40 bg-amber-50 dark:bg-amber-950/40",
                    )}
                  >
                    {alert.severity.toUpperCase()}
                  </Badge>
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    {alert.stageName}
                  </span>
                  <span className="text-xs font-mono text-rose-600 dark:text-rose-400 font-bold">
                    ({alert.dropoffRate}% drop-off)
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300">{t(alert.insightKey)}</p>
                <p className="text-xs text-sky-600 dark:text-cyan-400 font-medium flex items-center gap-1">
                  <ArrowRight className="h-3 w-3 inline shrink-0" />
                  {t(alert.recommendationKey)}
                </p>
              </div>

              <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-1.5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/50">
                <div className="text-right">
                  <span className="text-[10px] text-slate-500 block">{t("potentialRecovery")}</span>
                  <span
                    className="text-xs font-bold text-emerald-600 dark:text-emerald-400 font-mono"
                    title={formatMoney(alert.potentialRevenueRecovery)}
                  >
                    +{formatMoney(alert.potentialRevenueRecovery)}
                  </span>
                </div>
                <Button
                  size="sm"
                  onClick={() => handleDispatchAction(alert.id)}
                  className="h-7 text-xs bg-sky-600 hover:bg-sky-700 text-white cursor-pointer"
                >
                  <Sparkles className="h-3 w-3 mr-1" />
                  {t("dispatchCopilot")}
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
