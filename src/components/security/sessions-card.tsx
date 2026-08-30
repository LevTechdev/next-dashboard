"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Monitor, Trash2 } from "lucide-react";
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
        {others.length > 0 && (
          <Button variant="destructive" size="sm" onClick={revokeAllOthers} className="mt-2">
            <Trash2 className="h-4 w-4 mr-1" />
            {t("revokeAll")}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
