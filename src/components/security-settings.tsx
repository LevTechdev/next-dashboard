"use client";

import { useCallback, useEffect, useState, type ComponentType } from "react";
import { useTranslations } from "next-intl";
import { Monitor, KeyRound, Trash2, LogIn, LogOut, ShieldAlert } from "lucide-react";
import {
  ShieldCheckIcon,
  DownloadIcon,
  CopyIcon,
  CheckIcon,
  ClockIcon,
  RefreshCwIcon,
  FingerprintIcon,
} from "lucide-animated";

import { startRegistration } from "@simplewebauthn/browser";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/components/ui/confirm-provider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface SessionRow {
  id: string;
  ip: string | null;
  browser: string | null;
  device: string | null;
  location: string | null;
  lastActiveAt: string;
  createdAt: string;
  current: boolean;
}

interface SecurityEventRow {
  id: string;
  type: string;
  ip: string | null;
  createdAt: string;
}

function timeAgo(date: string): string {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

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
  SESSION_REVOKED: Monitor,
  SESSIONS_REVOKED_ALL: Monitor,
  STEP_UP_VERIFIED: ShieldCheckIcon,
};

export function SecuritySettings() {
  const t = useTranslations("security");
  const tcommon = useTranslations("common");
  const confirm = useConfirm();

  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [events, setEvents] = useState<SecurityEventRow[]>([]);
  const [backupRemaining, setBackupRemaining] = useState<number | null>(null);
  const [passkeys, setPasskeys] = useState<
    { id: string; deviceName: string | null; createdAt: string; lastUsedAt: string | null }[]
  >([]);
  const [addingPasskey, setAddingPasskey] = useState(false);
  const [newCodes, setNewCodes] = useState<string[] | null>(null);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  // Passkey revoke re-auth modal
  const [revokeTarget, setRevokeTarget] = useState<{
    id: string;
    deviceName: string | null;
  } | null>(null);
  const [verifyPassword, setVerifyPassword] = useState("");
  const [verifying, setVerifying] = useState(false);

  const loadAll = useCallback(() => {
    fetch("/api/auth/sessions")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setSessions(Array.isArray(d) ? d : []))
      .catch(() => setSessions([]));
    fetch("/api/auth/security-events")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setEvents(Array.isArray(d) ? d : []))
      .catch(() => setEvents([]));
    fetch("/api/auth/backup-codes")
      .then((r) => (r.ok ? r.json() : { remaining: 0 }))
      .then((d) => setBackupRemaining(d.remaining ?? 0))
      .catch(() => setBackupRemaining(0));
    fetch("/api/auth/webauthn/credentials")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setPasskeys(Array.isArray(d) ? d : []))
      .catch(() => setPasskeys([]));
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const revokeSession = async (id: string) => {
    setBusyId(id);
    const res = await fetch(`/api/auth/sessions/${id}`, { method: "DELETE" });
    setBusyId(null);
    if (res.ok) {
      toast.success(t("sessionRevoked"));
      loadAll();
    } else {
      toast.error(tcommon("error"));
    }
  };

  const revokeAllOthers = async () => {
    const ok = await confirm({
      title: t("revokeAllTitle"),
      description: t("revokeAllDesc"),
      confirmLabel: t("revokeAll"),
      destructive: true,
    });
    if (!ok) return;
    const res = await fetch("/api/auth/sessions", { method: "DELETE" });
    if (res.ok) {
      const d = await res.json();
      toast.success(t("revokedCount", { count: d.revoked ?? 0 }));
      loadAll();
    } else {
      toast.error(tcommon("error"));
    }
  };

  const generateCodes = async () => {
    if (backupRemaining && backupRemaining > 0) {
      const ok = await confirm({
        title: t("regenerateTitle"),
        description: t("regenerateDesc"),
        confirmLabel: t("generate"),
        destructive: true,
      });
      if (!ok) return;
    }
    setGenerating(true);
    const res = await fetch("/api/auth/backup-codes", { method: "POST" });
    setGenerating(false);
    if (res.ok) {
      const d = await res.json();
      setNewCodes(d.codes || []);
      setBackupRemaining((d.codes || []).length);
      loadAll();
    } else {
      toast.error(tcommon("error"));
    }
  };

  const copyCodes = () => {
    if (!newCodes) return;
    navigator.clipboard.writeText(newCodes.join("\n"));
    setCopied(true);
    toast.success(t("codesCopied"));
    setTimeout(() => setCopied(false), 1500);
  };

  const downloadCodes = () => {
    if (!newCodes) return;
    const blob = new Blob([newCodes.join("\n") + "\n"], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "backup-codes.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

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
      loadAll();
    } catch {
      toast.error(t("passkeyFailed"));
    } finally {
      setAddingPasskey(false);
    }
  };

  const confirmRemovePasskey = async (id: string, deviceName: string | null) => {
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
        loadAll();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || tcommon("error"));
      }
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Active Sessions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Monitor className="h-4 w-4" />
            {t("activeSessions")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {sessions.length === 0 ? (
            <p className="text-sm text-gray-500">{tcommon("noData")}</p>
          ) : (
            sessions.map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-800"
              >
                <div className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0">
                  <Monitor className="h-4 w-4 text-gray-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium flex items-center gap-2">
                    {s.browser || "Unknown"} · {s.device || "Unknown"}
                    {s.current && (
                      <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                        {t("thisDevice")}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">
                    {s.ip || "—"}
                    {s.location ? ` · ${s.location}` : ""} · {t("active")} {timeAgo(s.lastActiveAt)}
                  </p>
                </div>
                {!s.current && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => revokeSession(s.id)}
                    disabled={busyId === s.id}
                  >
                    {t("revoke")}
                  </Button>
                )}
              </div>
            ))
          )}
          {sessions.filter((s) => !s.current).length > 0 && (
            <Button variant="destructive" size="sm" onClick={revokeAllOthers} className="mt-2">
              <Trash2 className="h-4 w-4 mr-1" />
              {t("revokeAll")}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Passkeys (WebAuthn / FIDO2) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FingerprintIcon size={16} className="h-4 w-4" />
            {t("passkeys")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-gray-500">{t("passkeysDesc")}</p>
          {passkeys.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-3 p-3 rounded-lg border border-green-200 dark:border-green-800/60 bg-green-50/40 dark:bg-green-900/10"
            >
              <div className="w-9 h-9 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0">
                <FingerprintIcon size={16} className="h-4 w-4 text-green-600 dark:text-green-400" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium">{p.deviceName || "Passkey"}</p>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 text-[11px] font-semibold">
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

      {/* Backup Codes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <KeyRound className="h-4 w-4" />
            {t("backupCodes")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {newCodes ? (
            <div className="space-y-3">
              <p className="text-sm text-amber-600 dark:text-amber-400">{t("saveCodesWarning")}</p>
              <div className="grid grid-cols-2 gap-2 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 font-mono text-sm">
                {newCodes.map((c) => (
                  <span key={c}>{c}</span>
                ))}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={downloadCodes}>
                  <DownloadIcon size={16} className="h-4 w-4 mr-1" />
                  {t("download")}
                </Button>
                <Button variant="outline" size="sm" onClick={copyCodes}>
                  {copied ? (
                    <CheckIcon size={16} className="h-4 w-4 mr-1 text-emerald-500" />
                  ) : (
                    <CopyIcon size={16} className="h-4 w-4 mr-1" />
                  )}
                  {tcommon("copy")}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setNewCodes(null)}>
                  {tcommon("done")}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-gray-500">
                {backupRemaining === null ? "…" : t("codesRemaining", { count: backupRemaining })}
              </p>
              <Button variant="outline" size="sm" onClick={generateCodes} disabled={generating}>
                <RefreshCwIcon size={16} className="h-4 w-4 mr-1" />
                {backupRemaining && backupRemaining > 0 ? t("regenerate") : t("generate")}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Security Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ClockIcon size={16} className="h-4 w-4" />
            {t("securityActivity")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {events.length === 0 ? (
            <p className="text-sm text-gray-500">{tcommon("noData")}</p>
          ) : (
            events.map((e) => {
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
            })
          )}
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
    </div>
  );
}
