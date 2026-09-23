"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Loader2,
  Smartphone,
  TabletSmartphone,
  Trash2,
  KeyRound,
  Copy,
  CheckCheck,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { timeAgo, type SecurityData } from "@/components/security/use-security-data";

/**
 * The spare authenticator.
 *
 * A second authenticator app enrolled on a different device, accepted at the
 * same TOTP step as the primary one. Losing the primary phone then never
 * escalates to an emailed account recovery — which would turn 2FA off entirely
 * and sign every device out. The card only offers enrollment while 2FA is on,
 * because a spare for a factor the account does not have guards nothing.
 *
 * Enrollment state comes from `data.backupAuthenticator` (the shared security
 * hook) rather than its own fetch, so this card and the Recovery readiness
 * panel can never disagree about whether a spare exists.
 */
export function BackupAuthenticatorCard({ data }: { data: SecurityData }) {
  const t = useTranslations("security");
  const tcommon = useTranslations("common");

  const totpEnabled = data.totpEnabled === true;
  const state = data.backupAuthenticator;

  const [setupOpen, setSetupOpen] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [label, setLabel] = useState("");
  const [code, setCode] = useState("");
  const [secretCopied, setSecretCopied] = useState(false);

  // Deleting the spare is only dangerous when it is the last path back in, so
  // the acknowledgement gate appears exactly then (see recoveryImpactOf).
  const guard = useRecoveryImpact(data, confirmRemove ? "removeSpare" : null);

  const openRemoveDialog = () => {
    guard.setAcknowledged(false);
    setConfirmRemove(true);
  };
  const closeRemoveDialog = () => {
    setConfirmRemove(false);
    guard.setAcknowledged(false);
  };

  const openSetup = async () => {
    setPreparing(true);
    try {
      const res = await fetch("/api/auth/totp/backup?offer=1");
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || tcommon("error"));
      }
      const d = await res.json();
      setQrCode(d.qrCode || "");
      setSecret(d.secret || "");
      setCode("");
      setSecretCopied(false);
      setSetupOpen(true);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : tcommon("error"));
    } finally {
      setPreparing(false);
    }
  };

  // Answer the Recovery readiness panel's "Add spare device" action.
  useRecoveryAction("backup-authenticator-card", () => {
    if (!state?.enrolled) void openSetup();
  });

  const closeSetup = () => {
    setSetupOpen(false);
    setQrCode("");
    setSecret("");
    setCode("");
    setLabel("");
  };

  const confirm = async () => {
    if (code.trim().length < 6) {
      toast.error(t("enterValidCode"));
      return;
    }
    setVerifying(true);
    try {
      const res = await fetch("/api/auth/totp/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret, token: code.trim(), label }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || t("enterValidCode"));
      }
      toast.success(t("backupAuthenticatorAdded"));
      closeSetup();
      // Re-reads the shared status, so the readiness panel updates too.
      await data.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : tcommon("error"));
    } finally {
      setVerifying(false);
    }
  };

  const remove = async () => {
    setRemoving(true);
    try {
      // `acknowledge=1` carries the checkbox the user had to tick to enable
      // this button — the server refuses the removal without it when it would
      // leave the account with no way back in.
      const res = await fetch(
        `/api/auth/totp/backup?acknowledge=${guard.acknowledged ? "1" : "0"}`,
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error(tcommon("error"));
      closeRemoveDialog();
      toast.success(t("backupAuthenticatorRemoved"));
      await data.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : tcommon("error"));
    } finally {
      setRemoving(false);
    }
  };

  const copySecret = async () => {
    try {
      await navigator.clipboard.writeText(secret);
      setSecretCopied(true);
      toast.success(t("secretCopied"));
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <>
      <Card data-testid="backup-authenticator-card" id="backup-authenticator-card">
        <CardHeader>
          <div className="flex items-center gap-2">
            {state?.enrolled ? (
              <TabletSmartphone className="h-5 w-5" />
            ) : (
              <Smartphone className="h-5 w-5" />
            )}
            <CardTitle>{t("backupAuthenticator")}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">{t("backupAuthenticatorDesc")}</p>

          {!totpEnabled ? (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border">
              <KeyRound className="h-5 w-5 text-muted-foreground shrink-0" />
              <p className="text-sm text-muted-foreground">{t("backupAuthenticatorNeedsTotp")}</p>
            </div>
          ) : state?.enrolled ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-lime-50 dark:bg-green-900/10 border border-lime-200 dark:border-green-800">
                <CheckCheck className="h-5 w-5 text-lime-600 dark:text-green-600 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-lime-800 dark:text-green-300">
                    {state.label || t("backupAuthenticatorDefaultLabel")}
                  </p>
                  <p className="text-xs text-lime-700/80 dark:text-green-300/80">
                    {state.lastUsedAt
                      ? t("backupAuthenticatorLastUsed", { time: timeAgo(state.lastUsedAt) })
                      : t("backupAuthenticatorNeverUsed")}
                  </p>
                </div>
              </div>
              <Button variant="destructive" size="sm" onClick={openRemoveDialog}>
                <Trash2 className="h-4 w-4 mr-2" />
                {t("removeBackupAuthenticator")}
              </Button>
            </div>
          ) : (
            <Button variant="outline" onClick={openSetup} disabled={preparing}>
              {preparing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> {t("preparing")}
                </>
              ) : (
                <>
                  <TabletSmartphone className="h-4 w-4 mr-2" /> {t("addBackupAuthenticator")}
                </>
              )}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Spare-device enrollment */}
      <Dialog open={setupOpen} onOpenChange={(open) => !open && closeSetup()}>
        <DialogContent className="max-w-[420px]">
          <DialogHeader>
            <DialogTitle>{t("addBackupAuthenticator")}</DialogTitle>
            <DialogDescription>{t("backupAuthenticatorSetupDesc")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {qrCode && (
              <div className="mx-auto w-[180px] h-[180px] bg-white p-2 rounded-lg border border-border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrCode} alt={t("scanQrTitle")} className="w-full h-full" />
              </div>
            )}
            <div className="flex items-center gap-2">
              <code className="flex-1 text-[11px] font-mono truncate px-2 py-1.5 rounded bg-muted">
                {secret}
              </code>
              <Button type="button" variant="ghost" size="sm" onClick={copySecret}>
                {secretCopied ? <CheckCheck className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                <span className="sr-only">{t("copySecret")}</span>
              </Button>
            </div>
            <div className="space-y-2">
              <label htmlFor="backup-auth-label" className="text-xs font-medium">
                {t("backupAuthenticatorLabel")}
              </label>
              <Input
                id="backup-auth-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder={t("backupAuthenticatorLabelPlaceholder")}
                maxLength={60}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="backup-auth-code" className="text-xs font-medium">
                {t("verifyCodeLabel")}
              </label>
              <Input
                id="backup-auth-code"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder={t("manualEntry")}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={closeSetup} disabled={verifying}>
              {tcommon("cancel")}
            </Button>
            <Button onClick={confirm} disabled={verifying}>
              {verifying ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {t("verifyButton")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Removal confirmation */}
      <Dialog
        open={confirmRemove}
        onOpenChange={(open) => (open ? setConfirmRemove(true) : closeRemoveDialog())}
      >
        <DialogContent className="max-w-[400px]">
          <DialogHeader>
            <DialogTitle>{t("removeBackupAuthenticator")}</DialogTitle>
            <DialogDescription>{t("removeBackupAuthenticatorDesc")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <RecoveryImpactNotice impact={guard.impact} />
            <RecoveryImpactAcknowledgement
              impact={guard.impact}
              acknowledged={guard.acknowledged}
              onChange={guard.setAcknowledged}
            />
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={closeRemoveDialog} disabled={removing}>
              {tcommon("cancel")}
            </Button>
            <Button variant="destructive" onClick={remove} disabled={removing || guard.blocked}>
              {removing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {t("removeBackupAuthenticator")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
