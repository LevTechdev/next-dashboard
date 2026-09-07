"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  TrendingUp,
  Download,
  FileText,
  Sliders,
  Calculator,
  Check,
  ArrowRight,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { useCurrency } from "@/components/currency-provider";

interface RevenueForecastWidgetProps {
  baseMonthlyRevenue?: number;
}

export function RevenueForecastWidget({ baseMonthlyRevenue = 284750 }: RevenueForecastWidgetProps) {
  const t = useTranslations("dashboard");
  const { formatMoney } = useCurrency();
  const [growthMultiplier, setGrowthMultiplier] = useState<number>(25); // +25% default
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);

  const projectedMonthly = Math.round(baseMonthlyRevenue * (1 + growthMultiplier / 100));
  const projectedArr = projectedMonthly * 12;
  const grossMargin = 74.5; // percentage
  const projectedGrossProfit = Math.round(projectedMonthly * (grossMargin / 100));
  const projectedNetOperatingMargin = 31.8; // percentage
  const projectedNetProfit = Math.round(projectedMonthly * (projectedNetOperatingMargin / 100));

  const handleExportCsv = () => {
    const csvContent =
      `Scenario,GrowthRate,MonthlyRevenue,ProjectedARR,GrossProfit,NetOperatingProfit\n` +
      `Current,0%,${baseMonthlyRevenue},${baseMonthlyRevenue * 12},${Math.round(baseMonthlyRevenue * 0.745)},${Math.round(baseMonthlyRevenue * 0.318)}\n` +
      `Forecasted,+${growthMultiplier}%,${projectedMonthly},${projectedArr},${projectedGrossProfit},${projectedNetProfit}`;

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `revenue-forecast-${growthMultiplier}pct.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setDownloadSuccess("CSV Report Generated!");
    setTimeout(() => setDownloadSuccess(null), 3500);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <Card className="overflow-hidden border-border/70 shadow-sm">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 gap-3">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <Calculator className="h-4 w-4 text-emerald-500" />
            {t("financialSimulatorTitle")}
          </CardTitle>
          <CardDescription>{t("financialSimulatorDesc")}</CardDescription>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            className="gap-1.5 text-xs rounded-xl cursor-pointer"
          >
            {downloadSuccess ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-500" />
                <span>Exported</span>
              </>
            ) : (
              <>
                <Download className="h-3.5 w-3.5 text-muted-foreground" />
                <span>Export CSV</span>
              </>
            )}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handlePrint}
            className="gap-1.5 text-xs rounded-xl cursor-pointer hidden sm:flex"
          >
            <FileText className="h-3.5 w-3.5 text-muted-foreground" />
            <span>Print Report</span>
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-6 space-y-6">
        {/* Interactive Scenario Presets */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-muted/40 border border-border/60">
          <div className="flex items-center gap-2">
            <Sliders className="h-4 w-4 text-primary" />
            <span className="text-xs font-semibold text-foreground">Growth Multiplier:</span>
            <span className="text-xs font-bold text-primary px-2 py-0.5 rounded-md bg-primary/10 border border-primary/20 font-mono">
              +{growthMultiplier}%
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {[10, 25, 50, 75, 100].map((preset) => (
              <button
                key={preset}
                onClick={() => setGrowthMultiplier(preset)}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer",
                  growthMultiplier === preset
                    ? "bg-primary text-primary-foreground font-bold shadow-xs"
                    : "bg-background/80 hover:bg-background text-muted-foreground border border-border/50",
                )}
              >
                +{preset}%
              </button>
            ))}
          </div>
        </div>

        {/* Range Slider */}
        <div className="space-y-1.5">
          <input
            type="range"
            min="5"
            max="120"
            step="5"
            value={growthMultiplier}
            onChange={(e) => setGrowthMultiplier(Number(e.target.value))}
            className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
          />
          <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
            <span>Conservative (+5%)</span>
            <span>Balanced (+25%)</span>
            <span>Hyper-Growth (+100%)</span>
          </div>
        </div>

        {/* Dynamic Financial Results Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-4 rounded-xl min-w-0 overflow-hidden bg-gradient-to-br from-emerald-500/10 via-muted/20 to-background border border-emerald-500/20">
            <p className="text-xs text-muted-foreground truncate">Projected Monthly GMV</p>
            <p
              className="text-lg sm:text-xl font-bold text-foreground mt-1 truncate tracking-tight"
              title={formatMoney(projectedMonthly, "USD")}
            >
              {formatMoney(projectedMonthly, "USD", { compact: projectedMonthly > 9999999 })}
            </p>
            <p
              className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-1 truncate"
              title={`+${formatMoney(projectedMonthly - baseMonthlyRevenue, "USD")} delta`}
            >
              +
              {formatMoney(projectedMonthly - baseMonthlyRevenue, "USD", {
                compact: projectedMonthly - baseMonthlyRevenue > 9999999,
              })}{" "}
              delta
            </p>
          </div>

          <div className="p-4 rounded-xl min-w-0 overflow-hidden bg-gradient-to-br from-sky-500/10 via-muted/20 to-background border border-sky-500/20">
            <p className="text-xs text-muted-foreground truncate">Annualized Run Rate (ARR)</p>
            <p
              className="text-lg sm:text-xl font-bold text-foreground mt-1 truncate tracking-tight"
              title={formatMoney(projectedArr, "USD")}
            >
              {formatMoney(projectedArr, "USD", { compact: projectedArr > 999999 })}
            </p>
            <p className="text-[11px] text-sky-600 dark:text-sky-400 font-medium mt-1 truncate">
              Based on 12-mo forward projection
            </p>
          </div>

          <div className="p-4 rounded-xl min-w-0 overflow-hidden bg-gradient-to-br from-purple-500/10 via-muted/20 to-background border border-purple-500/20">
            <p className="text-xs text-muted-foreground truncate">
              Est. Gross Margin ({grossMargin}%)
            </p>
            <p
              className="text-lg sm:text-xl font-bold text-foreground mt-1 truncate tracking-tight"
              title={formatMoney(projectedGrossProfit, "USD")}
            >
              {formatMoney(projectedGrossProfit, "USD", {
                compact: projectedGrossProfit > 9999999,
              })}
            </p>
            <p className="text-[11px] text-purple-600 dark:text-purple-400 font-medium mt-1 truncate">
              After infrastructure & gateway fees
            </p>
          </div>

          <div className="p-4 rounded-xl min-w-0 overflow-hidden bg-gradient-to-br from-amber-500/10 via-muted/20 to-background border border-amber-500/20">
            <p className="text-xs text-muted-foreground truncate">Net Operating Profit (31.8%)</p>
            <p
              className="text-lg sm:text-xl font-bold text-foreground mt-1 truncate tracking-tight"
              title={formatMoney(projectedNetProfit, "USD")}
            >
              {formatMoney(projectedNetProfit, "USD", { compact: projectedNetProfit > 9999999 })}
            </p>
            <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium mt-1 truncate">
              Free cashflow available for re-investment
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
