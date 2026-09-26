/**
 * Admin panel — live mail-delivery health.
 *
 * The user-visible twin of the Phase-2 mail work: the resolved transport and
 * from-address (with sandbox-sender sanity), the durable outbox queue depths,
 * the most recent FAILED rows with their provider/SMTP error reasons, and a
 * one-click resend of the last failure so a fixed configuration can be
 * verified end-to-end without waiting for the scheduler.
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  MailIcon,
  RefreshCwIcon,
  SendIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
  Loader2Icon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface MailConfig {
  transport: string;
  from: string | null;
  warnings: string[];
  sandboxSender: boolean;
}

interface OutboxHealth {
  pending: number;
  sending: number;
  sent: number;
  failed: number;
  stuck: number;
  oldestPendingAt: string | null;
}

interface FailedRow {
  id: string;
  to: string;
  template: string;
  attempts: number;
  maxAttempts: number;
  lastError: string | null;
  transport: string | null;
  at: string;
}

interface MailHealth {
  config: MailConfig;
  outbox: OutboxHealth;
  recentFailed: FailedRow[];
  checkedAt: string;
}

export function MailHealthCard() {
  const t = useTranslations("admin");
  const tcommon = useTranslations("common");
  const [health, setHealth] = useState<MailHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [resendResult, setResendResult] = useState<string | null>(null);

  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/mail-health");
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || t("mailHealthLoadFailedStatus", { status: res.status }));
      }
      setHealth((await res.json()) as MailHealth);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("mailHealthLoadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchHealth(); // eslint-disable-line react-hooks/set-state-in-effect -- async; setstates land after the await
    // Two minutes: an outbox row flushed right after a "send test digest"
    // click (delivery follows the enqueue within seconds) must appear here
    // without a manual refresh, while the cadence stays light on the DB.
    const timer = setInterval(fetchHealth, 120_000);
    return () => clearInterval(timer);
  }, [fetchHealth]);

  const resendLatest = async () => {
    setResending(true);
    setResendResult(null);
    try {
      const res = await fetch("/api/admin/mail-health", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || tcommon("error"));
        return;
      }
      if (data.status === "sent") {
        toast.success(t("mailHealthResendSent", { to: data.to }));
        setResendResult(t("mailHealthResendSent", { to: data.to }));
      } else if (data.status === "failed") {
        toast.error(t("mailHealthResendFailed", { to: data.to }));
        setResendResult(t("mailHealthResendFailed", { to: data.to }));
      } else {
        toast.info(t("mailHealthResendNone"));
        setResendResult(t("mailHealthResendNone"));
      }
      await fetchHealth();
    } catch {
      toast.error(tcommon("error"));
    } finally {
      setResending(false);
    }
  };

  const configOk =
    health &&
    health.config.transport !== "none" &&
    !health.config.sandboxSender &&
    health.config.warnings.length === 0;

  return (
    <Card>
      <CardHeader className="pb-4 border-b border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <MailIcon size={18} className="text-zinc-500" />
              {t("mailHealthTitle")}
            </CardTitle>
            <CardDescription>{t("mailHealthDesc")}</CardDescription>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-zinc-500 sm:inline">
              {t("mailHealthAutoRefreshing")}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchHealth}
              aria-label={t("auditHealthRefresh")}
              className="gap-2"
            >
              <RefreshCwIcon size={14} className={cn(loading && "animate-spin")} />
              {t("auditHealthRefresh")}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        {/* Resolved transport + from-address sanity */}
        <div
          className="flex flex-wrap items-center gap-3 rounded-xl border p-3"
          data-testid="mail-transport-line"
          data-state={health ? (configOk ? "ok" : "bad") : "ok"}
        >
          {configOk ? (
            <CheckCircleIcon size={16} className="text-emerald-600 dark:text-emerald-400" />
          ) : (
            <AlertTriangleIcon size={16} className="text-amber-600 dark:text-amber-400" />
          )}
          <span className="text-sm font-medium">{t("mailHealthTransport")}</span>
          <Badge variant="outline" className="font-mono text-xs">
            {health ? health.config.transport : "—"}
          </Badge>
          <span className="text-sm text-zinc-500">
            {t("mailHealthFrom")}:{" "}
            <span className="font-mono text-xs">{health?.config.from ?? "—"}</span>
          </span>
          {health?.config.sandboxSender && (
            <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
              {t("mailHealthSandboxSender")}
            </Badge>
          )}
        </div>
        {health?.config.warnings.map((w) => (
          <p
            key={w}
            className="text-xs text-amber-700 dark:text-amber-400 flex items-start gap-1.5"
          >
            <AlertTriangleIcon size={12} className="mt-0.5 shrink-0" />
            {w}
          </p>
        ))}

        {/* Outbox queue depths */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2" data-testid="mail-outbox-depths">
          {(
            [
              ["pending", health?.outbox.pending],
              ["sending", health?.outbox.sending],
              ["sent", health?.outbox.sent],
              ["failed", health?.outbox.failed],
              ["stuck", health?.outbox.stuck],
            ] as const
          ).map(([key, value]) => (
            <div key={key} className="rounded-lg border p-2 text-center">
              <div className="text-lg font-bold tabular-nums">{value ?? "—"}</div>
              <div className="text-xs text-zinc-500">{t(`mailHealthQueue_${key}`)}</div>
            </div>
          ))}
        </div>

        {/* Recent failures with reasons */}
        <div className="space-y-2" data-testid="mail-recent-failures">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{t("mailHealthRecentFailures")}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={resendLatest}
              disabled={resending || !health || health.recentFailed.length === 0}
              className="gap-1.5 h-8 text-xs"
            >
              {resending ? (
                <Loader2Icon size={12} className="animate-spin" />
              ) : (
                <SendIcon size={12} />
              )}
              {t("mailHealthResend")}
            </Button>
          </div>
          {resendResult && <p className="text-xs text-zinc-500">{resendResult}</p>}
          {!health || health.recentFailed.length === 0 ? (
            <p className="text-sm text-zinc-500">{t("mailHealthNoFailures")}</p>
          ) : (
            health.recentFailed.map((r) => (
              <div
                key={r.id}
                className="rounded-lg border border-red-200 dark:border-red-900/40 bg-red-50/50 dark:bg-red-950/20 p-3"
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-sm font-medium font-mono">{r.to}</span>
                  <Badge variant="outline" className="text-xs">
                    {r.template}
                  </Badge>
                </div>
                <p className="text-xs text-red-700 dark:text-red-400 mt-1 font-mono break-all">
                  {r.lastError || "—"}
                </p>
                <p className="text-xs text-zinc-500 mt-1">
                  {t("mailHealthAttempts", { attempts: r.attempts, max: r.maxAttempts })} ·{" "}
                  {r.transport ?? "—"}
                </p>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
