"use client";

import React, { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import {
  Landmark,
  ShieldCheck,
  AlertTriangle,
  FileSpreadsheet,
  Calculator,
  Download,
  Building,
  Globe,
  Clock,
  ArrowRight,
  CheckCircle2,
  DollarSign,
  Receipt,
  FileCheck,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCurrency } from "@/components/currency-provider";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  TaxJurisdiction,
  QuarterlyFiling,
  TaxCalculationResult,
  MOCK_JURISDICTIONS,
  MOCK_QUARTERLY_FILINGS,
  calculateTaxRate,
} from "@/lib/tax-nexus";

export function TaxNexusEngine() {
  const t = useTranslations("taxNexus");
  const { formatMoney } = useCurrency();

  const [activeSubTab, setActiveSubTab] = useState<"nexus" | "calculator" | "filings">("nexus");
  const [jurisdictions, setJurisdictions] = useState<TaxJurisdiction[]>(MOCK_JURISDICTIONS);
  const [filings, setFilings] = useState<QuarterlyFiling[]>(MOCK_QUARTERLY_FILINGS);

  // Simulator Form State
  const [simCountry, setSimCountry] = useState("US");
  const [simSubtotal, setSimSubtotal] = useState(120);
  const [simCategory, setSimCategory] = useState<
    "DIGITAL_SAAS" | "PHYSICAL_GOODS" | "CONSULTING" | "B2B_EXEMPT"
  >("DIGITAL_SAAS");
  const [simB2bTaxId, setSimB2bTaxId] = useState("");
  const [simResult, setSimResult] = useState<TaxCalculationResult>(() =>
    calculateTaxRate({ country: "US", subtotal: 120, category: "DIGITAL_SAAS" }),
  );

  useEffect(() => {
    fetch("/api/billing/tax/nexus")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.jurisdictions) setJurisdictions(data.jurisdictions);
      })
      .catch(() => {});

    fetch("/api/billing/tax/filings")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && Array.isArray(data)) setFilings(data);
      })
      .catch(() => {});
  }, []);

  const handleSimulateTax = () => {
    const res = calculateTaxRate({
      country: simCountry,
      subtotal: Number(simSubtotal) || 100,
      category: simCategory,
      b2bTaxId: simB2bTaxId,
    });
    setSimResult(res);
    toast.success(t("simResult") + " updated");
  };

  const handleExportSchedule = () => {
    toast.success(t("filingExported"), {
      description: "IRS 1099/Sales Tax & EU One-Stop-Shop VAT report generated in CSV/PDF format.",
    });
  };

  const activeNexusCount = jurisdictions.filter((j) => j.status === "NEXUS_REACHED").length;
  const approachingCount = jurisdictions.filter((j) => j.status === "APPROACHING").length;

  return (
    <div className="space-y-6">
      {/* ─── Top Telemetry KPI Cards ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border/70 shadow-xs">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground font-medium">
                {t("activeNexus")}
              </span>
              <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                <Landmark className="h-4 w-4" />
              </div>
            </div>
            <div className="text-2xl font-bold tracking-tight text-foreground mt-2 font-mono">
              {activeNexusCount}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">{t("kpiActiveSub")}</p>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-xs">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground font-medium">
                {t("approachingNexus")}
              </span>
              <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                <AlertTriangle className="h-4 w-4" />
              </div>
            </div>
            <div className="text-2xl font-bold tracking-tight text-foreground mt-2 font-mono">
              {approachingCount}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">{t("kpiApproachingSub")}</p>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-xs">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground font-medium truncate">
                {t("estimatedLiability")}
              </span>
              <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                <Receipt className="h-4 w-4" />
              </div>
            </div>
            <div
              className="text-2xl font-bold tracking-tight text-primary mt-2 font-mono"
              title={formatMoney(89400)}
            >
              {formatMoney(89400)}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">{t("kpiLiabilitySub")}</p>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-xs">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground font-medium">
                {t("monitoredRegions")}
              </span>
              <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                <Globe className="h-4 w-4" />
              </div>
            </div>
            <div className="text-2xl font-bold tracking-tight text-foreground mt-2 font-mono">
              {jurisdictions.length}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">{t("kpiMonitoredSub")}</p>
          </CardContent>
        </Card>
      </div>

      {/* ─── Main Content Tabs ─── */}
      <Card className="border-border/70 shadow-sm overflow-hidden">
        <CardHeader className="pb-3 border-b border-border/50">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Landmark className="h-5 w-5 text-primary" />
                {t("title")}
              </CardTitle>
              <CardDescription className="text-xs">{t("subtitle")}</CardDescription>
            </div>

            {/* Subtab Switcher */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
              <button
                onClick={() => setActiveSubTab("nexus")}
                className={cn(
                  "px-2.5 py-1 rounded-md font-medium transition cursor-pointer flex items-center gap-1.5",
                  activeSubTab === "nexus"
                    ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-bold"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white",
                )}
              >
                <span>{t("tabNexus")}</span>
              </button>
              <button
                onClick={() => setActiveSubTab("calculator")}
                className={cn(
                  "px-2.5 py-1 rounded-md font-medium transition cursor-pointer flex items-center gap-1.5",
                  activeSubTab === "calculator"
                    ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-bold"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white",
                )}
              >
                <span>{t("tabCalculator")}</span>
              </button>
              <button
                onClick={() => setActiveSubTab("filings")}
                className={cn(
                  "px-2.5 py-1 rounded-md font-medium transition cursor-pointer flex items-center gap-1.5",
                  activeSubTab === "filings"
                    ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-bold"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white",
                )}
              >
                <span>{t("tabFilings")}</span>
              </button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-5">
          {/* ─── TAB 1: Nexus Thresholds ─── */}
          {activeSubTab === "nexus" && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {jurisdictions.map((j) => {
                const percent = Math.min(
                  100,
                  Math.round((j.currentAmount / j.thresholdAmount) * 100),
                );

                return (
                  <div
                    key={j.id}
                    className="p-4 rounded-xl border border-border/80 bg-slate-50/50 dark:bg-slate-900/40 hover:border-border transition space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xl leading-none">{j.flag}</span>
                        <div>
                          <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                            {j.name}
                          </h4>
                          <span className="text-[10px] text-slate-500">{j.region}</span>
                        </div>
                      </div>

                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] font-mono font-bold",
                          j.status === "NEXUS_REACHED"
                            ? "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-300 dark:border-rose-800"
                            : j.status === "APPROACHING"
                              ? "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 dark:border-amber-800"
                              : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800",
                        )}
                      >
                        {j.status === "NEXUS_REACHED"
                          ? t("nexusReached")
                          : j.status === "APPROACHING"
                            ? t("approaching")
                            : t("safe")}
                      </Badge>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] font-mono">
                        <span className="text-slate-500">{t("thresholdProg")}</span>
                        <span className="font-bold text-slate-900 dark:text-white">{percent}%</span>
                      </div>
                      <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all duration-700",
                            j.status === "NEXUS_REACHED"
                              ? "bg-rose-500"
                              : j.status === "APPROACHING"
                                ? "bg-amber-500"
                                : "bg-emerald-500",
                          )}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-400 font-mono pt-0.5">
                        <span>
                          Current: {j.currentAmount.toLocaleString()} {j.currency}
                        </span>
                        <span>
                          Cap: {j.thresholdAmount.toLocaleString()} {j.currency}
                        </span>
                      </div>
                    </div>

                    {/* Metadata Footer */}
                    <div className="pt-2 border-t border-border/50 flex items-center justify-between text-[11px]">
                      <div>
                        <span className="text-slate-400 block text-[10px]">
                          {t("standardRate")}
                        </span>
                        <span className="font-bold text-slate-900 dark:text-white font-mono">
                          {j.standardTaxRate}%
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-slate-400 block text-[10px]">
                          {t("daysRemaining")}
                        </span>
                        <span className="font-bold text-primary font-mono">
                          {j.daysRemainingToFiling} days
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ─── TAB 2: Live Tax Simulator ─── */}
          {activeSubTab === "calculator" && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Simulator Input Form */}
              <div className="lg:col-span-6 p-4 sm:p-5 rounded-xl border border-border/80 bg-slate-50/70 dark:bg-slate-900/60 space-y-4">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Calculator className="h-4 w-4 text-primary" />
                    {t("simTitle")}
                  </h4>
                  <p className="text-[11px] text-slate-500">{t("simDesc")}</p>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="text-slate-600 dark:text-slate-300 font-medium mb-1 block">
                      {t("countryLabel")}
                    </label>
                    <Select value={simCountry} onValueChange={setSimCountry}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Select Country" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="US">🇺🇸 United States (State Destination Tax)</SelectItem>
                        <SelectItem value="ID">🇮🇩 Indonesia (PPN 11% PMK-60)</SelectItem>
                        <SelectItem value="SG">🇸🇬 Singapore (GST 9% OVR)</SelectItem>
                        <SelectItem value="JP">🇯🇵 Japan (JCT 10% Qualified Invoice)</SelectItem>
                        <SelectItem value="GB">🇬🇧 United Kingdom (HMRC 20%)</SelectItem>
                        <SelectItem value="DE">🇩🇪 Germany (EU OSS 19%)</SelectItem>
                        <SelectItem value="FR">🇫🇷 France (EU OSS 20%)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-slate-600 dark:text-slate-300 font-medium mb-1 block">
                      {t("subtotalLabel")} ($)
                    </label>
                    <Input
                      type="number"
                      min={1}
                      value={simSubtotal}
                      onChange={(e) => setSimSubtotal(Number(e.target.value))}
                      className="h-8 text-xs font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-slate-600 dark:text-slate-300 font-medium mb-1 block">
                      {t("categoryLabel")}
                    </label>
                    <Select value={simCategory} onValueChange={(v: any) => setSimCategory(v)}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DIGITAL_SAAS">{t("catDigitalSaas")}</SelectItem>
                        <SelectItem value="PHYSICAL_GOODS">{t("catPhysicalGoods")}</SelectItem>
                        <SelectItem value="CONSULTING">{t("catConsulting")}</SelectItem>
                        <SelectItem value="B2B_EXEMPT">{t("catB2bExempt")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-slate-600 dark:text-slate-300 font-medium mb-1 block">
                      {t("b2bTaxIdLabel")}
                    </label>
                    <Input
                      placeholder="e.g. DE123456789 or 01.482.910.4-021.000"
                      value={simB2bTaxId}
                      onChange={(e) => setSimB2bTaxId(e.target.value)}
                      className="h-8 text-xs font-mono"
                    />
                  </div>

                  <Button
                    size="sm"
                    onClick={handleSimulateTax}
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer h-8 text-xs mt-2"
                  >
                    <Calculator className="h-3.5 w-3.5 mr-1.5" />
                    {t("calculateBtn")}
                  </Button>
                </div>
              </div>

              {/* Calculation Result Preview Card */}
              <div className="lg:col-span-6 p-4 sm:p-5 rounded-xl border border-primary/30 bg-card space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-border/60">
                  <div className="flex items-center gap-2">
                    <Receipt className="h-5 w-5 text-primary" />
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                      {t("simResult")}
                    </h4>
                  </div>
                  <Badge
                    variant="outline"
                    className="font-mono text-xs text-primary border-primary/40"
                  >
                    {simResult.taxLabel}
                  </Badge>
                </div>

                <div className="space-y-2.5 text-xs">
                  <div className="flex justify-between py-1 border-b border-border/40">
                    <span className="text-slate-500">{t("subtotal")}:</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">
                      {formatMoney(simResult.subtotal)}
                    </span>
                  </div>

                  <div className="flex justify-between py-1 border-b border-border/40">
                    <span className="text-slate-500">{t("taxRate")}:</span>
                    <span className="font-mono font-bold text-primary">
                      {simResult.taxRatePercent}%
                    </span>
                  </div>

                  <div className="flex justify-between py-1 border-b border-border/40">
                    <span className="text-slate-500">{t("taxAmount")}:</span>
                    <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
                      +{formatMoney(simResult.taxAmount)}
                    </span>
                  </div>

                  <div className="flex justify-between py-2 border-t-2 border-border font-bold text-sm">
                    <span className="text-slate-900 dark:text-white">{t("totalAmount")}:</span>
                    <span className="font-mono text-emerald-600 dark:text-emerald-400 text-base">
                      {formatMoney(simResult.totalWithTax)}
                    </span>
                  </div>

                  {simResult.isReverseChargeApplied && (
                    <div className="p-2 rounded bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 text-[11px] font-medium flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                      {t("reverseChargeApplied")}
                    </div>
                  )}

                  <p className="text-[10px] text-slate-500 italic mt-2">
                    Note: {simResult.complianceNote}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ─── TAB 3: Quarterly Filings ─── */}
          {activeSubTab === "filings" && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <FileSpreadsheet className="h-4 w-4 text-emerald-500" />
                    {t("filingsTitle")}
                  </h4>
                  <p className="text-xs text-slate-500">{t("filingsDesc")}</p>
                </div>

                <Button
                  size="sm"
                  onClick={handleExportSchedule}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer h-8 text-xs"
                >
                  <Download className="h-3.5 w-3.5 mr-1" />
                  {t("exportSchedule")}
                </Button>
              </div>

              <div className="rounded-xl border border-border/80 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-900/60 border-b border-border/60 text-slate-500">
                    <tr>
                      <th className="py-2.5 px-3 text-left font-medium">{t("quarterPeriodCol")}</th>
                      <th className="py-2.5 px-3 text-left font-medium">{t("grossTaxableCol")}</th>
                      <th className="py-2.5 px-3 text-left font-medium">{t("taxCollectedCol")}</th>
                      <th className="py-2.5 px-3 text-left font-medium">{t("jurisdictionsCol")}</th>
                      <th className="py-2.5 px-3 text-left font-medium">
                        {t("filingDeadlineCol")}
                      </th>
                      <th className="py-2.5 px-3 text-right font-medium">
                        {t("remittanceStatusCol")}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {filings.map((filing) => (
                      <tr
                        key={filing.quarter}
                        className="hover:bg-slate-50/50 dark:hover:bg-slate-900/40 transition-colors"
                      >
                        <td className="py-3 px-3">
                          <div className="font-bold text-slate-900 dark:text-white font-mono">
                            {filing.quarter}
                          </div>
                          <div className="text-[11px] text-slate-500">{filing.period}</div>
                        </td>

                        <td className="py-3 px-3 font-mono font-bold text-slate-900 dark:text-white">
                          {formatMoney(filing.grossRevenue)}
                        </td>

                        <td className="py-3 px-3 font-mono font-bold text-rose-600 dark:text-rose-400">
                          {formatMoney(filing.taxCollected)}
                        </td>

                        <td className="py-3 px-3 font-mono text-slate-600 dark:text-slate-400">
                          {t("taxAuthorities", { count: filing.jurisdictionCount })}
                        </td>

                        <td className="py-3 px-3 font-mono text-slate-700 dark:text-slate-300">
                          {filing.filingDeadline}
                        </td>

                        <td className="py-3 px-3 text-right">
                          <Badge
                            variant="outline"
                            className={cn(
                              "font-mono font-bold text-[10px]",
                              filing.status === "REMITTED"
                                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-400"
                                : "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-400",
                            )}
                          >
                            {filing.status === "REMITTED"
                              ? t("statusPaidRemitted")
                              : t("statusReadyToFile")}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
