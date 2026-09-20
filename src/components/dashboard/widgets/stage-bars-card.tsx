"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import {
  Eye,
  UserPlus,
  Zap,
  Crown,
  Users,
  Building2,
  CalendarDays,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * Stage Bars Card — the funnel as a list (boardui reference).
 *
 * One rounded pill per pipeline stage over a full-width track: stage name on
 * the left, value + share of the top stage on the right. Widths animate in on
 * mount, hovering a stage darkens its pill and fades the rest, and the header
 * headline follows the hovered (or largest) stage. Stages derive from REAL
 * workspace data — sessions, signups, active users, plan distribution — via
 * /api/dashboard/pipeline, with a demo fallback when the endpoint is
 * unavailable (signed-out marketing preview).
 */

interface Stage {
  key: string;
  labelKey: string;
  value: number;
  color: string;
  icon: LucideIcon;
}

type Range = "7d" | "30d" | "90d";

const RANGES: Array<{ key: Range; days: number }> = [
  { key: "7d", days: 7 },
  { key: "30d", days: 30 },
  { key: "90d", days: 90 },
];

const DEMO_STAGES: Stage[] = [
  { key: "visits", labelKey: "stageVisits", value: 1180, color: "bg-lime-500", icon: Eye },
  { key: "signups", labelKey: "stageSignups", value: 790, color: "bg-sky-500", icon: UserPlus },
  { key: "active", labelKey: "stageActive", value: 460, color: "bg-violet-500", icon: Zap },
  { key: "pro", labelKey: "stagePro", value: 250, color: "bg-pink-500", icon: Crown },
  { key: "team", labelKey: "stageTeam", value: 120, color: "bg-amber-500", icon: Users },
  {
    key: "enterprise",
    labelKey: "stageEnterprise",
    value: 40,
    color: "bg-emerald-500",
    icon: Building2,
  },
];

interface StageConversion {
  /** Stage ÷ top-of-funnel rate, percent. Null when the denominator is 0. */
  rate: number | null;
  /** Change vs the previous window, percentage points. Null when unknown. */
  deltaPp: number | null;
}

interface PipelinePayload {
  visits: number;
  signups: number;
  active: number;
  pro: number;
  team: number;
  enterprise: number;
  conversions?: Partial<
    Record<
      | "visitToSignup"
      | "signupToActive"
      | "activeToPro"
      | "proToTeam"
      | "teamToEnterprise"
      | "visits",
      StageConversion
    >
  >;
}

const FALLBACK: PipelinePayload = {
  visits: 1180,
  signups: 790,
  active: 460,
  pro: 250,
  team: 120,
  enterprise: 40,
};

function toStages(p: PipelinePayload): Stage[] {
  return [
    { key: "visits", labelKey: "stageVisits", value: p.visits, color: "bg-lime-500", icon: Eye },
    {
      key: "signups",
      labelKey: "stageSignups",
      value: p.signups,
      color: "bg-sky-500",
      icon: UserPlus,
    },
    { key: "active", labelKey: "stageActive", value: p.active, color: "bg-violet-500", icon: Zap },
    { key: "pro", labelKey: "stagePro", value: p.pro, color: "bg-pink-500", icon: Crown },
    { key: "team", labelKey: "stageTeam", value: p.team, color: "bg-amber-500", icon: Users },
    {
      key: "enterprise",
      labelKey: "stageEnterprise",
      value: p.enterprise,
      color: "bg-emerald-500",
      icon: Building2,
    },
  ];
}

export function StageBarsCard() {
  const t = useTranslations("dashboard");
  const [range, setRange] = useState<Range>("30d");
  const [hovered, setHovered] = useState<string | null>(null);
  const [pipeline, setPipeline] = useState<PipelinePayload | null>(null);

  // Real pipeline numbers for the selected window; demo fallback keeps the
  // card presentable on the marketing preview or before first paint.
  useMemo(() => {
    let cancelled = false;
    fetch(`/api/dashboard/pipeline?range=${range}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: PipelinePayload | null) => {
        if (!cancelled) setPipeline(d && typeof d.visits === "number" ? d : FALLBACK);
      })
      .catch(() => {
        if (!cancelled) setPipeline(FALLBACK);
      });
    return () => {
      cancelled = true;
    };
  }, [range]);

  const stages = useMemo(() => toStages(pipeline ?? FALLBACK), [pipeline]);
  const top = stages[0]?.value || 1;
  const headline = stages.find((s) => s.key === hovered) ?? stages[0];
  const headlineShare = Math.round((headline.value / top) * 100);
  const total = stages.reduce((s, st) => s + st.value, 0);

  // Per-stage conversion (rate relative to the funnel's top) + WoW-style
  // delta vs the previous window, straight from the pipeline endpoint.
  // The API keys conversions by TRANSITION (visitToSignup); stage rows map
  // to the transition INTO that stage.
  const CONV_BY_STAGE = {
    visits: "visits",
    signups: "visitToSignup",
    active: "signupToActive",
    pro: "activeToPro",
    team: "proToTeam",
    enterprise: "teamToEnterprise",
  } as const;
  const convByKey = pipeline?.conversions ?? {};
  const convFor = (key: string): StageConversion | null => {
    const convKey = CONV_BY_STAGE[key as keyof typeof CONV_BY_STAGE];
    if (!convKey) return null;
    const c = convByKey[convKey as keyof NonNullable<PipelinePayload["conversions"]>];
    return c && typeof c === "object" ? c : null;
  };

  return (
    <Card className="overflow-hidden border-border/70 shadow-sm" data-testid="stage-bars-card">
      <CardHeader className="flex flex-col sm:flex-row sm:items-start justify-between pb-3 gap-3">
        <div>
          <CardTitle className="text-base">{t("pipelineTitle")}</CardTitle>
          <p
            className="text-2xl sm:text-3xl font-bold tabular-nums tracking-tight mt-1"
            data-testid="stage-headline-value"
          >
            {headline.value.toLocaleString()}
            <span
              className={cn(
                "ml-2 align-middle inline-block rounded-full px-2 py-0.5 text-xs font-semibold",
                headlineShare === 100
                  ? "bg-primary/10 text-primary"
                  : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
              )}
              data-testid="stage-headline-share"
            >
              +{headlineShare}%
            </span>
          </p>
          <CardDescription className="mt-1">
            {t(`stage${headline.labelKey.replace("stage", "")}`)}
          </CardDescription>
        </div>

        {/* Period dropdown — boardui's "Last 7 days" pill */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5 rounded-full text-xs">
              <CalendarDays className="h-3.5 w-3.5" />
              {t(`pipelineRange${range.toUpperCase()}`)}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {RANGES.map(({ key }) => (
              <DropdownMenuItem
                key={key}
                onClick={() => setRange(key)}
                className={cn(range === key && "bg-primary/10 text-primary font-medium")}
              >
                {t(`pipelineRange${key.toUpperCase()}`)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>

      <CardContent className="space-y-2.5">
        {/* One rounded pill per stage over a full-width track */}
        {stages.map((stage, i) => {
          const width = Math.max((stage.value / top) * 100, 2);
          const share = Math.round((stage.value / top) * 100);
          const dim = hovered !== null && hovered !== stage.key;
          const Icon = stage.icon;
          return (
            <div
              key={stage.key}
              className="flex items-center gap-3 group"
              onMouseEnter={() => setHovered(stage.key)}
              onMouseLeave={() => setHovered(null)}
              data-testid={`stage-row-${stage.key}`}
            >
              <span className="w-20 sm:w-24 shrink-0 text-xs font-medium text-muted-foreground truncate text-right">
                {t(stage.labelKey)}
              </span>
              <div className="relative flex-1 h-7 rounded-full bg-muted/50 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${width}%` }}
                  transition={{ duration: 0.7, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}
                  className={cn(
                    "absolute inset-y-0 left-0 rounded-full transition-opacity duration-200",
                    stage.color,
                    dim && "opacity-40",
                  )}
                />
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 flex items-center justify-center w-4 h-4 rounded-full bg-background/85 shadow-sm">
                  <Icon className="h-2.5 w-2.5 text-foreground/70" />
                </span>
              </div>
              <span className="w-14 sm:w-16 shrink-0 text-sm font-semibold tabular-nums text-right">
                {stage.value.toLocaleString()}
              </span>
              <span className="w-10 shrink-0 text-xs text-muted-foreground tabular-nums text-right">
                {share}%
              </span>
              {/* Conversion + WoW delta (percentage points vs prior window) */}
              {(() => {
                const conv = convFor(stage.key);
                return (
                  <Tooltip side="top" content={t("stageConvTitle")}>
                    <span
                      tabIndex={0}
                      className="w-20 sm:w-24 shrink-0 text-right text-xs tabular-nums outline-none focus-visible:ring-1 focus-visible:ring-primary/60"
                      data-testid={`stage-conv-${stage.key}`}
                    >
                      {conv?.rate != null ? (
                        <span className="font-semibold text-foreground">
                          {conv.rate.toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                      {conv?.deltaPp != null && conv.deltaPp !== 0 ? (
                        <span
                          className={cn(
                            "ml-1.5 inline-flex items-center",
                            conv.deltaPp > 0 ? "text-emerald-600" : "text-red-600",
                          )}
                        >
                          {conv.deltaPp > 0 ? "▲" : "▼"}
                          {Math.abs(conv.deltaPp)}
                        </span>
                      ) : null}
                    </span>
                  </Tooltip>
                );
              })()}
            </div>
          );
        })}

        {/* Stage legend grid — value per stage, like the reference footer */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-3">
          {stages.map((stage) => {
            const dim = hovered !== null && hovered !== stage.key;
            return (
              <div
                key={stage.key}
                className={cn(
                  "p-3 rounded-xl bg-muted/30 border border-border/60 transition-opacity duration-200",
                  dim && "opacity-50",
                )}
              >
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <span className={cn("w-2 h-2 rounded-full", stage.color)} />
                  {t(stage.labelKey)}
                </div>
                <p className="text-lg font-bold tabular-nums mt-0.5">
                  {stage.value.toLocaleString()}
                </p>
              </div>
            );
          })}
        </div>

        <p className="text-[11px] text-muted-foreground pt-1">
          {t("pipelineTotal", {
            total: total.toLocaleString(),
            range: t(`pipelineRange${range.toUpperCase()}`),
          })}
          {" · "}
          {t("stageConvOfPrev", { range: t(`pipelineRange${range.toUpperCase()}`) })}
        </p>
      </CardContent>
    </Card>
  );
}
