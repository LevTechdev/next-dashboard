"use client";

import { useTranslations } from "next-intl";
import {
  AlertTriangle,
  Check,
  HelpCircle,
  KeyRound,
  LifeBuoy,
  Mail,
  ShieldCheck,
  Smartphone,
  TabletSmartphone,
  X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  recoveryFactsFrom,
  recoveryReadiness,
  type RecoveryPathId,
  type RecoveryPathState,
} from "@/lib/recovery-readiness";
import { BACKUP_CODE_LOW_THRESHOLD } from "@/lib/backup-code-status";
import { requestRecoveryAction } from "@/components/security/use-recovery-action";
import { ReadinessSparkline } from "@/components/security/readiness-sparkline";
import { useRecoveryHistory } from "@/components/security/use-recovery-history";
import type { SecurityData } from "@/components/security/use-security-data";

/**
 * Recovery readiness — "if I lost this phone right now, could I still get in?"
 *
 * Every other card in the Security Center states a fact ("2FA is active",
 * "0 passkeys"). This one answers the question those facts do not: whether the
 * account survives its owner losing a device. It reads only what the page has
 * already fetched, so it costs no extra request, and it names exactly ONE next
 * action — a checklist of four things to fix is a checklist nobody fixes.
 */
const PATH_ICONS: Record<RecoveryPathId, typeof Smartphone> = {
  spareAuthenticator: TabletSmartphone,
  recoveryCodes: KeyRound,
  passkey: ShieldCheck,
  email: Mail,
};

/**
 * Where each fix lives, so the action button lands on the right card. These ids
 * are set on the cards themselves — keep them in sync with the elements.
 */
const ACTION_TARGETS = {
  enable2fa: "totp-card",
  verifyEmail: "email-verification",
  addSpare: "backup-authenticator-card",
  generateCodes: "backup-codes-card",
} as const;

export function RecoveryReadinessCard({ data }: { data: SecurityData }) {
  const t = useTranslations("security");
  // The series records today's verdict on the way in (see the hook), so this
  // panel is the one place the history is guaranteed to include now.
  const history = useRecoveryHistory();

  // Shared with the destructive-action guards, so the panel and the dialogs
  // read the account's recovery ladder identically.
  const readiness = recoveryReadiness(recoveryFactsFrom(data));

  const { level, paths, nextAction, codesLow } = readiness;
  const tone = {
    ready: {
      border: "border-primary/30",
      chip: "bg-primary/10 text-primary",
      Icon: ShieldCheck,
    },
    thin: {
      border: "border-amber-500/30",
      chip: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
      Icon: AlertTriangle,
    },
    "locked-out": {
      border: "border-destructive/40",
      chip: "bg-destructive/10 text-destructive",
      Icon: AlertTriangle,
    },
    unprotected: {
      border: "border-border",
      chip: "bg-muted text-muted-foreground",
      Icon: AlertTriangle,
    },
    unknown: {
      border: "border-border",
      chip: "bg-muted text-muted-foreground",
      Icon: HelpCircle,
    },
  }[level];

  /**
   * Take the user to the fix AND start it. A button labelled "Set up 2FA" that
   * only scrolls is a lie in the interface — the owning card listens for the
   * action and opens its own dialog.
   */
  const goToAction = () => {
    if (!nextAction) return;
    const targetId = ACTION_TARGETS[nextAction];
    const target = document.getElementById(targetId);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      target.classList.add("ring-2", "ring-primary/40");
      setTimeout(() => target.classList.remove("ring-2", "ring-primary/40"), 1600);
    }
    requestRecoveryAction(targetId);
  };

  const stateLabel = (state: RecoveryPathState) =>
    state === "available"
      ? t("recoveryPathAvailable")
      : state === "missing"
        ? t("recoveryPathMissing")
        : t("recoveryPathUnknown");

  return (
    <Card
      data-testid="recovery-readiness-card"
      className={tone.border}
      data-level={level}
      id="recovery-readiness-card"
    >
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <LifeBuoy className="h-4 w-4" />
          {t("recoveryTitle")}
          <span
            data-testid="recovery-level"
            className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone.chip}`}
          >
            {t(`recoveryLevel_${level}`)}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground" data-testid="recovery-summary">
          {t(`recoverySummary_${level}`)}
        </p>

        <ul className="space-y-1.5">
          {paths.map((p) => {
            const Icon = PATH_ICONS[p.id];
            return (
              <li
                key={p.id}
                data-testid={`recovery-path-${p.id}`}
                data-state={p.state}
                className="flex items-center gap-2.5 text-xs"
              >
                <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">{t(`recoveryPath_${p.id}`)}</span>
                <span
                  className={`flex shrink-0 items-center gap-1 font-medium ${
                    p.state === "available"
                      ? "text-primary"
                      : p.state === "missing"
                        ? "text-muted-foreground"
                        : "text-muted-foreground/70"
                  }`}
                >
                  {p.state === "available" ? (
                    <Check className="h-3 w-3" />
                  ) : p.state === "missing" ? (
                    <X className="h-3 w-3" />
                  ) : (
                    <HelpCircle className="h-3 w-3" />
                  )}
                  {stateLabel(p.state)}
                  {typeof p.remaining === "number" && p.remaining > 0 && (
                    <span className="font-normal">
                      · {t("recoveryPathRemaining", { count: p.remaining })}
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>

        {codesLow && level !== "unprotected" && level !== "unknown" && (
          <p
            data-testid="recovery-codes-low"
            className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-[11px] leading-snug text-amber-700 dark:text-amber-400"
          >
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{t("recoveryCodesLowNote", { threshold: BACKUP_CODE_LOW_THRESHOLD })}</span>
          </p>
        )}

        <div
          data-testid="recovery-history"
          data-trend={history.trend}
          className="space-y-2 rounded-lg border border-border bg-muted/30 p-3"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {t("recoveryHistoryLabel", { days: history.days })}
            </p>
            <span
              data-testid="recovery-history-trend"
              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                history.trend === "down"
                  ? "bg-destructive/10 text-destructive"
                  : history.trend === "up"
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {t(`recoveryTrend_${history.trend}`)}
            </span>
          </div>

          {history.loading ? (
            <div className="h-11 w-full animate-pulse rounded bg-muted" />
          ) : history.points.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">{t("recoveryHistoryEmpty")}</p>
          ) : (
            <ReadinessSparkline points={history.points} days={history.days} />
          )}

          <p className="text-[11px] leading-snug text-muted-foreground">
            {t("recoveryHistoryHint")}
          </p>
        </div>

        {nextAction ? (
          <div className="space-y-2 rounded-lg border border-border bg-muted/40 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {t("recoveryNextLabel")}
            </p>
            <p className="text-xs leading-snug" data-testid="recovery-next-detail">
              {t(`recoveryNext_${nextAction}`)}
            </p>
            <Button
              size="sm"
              className="w-full"
              onClick={goToAction}
              data-testid="recovery-next-action"
            >
              {t(`recoveryNextAction_${nextAction}`)}
            </Button>
          </div>
        ) : (
          <p
            data-testid="recovery-no-action"
            className="flex items-center gap-2 text-xs text-primary"
          >
            <Check className="h-3.5 w-3.5" />
            {t("recoveryNothingToFix")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
