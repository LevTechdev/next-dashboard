"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, Eye, EyeOff, KeyRound, Loader2, Smartphone } from "lucide-react";
import { CheckIcon, FingerprintIcon } from "lucide-animated";
import { startRegistration } from "@simplewebauthn/browser";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CodeSlots } from "@/components/ui/code-slots";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/sora-ui/base/alert-dialog";
import { timeAgo, type SecurityData } from "@/components/security/use-security-data";

export function PasskeysCard({ data }: { data: SecurityData }) {
  const t = useTranslations("security");
  const tcommon = useTranslations("common");

  const [addingPasskey, setAddingPasskey] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<{
    id: string;
    deviceName: string | null;
  } | null>(null);
  const [verifyPassword, setVerifyPassword] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [showVerifyPassword, setShowVerifyPassword] = useState(false);
  // 30-day MFA freshness gate: when the step-up endpoint answers 428, the
  // dialog flips from password to authenticator-code verification — the same
  // second factor the freshness policy demands.
  const [totpMode, setTotpMode] = useState(false);
  // CodeSlots error treatment after a rejected step-up code.
  const [totpRejected, setTotpRejected] = useState(false);
  const [totpCode, setTotpCode] = useState("");

  const addPasskey = async () => {
    setAddingPasskey(true);
    try {
      // WebAuthn only exists in a secure context (HTTPS or localhost) — without
      // this guard the failure below is a cryptic NotSupportedError.
      if (
        typeof window === "undefined" ||
        !window.isSecureContext ||
        !navigator.credentials?.create
      ) {
        toast.error(t("passkeyUnsupported"));
        return;
      }
      const optRes = await fetch("/api/auth/webauthn/register/options", { method: "POST" });
      const options = await optRes.json().catch(() => null);
      if (!optRes.ok || !options) {
        throw new Error(options?.error || t("passkeyFailed"));
      }
      const att = await startRegistration({ optionsJSON: options });
      const label =
        typeof navigator !== "undefined" && navigator.platform ? navigator.platform : "Passkey";
      const verifyRes = await fetch("/api/auth/webauthn/register/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // The route destructures `{ credential, deviceName }`. Posting the
        // attestation at the top level left `credential` undefined, so
        // verifyRegistrationResponse threw and EVERY passkey registration
        // failed as "Passkey verification failed".
        body: JSON.stringify({ credential: att, deviceName: label }),
      });
      if (!verifyRes.ok) {
        const err = await verifyRes.json().catch(() => ({}));
        // The same authenticator re-registered on the same RP is a 409 the
        // server flags with a code, so the copy is localizable instead of
        // leaking the server's English string.
        if (err.code === "PASSKEY_DUPLICATE") throw new Error(t("passkeyDuplicate"));
        throw new Error(err.error || t("passkeyFailed"));
      }
      toast.success(t("passkeyRegistered"));
      data.refresh();
    } catch (err: any) {
      // The user dismissed the browser's passkey prompt — that is not a failure.
      if (err instanceof DOMException && err.name === "NotAllowedError") return;
      toast.error(err?.message || t("passkeyFailed"));
    } finally {
      setAddingPasskey(false);
    }
  };

  const removePasskey = async () => {
    if (!revokeTarget) return;
    if (!totpMode && !verifyPassword) {
      toast.error(t("verifyPasswordRequired"));
      return;
    }
    if (totpMode && totpCode.length < 6) {
      toast.error(t("totpRequired"));
      return;
    }
    setVerifying(true);
    try {
      // Step-up: re-authenticate before this sensitive action. The challenge
      // depends on the freshness gate: password normally, TOTP when the 30-day
      // MFA re-verification is due (the endpoint answers 428 and we flip).
      const stepUp = await fetch("/api/auth/step-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          totpMode
            ? { purpose: "manage_2fa", totpToken: totpCode }
            : { purpose: "manage_2fa", password: verifyPassword },
        ),
      });
      if (!stepUp.ok) {
        if (stepUp.status === 428 && !totpMode) {
          // Freshness gate: switch the dialog to TOTP and let the user retry.
          setTotpMode(true);
          setVerifying(false);
          return;
        }
        if (totpMode) setTotpRejected(true);
        toast.error(t("verificationFailed"));
        return;
      }
      const res = await fetch("/api/auth/webauthn/credentials", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: revokeTarget.id }),
      });
      if (res.ok) {
        toast.success(t("passkeyRemoved"));
        setRevokeTarget(null);
        setVerifyPassword("");
        setTotpMode(false);
        setTotpCode("");
        data.refresh();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || tcommon("error"));
      }
    } finally {
      setVerifying(false);
    }
  };

  const { passkeys } = data;
  const isLastPasskey = passkeys.length === 1;

  function confirmRemovePasskey(id: string, deviceName: string | null) {
    setRevokeTarget({ id, deviceName });
    setVerifyPassword("");
    setTotpMode(false);
    setTotpCode("");
    setTotpRejected(false);
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FingerprintIcon size={16} className="h-4 w-4" />
            {t("passkeys")}
            {passkeys.length > 0 && (
              <span className="ml-auto text-xs font-medium text-lime-600 dark:text-green-400">
                {passkeys.length}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-gray-500">{t("passkeysDesc")}</p>
          {passkeys.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-3 p-3 rounded-lg border border-lime-200 dark:border-green-800/60 bg-lime-50/40 dark:bg-green-900/10"
            >
              <div className="w-9 h-9 rounded-lg bg-lime-100 dark:bg-green-900/30 flex items-center justify-center shrink-0">
                <FingerprintIcon size={16} className="h-4 w-4 text-lime-600 dark:text-green-400" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium">{p.deviceName || "Passkey"}</p>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-lime-100 dark:bg-green-900/40 text-lime-700 dark:text-green-300 text-[11px] font-semibold">
                    <CheckIcon size={12} className="h-3 w-3" />
                    {t("verified")}
                  </span>
                </div>
                <p className="text-xs text-gray-500">
                  {t("added")} {new Date(p.createdAt).toLocaleDateString()}
                  {p.lastUsedAt ? ` · ${t("lastUsed")} ${timeAgo(p.lastUsedAt)}` : ""}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => confirmRemovePasskey(p.id, p.deviceName)}
              >
                {t("revoke")}
              </Button>
            </div>
          ))}
          {isLastPasskey && (
            <p className="flex items-start gap-2 rounded-lg border border-amber-200 dark:border-amber-800/60 bg-amber-50/60 dark:bg-amber-900/10 px-3 py-2 text-[11px] text-amber-700 dark:text-amber-300">
              <AlertTriangle size={13} className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              {t("passkeyBackupHint")}
            </p>
          )}
          <Button
            variant={passkeys.length > 0 ? "outline" : "outline"}
            size="sm"
            onClick={addPasskey}
            disabled={addingPasskey || passkeys.length > 0}
            className={cn("mt-1", passkeys.length > 0 && "opacity-60 cursor-not-allowed")}
          >
            {passkeys.length > 0 ? (
              <>
                <CheckIcon size={16} className="h-4 w-4 mr-1 text-lime-600 dark:text-green-400" />
                {t("passkeyRegistered")}
              </>
            ) : (
              <>
                <FingerprintIcon size={16} className="h-4 w-4 mr-1" />
                {addingPasskey ? tcommon("loading") : t("addPasskey")}
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Passkey revoke — Sora alert-dialog with re-auth verification.
          When the 30-day MFA freshness gate demands it (428), the challenge
          switches from password to authenticator code. */}
      <AlertDialog open={!!revokeTarget} onOpenChange={(open) => !open && setRevokeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-red-500/10 text-red-600 dark:text-red-400">
              <KeyRound className="size-5" />
            </AlertDialogMedia>
            <AlertDialogTitle>{t("passkeyVerifyTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("passkeyVerifyDesc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4">
            {isLastPasskey && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 dark:border-amber-800/60 bg-amber-50/60 dark:bg-amber-900/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                <AlertTriangle size={14} className="h-4 w-4 mt-0.5 shrink-0" />
                {t("lastPasskeyWarning")}
              </div>
            )}
            {revokeTarget?.deviceName && (
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {revokeTarget.deviceName}
              </p>
            )}
            {totpMode ? (
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t("totpLabel")}
                </label>
                {/* CodeSlots — the shared animated one-time-code control. */}
                <div className="flex justify-center">
                  <CodeSlots
                    value={totpCode}
                    onChange={(code) => {
                      setTotpCode(code);
                      if (code.length === 0 && totpRejected) setTotpRejected(false);
                    }}
                    status={totpRejected ? "error" : "idle"}
                    disabled={verifying}
                    autoFocus
                    ariaLabel={t("totpLabel")}
                    placeholder="123456"
                    slotSize={44}
                    gap={6}
                  />
                </div>
                <p className="text-xs text-muted-foreground">{t("totpFreshnessHint")}</p>
              </div>
            ) : (
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t("verifyPasswordLabel")}
                </label>
                <div className="relative">
                  <Input
                    type={showVerifyPassword ? "text" : "password"}
                    value={verifyPassword}
                    onChange={(e) => setVerifyPassword(e.target.value)}
                    placeholder={t("verifyPasswordPlaceholder")}
                    className="pr-10"
                    autoFocus
                    onKeyDown={(e) => e.key === "Enter" && !verifying && removePasskey()}
                  />
                  <button
                    type="button"
                    onClick={() => setShowVerifyPassword(!showVerifyPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    tabIndex={-1}
                  >
                    {showVerifyPassword ? (
                      <EyeOff size={16} className="h-4 w-4" />
                    ) : (
                      <Eye size={16} className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setRevokeTarget(null);
                setVerifyPassword("");
                setTotpMode(false);
                setTotpCode("");
              }}
              disabled={verifying}
            >
              {tcommon("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={removePasskey}
              disabled={verifying || (totpMode ? totpCode.length < 6 : !verifyPassword)}
            >
              {verifying ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> {t("verifying")}
                </>
              ) : totpMode ? (
                <>
                  <Smartphone className="h-4 w-4 mr-2" /> {t("totpConfirm")}
                </>
              ) : (
                t("verifyConfirm")
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
