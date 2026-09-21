"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  Activity,
  Archive,
  CheckCircle2,
  DatabaseZap,
  Loader2,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Timer,
  Webhook,
  XCircle,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useConfirm } from "@/components/ui/confirm-provider";
import { cn } from "@/lib/utils";

/**
 * Admin → System Health.
 *
 * One console for the operational surfaces that used to be scattered across
 * Settings and the Integrations DLQ tab: the in-app scheduler's job ledger,
 * the inbound webhook dead-letter queue, the Supabase mirror (last sync,
 * retained rollback snapshots, drift check) and snapshot restore verification.
 *
 * Every panel reads the same endpoints the dedicated surfaces use
 * (/api/scheduler/status, /api/scheduler/backups, /api/webhooks/inbound/dlq,
 * /api/scheduler/mirror-sync), so the page can never disagree with them — and
 * the destructive actions (restore, discard) stay behind a confirmation.
 */

interface JobRunInfo {
  at: string;
  ok: boolean;
  result?: unknown;
  error?: string;
}

interface SchedulerStatus {
  enabled: boolean;
  tickMs: number;
  jobs: Record<string, JobRunInfo | null>;
}

interface Snapshot {
  file: string;
  sizeMb: number;
  createdAt: string;
}

interface DlqEntry {
  id: string;
  platform: string;
  event: string;
  status: "FAILED" | "RETRYING" | "RESOLVED";
  retryCount: number;
  maxRetries: number;
  errorMessage?: string;
  createdAt: string;
  lastAttemptAt?: string;
  nextRetryAt?: string;
}

interface DlqPayload {
  summary: {
    totalFailed: number;
    totalRetrying: number;
    totalResolved: number;
    totalExhausted: number;
    totalCount: number;
  };
  entries: DlqEntry[];
}

const JOB_LABEL_KEYS: Record<string, string> = {
  "usage-digest": "jobUsageDigest",
  "auto-payout": "jobAutoPayout",
  "webhook-retry": "jobWebhookRetry",
  "auto-reorder": "jobAutoReorder",
  "supabase-sync": "jobSupabaseSync",
  "trial-sweep": "jobTrialSweep",
  "scheduled-reports": "jobScheduledReports",
  "backup-verify": "jobBackupVerify",
  "recovery-drift": "jobRecoveryDrift",
};

/** Locale-aware "3 minutes ago" formatting (no extra translation keys needed). */
function relativeTime(iso: string, locale: string): string {
  const diffMs = new Date(iso).getTime() - Date.now();
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const abs = Math.abs(diffMs);
  if (abs < 60_000) return rtf.format(Math.round(diffMs / 1000), "second");
  if (abs < 3_600_000) return rtf.format(Math.round(diffMs / 60_000), "minute");
  if (abs < 86_400_000) return rtf.format(Math.round(diffMs / 3_600_000), "hour");
  return rtf.format(Math.round(diffMs / 86_400_000), "day");
}

export default function SystemHealthPage() {
  const t = useTranslations("systemHealth");
  const params = useParams();
  const locale = (params?.locale as string) || "en";
  const confirm = useConfirm();

  const [status, setStatus] = useState<SchedulerStatus | null>(null);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [dlq, setDlq] = useState<DlqPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [mirror, setMirror] = useState<{ ok: boolean; output: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [statusRes, backupsRes, dlqRes] = await Promise.all([
        fetch("/api/scheduler/status", { cache: "no-store" }),
        fetch("/api/scheduler/backups", { cache: "no-store" }),
        fetch("/api/webhooks/inbound/dlq", { cache: "no-store" }),
      ]);
      if (statusRes.ok) setStatus(await statusRes.json());
      if (backupsRes.ok) setSnapshots((await backupsRes.json()).snapshots ?? []);
      if (dlqRes.ok) setDlq(await dlqRes.json());
    } catch {
      // Transient network error — keep the last snapshot on screen.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // ── Actions ──────────────────────────────────────────────────────────────

  const handleVerify = async () => {
    setBusy("verify");
    try {
      const res = await fetch("/api/scheduler/backups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify" }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? t("actionFailed"));
      if (data?.verified) {
        toast.success(t("backupVerifiedToast", { file: data.file, tables: data.tables }));
      } else {
        toast.error(
          data?.reason === "no_snapshots"
            ? t("backupNoSnapshots")
            : t("backupFailedToast", { detail: data?.detail ?? "" }),
        );
      }
      await load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t("actionFailed"));
    } finally {
      setBusy(null);
    }
  };

  const handleRestore = async (snapshot: Snapshot) => {
    const ok = await confirm({
      title: t("restoreConfirmTitle"),
      description: t("restoreConfirmDesc", { file: snapshot.file }),
      confirmLabel: t("restoreConfirmAction"),
      destructive: true,
    });
    if (!ok) return;
    setBusy(`restore:${snapshot.file}`);
    try {
      const res = await fetch("/api/scheduler/backups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file: snapshot.file }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? t("actionFailed"));
      }
      toast.success(t("restoreDoneToast", { file: snapshot.file }));
      await load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t("actionFailed"));
    } finally {
      setBusy(null);
    }
  };

  const handleMirrorCheck = async () => {
    setBusy("mirror");
    try {
      const res = await fetch("/api/scheduler/mirror-sync", { method: "POST" });
      const data = await res.json().catch(() => null);
      setMirror({ ok: Boolean(data?.ok), output: data?.output ?? "" });
      if (data?.ok) toast.success(t("mirrorHealthyToast"));
      else toast.warning(t("mirrorDriftToast"));
      await load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t("actionFailed"));
    } finally {
      setBusy(null);
    }
  };

  const handleDlq = async (entry: DlqEntry, action: "replay" | "discard") => {
    if (action === "discard") {
      const ok = await confirm({
        title: t("dlqDiscardConfirmTitle"),
        description: t("dlqDiscardConfirmDesc", { platform: entry.platform }),
        confirmLabel: t("dlqDiscard"),
        destructive: true,
      });
      if (!ok) return;
    }
    setBusy(`${action}:${entry.id}`);
    try {
      const res = await fetch("/api/webhooks/inbound/dlq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, id: entry.id }),
      });
      const data = await res.json().catch(() => null);
      if (action === "replay") {
        if (data?.ok) toast.success(t("dlqReplayedToast"));
        else toast.error(t("dlqReplayFailedToast"));
      } else {
        if (data?.ok) toast.success(t("dlqDiscardedToast"));
        else toast.error(t("actionFailed"));
      }
      await load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t("actionFailed"));
    } finally {
      setBusy(null);
    }
  };

  // ── Derived state ────────────────────────────────────────────────────────

  const jobEntries = status ? Object.entries(status.jobs) : [];
  const failingJobs = jobEntries.filter(([, run]) => run && !run.ok).length;
  const failedDlq = dlq?.summary.totalFailed ?? 0;
  const backupRun = status?.jobs["backup-verify"] ?? null;
  const mirrorRun = status?.jobs["supabase-sync"] ?? null;
  const degraded = failingJobs > 0 || failedDlq > 0 || (mirrorRun ? !mirrorRun.ok : false);

  return (
    <div className="space-y-4 sm:space-y-6" data-testid="system-health-page">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary shrink-0" />
            {t("title")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">{t("subtitle")}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant={degraded ? "danger" : "success"} data-testid="system-health-verdict">
            {degraded ? t("verdictDegraded") : t("verdictHealthy")}
          </Badge>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={cn("h-4 w-4 mr-1.5", loading && "animate-spin")} />
            {t("refresh")}
          </Button>
        </div>
      </div>

      {/* Scheduler jobs */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <Timer className="h-5 w-5 text-primary shrink-0" />
              <CardTitle className="text-base min-w-0">{t("schedulerTitle")}</CardTitle>
            </div>
            <Badge
              variant={status?.enabled ? "success" : "outline"}
              data-scheduler-enabled={status?.enabled ? "true" : "false"}
            >
              {status?.enabled ? t("schedulerEnabled") : t("schedulerDisabled")}
            </Badge>
          </div>
          <CardDescription>{t("schedulerDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
            {jobEntries.map(([job, run]) => (
              <div
                key={job}
                data-scheduler-job={job}
                className={cn(
                  "rounded-lg border px-3 py-2 min-w-0",
                  run && !run.ok ? "border-destructive/40 bg-destructive/5" : "border-border",
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={cn(
                      "h-2 w-2 rounded-full shrink-0",
                      !run ? "bg-muted-foreground/40" : run.ok ? "bg-emerald-500" : "bg-red-500",
                    )}
                  />
                  <span className="text-sm font-medium truncate">
                    {t(JOB_LABEL_KEYS[job] ?? "jobUsageDigest")}
                  </span>
                  <span className="ml-auto text-[11px] text-muted-foreground shrink-0">
                    {run ? relativeTime(run.at, locale) : t("jobNever")}
                  </span>
                </div>
                {run?.error && (
                  <p className="mt-1.5 text-[11px] text-destructive/90 line-clamp-2 break-words">
                    {run.error}
                  </p>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Webhook DLQ */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Webhook className="h-5 w-5 text-primary shrink-0" />
            <CardTitle className="text-base">{t("dlqTitle")}</CardTitle>
          </div>
          <CardDescription>{t("dlqDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2 text-[11px]">
            {[
              { label: t("dlqFailed"), value: dlq?.summary.totalFailed ?? 0, tone: "destructive" },
              { label: t("dlqRetrying"), value: dlq?.summary.totalRetrying ?? 0, tone: "warning" },
              { label: t("dlqExhausted"), value: dlq?.summary.totalExhausted ?? 0, tone: "muted" },
              { label: t("dlqResolved"), value: dlq?.summary.totalResolved ?? 0, tone: "success" },
            ].map((chip) => (
              <span
                key={chip.label}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-medium",
                  chip.tone === "destructive" && "border-destructive/40 text-destructive",
                  chip.tone === "warning" &&
                    "border-amber-500/40 text-amber-600 dark:text-amber-500",
                  chip.tone === "success" &&
                    "border-emerald-500/40 text-emerald-600 dark:text-emerald-500",
                  chip.tone === "muted" && "border-border text-muted-foreground",
                )}
              >
                {chip.label}
                <span className="tabular-nums font-bold">{chip.value}</span>
              </span>
            ))}
          </div>

          {dlq && dlq.entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("dlqEmpty")}</p>
          ) : (
            <div
              className="divide-y divide-border rounded-lg border"
              data-testid="system-health-dlq"
            >
              {(dlq?.entries ?? []).slice(0, 8).map((entry) => (
                <div
                  key={entry.id}
                  className="flex flex-wrap items-start gap-3 px-3 py-2.5 min-w-0"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium capitalize">{entry.platform}</span>
                      <Badge
                        variant={
                          entry.status === "FAILED"
                            ? "danger"
                            : entry.status === "RESOLVED"
                              ? "success"
                              : "outline"
                        }
                      >
                        {entry.status}
                      </Badge>
                      <span className="text-[11px] text-muted-foreground">
                        {t("dlqAttempts", {
                          count: entry.retryCount,
                          max: entry.maxRetries,
                        })}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {relativeTime(entry.createdAt, locale)}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground line-clamp-2 break-words">
                      {entry.errorMessage ?? entry.event}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 gap-1 text-xs"
                      disabled={busy === `replay:${entry.id}`}
                      onClick={() => void handleDlq(entry, "replay")}
                    >
                      {busy === `replay:${entry.id}` ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <RotateCcw className="h-3 w-3" />
                      )}
                      {t("dlqReplay")}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1 text-xs text-muted-foreground hover:text-destructive"
                      disabled={busy === `discard:${entry.id}`}
                      onClick={() => void handleDlq(entry, "discard")}
                    >
                      <XCircle className="h-3 w-3" />
                      {t("dlqDiscard")}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Mirror sync + rollback snapshots */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <DatabaseZap className="h-5 w-5 text-primary shrink-0" />
              <CardTitle className="text-base">{t("mirrorTitle")}</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1.5 text-xs"
                onClick={() => void handleMirrorCheck()}
                disabled={busy === "mirror"}
              >
                {busy === "mirror" ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <RefreshCw className="h-3 w-3" />
                )}
                {t("mirrorCheck")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1.5 text-xs"
                onClick={() => void handleVerify()}
                disabled={busy === "verify"}
                data-testid="backup-verify-btn"
              >
                {busy === "verify" ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <ShieldCheck className="h-3 w-3" />
                )}
                {t("backupVerify")}
              </Button>
            </div>
          </div>
          <CardDescription>{t("mirrorDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-muted-foreground">{t("lastSync")}</span>
            {mirrorRun ? (
              <>
                {mirrorRun.ok ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                ) : (
                  <XCircle className="h-3.5 w-3.5 text-red-500" />
                )}
                <span className="font-medium">{relativeTime(mirrorRun.at, locale)}</span>
              </>
            ) : (
              <span className="text-muted-foreground">{t("jobNever")}</span>
            )}
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">{t("lastBackupCheck")}</span>
            {backupRun ? (
              <>
                {backupRun.ok ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                ) : (
                  <XCircle className="h-3.5 w-3.5 text-red-500" />
                )}
                <span className="font-medium">{relativeTime(backupRun.at, locale)}</span>
              </>
            ) : (
              <span className="text-muted-foreground">{t("jobNever")}</span>
            )}
          </div>

          {mirrorRun?.error && (
            <p className="text-[11px] text-destructive/90 whitespace-pre-wrap break-words">
              {mirrorRun.error}
            </p>
          )}

          {mirror && (
            <pre className="max-h-48 overflow-auto rounded-lg border border-border bg-muted/40 p-3 text-[11px] leading-relaxed whitespace-pre-wrap break-words">
              {mirror.output || (mirror.ok ? t("mirrorClean") : t("actionFailed"))}
            </pre>
          )}

          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-1.5">
              <Archive className="h-3.5 w-3.5" />
              {t("snapshotsTitle")}
              <span className="tabular-nums">({snapshots.length})</span>
            </div>
            {snapshots.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t("snapshotsEmpty")}</p>
            ) : (
              <div
                className="divide-y divide-border rounded-lg border max-h-56 overflow-y-auto scrollbar-auto-hide"
                data-testid="system-health-snapshots"
              >
                {snapshots.map((snap) => (
                  <div
                    key={snap.file}
                    className="flex items-center justify-between gap-3 px-3 py-2 min-w-0"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-mono truncate" title={snap.file}>
                        {snap.file}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {snap.sizeMb} MB · {relativeTime(snap.createdAt, locale)}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 gap-1 text-xs shrink-0"
                      disabled={busy === `restore:${snap.file}`}
                      onClick={() => void handleRestore(snap)}
                    >
                      {busy === `restore:${snap.file}` ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <RotateCcw className="h-3 w-3" />
                      )}
                      {t("backupRestore")}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
