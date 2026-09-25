"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Monitor, Trash2, LogOut } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useConfirm } from "@/components/ui/confirm-provider";
import { timeAgo, type SecurityData } from "@/components/security/use-security-data";

export function SessionsCard({ data }: { data: SecurityData }) {
  const t = useTranslations("security");
  const tcommon = useTranslations("common");
  const confirm = useConfirm();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [signingOutEverywhere, setSigningOutEverywhere] = useState(false);

  const revokeSession = async (id: string) => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/auth/sessions/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success(t("sessionRevoked"));
        data.refresh();
      } else {
        toast.error(tcommon("error"));
      }
    } finally {
      setBusyId(null);
    }
  };

  const revokeAllOthers = async () => {
    const ok = await confirm({
      title: t("revokeAllTitle"),
      description: t("revokeAllDesc"),
      confirmLabel: t("revokeAll"),
      icon: "key",
      destructive: true,
    });
    if (!ok) return;
    const res = await fetch("/api/auth/sessions", { method: "DELETE" });
    if (res.ok) {
      const d = await res.json();
      toast.success(t("revokedCount", { count: d.revoked ?? 0 }));
      data.refresh();
    } else {
      toast.error(tcommon("error"));
    }
  };

  const { sessions } = data;
  const others = sessions.filter((s) => !s.current);

  /**
   * Sign out EVERYWHERE — every session including this one, plus every
   * trusted device, so no 2FA skip survives. The server revokes first and
   * answers before the token is re-checked, so the response always lands;
   * the client then hard-navigates to /login.
   */
  const signOutEverywhere = async () => {
    const ok = await confirm({
      title: t("signOutEverywhereTitle"),
      description: t("signOutEverywhereDesc"),
      confirmLabel: t("signOutEverywhere"),
      icon: "key",
      destructive: true,
    });
    if (!ok) return;
    setSigningOutEverywhere(true);
    try {
      const res = await fetch("/api/auth/sessions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ everywhere: true }),
      });
      if (res.ok) {
        toast.success(t("signedOutEverywhere"));
        // Hard navigation, not router.push: a full sign-out must also drop
        // every cached client store, and there is no router to keep anyway.
        window.location.assign("/en/login");
      } else {
        toast.error(tcommon("error"));
      }
    } finally {
      setSigningOutEverywhere(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Monitor className="h-4 w-4" />
          {t("activeSessions")}
          {sessions.length > 0 && (
            <Badge className="ml-auto bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
              {sessions.length}
            </Badge>
          )}
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
                <div className="text-sm font-medium flex items-center gap-2 flex-wrap">
                  <span>
                    {s.browser || "Unknown"} · {s.device || "Unknown"}
                  </span>
                  {s.current && (
                    <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                      {t("thisDevice")}
                    </Badge>
                  )}
                  {/* Device-policy badges: trusted = 30-day 2FA skip cookie;
                      a live stay grant = the long session window. Revoking
                      the session kills both (the family dies with it). */}
                  {s.trusted && (
                    <Badge className="bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400">
                      {t("sessionTrustedDevice")}
                    </Badge>
                  )}
                  {s.stayLoginUntil && (
                    <Badge className="bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">
                      {t("sessionStayGranted")}
                    </Badge>
                  )}
                  {typeof s.recognized === "boolean" && !s.current && (
                    <Badge
                      className={
                        s.recognized
                          ? "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                          : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                      }
                    >
                      {s.recognized ? t("sessionRecognized") : t("sessionNew")}
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
        {others.length > 0 && (
          <Button variant="destructive" size="sm" onClick={revokeAllOthers} className="mt-2">
            <Trash2 className="h-4 w-4 mr-1" />
            {t("revokeAll")}
          </Button>
        )}
        {sessions.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={signOutEverywhere}
            disabled={signingOutEverywhere}
            className="mt-2 border-zinc-300 dark:border-zinc-700"
          >
            <LogOut className="h-4 w-4 mr-1" />
            {t("signOutEverywhere")}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
