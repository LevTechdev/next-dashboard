/**
 * Admin panel — audit-event tenant-attribution & mail-outbox health.
 *
 * Fetches GET /api/admin/audit-health (ADMIN-only) and surfaces:
 *   • Chain integrity — the tamper-evident SecurityEvent hash chain, verified
 *     by the same verifier the CI gate (scripts/check-audit-chain.ts) and
 *     GET /api/security/audit/verify use. "Verified n/n" means every hashed row
 *     re-hashes to its stored value and still links to its predecessor.
 *   • Tenant attribution — rows WITH an actor but no tenant (logSecurityEvent
 *     resolves a tenant for every event that has an actor, so these are always
 *     a real bug) and rows pointing at a tenant that no longer exists
 *     (cross-tenant contamination invisible to the hash chain itself, because
 *     tenantId is not part of the canonical hash payload). Actor-less rows are
 *     deployment telemetry and exempt.
 *   • Mail outbox — the durable mail queue: pending depth, permanent failures,
 *     and stuck mail. A red number here is the user-visible symptom of a
 *     misconfigured sender or dead SMTP transport — the thing users report as
 *     "I never got the email".
 *
 * Kept lightweight and self-refreshing (60s) so the panel can stay open on a
 * wallboard; nothing here mutates state.
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShieldCheckIcon, MailIcon, RefreshCwIcon, ScanSearchIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChainReport {
  ok: boolean;
  total: number;
  verified: number;
  firstBreakSeq: number | null;
  breaks: Array<{ seq: number; id: string; reason: string }>;
}

interface AttributionReport {
  missingTenant: number;
  orphanTenant: number;
  nullHash: number;
}

interface MailReport {
  pending: number;
  sending: number;
  sent: number;
  failed: number;
  stuck: number;
  oldestPendingAt: string | null;
}

interface AuditHealth {
  chain: ChainReport;
  attribution: AttributionReport;
  mail: MailReport;
  checkedAt: string;
}

type Health = "ok" | "warn" | "bad";

function healthTone(health: Health): string {
  switch (health) {
    case "ok":
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400";
    case "warn":
      return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
    case "bad":
      return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
  }
}

function healthLabel(health: Health, t: (key: string) => string): string {
  switch (health) {
    case "ok":
      return t("auditHealthStatusOk");
    case "warn":
      return t("auditHealthStatusWarn");
    case "bad":
      return t("auditHealthStatusBad");
  }
}

/** One metric row inside the attribution/outbox lists. */
function MetricRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm text-zinc-600 dark:text-zinc-400">{label}</span>
      <span className="text-sm font-semibold tabular-nums">{value}</span>
    </div>
  );
}

export function AuditHealthCard() {
  const t = useTranslations("admin");
  const [health, setHealth] = useState<AuditHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/audit-health");
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || t("auditHealthLoadFailedStatus", { status: res.status }));
      }
      setHealth((await res.json()) as AuditHealth);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("auditHealthLoadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchHealth(); // eslint-disable-line react-hooks/set-state-in-effect -- async; setstates land after the await
    const timer = setInterval(fetchHealth, 60_000);
    return () => clearInterval(timer);
  }, [fetchHealth]);

  const chainHealth: Health = health ? (health.chain.ok ? "ok" : "bad") : "ok";
  const attributionHealth: Health =
    !health || (health.attribution.missingTenant === 0 && health.attribution.orphanTenant === 0)
      ? "ok"
      : "bad";
  const mailHealth: Health = !health
    ? "ok"
    : health.mail.stuck > 0
      ? "bad"
      : health.mail.pending + health.mail.sending > 0
        ? "warn"
        : "ok";

  return (
    <Card>
      <CardHeader className="pb-4 border-b border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <ScanSearchIcon size={18} className="text-zinc-500" />
              {t("auditHealthTitle")}
            </CardTitle>
            <CardDescription>{t("auditHealthDesc")}</CardDescription>
          </div>
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
      </CardHeader>
      <CardContent className="grid gap-6 md:grid-cols-3 pt-4">
        {error && <p className="text-sm text-red-600 dark:text-red-400 md:col-span-3">{error}</p>}
        {/* Chain integrity */}
        <div className="space-y-2" data-testid="audit-chain-health" data-state={chainHealth}>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium flex items-center gap-1.5">
              <ShieldCheckIcon size={14} className="text-zinc-500" />
              {t("auditHealthChainTitle")}
            </span>
            <Badge className={cn("border-transparent", healthTone(chainHealth))}>
              {health ? healthLabel(chainHealth, (k) => t(k)) : "—"}
            </Badge>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">{t("auditHealthChainDesc")}</p>
          <MetricRow
            label={t("auditHealthChainVerified")}
            value={health ? `${health.chain.verified}/${health.chain.total}` : "—"}
          />
          <MetricRow
            label={t("auditHealthChainBreaks")}
            value={health ? health.chain.breaks.length : "—"}
          />
          {health && !health.chain.ok && health.chain.firstBreakSeq !== null && (
            <p className="text-xs text-red-600 dark:text-red-400">
              {t("auditHealthChainFirstBreak", { seq: health.chain.firstBreakSeq })}
            </p>
          )}
        </div>

        {/* Tenant attribution */}
        <div
          className="space-y-2"
          data-testid="audit-attribution-health"
          data-state={attributionHealth}
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium flex items-center gap-1.5">
              <ShieldCheckIcon size={14} className="text-zinc-500" />
              {t("auditHealthAttributionTitle")}
            </span>
            <Badge className={cn("border-transparent", healthTone(attributionHealth))}>
              {health ? healthLabel(attributionHealth, (k) => t(k)) : "—"}
            </Badge>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {t("auditHealthAttributionDesc")}
          </p>
          <MetricRow
            label={t("auditHealthAttributionMissing")}
            value={health ? health.attribution.missingTenant : "—"}
          />
          <MetricRow
            label={t("auditHealthAttributionOrphan")}
            value={health ? health.attribution.orphanTenant : "—"}
          />
          <MetricRow
            label={t("auditHealthAttributionNullHash")}
            value={health ? health.attribution.nullHash : "—"}
          />
        </div>

        {/* Mail outbox */}
        <div className="space-y-2" data-testid="audit-mail-health" data-state={mailHealth}>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium flex items-center gap-1.5">
              <MailIcon size={14} className="text-zinc-500" />
              {t("auditHealthMailTitle")}
            </span>
            <Badge className={cn("border-transparent", healthTone(mailHealth))}>
              {health ? healthLabel(mailHealth, (k) => t(k)) : "—"}
            </Badge>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">{t("auditHealthMailDesc")}</p>
          <MetricRow
            label={t("auditHealthMailPending")}
            value={health ? health.mail.pending : "—"}
          />
          <MetricRow label={t("auditHealthMailFailed")} value={health ? health.mail.failed : "—"} />
          <MetricRow label={t("auditHealthMailStuck")} value={health ? health.mail.stuck : "—"} />
        </div>
      </CardContent>
    </Card>
  );
}
