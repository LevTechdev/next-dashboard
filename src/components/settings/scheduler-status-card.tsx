"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  TimerIcon,
  RefreshCwIcon,
  ArchiveIcon,
  RotateCcwIcon,
  Loader2Icon,
  ShieldCheckIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip } from "@/components/ui/tooltip";
import { useNow } from "@/hooks/use-now";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/sora-ui/base/alert-dialog";
import { cn } from "@/lib/utils";

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

const JOB_LABEL_KEYS: Record<string, string> = {
  "usage-digest": "jobDigest",
  "auto-payout": "jobAutoPayout",
  "webhook-retry": "jobWebhookRetry",
  "auto-reorder": "jobAutoReorder",
  "supabase-sync": "jobSupabaseSync",
  "supabase-leaf-sync": "jobSupabaseLeafSync",
  "backup-verify": "jobBackupVerify",
  "trial-sweep": "jobTrialSweep",
  "scheduled-reports": "jobScheduledReports",
  "recovery-drift": "jobRecoveryDrift",
};

/**
 * Settings → Scheduler health. Shows whether the in-app job loop is enabled
 * (SCHEDULER_ENABLED=1 / production) and when each job last ran, with the
 * outcome. Non-admins get a 403 from the API and the card renders nothing.
 */
export function SchedulerStatusCard() {
  const t = useTranslations("settings.scheduler");
  const tcommon = useTranslations("common");
  const [status, setStatus] = useState<SchedulerStatus | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [loading, setLoading] = useState(false);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [restoreTarget, setRestoreTarget] = useState<Snapshot | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [verifying, setVerifying] = useState(false);
  // Drives the "2 mins ago" labels below without reading the clock during
  // render (impure, and the server/client values disagree).
  const now = useNow();

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/scheduler/status");
      if (res.status === 403) {
        setForbidden(true);
        return;
      }
      if (res.ok) setStatus(await res.json());
      // Rollback snapshots (admin-only endpoint; 403 handled above).
      const bres = await fetch("/api/scheduler/backups");
      if (bres.ok) {
        const b = await bres.json();
        setSnapshots(b.snapshots ?? []);
      }
    } catch {
      // Transient network error — keep the last snapshot.
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // Restore-verify: restore the newest snapshot into a throwaway scratch DB
  // and drop it — proves the backups are restorable, not just retained.
  const handleVerify = async () => {
    setVerifying(true);
    try {
      const res = await fetch("/api/scheduler/backups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify" }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? t("restoreFailed"));
      if (data?.verified) {
        toast.success(t("verifyDone", { file: data.file, tables: data.tables }));
      } else {
        toast.error(
          data?.reason === "no_snapshots"
            ? t("verifyNone")
            : t("verifyFailed", { detail: data?.detail ?? "" }),
        );
      }
      await load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setVerifying(false);
    }
  };

  const handleRestore = async () => {
    if (!restoreTarget) return;
    setRestoring(true);
    try {
      const res = await fetch("/api/scheduler/backups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file: restoreTarget.file }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => null);
        throw new Error(b?.error ?? t("restoreFailed"));
      }
      toast.success(t("restoreDone", { file: restoreTarget.file }));
      setRestoreTarget(null);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setRestoring(false);
    }
  };

  if (forbidden) return null;

  const formatWhen = (iso?: string) => {
    if (!iso) return t("never");
    const d = new Date(iso);
    const mins = Math.round((now - d.getTime()) / 60000);
    if (mins < 1) return t("justNow");
    if (mins < 60) return t("minsAgo", { n: mins });
    const hours = Math.round(mins / 60);
    if (hours < 24) return t("hoursAgo", { n: hours });
    return d.toLocaleString();
  };

  return (
    <Card data-testid="scheduler-status">
      <CardHeader>
        <div className="flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <TimerIcon className="h-5 w-5 text-primary shrink-0" />
            <CardTitle className="min-w-0">{t("title")}</CardTitle>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge
              variant={status?.enabled ? "success" : "outline"}
              data-scheduler-enabled={status?.enabled ? "true" : "false"}
            >
              {status?.enabled ? t("enabled") : t("disabled")}
            </Badge>
            <Tooltip side="bottom" content={tcommon("refresh")}>
              <Button
                variant="ghost"
                size="icon"
                onClick={load}
                disabled={loading}
                aria-label={tcommon("refresh")}
              >
                <RefreshCwIcon size={14} className={cn("h-4 w-4", loading && "animate-spin")} />
              </Button>
            </Tooltip>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {!status ? (
          <p className="text-sm text-muted-foreground">{tcommon("loading")}</p>
        ) : (
          <>
            {!status.enabled && (
              <p className="text-xs text-muted-foreground">{t("disabledHint")}</p>
            )}
            <div className="divide-y divide-border rounded-lg border">
              {Object.entries(status.jobs).map(([job, run]) => (
                <div
                  key={job}
                  data-scheduler-job={job}
                  className="flex items-center justify-between gap-3 px-3 py-2 min-w-0"
                >
                  <span className="text-sm font-medium truncate">
                    {t(JOB_LABEL_KEYS[job] ?? "jobDigest")}
                  </span>
                  <span className="flex items-center gap-2 shrink-0">
                    {run ? (
                      <>
                        <span
                          className={cn(
                            "h-2 w-2 rounded-full",
                            run.ok ? "bg-emerald-500" : "bg-red-500",
                          )}
                          title={run.ok ? undefined : run.error}
                        />
                        <span className="text-xs text-muted-foreground">{formatWhen(run.at)}</span>
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground">{t("never")}</span>
                    )}
                  </span>
                </div>
              ))}
            </div>

            {/* Rollback snapshots — the supabase-sync job's retained pre-sync
                dumps, restorable with one confirmed action. */}
            <div className="pt-2">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-1.5">
                <ArchiveIcon className="h-3.5 w-3.5" />
                {t("snapshotsTitle")}
                <span className="tabular-nums">({snapshots.length})</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 ml-auto gap-1 text-[11px] text-primary hover:text-primary/80"
                  onClick={() => void handleVerify()}
                  disabled={verifying}
                  data-testid="backup-verify-btn"
                >
                  {verifying ? (
                    <Loader2Icon className="h-3 w-3 animate-spin" />
                  ) : (
                    <ShieldCheckIcon className="h-3 w-3" />
                  )}
                  {t("verify")}
                </Button>
              </div>
              {snapshots.length === 0 ? (
                <p className="text-xs text-muted-foreground">{t("snapshotsEmpty")}</p>
              ) : (
                <div
                  className="divide-y divide-border rounded-lg border max-h-40 overflow-y-auto"
                  data-testid="scheduler-snapshots"
                >
                  {snapshots.slice(0, 8).map((snap) => (
                    <div
                      key={snap.file}
                      className="flex items-center justify-between gap-3 px-3 py-2 min-w-0"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-mono truncate" title={snap.file}>
                          {snap.file.replace("remote-", "").replace(".dump", "")}
                        </p>
                        <p className="text-[11px] text-muted-foreground">{snap.sizeMb} MB</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 gap-1 text-xs shrink-0"
                        onClick={() => setRestoreTarget(snap)}
                      >
                        <RotateCcwIcon className="h-3 w-3" />
                        {t("restore")}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>

      {/* Restore confirmation — overwriting the remote is destructive */}
      <AlertDialog
        open={Boolean(restoreTarget)}
        onOpenChange={(o: boolean) => !o && setRestoreTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("restoreConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("restoreConfirmDesc", { file: restoreTarget?.file ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={restoring}>{tcommon("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e: React.MouseEvent) => {
                e.preventDefault();
                handleRestore();
              }}
              disabled={restoring}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {restoring && <Loader2Icon className="h-4 w-4 mr-1.5 animate-spin" />}
              {t("restoreConfirmAction")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
