"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertTriangle,
  ArrowUpRight,
  Gauge,
  Info,
  KeyRound,
  ShoppingCart,
  TrendingUp,
  Users,
} from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { cn } from "@/lib/utils";
import { GlassChartTooltip } from "@/components/charts/glass-tooltip";

/**
 * Usage & quota metering for the Billing overview.
 *
 * Reads GET /api/usage (orders / team seats / API keys vs the ACTIVE plan's
 * limits) and renders progress bars with a Starter→Professional upgrade CTA
 * when the workspace is consuming a capped resource. Numbers mirror the 402
 * plan-limit gates enforced server-side on order and invite creation. The
 * GET also persists monthly snapshots into the UsageRecord table and returns
 * the per-cycle history rendered as the trend chart below the quota rows.
 */

interface UsageHistoryPoint {
  cycle: string;
  periodStart: string;
  orders: number;
  teamMembers: number;
  apiKeys: number;
}

interface UsagePayload {
  period: { start: string; end: string };
  plan: {
    name: string;
    tier: string;
    trial?: { daysLeft: number; endsAt: string } | null;
  };
  orders: { used: number; limit: number | null };
  teamMembers: { used: number; limit: number | null };
  apiKeys: { used: number; limit: number | null };
  history?: UsageHistoryPoint[];
}

interface QuotaRow {
  key: "orders" | "teamMembers" | "apiKeys";
  label: string;
  used: number;
  limit: number | null;
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
}

function pct(used: number, limit: number | null): number {
  if (limit === null) return 0;
  if (limit <= 0) return 100;
  return Math.min(100, Math.round((used / limit) * 100));
}

function toneFor(used: number, limit: number | null): { bar: string; warn: boolean } {
  const p = pct(used, limit);
  if (limit !== null && p >= 100) return { bar: "bg-destructive", warn: true };
  if (limit !== null && p >= 80) return { bar: "bg-amber-500", warn: true };
  return { bar: "bg-primary", warn: false };
}

/** "2026-09" → "Sep" (locale-stable, compact for the chart axis). */
const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function cycleLabel(cycle: string): string {
  const month = Number(cycle.slice(5, 7));
  return MONTH_LABELS[(month - 1) % 12] ?? cycle;
}

/** Minimal shape validation — a malformed/unrelated payload keeps the card hidden. */
function isValidUsagePayload(data: unknown): data is UsagePayload {
  if (typeof data !== "object" || data === null) return false;
  const d = data as UsagePayload;
  const hasQuota = (q: unknown) =>
    typeof q === "object" && q !== null && "used" in q && "limit" in q;
  return (
    hasQuota(d.orders) &&
    hasQuota(d.teamMembers) &&
    hasQuota(d.apiKeys) &&
    typeof d.plan === "object" &&
    d.plan !== null &&
    typeof d.period === "object" &&
    d.period !== null &&
    typeof d.period.start === "string"
  );
}

export function UsageQuotaCard({
  onStartUpgrade,
  viewerRole,
}: {
  onStartUpgrade?: () => void;
  /** When the viewer is a CLIENT/CLIENT_ENTERPRISE member, the card renders a
   * read-only workspace-consumption view with a handoff to the owner instead
   * of the owner-facing upgrade CTA. */
  viewerRole?: string | null;
}) {
  const t = useTranslations("usageQuota");
  const isClientViewer = viewerRole === "CLIENT" || viewerRole === "CLIENT_ENTERPRISE";
  const [usage, setUsage] = useState<UsagePayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/usage")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data: UsagePayload) => {
        if (!cancelled && isValidUsagePayload(data)) setUsage(data);
      })
      .catch(() => {
        // Non-critical metering — the card simply stays hidden on failure.
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Trend chart data: persisted monthly snapshots (including the live cycle,
  // which /api/usage upserts before responding). Falls back to the current
  // cycle alone when no history has accumulated yet.
  // Rules of Hooks: this sits above the early returns below and is
  // null-safe on the loading/hidden states.
  const trendData = useMemo(
    () =>
      (usage?.history ?? []).map((h) => ({
        cycle: h.cycle,
        label: cycleLabel(h.cycle),
        Orders: h.orders,
        "Team seats": h.teamMembers,
        "API keys": h.apiKeys,
      })),
    [usage?.history],
  );

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!usage) return null;

  const rows: QuotaRow[] = [
    {
      key: "orders",
      label: t("orders"),
      used: usage.orders.used,
      limit: usage.orders.limit,
      icon: ShoppingCart,
      tone: "text-primary",
    },
    {
      key: "teamMembers",
      label: t("teamMembers"),
      used: usage.teamMembers.used,
      limit: usage.teamMembers.limit,
      icon: Users,
      tone: "text-primary",
    },
    {
      key: "apiKeys",
      label: t("apiKeys"),
      used: usage.apiKeys.used,
      limit: usage.apiKeys.limit,
      icon: KeyRound,
      tone: "text-primary",
    },
  ];

  const anyCapped = rows.some((r) => r.limit !== null);
  const anyWarn = rows.some((r) => toneFor(r.used, r.limit).warn);
  // CLIENT viewers never see the owner-facing upgrade CTA — they get the
  // read-only banner pointing at the workspace owner instead.
  const showUpgrade = anyCapped && usage.plan.tier === "REGULAR" && !isClientViewer;

  const currentPoint = {
    cycle: usage.period.start.slice(0, 7),
    label: cycleLabel(usage.period.start.slice(0, 7)),
    Orders: usage.orders.used,
    "Team seats": usage.teamMembers.used,
    "API keys": usage.apiKeys.used,
  };
  const chartData = trendData.some((d) => d.cycle === currentPoint.cycle)
    ? trendData.map((d) => (d.cycle === currentPoint.cycle ? currentPoint : d))
    : [...trendData, currentPoint];

  return (
    <Card
      data-testid="usage-quota-card"
      data-usage-view={isClientViewer ? "client-read-only" : "owner"}
      className={cn(anyWarn && "border-amber-300 dark:border-amber-800")}
    >
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-3 text-base font-semibold">
          <span className="flex items-center gap-2">
            <Gauge className="h-4 w-4 text-primary" />
            {t(isClientViewer ? "clientTitle" : "title")}
          </span>
          <span className="flex items-center gap-2 text-xs font-normal text-muted-foreground">
            {/* 14-day PRO trial chip — tells new signups why every gate is open. */}
            {usage.plan.trial && (
              <span
                className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary"
                data-testid="usage-trial-chip"
              >
                {t("trialChip", { days: usage.plan.trial.daysLeft })}
              </span>
            )}
            {usage.plan.name} · {t("period")}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {rows.map(({ key, label, used, limit, icon: Icon, tone }) => {
          const { bar, warn } = toneFor(used, limit);
          const p = pct(used, limit);
          return (
            <div key={key} data-testid={`usage-${key}`}>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 font-medium">
                  <Icon className={cn("h-4 w-4", tone)} />
                  {label}
                </span>
                <span
                  className={cn(
                    "tabular-nums",
                    warn && "font-semibold text-amber-600 dark:text-amber-400",
                  )}
                >
                  {limit === null ? (
                    <>
                      {used.toLocaleString()} ·{" "}
                      <span className="text-muted-foreground">{t("unlimited")}</span>
                    </>
                  ) : (
                    `${used.toLocaleString()} / ${limit.toLocaleString()}`
                  )}
                  {limit !== null && warn && (
                    <AlertTriangle className="ml-1.5 inline h-3.5 w-3.5 text-amber-500" />
                  )}
                </span>
              </div>
              {limit !== null && (
                <div
                  className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-muted"
                  role="progressbar"
                  aria-valuenow={p}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={label}
                >
                  <div
                    className={cn("h-full rounded-full transition-all duration-500", bar)}
                    style={{ width: `${p}%` }}
                  />
                </div>
              )}
            </div>
          );
        })}

        {/* Per-cycle usage trend from persisted UsageRecord snapshots */}
        <div
          data-testid="usage-trend"
          className="rounded-lg border border-border/60 bg-muted/20 p-3"
        >
          <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground mb-2">
            <TrendingUp className="h-3.5 w-3.5 text-primary" />
            {t("trendTitle")}
          </p>
          <div className="h-32 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 4, right: 0, bottom: 0, left: -18 }}
                barCategoryGap="25%"
              >
                <XAxis dataKey="label" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  cursor={{ fill: "hsl(var(--muted) / 0.5)" }}
                  content={<GlassChartTooltip />}
                />
                <Bar dataKey="Orders" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Team seats" fill="#a855f7" radius={[3, 3, 0, 0]} />
                <Bar dataKey="API keys" fill="#f59e0b" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {isClientViewer && (
          <div
            data-testid="usage-client-banner"
            className="flex items-start gap-2 rounded-lg border border-border/60 bg-muted/30 p-3 text-sm text-muted-foreground"
          >
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p>{t("clientReadOnlyHint")}</p>
          </div>
        )}

        {showUpgrade && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
            <p className="text-sm text-muted-foreground">{t("upgradeHint")}</p>
            <Link
              href="/billing?tab=plans"
              data-testid="usage-upgrade-cta"
              className="text-sm font-semibold text-primary hover:underline shrink-0 inline-flex items-center gap-1.5"
              onClick={(e) => {
                if (onStartUpgrade) {
                  e.preventDefault();
                  onStartUpgrade();
                }
              }}
            >
              <ArrowUpRight className="h-4 w-4" />
              {t("upgradeCta")}
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
