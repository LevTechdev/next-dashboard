"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowDown,
  TrendingUp,
  Zap,
  Sparkles,
  CheckCircle2,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface FunnelStep {
  name: string;
  count: number;
  rate: number;
  dropoff: number;
  color: string;
}

const FUNNEL_DATA: FunnelStep[] = [
  { name: "1. Store Impressions", count: 142500, rate: 100, dropoff: 0, color: "bg-sky-500" },
  { name: "2. Product Page Views", count: 68200, rate: 47.8, dropoff: 52.2, color: "bg-blue-500" },
  { name: "3. Added to Cart", count: 24800, rate: 36.3, dropoff: 63.7, color: "bg-purple-500" },
  { name: "4. Checkout Initiated", count: 8410, rate: 33.9, dropoff: 66.1, color: "bg-amber-500" },
  {
    name: "5. Completed Purchases",
    count: 1847,
    rate: 21.9,
    dropoff: 78.1,
    color: "bg-emerald-500",
  },
];

export function ConversionRadarWidget() {
  const t = useTranslations("dashboard");
  const [timeframe, setTimeframe] = useState<"7d" | "30d" | "90d">("30d");

  return (
    <Card className="overflow-hidden border-border/70 shadow-sm">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 gap-3">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-500" />
            {t("funnelHealthTitle")}
          </CardTitle>
          <CardDescription>{t("funnelHealthDesc")}</CardDescription>
        </div>

        {/* Timeframe filter */}
        <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl border border-border/50 text-xs">
          {(["7d", "30d", "90d"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTimeframe(t)}
              className={cn(
                "px-2.5 py-1 rounded-lg font-medium transition cursor-pointer",
                timeframe === t
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.toUpperCase()}
            </button>
          ))}
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-6 space-y-6">
        {/* Funnel Pipeline Visualization */}
        <div className="space-y-3">
          {FUNNEL_DATA.map((step, idx) => (
            <div key={step.name} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-foreground">{step.name}</span>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-muted-foreground">
                    {step.count.toLocaleString()}
                  </span>
                  <span className="font-bold text-foreground w-12 text-right">{step.rate}%</span>
                </div>
              </div>

              {/* Bar */}
              <div className="h-2.5 w-full rounded-full bg-muted/50 overflow-hidden relative">
                <div
                  className={cn("h-full rounded-full transition-all duration-700", step.color)}
                  style={{ width: `${step.rate}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Radar & Vital Health Signals Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          <div className="p-3 rounded-xl bg-muted/30 border border-border/60 min-w-0 overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground truncate">Checkout SLA</span>
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
            </div>
            <p className="text-lg font-bold text-foreground mt-1 truncate">99.82%</p>
            <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5 truncate">
              Zero drop in gateway
            </p>
          </div>

          <div className="p-3 rounded-xl bg-muted/30 border border-border/60 min-w-0 overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground truncate">Cart Recovery</span>
              <TrendingUp className="h-3.5 w-3.5 text-sky-500 shrink-0" />
            </div>
            <p className="text-lg font-bold text-foreground mt-1 truncate">28.4%</p>
            <p className="text-[10px] text-sky-600 dark:text-sky-400 font-semibold mt-0.5 truncate">
              +4.8% vs benchmark
            </p>
          </div>

          <div className="p-3 rounded-xl bg-muted/30 border border-border/60 min-w-0 overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground truncate">Avg Latency</span>
              <Zap className="h-3.5 w-3.5 text-amber-500 shrink-0" />
            </div>
            <p className="text-lg font-bold text-foreground mt-1 truncate">118 ms</p>
            <p className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold mt-0.5 truncate">
              Global edge network
            </p>
          </div>

          <div className="p-3 rounded-xl bg-muted/30 border border-border/60 min-w-0 overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground truncate">Mobile Share</span>
              <ShieldCheck className="h-3.5 w-3.5 text-purple-500 shrink-0" />
            </div>
            <p className="text-lg font-bold text-foreground mt-1 truncate">64.5%</p>
            <p className="text-[10px] text-purple-600 dark:text-purple-400 font-semibold mt-0.5 truncate">
              1,191 mobile buyers
            </p>
          </div>
        </div>

        {/* AI Optimization Callout */}
        <div className="flex items-start gap-3 p-3.5 rounded-xl bg-primary/10 border border-primary/20 text-xs">
          <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-foreground">AI Conversion Insight: </span>
            <span className="text-muted-foreground">
              Enabling one-click localized payments (QRIS & DPoP Token Auth) eliminated 31% of
              checkout friction for returning mobile shoppers.
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
