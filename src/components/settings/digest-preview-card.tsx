"use client";

import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { CalendarClock, Mail, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { typeLabelKey } from "@/lib/notification-taxonomy";
import { formatLocaleNumber } from "@/lib/utils";

/**
 * Daily-digest preview — Settings → Notifications.
 *
 * Renders exactly what `runQuotaDigest` will email: the per-metric quota
 * table (used / limit / % with ⚠ at ≥80%) and the "While you were away"
 * missed-event rollup, straight from the same compute path the cron job uses
 * (GET /api/usage/digest?preview=1 returns the digests without sending).
 * A static mock would drift from the real email; this can't.
 */

interface DigestMetric {
  key: string;
  label: string;
  used: number;
  limit: number | null;
  pct: number | null;
  warn: boolean;
}

interface DigestNotification {
  type: string;
  total: number;
  unread: number;
}

interface DigestPreview {
  planName: string;
  metrics: DigestMetric[];
  anyWarn: boolean;
  notifications: DigestNotification[];
  hasUnreadNotifications: boolean;
}

export function DigestPreviewCard() {
  const t = useTranslations("settings");
  const tnotif = useTranslations("notifications");
  const locale = useLocale();
  const [digest, setDigest] = useState<DigestPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = () => {
    setLoading(true);
    setFailed(false);
    fetch("/api/usage/digest/preview")
      .then((r) => {
        if (!r.ok) throw new Error("preview unavailable");
        return r.json();
      })
      .then((d: { digest?: DigestPreview }) => {
        setDigest(d.digest ?? null);
        setLoading(false);
      })
      .catch(() => {
        setFailed(true);
        setLoading(false);
      });
  };

  useEffect(() => {
    load();
  }, []);

  const typeLabel = (type: string) => tnotif(typeLabelKey(type) as never);

  return (
    <Card data-testid="digest-preview-card">
      <CardHeader>
        <div className="flex items-center gap-2">
          <CalendarClock className="h-5 w-5" />
          <CardTitle>{t("digestPreviewTitle")}</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto"
            onClick={load}
            disabled={loading}
            aria-label={t("digestPreviewRefresh")}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
        <p className="text-xs text-gray-500 mt-1">{t("digestPreviewDesc")}</p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2" aria-busy="true">
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-4/5" />
            <Skeleton className="h-5 w-3/5" />
          </div>
        ) : failed || !digest ? (
          <p className="text-sm text-gray-500">{t("digestPreviewUnavailable")}</p>
        ) : (
          <div className="space-y-4">
            {/* Quota rows — mirrors digestHtml's table */}
            <div className="rounded-lg border border-gray-200 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800">
              {digest.metrics.map((m) => (
                <div
                  key={m.key}
                  className="flex items-center justify-between px-3 py-2 text-sm gap-3"
                >
                  <span className="min-w-0 truncate font-medium">{m.label}</span>
                  <span className="shrink-0 tabular-nums text-gray-500">
                    {formatLocaleNumber(m.used, locale)}
                    {" / "}
                    {m.limit === null ? "∞" : formatLocaleNumber(m.limit, locale)}
                  </span>
                  <span
                    className={`shrink-0 w-12 text-right text-xs font-semibold tabular-nums ${
                      m.warn
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-emerald-600 dark:text-emerald-400"
                    }`}
                  >
                    {m.pct === null ? "—" : `${m.pct}%${m.warn ? " ⚠" : ""}`}
                  </span>
                </div>
              ))}
            </div>

            {/* Missed events — hidden when the email would omit the section */}
            {digest.notifications.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1.5">
                  {t("digestPreviewMissedTitle")}
                </p>
                <ul className="space-y-1" data-testid="digest-preview-events">
                  {digest.notifications.map((n) => (
                    <li key={n.type} className="flex items-center justify-between text-sm gap-3">
                      <span className="min-w-0 truncate">{typeLabel(n.type)}</span>
                      <span className="shrink-0 text-xs tabular-nums text-gray-500">
                        {formatLocaleNumber(n.total, locale)}
                        {n.unread > 0 && (
                          <span className="ml-2 inline-flex items-center rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                            {formatLocaleNumber(n.unread, locale)}
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <p className="flex items-start gap-1.5 text-[11px] text-gray-400">
              <Mail className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              {t("digestPreviewPlan", { plan: digest.planName })}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
