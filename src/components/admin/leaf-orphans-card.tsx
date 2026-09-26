/**
 * Admin panel — leaf-sync orphan health.
 *
 * The scheduler card in Settings surfaces the leaf-sync orphan report, but
 * reconciliation depended on someone opening that page. This card makes the
 * open tally a first-class admin ops signal: the projected per-table report
 * (raw report minus the acknowledged-orphan ledger that
 * `node scripts/ack-leaf-orphans.mjs` maintains), an `unacknowledged` verdict,
 * and a run-now trigger so an operator who just retired refs can see the
 * projection land without waiting for the 30-minute scheduler gate.
 *
 * Acknowledge-only by design: the refs name SecurityEvent/Session rows whose
 * FKs are part of the audit-hash canonical payload — they are never rewritten,
 * only retired from the report. The card is read-only on the ledger; the CLI
 * owns reconciliation.
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GitBranchIcon, RefreshCwIcon, CircleCheckIcon, CircleAlertIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface OrphanEntry {
  count: number;
  samples?: string[];
}

interface LeafOrphans {
  state: "ok" | "warn" | "bad";
  total: number;
  unacknowledgedSamples: number;
  tables: Record<string, OrphanEntry>;
  checkedAt: string;
}

/** One table's line: "Table: N rows cannot sync" + up to its 6 samples. */
function TableOrphans({ table, entry }: { table: string; entry: OrphanEntry }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold">
        {table}: {entry.count}
      </p>
      {(entry.samples ?? []).map((s) => (
        <p key={s} className="truncate font-mono text-[10px] text-muted-foreground">
          {s}
        </p>
      ))}
    </div>
  );
}

export function LeafOrphansCard() {
  const t = useTranslations("admin");
  const [report, setReport] = useState<LeafOrphans | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const fetchReport = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch("/api/admin/leaf-orphans");
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || t("leafOrphansLoadFailedStatus", { status: res.status }));
      }
      setReport((await res.json()) as LeafOrphans);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("leafOrphansLoadFailed"));
    }
  }, [t]);

  const runNow = useCallback(async () => {
    setRunning(true);
    try {
      const res = await fetch("/api/admin/leaf-orphans", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        output?: string;
        error?: string;
      };
      if (!res.ok || data.ok === false) {
        throw new Error(data.output || data.error || t("leafOrphansRunFailed"));
      }
      toast.success(t("leafOrphansRunDone"));
      await fetchReport();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("leafOrphansRunFailed"));
    } finally {
      setRunning(false);
    }
  }, [t, fetchReport]);

  useEffect(() => {
    fetchReport(); // eslint-disable-line react-hooks/set-state-in-effect -- async; setstates land after the await
    const timer = setInterval(fetchReport, 120_000);
    return () => clearInterval(timer);
  }, [fetchReport]);

  const tables = Object.entries(report?.tables ?? {});

  return (
    <Card data-testid="leaf-orphans-card" data-state={report?.state ?? "ok"}>
      <CardHeader className="pb-4 border-b border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <GitBranchIcon size={18} className="text-zinc-500" />
              {t("leafOrphansTitle")}
              {report && (
                <Badge
                  data-testid="leaf-orphans-badge"
                  className={cn(
                    "border-transparent",
                    report.state === "ok" &&
                      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
                    report.state === "warn" &&
                      "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
                    report.state === "bad" &&
                      "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
                  )}
                >
                  {t(`leafOrphansState_${report.state}`)}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>{t("leafOrphansDesc")}</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={runNow}
              disabled={running}
              data-testid="leaf-orphans-run"
            >
              <RefreshCwIcon size={14} className={cn(running && "animate-spin")} />
              {t("leafOrphansRunNow")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchReport}
              aria-label={t("leafOrphansRefresh")}
            >
              <RefreshCwIcon size={14} className={cn(!report && "animate-spin")} />
              {t("leafOrphansRefresh")}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        {!error && !report && (
          <p className="text-sm text-muted-foreground">{t("leafOrphansLoading")}</p>
        )}
        {!error && report && tables.length === 0 && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <CircleCheckIcon size={14} className="text-emerald-500" />
            {t("leafOrphansClean")}
          </p>
        )}
        {!error && report && tables.length > 0 && (
          <div className="space-y-3">
            <p className="flex items-center gap-2 text-sm">
              {report.state === "bad" ? (
                <CircleAlertIcon size={14} className="text-red-500" />
              ) : (
                <CircleCheckIcon size={14} className="text-amber-500" />
              )}
              <span data-testid="leaf-orphans-total">
                {t("leafOrphansTotal", { count: report.total, tables: tables.length })}
              </span>
              {report.unacknowledgedSamples === 0 && (
                <span className="text-xs text-muted-foreground">{t("leafOrphansAllAcked")}</span>
              )}
            </p>
            <div className="space-y-2">
              {tables.map(([table, entry]) => (
                <TableOrphans key={table} table={table} entry={entry} />
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">{t("leafOrphansHowTo")}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
