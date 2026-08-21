"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { KeyRound } from "lucide-react";
import { CopyIcon, CheckIcon, DownloadIcon, RefreshCwIcon } from "lucide-animated";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useConfirm } from "@/components/ui/confirm-provider";
import type { SecurityData } from "@/components/security/use-security-data";

export function BackupCodesCard({ data }: { data: SecurityData }) {
  const t = useTranslations("security");
  const tcommon = useTranslations("common");
  const confirm = useConfirm();

  const [newCodes, setNewCodes] = useState<string[] | null>(null);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const generateCodes = async () => {
    if (data.backupRemaining && data.backupRemaining > 0) {
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
      data.refresh();
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

  const { backupRemaining } = data;

  return (
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
  );
}
