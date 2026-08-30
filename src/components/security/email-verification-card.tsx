"use client";

import { useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { AlertTriangle, KeyRound, Loader2, Mail, Timer } from "lucide-react";
import { CheckIcon, CheckCheckIcon, CopyIcon, MailCheckIcon } from "lucide-animated";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import type { SecurityData } from "@/components/security/use-security-data";
import { useResendCooldown } from "@/components/security/use-resend-cooldown";
import { useAuth } from "@/hooks/use-auth";

/**
 * Email-verification status card shown in the Security Center.
 *
 * Unverified users can request a 6-digit OTP (emailed via SMTP/Resend, or
 * surfaced as a dev-mode fallback when no mailer is configured), enter it
 * inline to verify, or use the classic click-through link. After a send a
 * countdown disables resending until the cooldown elapses.
 */
export function EmailVerificationCard({ data }: { data: SecurityData }) {
  const t = useTranslations("security");
  const tcommon = useTranslations("common");
  const locale = useLocale();

  const emailVerified = data.emailVerified !== null;

  const [sending, setSending] = useState(false);
  const [verificationUrl, setVerificationUrl] = useState<string | null>(null);
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [otp, setOtp] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  // Guards the OTP submission against double-firing: the auto-submit on the
  // 6th digit and a click on "Verify" for the same code can both trigger
  // verification, so the second call is a no-op while the first is in flight.
  // Reset in `finally`, so retrying after an error still works.
  const otpSubmittingRef = useRef(false);

  // Shared 60s resend cooldown (persisted in localStorage).
  const { cooldownLeft, startCooldown } = useResendCooldown();
  const { refreshUser } = useAuth();

  const sendVerification = async () => {
    setSending(true);
    try {
      const res = await fetch("/api/auth/verify-email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // `from: "security"` is forwarded into the confirm link so the
        // post-confirm redirect lands back on the Security Center.
        body: JSON.stringify({ locale, from: "security" }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || tcommon("error"));
      }
      const d = await res.json();
      if (d.alreadyVerified) {
        toast.success(t("emailVerifiedToast"));
      } else {
        setVerificationUrl(d.verificationUrl || null);
        setDevOtp(d.devOtp || null);
        setOtpError(null);
        startCooldown();
        toast.success(t("otpSent"));
      }
      data.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : tcommon("error"));
    } finally {
      setSending(false);
    }
  };

  const verifyOtpCode = async (code: string) => {
    if (otpSubmittingRef.current) return;
    if (!/^\d{6}$/.test(code)) {
      setOtpError(t("otpInvalidFormat"));
      return;
    }
    otpSubmittingRef.current = true;
    setVerifying(true);
    setOtpError(null);
    try {
      const res = await fetch("/api/auth/verify-email/otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const d = await res.json();
      if (!res.ok) {
        const errCode = d.error;
        if (errCode === "OTP_EXPIRED") setOtpError(t("otpExpired"));
        else if (errCode === "OTP_TOO_MANY_ATTEMPTS") setOtpError(t("otpTooManyAttempts"));
        else if (errCode === "OTP_NOT_REQUESTED") setOtpError(t("otpNotRequested"));
        else if (typeof d.attemptsLeft === "number")
          setOtpError(t("otpInvalid", { attemptsLeft: d.attemptsLeft }));
        else setOtpError(t("otpInvalidFinal"));
        return;
      }
      toast.success(t("emailVerifiedToast"));
      setOtp("");
      data.refresh();
      refreshUser();
    } catch {
      setOtpError(t("otpGenericError"));
    } finally {
      otpSubmittingRef.current = false;
      setVerifying(false);
    }
  };

  const verifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    verifyOtpCode(otp);
  };

  const copyLink = () => {
    if (!verificationUrl) return;
    navigator.clipboard.writeText(verificationUrl);
    setCopied(true);
    toast.success(t("linkCopied"));
    setTimeout(() => setCopied(false), 1500);
  };

  const devFallbackVisible = Boolean(devOtp) || Boolean(verificationUrl);

  return (
    <Card id="email-verification">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          {emailVerified ? (
            <MailCheckIcon size={16} className="h-4 w-4 text-green-600" />
          ) : (
            <Mail className="h-4 w-4" />
          )}
          {t("emailVerification")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {emailVerified ? (
          <div className="flex items-start gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800">
            <MailCheckIcon size={18} className="h-[18px] w-[18px] text-green-600 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-medium text-green-800 dark:text-green-300">
                  {t("emailVerifiedStatus")}
                </p>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 text-[11px] font-semibold">
                  <CheckCheckIcon size={12} className="h-3 w-3" />
                  {t("verified")}
                </span>
              </div>
              <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">
                {t("verifiedOn", { date: new Date(data.emailVerified!).toLocaleDateString() })}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800">
              <AlertTriangle
                size={18}
                className="h-[18px] w-[18px] text-amber-600 shrink-0 mt-0.5"
              />
              <div className="min-w-0">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                  {t("emailUnverified")}
                </p>
                <p className="text-xs text-amber-600 dark:text-amber-400">{t("emailVerifyDesc")}</p>
              </div>
            </div>

            {/* OTP entry — the primary identity-verification flow */}
            <form onSubmit={verifyOtp} className="space-y-2">
              <label
                htmlFor="verify-otp-input"
                className="text-xs font-medium text-gray-600 dark:text-gray-400"
              >
                {t("otpLabel")}
              </label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="verify-otp-input"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    pattern="\d{6}"
                    value={otp}
                    onChange={(e) => {
                      const next = e.target.value.replace(/\D/g, "");
                      setOtp(next);
                      // Auto-submit the moment the 6th digit lands — same
                      // pattern as the register page and login TOTP prompt.
                      // Correcting a digit back to 6 re-verifies; the submit
                      // button stays as a fallback (guarded against the
                      // double-fire by otpSubmittingRef).
                      if (next.length === 6) verifyOtpCode(next);
                    }}
                    placeholder={t("otpPlaceholder")}
                    className="pl-9 text-center tracking-[0.4em] font-semibold"
                    disabled={verifying}
                  />
                </div>
                <Button type="submit" size="sm" disabled={verifying || otp.length !== 6 || sending}>
                  {verifying ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" /> {t("otpVerifying")}
                    </>
                  ) : (
                    <>{t("otpVerify")}</>
                  )}
                </Button>
              </div>
              {otpError && <p className="text-xs text-red-500">{otpError}</p>}
            </form>

            {devFallbackVisible ? (
              <div className="space-y-2">
                {devOtp ? (
                  <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40 p-2.5">
                    <p className="text-[11px] uppercase tracking-wider text-gray-400">
                      {t("otpDevCode")}
                    </p>
                    <p
                      data-testid="dev-otp"
                      className="text-base font-bold tracking-[0.3em] text-gray-700 dark:text-gray-200"
                    >
                      {devOtp}
                    </p>
                  </div>
                ) : null}
                {verificationUrl ? (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {t("verificationLink")}
                    </p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 p-2 text-xs bg-gray-50 dark:bg-gray-800 border rounded-lg truncate">
                        {verificationUrl}
                      </code>
                      <Button variant="outline" size="sm" onClick={copyLink}>
                        {copied ? (
                          <CheckIcon size={16} className="h-4 w-4 text-green-600" />
                        ) : (
                          <CopyIcon size={16} className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-gray-500">{t("verificationNote")}</p>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={sendVerification}
                disabled={sending || cooldownLeft > 0}
              >
                {sending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" /> {t("sendingVerification")}
                  </>
                ) : cooldownLeft > 0 ? (
                  <>
                    <Timer className="h-4 w-4 mr-1" />{" "}
                    {t("resendInSeconds", { seconds: cooldownLeft })}
                  </>
                ) : (
                  <>
                    <Mail className="h-4 w-4 mr-1" />{" "}
                    {devFallbackVisible ? t("resendEmail") : t("sendVerificationEmail")}
                  </>
                )}
              </Button>
              {cooldownLeft > 0 && (
                <p className="text-xs text-gray-500">
                  {t("emailResendNote", { seconds: cooldownLeft })}
                </p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
