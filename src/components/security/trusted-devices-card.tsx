"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ShieldCheck, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useConfirm } from "@/components/ui/confirm-provider";
import { timeAgo, type SecurityData } from "@/components/security/use-security-data";

/**
 * Trusted devices — the 30-day "skip 2FA on this device" grants. Each row
 * shows the device profile the trust is bound to (a stolen cookie is useless
 * on any other machine) and when it expires; revoke restores the second
 * factor immediately.
 */
export function TrustedDevicesCard({ data }: { data: SecurityData }) {
  const t = useTranslations("security");
  const tcommon = useTranslations("common");
  const confirm = useConfirm();
  const [busyId, setBusyId] = useState<string | null>(null);
  // Captured once per mount: Date.now() is impure and may not run during
  // render (react-hooks/purity). Day-granularity expiry labels don't need a
  // ticking clock.
  const [now] = useState(() => Date.now());

  const { trustedDevices } = data;

  const revoke = async (id: string) => {
    setBusyId(id);
    try {
      const res = await fetch("/api/auth/trusted-devices", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        toast.success(t("trustedDeviceRevoked"));
        data.refresh();
      } else {
        toast.error(tcommon("error"));
      }
    } finally {
      setBusyId(null);
    }
  };

  const revokeAll = async () => {
    const ok = await confirm({
      title: t("trustedRevokeAllTitle"),
      description: t("trustedRevokeAllDesc"),
      confirmLabel: t("trustedRevokeAll"),
      icon: "key",
      destructive: true,
    });
    if (!ok) return;
    const res = await fetch("/api/auth/trusted-devices", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
    if (res.ok) {
      const d = await res.json();
      toast.success(t("trustedRevokedCount", { count: d.revoked ?? 0 }));
      data.refresh();
    } else {
      toast.error(tcommon("error"));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldCheck className="h-4 w-4" />
          {t("trustedDevicesTitle")}
          {trustedDevices.length > 0 && (
            <Badge className="ml-auto bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
              {trustedDevices.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {trustedDevices.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("trustedDevicesEmpty")}</p>
        ) : (
          <>
            {trustedDevices.map((d) => {
              const expiresDays = Math.max(
                0,
                Math.ceil((new Date(d.expiresAt).getTime() - now) / 86_400_000),
              );
              return (
                <div
                  key={d.id}
                  className="flex items-center gap-3 rounded-lg border border-zinc-200 dark:border-zinc-700 p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {d.label ?? `${d.device} · ${d.browser}`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t("trustedDeviceMeta", {
                        lastUsed: timeAgo(d.lastUsedAt),
                        days: expiresDays,
                      })}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busyId === d.id}
                    aria-label={t("trustedDeviceRevokeLabel", { device: d.label ?? d.device })}
                    onClick={() => void revoke(d.id)}
                    className="text-destructive hover:text-destructive shrink-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
            <Button
              variant="outline"
              size="sm"
              className="w-full text-destructive hover:text-destructive"
              onClick={() => void revokeAll()}
            >
              {t("trustedRevokeAll")}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
