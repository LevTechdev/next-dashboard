"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle } from "lucide-react";
import {
  recoveryFactsFrom,
  recoveryImpactOf,
  type RecoveryActionImpact,
  type RecoveryRemovalAction,
} from "@/lib/recovery-readiness";
import type { SecurityData } from "@/components/security/use-security-data";

/**
 * The acknowledgement gate in front of a recovery-destroying action.
 *
 * Disabling 2FA and deleting the spare authenticator are the only two things a
 * signed-in user can do that make the account *harder to get back into*. The
 * dialogs used to ask for a password and nothing else, which answers "are you
 * you?" but never "do you understand what this costs you?".
 *
 * The judgement is not made here: `recoveryImpactOf` computes it from the same
 * facts the Recovery readiness panel renders, so the warning can never disagree
 * with the panel sitting above it on the page. This file is only the pixels.
 */
export function useRecoveryImpact(
  data: SecurityData,
  action: RecoveryRemovalAction | null,
): {
  impact: RecoveryActionImpact | null;
  acknowledged: boolean;
  setAcknowledged: (value: boolean) => void;
  /** True while the destructive button must stay disabled. */
  blocked: boolean;
} {
  const facts = recoveryFactsFrom(data);
  const impact = useMemo(
    () => (action ? recoveryImpactOf(facts, action) : null),
    // `facts` is rebuilt every render from the same fields this memo reads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      action,
      data.totpEnabled,
      data.backupAuthenticator,
      data.backupRemaining,
      data.passkeys?.length,
      data.loading,
      data.emailVerified,
    ],
  );
  const [acknowledged, setAcknowledged] = useState(false);

  return {
    impact,
    acknowledged,
    setAcknowledged,
    blocked: Boolean(impact?.requiresAcknowledgement) && !acknowledged,
  };
}

/**
 * The warning block itself. Renders nothing when the action is harmless —
 * which, for removing the spare, is the common case: a user with fresh recovery
 * codes needs no lecture.
 */
export function RecoveryImpactNotice({ impact }: { impact: RecoveryActionImpact | null }) {
  const t = useTranslations("security");

  if (!impact?.requiresAcknowledgement) return null;
  const { action } = impact;

  return (
    <div
      data-testid="recovery-guard"
      data-action={action}
      className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-destructive"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1 space-y-2">
        <p className="text-sm font-semibold">{t(`recoveryGuard_${action}_title`)}</p>
        <p className="text-xs leading-snug">{t(`recoveryGuard_${action}_body`)}</p>
        <p className="text-[11px] leading-snug opacity-90" data-testid="recovery-guard-after">
          {t("recoveryGuardAfter", { level: t(`recoveryLevel_${impact.after.level}`) })}
        </p>
      </div>
    </div>
  );
}

/**
 * The acknowledgement checkbox. Separate from the notice because it must sit
 * directly above the confirm button, whatever layout the dialog uses.
 */
export function RecoveryImpactAcknowledgement({
  impact,
  acknowledged,
  onChange,
}: {
  impact: RecoveryActionImpact | null;
  acknowledged: boolean;
  onChange: (value: boolean) => void;
}) {
  const t = useTranslations("security");
  if (!impact?.requiresAcknowledgement) return null;

  return (
    <label
      htmlFor="recovery-guard-ack"
      className="flex cursor-pointer items-start gap-2.5 rounded-md border border-border bg-muted/40 p-2.5 text-xs leading-snug"
    >
      <input
        id="recovery-guard-ack"
        data-testid="recovery-guard-ack"
        type="checkbox"
        checked={acknowledged}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-destructive"
      />
      <span>{t(`recoveryGuard_${impact.action}_ack`)}</span>
    </label>
  );
}
