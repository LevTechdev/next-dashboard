"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, Loader2, Shield, ShieldOff, Smartphone } from "lucide-react";
import { ShieldCheckIcon, CheckCheckIcon, CopyIcon } from "lucide-animated";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { SecurityData } from "@/components/security/use-security-data";

export function TotpCard({ data }: { data: SecurityData }) {
  const t = useTranslations("security");
  const tcommon = useTranslations("common");

  const totpEnabled = data.totpEnabled === true;

  const [twoFADialogOpen, setTwoFADialogOpen] = useState(false);
  const [qrCode, setQrCode] = useState("");
  const [totpSecret, setTotpSecret] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [verifying2FA, setVerifying2FA] = useState(false);
  const [settingUp2FA, setSettingUp2FA] = useState(false);

  const [disable2FADialog, setDisable2FADialog] = useState(false);
  const [disablePassword, setDisablePassword] = useState("");
  const [disabling2FA, setDisabling2FA] = useState(false);

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
        throw new Error(err.error || t("enterValidCode"));
      }
      toast.success(t("twoFAEnabledToast"));
      closeSetupDialog();
      data.refresh();
    } catch (err: unknown) {
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

  return (
    <>
      <Card>
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
                else setDisable2FADialog(true);
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
              <Button variant="destructive" size="sm" onClick={() => setDisable2FADialog(true)}>
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-lime-600 dark:text-indigo-600" />
              {t("setup2FATitle")}
            </DialogTitle>
            <DialogDescription>{t("setup2FADesc")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {qrCode && (
              <div className="flex justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrCode}
                  alt="TOTP QR Code"
                  className="w-48 h-48 rounded-lg border-2 border-gray-200 dark:border-gray-700"
                />
              </div>
            )}
            {totpSecret && (
              <div className="space-y-2">
                <p className="text-xs text-gray-500 text-center">{t("manualEntry")}</p>
                <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 rounded-lg p-2 border">
                  <code className="flex-1 text-center text-sm font-mono tracking-wider">
                    {totpSecret.match(/.{1,4}/g)?.join(" ")}
                  </code>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(totpSecret);
                      toast.success(t("secretCopied"));
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <CopyIcon size={16} className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 text-center block">
                {t("verifyCodeLabel")}
              </label>
              <Input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                className="h-12 text-center text-xl tracking-[0.5em] font-mono"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={closeSetupDialog} disabled={verifying2FA}>
              {tcommon("cancel")}
            </Button>
            <Button onClick={handleVerify2FA} disabled={totpCode.length < 6 || verifying2FA}>
              {verifying2FA ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> {t("verifying")}
                </>
              ) : (
                t("enable2FA")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disable 2FA Dialog */}
      <Dialog
        open={disable2FADialog}
        onOpenChange={(open) => {
          if (!open) {
            setDisable2FADialog(false);
            setDisablePassword("");
          }
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
              <Input
                type="password"
                value={disablePassword}
                onChange={(e) => setDisablePassword(e.target.value)}
                placeholder={t("verifyPasswordPlaceholder")}
                onKeyDown={(e) => e.key === "Enter" && !disabling2FA && handleDisable2FA()}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setDisable2FADialog(false);
                setDisablePassword("");
              }}
              disabled={disabling2FA}
            >
              {tcommon("cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDisable2FA}
              disabled={!disablePassword || disabling2FA}
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
