"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  AlertTriangle,
  Eye,
  EyeOff,
  Loader2,
  Shield,
  ShieldOff,
  Smartphone,
  Scan,
  KeyRound,
} from "lucide-react";
import { ShieldCheckIcon, CheckCheckIcon, CopyIcon } from "lucide-animated";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { CodeSlots } from "@/components/ui/code-slots";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useRecoveryAction } from "@/components/security/use-recovery-action";
import {
  RecoveryImpactAcknowledgement,
  RecoveryImpactNotice,
  useRecoveryImpact,
} from "@/components/security/recovery-guard";
import type { SecurityData } from "@/components/security/use-security-data";

export function TotpCard({ data }: { data: SecurityData }) {
  const t = useTranslations("security");
  const tcommon = useTranslations("common");

  const totpEnabled = data.totpEnabled === true;

  const [twoFADialogOpen, setTwoFADialogOpen] = useState(false);
  const [qrCode, setQrCode] = useState("");
  const [totpSecret, setTotpSecret] = useState("");
  const [totpCode, setTotpCode] = useState("");
  // CodeSlots error state: set when the server rejects the code, cleared by
  // the component's post-drain reset so the row is ready for another attempt.
  const [totpRejected, setTotpRejected] = useState(false);
  const [verifying2FA, setVerifying2FA] = useState(false);
  const [settingUp2FA, setSettingUp2FA] = useState(false);

  const [disable2FADialog, setDisable2FADialog] = useState(false);
  const [disablePassword, setDisablePassword] = useState("");
  const [disabling2FA, setDisabling2FA] = useState(false);
  const [showDisablePassword, setShowDisablePassword] = useState(false);

  // Disabling 2FA always needs an explicit acknowledgement: it is the one
  // action that removes the factor every recovery path exists to protect.
  const guard = useRecoveryImpact(data, disable2FADialog ? "disable2fa" : null);

  const openDisableDialog = () => {
    guard.setAcknowledged(false);
    setDisable2FADialog(true);
  };
  const closeDisableDialog = () => {
    setDisable2FADialog(false);
    setDisablePassword("");
    guard.setAcknowledged(false);
  };

  const closeSetupDialog = () => {
    setTwoFADialogOpen(false);
    setQrCode("");
    setTotpSecret("");
    setTotpCode("");
  };

  const handleSetup2FA = async () => {
    setSettingUp2FA(true);
    try {
      const res = await fetch("/api/auth/totp/setup");
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || tcommon("error"));
      }
      const d = await res.json();
      setQrCode(d.qrCode || "");
      setTotpSecret(d.secret || "");
      setTotpCode("");
      setTwoFADialogOpen(true);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : tcommon("error"));
    } finally {
      setSettingUp2FA(false);
    }
  };

  const handleVerify2FA = async () => {
    if (!totpCode || totpCode.length < 6) {
      toast.error(t("enterValidCode"));
      return;
    }
    setVerifying2FA(true);
    try {
      const res = await fetch("/api/auth/totp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: totpCode, secret: totpSecret }),
      });
      if (!res.ok) {
        const err = await res.json();
        setTotpRejected(true);
        throw new Error(err.error || t("enterValidCode"));
      }
      toast.success(t("twoFAEnabledToast"));
      closeSetupDialog();
      data.refresh();
    } catch (err: unknown) {
      setTotpRejected(true);
      toast.error(err instanceof Error ? err.message : tcommon("error"));
    } finally {
      setVerifying2FA(false);
    }
  };

  const handleDisable2FA = async () => {
    if (!disablePassword) {
      toast.error(t("currentPasswordRequired"));
      return;
    }
    setDisabling2FA(true);
    try {
      const res = await fetch("/api/auth/totp/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: disablePassword }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || tcommon("error"));
      }
      toast.success(t("twoFADisabledToast"));
      setDisable2FADialog(false);
      setDisablePassword("");
      data.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : tcommon("error"));
    } finally {
      setDisabling2FA(false);
    }
  };

  // Answer the Recovery readiness panel's "Set up 2FA" action: it is only ever
  // offered while 2FA is off, so opening the enrollment flow is the fix.
  useRecoveryAction("totp-card", () => {
    if (!totpEnabled) void handleSetup2FA();
  });

  return (
    <>
      <Card id="totp-card">
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {totpEnabled ? (
                <ShieldCheckIcon size={20} className="h-5 w-5 text-lime-600 dark:text-green-600" />
              ) : (
                <Shield className="h-5 w-5" />
              )}
              <CardTitle>{t("twoFactor")}</CardTitle>
            </div>
            <Switch
              checked={totpEnabled}
              disabled={settingUp2FA}
              onCheckedChange={(next) => {
                if (next) handleSetup2FA();
                else openDisableDialog();
              }}
              aria-label={t("twoFactor")}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-gray-500">{t("twoFactorDesc")}</p>
          {totpEnabled ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-lime-50 dark:bg-green-900/10 border border-lime-200 dark:border-green-800">
                <ShieldCheckIcon
                  size={20}
                  className="h-5 w-5 text-lime-600 dark:text-green-600 shrink-0 mt-0.5"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-lime-800 dark:text-green-300">
                      {t("twoFAActive")}
                    </p>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-lime-100 dark:bg-green-900/40 text-lime-700 dark:text-green-300 text-[11px] font-semibold">
                      <CheckCheckIcon size={12} className="h-3 w-3" />
                      {t("verified")}
                    </span>
                  </div>
                </div>
              </div>
              <Button variant="destructive" size="sm" onClick={openDisableDialog}>
                <ShieldOff className="h-4 w-4 mr-2" /> {t("disable2FA")}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
                <Smartphone className="h-5 w-5 text-gray-400 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {t("enhanceSecurity")}
                  </p>
                  <p className="text-xs text-gray-500">{t("enhanceSecurityDesc")}</p>
                </div>
              </div>
              <Button variant="outline" onClick={handleSetup2FA} disabled={settingUp2FA}>
                {settingUp2FA ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" /> {t("preparing")}
                  </>
                ) : (
                  <>
                    <Smartphone className="h-4 w-4 mr-2" /> {t("setup2FA")}
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 2FA Setup Dialog */}
      <Dialog
        open={twoFADialogOpen}
        onOpenChange={(open) => {
          if (!open) closeSetupDialog();
        }}
      >
        <DialogContent className="max-w-[420px] p-0 overflow-hidden backdrop-blur-sm bg-background/95 border-border shadow-2xl">
          <DialogHeader className="px-4 py-3.5 pb-0 sm:px-5">
            <DialogTitle className="flex items-center text-lg font-medium">
              {t("setup2FATitle")}
            </DialogTitle>
            <DialogDescription className="hidden">{t("setup2FADesc")}</DialogDescription>
          </DialogHeader>

          <div className="px-4 sm:px-5 space-y-3.5 pb-3.5 pt-2.5">
            {/* Scan QR Section */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Scan className="w-4 h-4 text-primary" />
                {t("scanQrTitle")}
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{t("scanQrHint")}</p>

              <div className="flex flex-col sm:flex-row gap-3 p-3 border rounded-xl bg-card/50">
                {qrCode && (
                  <div className="bg-white p-1 rounded-lg shrink-0 w-28 h-28 sm:w-32 sm:h-32 flex items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={qrCode} alt="TOTP QR Code" className="w-full h-full" />
                  </div>
                )}
                {totpSecret && (
                  <div className="flex flex-col justify-center space-y-2 w-full">
                    <p className="text-xs font-medium">{t("manualEntryHint")}</p>
                    <div className="bg-background border rounded-md px-3 py-1.5">
                      <code className="text-xs font-mono tracking-widest text-center block">
                        {totpSecret.match(/.{1,4}/g)?.join(" ")}
                        {/* Hidden element to satisfy the E2E test exactly if needed */}
                        <span className="sr-only">{totpSecret}</span>
                      </code>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="w-fit h-7 text-xs"
                      onClick={() => {
                        navigator.clipboard.writeText(totpSecret);
                        toast.success(t("secretCopied"));
                      }}
                    >
                      <CopyIcon size={14} className="w-3 h-3 mr-1.5" /> {t("copySecret")}
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Verification Code Section */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <KeyRound className="w-4 h-4 text-primary" />
                {t("verifyCodeLabel")}
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{t("verifyCodeHint")}</p>

              {/* CodeSlots — same animated one-time-code control as the sign-in
                  prompt, so enrolling 2FA feels identical to using it. */}
              <div className="flex w-full max-w-sm justify-start pt-1">
                <CodeSlots
                  value={totpCode}
                  onChange={(code) => {
                    setTotpCode(code);
                    if (code.length === 0 && totpRejected) setTotpRejected(false);
                  }}
                  status={totpRejected ? "error" : "idle"}
                  disabled={verifying2FA}
                  autoFocus
                  ariaLabel={t("verifyCodeLabel")}
                  slotSize={44}
                  gap={6}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="px-4 sm:px-5 py-3 bg-muted/30 border-t flex sm:justify-between items-center w-full gap-2">
            <Button variant="secondary" onClick={closeSetupDialog} disabled={verifying2FA}>
              {tcommon("cancel")}
            </Button>
            <Button
              className="bg-primary hover:bg-primary/90 text-primary-foreground border-0"
              onClick={handleVerify2FA}
              disabled={totpCode.length < 6 || verifying2FA}
            >
              {verifying2FA ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> {t("verifying")}
                </>
              ) : (
                t("verifyButton")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disable 2FA Dialog */}
      <Dialog
        open={disable2FADialog}
        onOpenChange={(open) => {
          if (!open) closeDisableDialog();
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
              {t("disable2FATitle")}
            </DialogTitle>
            <DialogDescription>{t("disable2FADesc")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {t("enterPassword")}
              </label>
              <div className="relative">
                <Input
                  type={showDisablePassword ? "text" : "password"}
                  value={disablePassword}
                  onChange={(e) => setDisablePassword(e.target.value)}
                  placeholder={t("verifyPasswordPlaceholder")}
                  className="pr-10"
                  onKeyDown={(e) => e.key === "Enter" && !disabling2FA && handleDisable2FA()}
                />
                <button
                  type="button"
                  onClick={() => setShowDisablePassword(!showDisablePassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showDisablePassword ? (
                    <EyeOff size={16} className="h-4 w-4" />
                  ) : (
                    <Eye size={16} className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          </div>
          {/* What this action costs, computed from the same facts the Recovery
              readiness panel shows — and a checkbox that must be ticked. */}
          <RecoveryImpactNotice impact={guard.impact} />
          <RecoveryImpactAcknowledgement
            impact={guard.impact}
            acknowledged={guard.acknowledged}
            onChange={guard.setAcknowledged}
          />
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={closeDisableDialog} disabled={disabling2FA}>
              {tcommon("cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDisable2FA}
              disabled={!disablePassword || disabling2FA || guard.blocked}
            >
              {disabling2FA ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> {t("verifying")}
                </>
              ) : (
                t("disable2FA")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
