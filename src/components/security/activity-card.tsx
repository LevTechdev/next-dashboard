"use client";

import { type ComponentType } from "react";
import { useTranslations } from "next-intl";
import { LogIn, LogOut, KeyRound, ShieldAlert, Monitor, MailCheck } from "lucide-react";
import { ShieldCheckIcon, ClockIcon, FingerprintIcon, RefreshCwIcon } from "lucide-animated";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { timeAgo, withinDays, type SecurityData } from "@/components/security/use-security-data";
import { isSuspiciousEventType } from "@/lib/security-score";

const EVENT_ICON: Record<string, ComponentType<{ className?: string; size?: number }>> = {
  LOGIN: LogIn,
  LOGOUT: LogOut,
  LOGIN_FAILED: ShieldAlert,
  ACCOUNT_LOCKED: ShieldAlert,
  PASSWORD_CHANGE: KeyRound,
  TOTP_ENABLED: ShieldCheckIcon,
  TOTP_DISABLED: ShieldAlert,
  BACKUP_CODES_GENERATED: KeyRound,
  BACKUP_CODE_USED: KeyRound,
  PASSKEY_ADDED: FingerprintIcon,
  PASSKEY_REMOVED: FingerprintIcon,
  PASSKEY_LOGIN: FingerprintIcon,
  MFA_VERIFIED: ShieldCheckIcon,
  EMAIL_VERIFIED: MailCheck,
  SESSION_REVOKED: Monitor,
  SESSIONS_REVOKED_ALL: Monitor,
  STEP_UP_VERIFIED: ShieldCheckIcon,
};

export function ActivityCard({ data }: { data: SecurityData }) {
  const t = useTranslations("security");
  const tcommon = useTranslations("common");

  const { events } = data;
  const recent = events.filter((e) => withinDays(e.createdAt, 7));
  const hasSuspicious = recent.some((e) => isSuspiciousEventType(e.type));

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ClockIcon size={16} className="h-4 w-4" />
            {t("securityActivity")}
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={() => data.refresh()} className="h-7 px-2">
            <RefreshCwIcon size={14} className="h-3.5 w-3.5 mr-1" />
            <span className="text-xs">{tcommon("refresh")}</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-1">
        {recent.length === 0 ? (
          <p className="text-sm text-gray-500">{tcommon("noData")}</p>
        ) : (
          <>
            {!hasSuspicious && (
              <div className="flex items-center gap-2 px-3 py-2 mb-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800/50 text-sm text-emerald-700 dark:text-emerald-300">
                <ShieldCheckIcon size={16} className="h-4 w-4 shrink-0" />
                {t("noSuspicious")}
              </div>
            )}
            {recent.map((e) => {
              const Icon = EVENT_ICON[e.type] || ShieldCheckIcon;
              return (
                <div key={e.id} className="flex items-center gap-3 py-2 text-sm">
                  <Icon size={16} className="h-4 w-4 text-gray-400 shrink-0" />
                  <span className="flex-1 min-w-0">{t(`evt_${e.type}` as never)}</span>
                  <span className="text-xs text-gray-400 shrink-0">
                    {e.ip || "—"} · {timeAgo(e.createdAt)}
                  </span>
                </div>
              );
            })}
          </>
        )}
      </CardContent>
    </Card>
  );
}
