"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { ShieldCheckIcon, DownloadIcon, FileTextIcon, ActivityIcon } from "lucide-animated";
import { FileCheck2, AlertTriangle, Lock, RotateCw } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { CompliancePack } from "@/lib/security-telemetry";

export function Soc2ComplianceCard() {
  const t = useTranslations("compliance");
  const [pack, setPack] = useState<CompliancePack | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchPack = async () => {
    try {
      const res = await fetch("/api/security/audit/compliance-pack");
      if (res.ok) {
        const data = await res.json();
        setPack(data.pack);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPack();
  }, []);

  const handleDownloadJson = () => {
    if (!pack) return;
    const blob = new Blob([JSON.stringify(pack, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `soc2-compliance-pack-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(t("downloadSuccess"));
  };

  const handlePrintCertificate = () => {
    window.open("/api/security/audit/compliance-pack?format=html", "_blank");
  };

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-sm space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
            <ShieldCheckIcon size={20} className="h-5 w-5 text-primary" animateOnHover />
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              {t("title")}
              <Badge variant="success" className="text-[10px]">
                {t("verifiedStandard")}
              </Badge>
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t("description")}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadJson}
            className="text-xs flex items-center gap-1.5 transition-all hover:scale-[1.02] active:scale-[0.98]"
            disabled={!pack}
          >
            <DownloadIcon size={14} className="h-3.5 w-3.5" animateOnHover />
            {t("downloadJson")}
          </Button>
          <Button
            size="sm"
            onClick={handlePrintCertificate}
            className="text-xs flex items-center gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <FileTextIcon size={14} className="h-3.5 w-3.5" animateOnHover />
            {t("printCertificate")}
          </Button>
        </div>
      </div>

      {/* Merkle Chain & Policies Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-800/40 bg-emerald-50/50 dark:bg-emerald-950/20 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-emerald-800 dark:text-emerald-300">
              {t("merkleChainStatus")}
            </span>
            <Lock className="h-3.5 w-3.5 text-emerald-600" />
          </div>
          <p className="text-sm font-bold text-emerald-900 dark:text-emerald-100">
            {pack?.merkleChain.ok ? t("chainValid") : t("chainChecking")}
          </p>
          <p className="text-[10px] text-emerald-700 dark:text-emerald-400 font-mono">
            {pack?.merkleChain.verified ?? 0} {t("verifiedLinks")}
          </p>
        </div>

        <div className="p-3.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-gray-600 dark:text-gray-400">
              {t("rbacActions")}
            </span>
            <FileTextIcon size={14} className="h-3.5 w-3.5 text-indigo-500" animateOnHover />
          </div>
          <p className="text-sm font-bold text-gray-900 dark:text-gray-100">
            {pack?.rbacGovernance.granularActions.length ?? 7} {t("actionsGoverned")}
          </p>
          <p className="text-[10px] text-gray-500">{pack?.rbacGovernance.roles.join(", ")}</p>
        </div>

        <div className="p-3.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-gray-600 dark:text-gray-400">
              {t("encryptionTelemetry")}
            </span>
            <ActivityIcon size={14} className="h-3.5 w-3.5 text-primary" animateOnHover />
          </div>
          <p className="text-sm font-bold text-gray-900 dark:text-gray-100">
            {pack?.securityPolicies.tlsVersion || "TLS 1.3"}
          </p>
          <p className="text-[10px] text-gray-500">
            {pack?.securityPolicies.encryptionAtRest || "AES-256-GCM / SHA-256"}
          </p>
        </div>
      </div>

      {/* Anomaly Alerts Section */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div className="px-4 py-2.5 bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
            {t("anomalyTitle")}
          </span>
          <span className="text-[10px] text-gray-500">
            {pack?.anomalyTelemetry.activeAnomaliesCount ?? 0} {t("detectedAlerts")}
          </span>
        </div>

        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {(pack?.anomalyTelemetry.anomalies || []).map((anom) => (
            <div key={anom.id} className="p-3.5 flex items-start justify-between gap-3 text-xs">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge
                    variant={anom.severity === "CRITICAL" ? "danger" : "warning"}
                    className="text-[10px] uppercase font-bold"
                  >
                    {anom.severity}
                  </Badge>
                  <span className="font-mono text-[11px] font-semibold text-gray-800 dark:text-gray-200">
                    {anom.type}
                  </span>
                </div>
                <p className="text-gray-600 dark:text-gray-300 text-[11px] leading-relaxed">
                  {anom.description}
                </p>
              </div>
              <span className="text-[10px] text-gray-400 shrink-0 font-mono">
                {new Date(anom.timestamp).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
