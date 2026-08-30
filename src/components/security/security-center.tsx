"use client";

import { useEffect, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { AlertTriangle, KeyRound, Monitor, Shield } from "lucide-react";
import { ClockIcon, FingerprintIcon, ShieldCheckIcon } from "lucide-animated";
import { useSecurityData, withinDays } from "@/components/security/use-security-data";
import { SessionsCard } from "@/components/security/sessions-card";
import { ActivityCard } from "@/components/security/activity-card";
import { TotpCard } from "@/components/security/totp-card";
import { PasskeysCard } from "@/components/security/passkeys-card";
import { BackupCodesCard } from "@/components/security/backup-codes-card";
import { EmailVerificationCard } from "@/components/security/email-verification-card";
import {
  computeSecurityScore,
  isSuspiciousEventType,
  scoreColor,
  scoreTier,
} from "@/lib/security-score";

function ScoreRing({ score, scoreOfLabel }: { score: number; scoreOfLabel: string }) {
  const r = 42;
  const c = 2 * Math.PI * r;
  const color = scoreColor(score);
  return (
    <div className="relative w-28 h-28 shrink-0">
      <svg
        viewBox="0 0 100 100"
        className="w-28 h-28 -rotate-90"
        role="img"
        aria-label={`${score}/100`}
      >
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          strokeWidth="10"
          className="stroke-gray-200/70 dark:stroke-gray-700/60"
        />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          strokeWidth="10"
          stroke={color}
          strokeLinecap="round"
          strokeDasharray={`${(score / 100) * c} ${c}`}
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold text-gray-900 dark:text-gray-100">{score}</span>
        <span className="text-[10px] text-gray-400 uppercase tracking-wider">{scoreOfLabel}</span>
      </div>
    </div>
  );
}

function StatTile({
  icon,
  label,
  value,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  tone: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 transition-shadow hover:shadow-md dark:hover:shadow-black/20">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${tone}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 truncate">{label}</p>
        <p className="text-lg font-bold text-gray-900 dark:text-gray-100 leading-tight">{value}</p>
      </div>
    </div>
  );
}

export function SecurityCenter() {
  const t = useTranslations("security");
  const data = useSecurityData();

  const recentEvents = data.events.filter((e) => withinDays(e.createdAt, 7));
  const suspiciousRecent = recentEvents.filter((e) => isSuspiciousEventType(e.type)).length;

  // Handle returning from the email-verification confirm link (?verified=true).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const verified = params.get("verified");
    if (verified === "true") {
      toast.success(t("emailVerifiedToast"));
      // No explicit refresh needed: the redirect only happens after the DB
      // update, so the hook's own mount fetch already sees emailVerified set.
      window.history.replaceState({}, "", window.location.pathname);
    } else if (verified === "invalid") {
      toast.error(t("emailVerifyLinkInvalid"));
      window.history.replaceState({}, "", window.location.pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const score = computeSecurityScore({
    totpEnabled: data.totpEnabled,
    passkeyCount: data.passkeys.length,
    backupRemaining: data.backupRemaining,
    emailVerified: data.emailVerified ? true : null,
    suspiciousRecent,
    sessionCount: data.sessions.length,
    mfaVerifiedRecently: data.mfaVerifiedRecently,
  });

  const tier = scoreTier(score);
  const scoreMessage = t(`score${tier[0].toUpperCase()}${tier.slice(1)}` as never);

  const color = scoreColor(score);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t("pageTitle")}</h1>
        <p className="text-sm text-gray-500 mt-1">{t("pageSubtitle")}</p>
      </div>

      {/* Unverified email alert — shown until identity verification completes */}
      {!data.loading && !data.emailVerified && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          role="alert"
          className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/15 px-4 py-3"
        >
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                {t("unverifiedAlertTitle")}
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-400/90">
                {t("unverifiedAlertDesc")}
              </p>
            </div>
          </div>
          <a
            href="#email-verification"
            className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold px-3 py-2 transition-colors"
          >
            <KeyRound className="h-3.5 w-3.5" />
            {t("unverifiedAlertAction")}
          </a>
        </motion.div>
      )}

      {/* Security score banner */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="relative overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6"
      >
        <div
          className="absolute -top-24 -right-24 w-72 h-72 rounded-full opacity-20 blur-3xl pointer-events-none"
          style={{ background: color }}
        />
        <div
          className="absolute inset-0 opacity-[0.14] pointer-events-none [background-size:18px_18px] dark:opacity-[0.08]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(15,23,42,0.6) 1px, transparent 0)",
          }}
        />
        <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-6">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5" />
              {t("scoreLabel")}
            </p>
            <p
              className="mt-2 text-lg font-semibold text-gray-900 dark:text-gray-100"
              style={{ color }}
            >
              {data.loading ? "…" : scoreMessage}
            </p>
            <p className="mt-1 text-xs text-gray-500">{t("scoreHint")}</p>
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-gray-200 dark:border-gray-700 px-2.5 py-1 text-[11px] font-medium">
              {data.loading ? (
                <span className="text-gray-400">…</span>
              ) : data.mfaVerifiedRecently ? (
                <>
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  <span className="text-emerald-600 dark:text-emerald-400">
                    {t("mfaVerifiedRecent")}
                  </span>
                </>
              ) : (
                <>
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-gray-300 dark:bg-gray-600" />
                  <span className="text-gray-500">{t("mfaNotVerifiedRecent")}</span>
                </>
              )}
            </div>
            <div className="mt-4 h-2 w-full max-w-sm rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700 ease-out"
                style={{ width: `${data.loading ? 0 : score}%`, background: color }}
              />
            </div>
          </div>
          <ScoreRing score={data.loading ? 0 : score} scoreOfLabel={t("scoreOf")} />
        </div>
      </motion.div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile
          icon={
            data.totpEnabled ? (
              <ShieldCheckIcon size={18} className="h-[18px] w-[18px] text-green-600" />
            ) : (
              <Shield className="h-[18px] w-[18px] text-gray-500" />
            )
          }
          label={t("stat2FA")}
          value={
            data.totpEnabled === null ? (
              "—"
            ) : data.totpEnabled ? (
              <span className="flex items-center gap-1.5 text-green-600">
                <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
                {t("statEnabled")}
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-gray-500">
                <span className="inline-block h-2 w-2 rounded-full bg-gray-300 dark:bg-gray-600" />
                {t("statDisabled")}
              </span>
            )
          }
          tone="bg-green-50 dark:bg-green-900/20"
        />
        <StatTile
          icon={
            <FingerprintIcon
              size={18}
              className="h-[18px] w-[18px] text-lime-600 dark:text-indigo-600"
            />
          }
          label={t("statPasskeys")}
          value={data.passkeys.length}
          tone="bg-lime-50 dark:bg-indigo-900/20"
        />
        <StatTile
          icon={<Monitor className="h-[18px] w-[18px] text-sky-600" />}
          label={t("statSessions")}
          value={data.sessions.length}
          tone="bg-sky-50 dark:bg-sky-900/20"
        />
        <StatTile
          icon={<ClockIcon size={18} className="h-[18px] w-[18px] text-amber-600" />}
          label={t("statEvents7d")}
          value={recentEvents.length}
          tone="bg-amber-50 dark:bg-amber-900/20"
        />
      </div>

      {/* Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
        <div className="lg:col-span-3 space-y-6">
          <SessionsCard data={data} />
          <ActivityCard data={data} />
        </div>
        <div className="lg:col-span-2 space-y-6">
          <TotpCard data={data} />
          <PasskeysCard data={data} />
          <BackupCodesCard data={data} />
          <EmailVerificationCard data={data} />
        </div>
      </div>
    </div>
  );
}
