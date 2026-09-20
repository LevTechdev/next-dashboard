"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Activity, Ban, Gauge, ShieldAlert, Timer } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { timeAgo, type SecurityData } from "@/components/security/use-security-data";
import { withinDays } from "@/components/security/use-security-data";

/**
 * Security telemetry — the account-pressure panel.
 *
 * Distills the raw event feed into the three signals an owner actually needs:
 *  - RATE_LIMITED pressure: how many login attempts were throttled, the most
 *    recent offender IP, and a LIVE gauge of the current sliding window
 *    (used / limit, blocked-or-clearing countdown) that ticks down each second.
 *  - ACCOUNT_LOCKED: brute-force lockouts with per-IP attribution.
 *  - Sessions: active count surfaced next to the Sessions card's revoke flow.
 *
 * All data already ships in useSecurityData(); this card only reshapes it, so
 * no extra network round-trip is needed and `data.refresh()` after a revoke
 * updates it in lockstep with the rest of the page.
 */
export function TelemetryCard({ data }: { data: SecurityData }) {
  const t = useTranslations("security");
  // Ticking clock (client-only, so SSR output stays stable): it drives both the
  // rolling 24h counts and the live throttle countdown below — no re-fetch
  // needed, since a window's end time is already known.
  const [now, setNow] = useState(() => Date.now());

  const stats = useMemo(() => {
    const within24h = (iso: string) => now - new Date(iso).getTime() < 24 * 60 * 60 * 1000;

    const rateLimited = data.events.filter((e) => e.type === "RATE_LIMITED");
    const rateLimited24h = rateLimited.filter((e) => within24h(e.createdAt));
    const blockedRecent = rateLimited.filter(
      (e) => withinDays(e.createdAt, 7) && e.metadata?.blocked === true,
    );
    const lockouts = data.events.filter(
      (e) => e.type === "ACCOUNT_LOCKED" && withinDays(e.createdAt, 7),
    );
    const lastOffender = rateLimited24h.find((e) => e.ip && e.ip !== "unknown")?.ip ?? null;

    return {
      rateLimitedTotal: rateLimited.length,
      rateLimited24h: rateLimited24h.length,
      blockedRecent: blockedRecent.length,
      lockouts,
      lastOffender,
      hasSignal: rateLimited24h.length > 0 || lockouts.length > 0,
    };
  }, [data.events, now]);

  /**
   * Live sliding-window pressure for the busiest IP.
   *
   * The limiter writes one RATE_LIMITED row per attempt carrying its own
   * `limit` / `windowSeconds`, so replaying the rows reconstructs the exact
   * window the server is enforcing: how full it is right now, whether the IP
   * is blocked, and when the oldest attempt slides out. The ticking clock
   * re-runs the replay each second so a window that slides empty disappears.
   */
  const pressure = useMemo(() => {
    const rateLimited = data.events.filter((e) => e.type === "RATE_LIMITED");
    if (!rateLimited.length) return null;

    const byIp = new Map<string, typeof rateLimited>();
    for (const e of rateLimited) {
      const ip = e.ip || "unknown";
      const list = byIp.get(ip);
      if (list) list.push(e);
      else byIp.set(ip, [e]);
    }

    const windows = [...byIp.entries()].flatMap(([ip, list]) => {
      // Events arrive newest-first; the newest row carries the config in force.
      const newest = list[0];
      const windowSeconds = Number(newest.metadata?.windowSeconds ?? 120);
      const limit = Number(newest.metadata?.limit ?? 10);
      const cutoff = now - windowSeconds * 1000;
      const inWindow = list.filter((e) => new Date(e.createdAt).getTime() >= cutoff);
      if (!inWindow.length) return [];
      const oldest = inWindow[inWindow.length - 1];
      return [
        {
          ip,
          used: inWindow.length,
          limit,
          windowSeconds,
          blocked: inWindow.some((e) => e.metadata?.blocked === true),
          endsAt: new Date(oldest.createdAt).getTime() + windowSeconds * 1000,
        },
      ];
    });
    if (!windows.length) return null;
    // Busiest window wins; a real IP outranks "unknown" on a tie.
    windows.sort(
      (a, b) => b.used - a.used || Number(a.ip === "unknown") - Number(b.ip === "unknown"),
    );
    const top = windows[0];
    return {
      ...top,
      remaining: Math.max(0, Math.ceil((top.endsAt - now) / 1000)),
      percent: Math.max(0, Math.min(100, Math.round((top.used / Math.max(top.limit, 1)) * 100))),
    };
  }, [data.events, now]);

  // Tick only while a window is open — an idle telemetry card costs nothing.
  const windowOpen = pressure !== null;
  useEffect(() => {
    if (!windowOpen) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [windowOpen]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Activity className="h-4 w-4" />
          {t("telemetryTitle")}
          {stats.hasSignal && (
            <span
              className="ml-auto inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
              data-testid="telemetry-pressure-badge"
            >
              <ShieldAlert className="h-3 w-3" />
              {t("telemetryPressureBadge")}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3" data-testid="security-telemetry">
        {/* Live throttle window — reconstructs the server's sliding window */}
        {pressure && (
          <div
            className="rounded-lg border border-gray-200 p-3 dark:border-gray-800"
            data-testid="telemetry-throttle-window"
          >
            <div className="flex items-center justify-between gap-2 text-xs font-medium text-gray-500 dark:text-gray-400">
              <span className="flex items-center gap-1.5">
                <Gauge className="h-3.5 w-3.5" />
                {t("telemetryThrottleTitle")}
              </span>
              <span className="tabular-nums" data-testid="telemetry-throttle-count">
                {t("telemetryThrottleCount", { used: pressure.used, limit: pressure.limit })}
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
              <div
                className={cn(
                  "h-full rounded-full transition-[width] duration-500",
                  pressure.blocked ? "bg-amber-500" : "bg-primary",
                )}
                style={{ width: `${pressure.percent}%` }}
              />
            </div>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-[11px]">
              <span
                className={cn(
                  pressure.blocked
                    ? "font-semibold text-amber-600 dark:text-amber-400"
                    : "text-gray-500 dark:text-gray-400",
                )}
                data-testid="telemetry-throttle-state"
              >
                {pressure.blocked
                  ? t("telemetryThrottleBlocked", { seconds: pressure.remaining })
                  : t("telemetryThrottleClearing", { seconds: pressure.remaining })}
              </span>
              <span className="text-gray-400">{t("telemetryThrottleIp", { ip: pressure.ip })}</span>
            </p>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-3">
          {/* Throttled attempts */}
          <div className="rounded-lg border border-gray-200 p-3 dark:border-gray-800">
            <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">
              <Timer className="h-3.5 w-3.5" />
              {t("telemetryRateLimited")}
            </div>
            <p
              className="mt-1 text-2xl font-bold tabular-nums"
              data-testid="telemetry-rate-limited"
            >
              {stats.rateLimited24h}
            </p>
            <p className="text-[11px] text-gray-400">{t("telemetryRateLimitedWindow")}</p>
            {stats.lastOffender && (
              <p className="mt-1 truncate text-[11px] text-gray-500">
                {t("telemetryLastOffender", { ip: stats.lastOffender })}
              </p>
            )}
          </div>

          {/* Lockouts */}
          <div className="rounded-lg border border-gray-200 p-3 dark:border-gray-800">
            <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">
              <Ban className="h-3.5 w-3.5" />
              {t("telemetryLockouts")}
            </div>
            <p className="mt-1 text-2xl font-bold tabular-nums" data-testid="telemetry-lockouts">
              {stats.lockouts.length}
            </p>
            <p className="text-[11px] text-gray-400">{t("telemetryLockoutsWindow")}</p>
            {stats.lockouts[0] && (
              <p className="mt-1 truncate text-[11px] text-gray-500">
                {t("telemetryLastEvent", { when: timeAgo(stats.lockouts[0].createdAt) })}
              </p>
            )}
          </div>

          {/* Active sessions (cross-reference to the Sessions card revoke flow) */}
          <div className="rounded-lg border border-gray-200 p-3 dark:border-gray-800">
            <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">
              <Activity className="h-3.5 w-3.5" />
              {t("telemetrySessions")}
            </div>
            <p className="mt-1 text-2xl font-bold tabular-nums" data-testid="telemetry-sessions">
              {data.sessions.length}
            </p>
            <p className="text-[11px] text-gray-400">{t("telemetrySessionsHint")}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
