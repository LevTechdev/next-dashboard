"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import {
  UsersIcon,
  TrendingUpIcon,
  DollarSignIcon,
  ClockIcon,
  ShieldCheckIcon,
  RefreshCwIcon,
  ZapIcon,
  LayoutGridIcon,
  HeartHandshakeIcon,
} from "lucide-animated";
import { AlertCircle, Award, Lock } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCurrency } from "@/components/currency-provider";
import {
  CohortRow,
  LtvCacPoint,
  RfmSegment,
  CohortAnalyticsResponse,
} from "@/lib/cohort-analytics";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

export function CohortRetentionHeatmap() {
  const t = useTranslations("cohorts");
  const tc = useTranslations("common");
  const { currency, formatMoney } = useCurrency();

  const [data, setData] = useState<CohortAnalyticsResponse | null>(null);
  const [upgradeRequired, setUpgradeRequired] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCell, setSelectedCell] = useState<{
    cohort: string;
    month: number;
    pct: number;
    revenue?: number;
  } | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/analytics/cohorts");
      if (res.status === 402) {
        // PRO-gated: the API returned the upgrade challenge — show the
        // upsell empty-state instead of a generic error.
        setUpgradeRequired(true);
        setError(null);
        return;
      }
      setUpgradeRequired(false);
      if (!res.ok) throw new Error("Failed to load cohort analytics");
      const json: CohortAnalyticsResponse = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message || "Failed to load cohort analytics");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-4 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800">
        <RefreshCwIcon size={32} className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
          {t("calculatingCohorts")}
        </p>
      </div>
    );
  }

  if (upgradeRequired) {
    return (
      <div className="relative overflow-hidden p-8 bg-gradient-to-br from-primary/5 via-transparent to-primary/5 border border-primary/20 rounded-2xl text-center space-y-3">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Lock className="h-6 w-6" />
        </div>
        <p className="text-sm font-semibold">{t("upsellTitle")}</p>
        <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
          {t("upsellDesc")}
        </p>
        <div className="flex items-center justify-center gap-2 pt-1">
          <Button size="sm" variant="outline" onClick={fetchData}>
            <RefreshCwIcon size={14} className="mr-1.5 h-3.5 w-3.5" />
            {tc("retry")}
          </Button>
          <Button size="sm" className="gap-1.5" asChild>
            <Link href="/en/billing">
              <Lock className="h-3.5 w-3.5" />
              {t("upsellCta")}
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-2xl text-center space-y-3">
        <AlertCircle className="h-8 w-8 text-red-500 mx-auto" />
        <p className="text-sm text-red-600 dark:text-red-400 font-medium">
          {error || t("loadError")}
        </p>
        <Button
          size="sm"
          variant="outline"
          onClick={fetchData}
          className="border-primary/20 hover:bg-primary/10"
        >
          <RefreshCwIcon size={14} className="mr-1.5 h-3.5 w-3.5" />
          {tc("retry")}
        </Button>
      </div>
    );
  }

  const { cohorts, ltvCacCurve, paybackMonth, rfmSegments, summary } = data;

  // Helper for heatmap cell color intensity
  const getCellColor = (val: number | undefined) => {
    if (val === undefined)
      return "bg-gray-100/50 dark:bg-gray-800/40 text-gray-400 dark:text-gray-500 border border-transparent";
    if (val >= 60) {
      return "bg-emerald-600 dark:bg-emerald-600 text-white font-semibold shadow-sm";
    }
    if (val >= 45) {
      return "bg-emerald-500/85 dark:bg-emerald-500/80 text-white font-medium";
    }
    if (val >= 30) {
      return "bg-teal-400/80 dark:bg-teal-500/60 text-teal-950 dark:text-teal-100 font-medium";
    }
    if (val >= 20) {
      return "bg-amber-400/75 dark:bg-amber-500/60 text-amber-950 dark:text-amber-100 font-medium";
    }
    if (val > 0) {
      return "bg-rose-400/75 dark:bg-rose-500/60 text-rose-950 dark:text-rose-100 font-medium";
    }
    return "bg-gray-100 dark:bg-gray-800/80 text-gray-400 dark:text-gray-500";
  };

  return (
    <div className="space-y-6">
      {/* KPI Top Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="rounded-2xl border-gray-200 dark:border-gray-800">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                {t("totalCustomersTracked")}
              </p>
              <h3 className="text-2xl font-black mt-1 text-gray-900 dark:text-white">
                {summary.totalCohortCustomers.toLocaleString()}
              </h3>
              <div className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1.5 font-medium">
                <UsersIcon size={14} className="h-3.5 w-3.5 shrink-0" />
                <span>{t("activeCohortsCount", { count: summary.activeCohortCount })}</span>
              </div>
            </div>
            <div className="p-2.5 bg-blue-50 dark:bg-blue-950/40 rounded-xl text-blue-600 dark:text-blue-400">
              <UsersIcon size={20} className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-gray-200 dark:border-gray-800">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                {t("avgM1Retention")}
              </p>
              <h3 className="text-2xl font-black mt-1 text-gray-900 dark:text-white">
                {summary.avgRetentionM1}%
              </h3>
              <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1.5 font-medium">
                <TrendingUpIcon size={14} className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                <span>{t("m6Benchmark", { rate: summary.avgRetentionM6 })}</span>
              </div>
            </div>
            <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl text-emerald-600 dark:text-emerald-400">
              <TrendingUpIcon size={20} className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-gray-200 dark:border-gray-800">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                {t("ltvCacRatio")}
              </p>
              <h3 className="text-2xl font-black mt-1 text-gray-900 dark:text-white flex items-baseline gap-1">
                <span>{summary.ltvCacRatio}x</span>
                <span className="text-xs font-normal text-gray-500">
                  ({formatMoney(summary.avgLtv12m, "USD")} /{" "}
                  {formatMoney(summary.blendedCac, "USD")})
                </span>
              </h3>
              <div className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1.5 font-medium">
                <ShieldCheckIcon size={14} className="h-3.5 w-3.5 shrink-0" />
                <span>
                  {summary.ltvCacRatio >= 3
                    ? t("healthyUnitEconomics")
                    : t("monitorAcquisitionCost")}
                </span>
              </div>
            </div>
            <div className="p-2.5 bg-primary/10 rounded-xl text-primary">
              <ZapIcon size={20} className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-gray-200 dark:border-gray-800">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                {t("cacPaybackPeriod")}
              </p>
              <h3 className="text-2xl font-black mt-1 text-gray-900 dark:text-white">
                {paybackMonth !== null ? `M${paybackMonth}` : "M4"}
              </h3>
              <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1.5 font-medium">
                <ClockIcon size={14} className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                <span>
                  {paybackMonth !== null
                    ? t("paybackAchievedDesc", { month: paybackMonth })
                    : t("projectedPaybackM4")}
                </span>
              </div>
            </div>
            <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 rounded-xl text-amber-600 dark:text-amber-400">
              <ClockIcon size={20} className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 12-Month Cohort Retention Heatmap Matrix */}
      <Card className="rounded-2xl border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
        <CardHeader className="border-b border-gray-100 dark:border-gray-800 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <LayoutGridIcon size={20} className="h-5 w-5 text-emerald-500" />
                {t("matrixTitle")}
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">{t("matrixSubtitle")}</CardDescription>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-gray-400 text-[11px] font-medium mr-1">
                {t("retentionLegend")}:
              </span>
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded bg-emerald-600 inline-block" />
                <span className="text-[11px] text-gray-600 dark:text-gray-300 font-medium">
                  ≥60%
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded bg-emerald-500/85 inline-block" />
                <span className="text-[11px] text-gray-600 dark:text-gray-300 font-medium">
                  45-59%
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded bg-teal-400/80 inline-block" />
                <span className="text-[11px] text-gray-600 dark:text-gray-300 font-medium">
                  30-44%
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded bg-amber-400/75 inline-block" />
                <span className="text-[11px] text-gray-600 dark:text-gray-300 font-medium">
                  20-29%
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded bg-rose-400/75 inline-block" />
                <span className="text-[11px] text-gray-600 dark:text-gray-300 font-medium">
                  &lt;20%
                </span>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50/75 dark:bg-gray-800/40">
                  <th className="text-left py-3 px-3 font-semibold text-gray-700 dark:text-gray-300 sticky left-0 bg-gray-50 dark:bg-gray-800/90 z-10 w-28">
                    {t("cohortMonthCol")}
                  </th>
                  <th className="text-center py-3 px-2 font-semibold text-gray-500 w-16">
                    {t("usersCol")}
                  </th>
                  <th className="text-center py-3 px-2 font-semibold text-gray-500 w-16">
                    {t("aovCol")}
                  </th>
                  {Array.from({ length: 12 }, (_, i) => (
                    <th
                      key={i}
                      className="text-center py-3 px-1.5 font-semibold text-gray-600 dark:text-gray-400 min-w-[52px]"
                    >
                      M{i}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60">
                {cohorts.map((row) => (
                  <tr
                    key={row.cohortMonth}
                    className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors"
                  >
                    <td className="py-2.5 px-3 font-semibold text-gray-900 dark:text-gray-100 sticky left-0 bg-white dark:bg-gray-900 z-10 whitespace-nowrap">
                      {row.displayMonth}
                    </td>
                    <td className="py-2.5 px-2 text-center text-gray-600 dark:text-gray-400 font-medium">
                      {row.cohortSize}
                    </td>
                    <td className="py-2.5 px-2 text-center text-gray-600 dark:text-gray-400 font-medium">
                      {formatMoney(row.avgAov, "USD")}
                    </td>
                    {Array.from({ length: 12 }, (_, m) => {
                      const val = row.retention[m];
                      const rev = row.revenue?.[m];
                      const isDefined = val !== undefined;

                      return (
                        <td key={m} className="py-1.5 px-1 text-center">
                          <button
                            type="button"
                            onClick={() =>
                              isDefined &&
                              setSelectedCell({
                                cohort: row.displayMonth,
                                month: m,
                                pct: val,
                                revenue: rev,
                              })
                            }
                            className={cn(
                              "w-full h-8 rounded-lg text-xs transition-all flex items-center justify-center cursor-default",
                              getCellColor(val),
                              isDefined &&
                                "cursor-pointer hover:ring-2 hover:ring-primary/40 hover:scale-105",
                            )}
                            title={
                              isDefined
                                ? `${row.displayMonth} Month ${m}: ${val}% retention ${
                                    rev ? `(${formatMoney(rev, "USD")} rev)` : ""
                                  }`
                                : undefined
                            }
                          >
                            {isDefined ? `${val}%` : "—"}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Cell Drilldown inspection popup */}
          {selectedCell && (
            <div className="p-3 mx-4 my-3 rounded-xl bg-primary/5 dark:bg-primary/10 border border-primary/20 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Award className="h-5 w-5 text-primary shrink-0" />
                <div className="text-xs">
                  <span className="font-bold text-gray-900 dark:text-white">
                    {selectedCell.cohort} &bull; Month {selectedCell.month}
                  </span>
                  <span className="text-gray-500 ml-2">
                    Retention: <strong className="text-primary">{selectedCell.pct}%</strong>
                    {selectedCell.revenue !== undefined && (
                      <span className="ml-2">
                        Gross Generated: <strong>{formatMoney(selectedCell.revenue, "USD")}</strong>
                      </span>
                    )}
                  </span>
                </div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs hover:bg-primary/10 hover:text-primary"
                onClick={() => setSelectedCell(null)}
              >
                {tc("close")}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 2-Column: LTV:CAC Payback Curve & RFM Segments */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LTV vs CAC Payback Line Chart */}
        <Card className="rounded-2xl border-gray-200 dark:border-gray-800 shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <DollarSignIcon size={20} className="h-5 w-5 text-emerald-500" />
                  {t("ltvCacCurveTitle")}
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  {t("ltvCacCurveSubtitle")}
                </CardDescription>
              </div>
              {paybackMonth !== null && (
                <Badge
                  variant="outline"
                  className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-300 border-emerald-200 text-xs"
                >
                  {t("breakevenAtMonth", { month: paybackMonth })}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={ltvCacCurve} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) => formatMoney(v, "USD")}
                    domain={[0, "auto"]}
                  />
                  <Tooltip
                    cursor={{ stroke: "hsl(var(--border))" }}
                    content={({ active, payload, label }) => {
                      if (!active || !payload || !payload.length) return null;
                      const pt = payload[0].payload as LtvCacPoint;
                      return (
                        <div className="rounded-xl border border-white/50 bg-white/70 text-gray-900 shadow-xl backdrop-blur-md dark:border-border dark:bg-card/95 dark:text-card-foreground p-3 text-xs space-y-1 tabular-nums pointer-events-none">
                          <p className="font-bold text-gray-900 dark:text-card-foreground">
                            Month {pt.month} ({pt.label})
                          </p>
                          <div className="flex items-center justify-between gap-4 text-emerald-600">
                            <span>Cumulative LTV:</span>
                            <span className="font-bold">
                              {formatMoney(pt.cumulativeLtv, "USD")}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-4 text-gray-500 dark:text-muted-foreground">
                            <span>Blended CAC:</span>
                            <span>{formatMoney(pt.blendedCac, "USD")}</span>
                          </div>
                          <div className="flex items-center justify-between gap-4 font-semibold text-primary pt-1 border-t border-white/50 dark:border-border">
                            <span>LTV : CAC:</span>
                            <span>{pt.ratio}x</span>
                          </div>
                        </div>
                      );
                    }}
                  />
                  {/* Blended CAC baseline */}
                  <ReferenceLine
                    y={summary.blendedCac}
                    stroke="#ef4444"
                    strokeDasharray="4 4"
                    label={{
                      value: `CAC (${formatMoney(summary.blendedCac, "USD")})`,
                      fill: "#ef4444",
                      fontSize: 10,
                      position: "insideTopRight",
                    }}
                  />
                  {/* Cumulative LTV line */}
                  <Line
                    type="monotone"
                    dataKey="cumulativeLtv"
                    stroke="#10b981"
                    strokeWidth={3}
                    dot={{ r: 4, fill: "#10b981" }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-4 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800 text-xs text-gray-500 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                Cumulative Customer LTV
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-0.5 bg-red-500 border-t border-dashed" />
                Customer Acquisition Cost ({formatMoney(summary.blendedCac, "USD")})
              </span>
            </div>
          </CardContent>
        </Card>

        {/* RFM Customer Segmentation Engine */}
        <Card className="rounded-2xl border-gray-200 dark:border-gray-800 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Award className="h-5 w-5 text-amber-500" />
              {t("rfmTitle")}
            </CardTitle>
            <CardDescription className="text-xs mt-0.5">{t("rfmSubtitle")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {rfmSegments.map((seg) => (
              <div
                key={seg.id}
                className="p-3 rounded-xl border border-gray-100 dark:border-gray-800/80 bg-gray-50/50 dark:bg-gray-800/30 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "w-2.5 h-2.5 rounded-full",
                        seg.color === "emerald" && "bg-emerald-500",
                        seg.color === "blue" && "bg-blue-500",
                        seg.color === "indigo" && "bg-indigo-500",
                        seg.color === "amber" && "bg-amber-500",
                        seg.color === "rose" && "bg-rose-500",
                      )}
                    />
                    <span className="font-bold text-xs text-gray-900 dark:text-white">
                      {seg.name}
                    </span>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      {seg.percentage}%
                    </Badge>
                  </div>
                  <div className="text-right text-xs">
                    <span className="font-black text-gray-900 dark:text-white">
                      {formatMoney(seg.totalRevenue, "USD")}
                    </span>
                    <span className="text-gray-400 text-[10px] ml-1">
                      ({seg.count} {t("customersUnit")})
                    </span>
                  </div>
                </div>

                <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">
                  {seg.description}
                </p>

                <div className="pt-1.5 border-t border-gray-200/40 dark:border-gray-700/40 flex items-start gap-1.5 text-[11px] text-primary">
                  <HeartHandshakeIcon size={14} className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span className="font-medium">{seg.recommendedAction}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
