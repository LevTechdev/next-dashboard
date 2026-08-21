"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { CheckIcon, FingerprintIcon } from "lucide-animated";
import { startRegistration } from "@simplewebauthn/browser";
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

  const addPasskey = async () => {
    setAddingPasskey(true);
    try {
      const optRes = await fetch("/api/auth/webauthn/register/options", { method: "POST" });
      if (!optRes.ok) throw new Error("options");
      const options = await optRes.json();
      const att = await startRegistration({ optionsJSON: options });
      const label =
        typeof navigator !== "undefined" && navigator.platform ? navigator.platform : "Passkey";
      const verifyRes = await fetch("/api/auth/webauthn/register/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential: att, deviceName: label }),
      });
      if (!verifyRes.ok) throw new Error("verify");
      toast.success(t("passkeyAdded"));
      data.refresh();
    } catch {
      toast.error(t("passkeyFailed"));
    } finally {
      setAddingPasskey(false);
    }
  };

  const confirmRemovePasskey = (id: string, deviceName: string | null) => {
    setVerifyPassword("");
    setRevokeTarget({ id, deviceName });
  };

  const removePasskey = async () => {
    if (!revokeTarget) return;
    if (!verifyPassword) {
      toast.error(t("verifyPasswordRequired"));
      return;
    }
    setVerifying(true);
    try {
      // Step-up: re-authenticate before this sensitive action (password or TOTP).
      const stepUp = await fetch("/api/auth/step-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purpose: "manage_2fa", password: verifyPassword }),
      });
      if (!stepUp.ok) {
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
            variant="outline"
            size="sm"
            onClick={addPasskey}
            disabled={addingPasskey}
            className="mt-1"
          >
            <FingerprintIcon size={16} className="h-4 w-4 mr-1" />
            {addingPasskey ? tcommon("loading") : t("addPasskey")}
          </Button>
        </CardContent>
      </Card>

      {/* Passkey revoke — re-auth verification modal */}
      <Dialog open={!!revokeTarget} onOpenChange={(open) => !open && setRevokeTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <Trash2 className="h-5 w-5" />
              {t("passkeyVerifyTitle")}
            </DialogTitle>
            <DialogDescription>{t("passkeyVerifyDesc")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
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
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {t("verifyPasswordLabel")}
              </label>
              <Input
                type="password"
                value={verifyPassword}
                onChange={(e) => setVerifyPassword(e.target.value)}
                placeholder={t("verifyPasswordPlaceholder")}
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && !verifying && removePasskey()}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setRevokeTarget(null);
                setVerifyPassword("");
              }}
              disabled={verifying}
            >
              {tcommon("cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={removePasskey}
              disabled={!verifyPassword || verifying}
            >
              {verifying ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> {t("verifying")}
                </>
              ) : (
                t("verifyConfirm")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
