"use client";

import React, { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp,
  TrendingDown,
  Calculator,
  Target,
  DollarSign,
  Users,
  Percent,
  Layers,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
  RotateCcw,
  Sliders,
  Sparkles,
  HelpCircle,
  ExternalLink,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  calculateUnitEconomics,
  modelAcquisitionFlowdown,
  type UnitEconomicsResult,
  type FunnelFlowdownResult,
} from "@/lib/marketing-math";
import { useTranslations } from "next-intl";
import { useCurrency } from "@/components/currency-provider";

export function PerformanceMarketingEngine() {
  const t = useTranslations("unitEconomics");
  const { formatMoney } = useCurrency();
  const [price, setPrice] = useState<number>(129.99);
  const [cogs, setCogs] = useState<number>(42.0);
  const [adSpend, setAdSpend] = useState<number>(3850);
  const [conversions, setConversions] = useState<number>(132);
  const [cpc, setCpc] = useState<number>(1.25);
  const [cvr, setCvr] = useState<number>(3.5);
  const [impressions, setImpressions] = useState<number>(110000);
  const [targetProfit, setTargetProfit] = useState<number>(25);
  const [variableFeePercent, setVariableFeePercent] = useState<number>(2.9);

  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
  const [activePreset, setActivePreset] = useState<string>("custom");

  useEffect(() => {
    fetch("/api/analytics/marketing-unit-economics")
      .then((res) => res.json())
      .then((data) => {
        if (data.summary) {
          if (data.summary.avgOrderValue > 0) setPrice(data.summary.avgOrderValue);
          if (data.summary.avgCogs > 0) setCogs(data.summary.avgCogs);
          if (data.summary.totalAdSpend > 0) setAdSpend(data.summary.totalAdSpend);
          if (data.summary.totalOrders > 0) setConversions(data.summary.totalOrders);
        }
      })
      .catch(() => {});
  }, []);

  const economics = useMemo<UnitEconomicsResult>(() => {
    return calculateUnitEconomics({
      price,
      cogs,
      adSpend,
      conversions,
      cpc,
      conversionRate: cvr / 100,
      variableFeePercent: variableFeePercent / 100,
      targetProfitPerOrder: targetProfit,
    });
  }, [price, cogs, adSpend, conversions, cpc, cvr, variableFeePercent, targetProfit]);

  const funnel = useMemo<FunnelFlowdownResult>(() => {
    return modelAcquisitionFlowdown({
      impressions,
      ctr: 0.028,
      cpc,
      conversionRate: cvr / 100,
      aov: price,
      unitCogs: cogs,
      variableFeePercent: variableFeePercent / 100,
      targetProfitPerOrder: targetProfit,
    });
  }, [impressions, cpc, cvr, price, cogs, variableFeePercent, targetProfit]);

  const applyPreset = (name: string) => {
    setActivePreset(name);
    if (name === "apparel") {
      setPrice(85);
      setCogs(25);
      setCpc(0.95);
      setCvr(3.2);
      setTargetProfit(20);
    } else if (name === "saas") {
      setPrice(149);
      setCogs(15);
      setCpc(2.8);
      setCvr(2.5);
      setTargetProfit(60);
    } else if (name === "electronics") {
      setPrice(299);
      setCogs(180);
      setCpc(1.6);
      setCvr(2.1);
      setTargetProfit(45);
    }
  };

  const fmtCurrency = (val: number, compact = false) => formatMoney(val, "USD", { compact });

  const roasBuffer = Number((economics.roas - economics.breakEvenROAS).toFixed(2));
  const isRoasHealthy = roasBuffer > 0;

  return (
    <Card className="border-indigo-500/20 bg-gradient-to-br from-card via-card to-indigo-950/10 shadow-sm">
      <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <CardTitle className="text-lg font-bold tracking-tight flex items-center gap-2">
              {t("title")}
            </CardTitle>
            <Badge
              variant="outline"
              className={
                economics.status === "HIGHLY_PROFITABLE"
                  ? "border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10"
                  : economics.status === "BREAK_EVEN"
                    ? "border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-500/10"
                    : "border-rose-500/30 text-rose-600 dark:text-rose-400 bg-rose-500/10"
              }
            >
              {economics.status === "HIGHLY_PROFITABLE"
                ? t("highlyProfitable")
                : economics.status === "BREAK_EVEN"
                  ? t("nearBreakEven")
                  : t("subViable")}
            </Badge>
          </div>
          <CardDescription className="text-xs text-muted-foreground mt-1">
            {t("subtitle")}
          </CardDescription>
        </div>

        <Button
          size="sm"
          variant="outline"
          className="gap-2 text-xs border-indigo-500/30 hover:border-indigo-500/50 hover:bg-indigo-500/10"
          onClick={() => setIsSimulatorOpen(true)}
        >
          <Sliders className="h-3.5 w-3.5 text-indigo-500" />
          {t("openSimulator")}
        </Button>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl border border-border/80 bg-background/50 relative min-w-0 overflow-hidden">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span className="font-semibold uppercase tracking-wider truncate">
                {t("roasLabel")}
              </span>
              <DollarSign className="h-4 w-4 text-indigo-500 shrink-0" />
            </div>
            <div className="flex items-baseline gap-2 min-w-0">
              <span className="text-xl sm:text-2xl font-black truncate">{economics.roas}x</span>
              <span
                className={`text-xs font-semibold flex items-center shrink-0 ${
                  isRoasHealthy ? "text-emerald-500" : "text-rose-500"
                }`}
              >
                {isRoasHealthy ? (
                  <TrendingUp className="h-3 w-3 mr-0.5" />
                ) : (
                  <TrendingDown className="h-3 w-3 mr-0.5" />
                )}
                {roasBuffer >= 0 ? `+${roasBuffer}x` : `${roasBuffer}x`}
              </span>
            </div>
            <div className="mt-2 text-[11px] text-muted-foreground font-mono truncate">
              {t("roasFormula")}
            </div>
          </div>

          <div className="p-4 rounded-xl border border-border/80 bg-background/50 relative min-w-0 overflow-hidden">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span className="font-semibold uppercase tracking-wider truncate">
                {t("breakEvenRoasLabel")}
              </span>
              <Target className="h-4 w-4 text-amber-500 shrink-0" />
            </div>
            <div className="flex items-baseline gap-2 min-w-0">
              <span className="text-xl sm:text-2xl font-black truncate">
                {economics.breakEvenROAS}x
              </span>
              <span className="text-xs text-muted-foreground shrink-0">{t("minRequired")}</span>
            </div>
            <div className="mt-2 text-[11px] text-muted-foreground font-mono truncate">
              {t("breakEvenFormula")} ({economics.grossMarginPercent}%)
            </div>
          </div>

          <div className="p-4 rounded-xl border border-border/80 bg-background/50 relative min-w-0 overflow-hidden">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span className="font-semibold uppercase tracking-wider truncate">
                {t("cpaLabel")}
              </span>
              <Users className="h-4 w-4 text-cyan-500 shrink-0" />
            </div>
            <div className="flex items-baseline gap-2 min-w-0">
              <span
                className="text-xl sm:text-2xl font-black truncate tracking-tight"
                title={fmtCurrency(economics.cpa)}
              >
                {fmtCurrency(economics.cpa, economics.cpa > 999999)}
              </span>
              <span className="text-xs text-muted-foreground shrink-0">{t("perOrder")}</span>
            </div>
            <div className="mt-2 text-[11px] text-muted-foreground font-mono truncate">
              {t("cpaFormula")}
            </div>
          </div>

          <div className="p-4 rounded-xl border border-border/80 bg-background/50 relative min-w-0 overflow-hidden">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span className="font-semibold uppercase tracking-wider truncate">
                {t("mvpTargetPriceLabel")}
              </span>
              <Calculator className="h-4 w-4 text-emerald-500 shrink-0" />
            </div>
            <div className="flex items-baseline gap-2 min-w-0">
              <span
                className="text-xl sm:text-2xl font-black truncate tracking-tight"
                title={fmtCurrency(economics.targetPriceMVP)}
              >
                {fmtCurrency(economics.targetPriceMVP, economics.targetPriceMVP > 999999)}
              </span>
              <span
                className={`text-xs font-semibold shrink-0 ${
                  price >= economics.targetPriceMVP ? "text-emerald-500" : "text-amber-500"
                }`}
              >
                {price >= economics.targetPriceMVP ? t("statusViable") : t("statusUnderpriced")}
              </span>
            </div>
            <div className="mt-2 text-[11px] text-muted-foreground font-mono truncate">
              {t("mvpFormula")}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-indigo-500" />
              {t("flowdownTitle")}
            </span>
            <span className="text-muted-foreground font-mono text-[11px]">
              AOV: {fmtCurrency(price)} | Unit COGS: {fmtCurrency(cogs)}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-center pt-2">
            <div className="p-2.5 rounded-lg bg-background border border-border/60 min-w-0 overflow-hidden">
              <div className="text-[10px] text-muted-foreground uppercase font-bold truncate">
                {t("impressions")}
              </div>
              <div className="text-sm font-bold mt-0.5 truncate">
                {funnel.clicks > 0 ? (funnel.clicks * 36).toLocaleString() : "125,000"}
              </div>
              <div className="text-[10px] text-muted-foreground truncate">{t("topOfFunnel")}</div>
            </div>

            <div className="p-2.5 rounded-lg bg-background border border-border/60 min-w-0 overflow-hidden">
              <div className="text-[10px] text-muted-foreground uppercase font-bold truncate">
                {t("clicks")}
              </div>
              <div className="text-sm font-bold mt-0.5 truncate">
                {funnel.clicks.toLocaleString()}
              </div>
              <div
                className="text-[10px] text-indigo-500 font-semibold truncate"
                title={`${fmtCurrency(cpc)}/click`}
              >
                {fmtCurrency(cpc)}/click
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-background border border-border/60 min-w-0 overflow-hidden">
              <div className="text-[10px] text-muted-foreground uppercase font-bold truncate">
                {t("conversions")}
              </div>
              <div className="text-sm font-bold mt-0.5 truncate">
                {funnel.conversions.toLocaleString()}
              </div>
              <div className="text-[10px] text-emerald-500 font-semibold truncate">{cvr}% CVR</div>
            </div>

            <div className="p-2.5 rounded-lg bg-background border border-border/60 min-w-0 overflow-hidden">
              <div className="text-[10px] text-muted-foreground uppercase font-bold truncate">
                {t("grossRevenue")}
              </div>
              <div
                className="text-sm font-bold mt-0.5 text-indigo-600 dark:text-indigo-400 truncate tracking-tight"
                title={fmtCurrency(funnel.revenue)}
              >
                {fmtCurrency(funnel.revenue, funnel.revenue > 999999)}
              </div>
              <div className="text-[10px] text-muted-foreground truncate">{t("gmvTotal")}</div>
            </div>

            <div className="p-2.5 rounded-lg bg-background border border-border/60 min-w-0 overflow-hidden">
              <div className="text-[10px] text-muted-foreground uppercase font-bold truncate">
                {t("totalCosts")}
              </div>
              <div
                className="text-sm font-bold mt-0.5 text-rose-500 truncate tracking-tight"
                title={`-${fmtCurrency(funnel.adSpend + funnel.totalCogs + funnel.variableFees)}`}
              >
                -
                {fmtCurrency(
                  funnel.adSpend + funnel.totalCogs + funnel.variableFees,
                  funnel.adSpend + funnel.totalCogs + funnel.variableFees > 999999,
                )}
              </div>
              <div className="text-[10px] text-muted-foreground truncate">
                {t("costsBreakdown")}
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 min-w-0 overflow-hidden">
              <div className="text-[10px] text-emerald-600 dark:text-emerald-400 uppercase font-bold truncate">
                {t("contributionMargin")}
              </div>
              <div
                className="text-sm font-bold mt-0.5 text-emerald-600 dark:text-emerald-400 truncate tracking-tight"
                title={fmtCurrency(funnel.contributionMargin)}
              >
                {fmtCurrency(
                  funnel.contributionMargin,
                  Math.abs(funnel.contributionMargin) > 999999,
                )}
              </div>
              <div className="text-[10px] font-semibold text-emerald-500 truncate">
                {funnel.contributionMarginPercent}% Margin
              </div>
            </div>
          </div>

          <div className="pt-2">
            <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
              <span>{t("marginRetention")}</span>
              <span className="font-semibold text-foreground">
                {funnel.contributionMarginPercent}%
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  funnel.contributionMarginPercent >= 20
                    ? "bg-emerald-500"
                    : funnel.contributionMarginPercent >= 10
                      ? "bg-amber-500"
                      : "bg-rose-500"
                }`}
                style={{
                  width: `${Math.max(0, Math.min(100, funnel.contributionMarginPercent))}%`,
                }}
              />
            </div>
          </div>
        </div>
      </CardContent>

      <Dialog open={isSimulatorOpen} onOpenChange={setIsSimulatorOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto scrollbar-thin">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sliders className="h-5 w-5 text-indigo-500" />
              {t("simulatorTitle")}
            </DialogTitle>
            <DialogDescription>{t("simulatorDesc")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-6 pt-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground">{t("presets")}</span>
              <Button
                variant={activePreset === "apparel" ? "default" : "outline"}
                size="sm"
                className="h-7 text-xs"
                onClick={() => applyPreset("apparel")}
              >
                {t("presetApparel")}
              </Button>
              <Button
                variant={activePreset === "saas" ? "default" : "outline"}
                size="sm"
                className="h-7 text-xs"
                onClick={() => applyPreset("saas")}
              >
                {t("presetSaas")}
              </Button>
              <Button
                variant={activePreset === "electronics" ? "default" : "outline"}
                size="sm"
                className="h-7 text-xs"
                onClick={() => applyPreset("electronics")}
              >
                {t("presetElectronics")}
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5 p-3 rounded-lg border bg-card">
                <div className="flex justify-between text-xs font-medium">
                  <span>{t("sellingPrice")}</span>
                  <span className="font-bold text-indigo-500">{fmtCurrency(price)}</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="500"
                  step="5"
                  value={price}
                  onChange={(e) => setPrice(Number(e.target.value))}
                  className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
              </div>

              <div className="space-y-1.5 p-3 rounded-lg border bg-card">
                <div className="flex justify-between text-xs font-medium">
                  <span>{t("unitCogs")}</span>
                  <span className="font-bold text-rose-500">{fmtCurrency(cogs)}</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="300"
                  step="5"
                  value={cogs}
                  onChange={(e) => setCogs(Number(e.target.value))}
                  className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-rose-600"
                />
              </div>

              <div className="space-y-1.5 p-3 rounded-lg border bg-card">
                <div className="flex justify-between text-xs font-medium">
                  <span>{t("cpc")}</span>
                  <span className="font-bold text-cyan-500">{fmtCurrency(cpc)}</span>
                </div>
                <input
                  type="range"
                  min="0.2"
                  max="5.0"
                  step="0.05"
                  value={cpc}
                  onChange={(e) => setCpc(Number(e.target.value))}
                  className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-cyan-600"
                />
              </div>

              <div className="space-y-1.5 p-3 rounded-lg border bg-card">
                <div className="flex justify-between text-xs font-medium">
                  <span>{t("cvr")}</span>
                  <span className="font-bold text-emerald-500">{cvr}%</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="10.0"
                  step="0.1"
                  value={cvr}
                  onChange={(e) => setCvr(Number(e.target.value))}
                  className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-emerald-600"
                />
              </div>

              <div className="space-y-1.5 p-3 rounded-lg border bg-card">
                <div className="flex justify-between text-xs font-medium">
                  <span>{t("targetProfit")}</span>
                  <span className="font-bold text-amber-500">{fmtCurrency(targetProfit)}</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="100"
                  step="5"
                  value={targetProfit}
                  onChange={(e) => setTargetProfit(Number(e.target.value))}
                  className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-amber-600"
                />
              </div>

              <div className="space-y-1.5 p-3 rounded-lg border bg-card">
                <div className="flex justify-between text-xs font-medium">
                  <span>{t("gatewayFee")}</span>
                  <span className="font-bold text-muted-foreground">{variableFeePercent}%</span>
                </div>
                <input
                  type="range"
                  min="1.0"
                  max="8.0"
                  step="0.1"
                  value={variableFeePercent}
                  onChange={(e) => setVariableFeePercent(Number(e.target.value))}
                  className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-gray-600"
                />
              </div>
            </div>

            <div className="p-4 rounded-xl border border-indigo-500/30 bg-indigo-500/5 space-y-3">
              <div className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                {t("simulatedVerdict")}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="p-2 rounded-lg bg-background border">
                  <div className="text-[10px] text-muted-foreground uppercase font-bold">
                    {t("simulatedRoas")}
                  </div>
                  <div className="text-base font-black mt-0.5">{economics.roas}x</div>
                </div>
                <div className="p-2 rounded-lg bg-background border">
                  <div className="text-[10px] text-muted-foreground uppercase font-bold">
                    {t("breakEvenRoasLabel")}
                  </div>
                  <div className="text-base font-black mt-0.5 text-amber-500">
                    {economics.breakEvenROAS}x
                  </div>
                </div>
                <div className="p-2 rounded-lg bg-background border">
                  <div className="text-[10px] text-muted-foreground uppercase font-bold">
                    {t("mvpTargetPriceLabel")}
                  </div>
                  <div className="text-base font-black mt-0.5 text-emerald-500">
                    {fmtCurrency(economics.targetPriceMVP)}
                  </div>
                </div>
                <div className="p-2 rounded-lg bg-background border">
                  <div className="text-[10px] text-muted-foreground uppercase font-bold">
                    {t("contributionMargin")} %
                  </div>
                  <div className="text-base font-black mt-0.5 text-indigo-500">
                    {economics.contributionMarginPercent}%
                  </div>
                </div>
              </div>

              <div className="space-y-1 text-xs text-muted-foreground pt-1">
                {economics.recommendations.map((rec, i) => (
                  <div key={i} className="flex items-start gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5 text-indigo-500 shrink-0 mt-0.5" />
                    <span>{rec}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
