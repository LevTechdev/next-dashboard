"use client";

import React, { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  FileCheck,
  Sliders,
  Download,
  Copy,
  Check,
  Sparkles,
  ExternalLink,
  Lock,
  Globe,
  Smartphone,
  CreditCard,
  Truck,
  Hash,
  Eye,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCurrency } from "@/components/currency-provider";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  FlaggedTransaction,
  FraudRulesConfig,
  DisputeDossier,
  DEFAULT_FRAUD_RULES,
} from "@/lib/fraud-detection";

export function FraudPreventionCard() {
  const t = useTranslations("fraudPrevention");
  const { formatMoney } = useCurrency();

  const [transactions, setTransactions] = useState<FlaggedTransaction[]>([]);
  const [rules, setRules] = useState<FraudRulesConfig>(DEFAULT_FRAUD_RULES);
  const [selectedTx, setSelectedTx] = useState<FlaggedTransaction | null>(null);
  const [dossier, setDossier] = useState<DisputeDossier | null>(null);
  const [dossierLoading, setDossierLoading] = useState(false);
  const [copiedHash, setCopiedHash] = useState(false);
  const [copiedStatement, setCopiedStatement] = useState(false);
  const [savingRules, setSavingRules] = useState(false);

  useEffect(() => {
    // Fetch transactions
    fetch("/api/security/fraud/transactions")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setTransactions(data))
      .catch(() => {});

    // Fetch rules
    fetch("/api/security/fraud/rules")
      .then((res) => (res.ok ? res.json() : DEFAULT_FRAUD_RULES))
      .then((data) => setRules(data))
      .catch(() => {});
  }, []);

  const handleOpenDossier = async (tx: FlaggedTransaction) => {
    setSelectedTx(tx);
    setDossierLoading(true);
    try {
      const res = await fetch(`/api/security/fraud/dossier/${tx.id}`);
      if (res.ok) {
        const data = await res.json();
        setDossier(data);
      }
    } catch {
      toast.error("Failed to load dispute dossier");
    } finally {
      setDossierLoading(false);
    }
  };

  const handleSaveRules = async () => {
    setSavingRules(true);
    try {
      const res = await fetch("/api/security/fraud/rules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rules),
      });
      if (res.ok) {
        toast.success(t("rulesUpdated"));
      }
    } catch {
      toast.error("Failed to update rules");
    } finally {
      setSavingRules(false);
    }
  };

  const copyToClipboard = (text: string, isStatement: boolean) => {
    navigator.clipboard.writeText(text);
    if (isStatement) {
      setCopiedStatement(true);
      setTimeout(() => setCopiedStatement(false), 2000);
    } else {
      setCopiedHash(true);
      setTimeout(() => setCopiedHash(false), 2000);
    }
    toast.success("Copied to clipboard");
  };

  // SVG Radar coordinates for the 5 risk axes (center at 150, 150, radius 100)
  // Axes: 0: Velocity (Top), 1: Geolocation (Top-Right), 2: Device Fingerprint (Bottom-Right), 3: Payment Anomalies (Bottom-Left), 4: Identity Match (Top-Left)
  const radarAxes = [
    { label: "Velocity", x: 150, y: 35, score: 82 },
    { label: "Geolocation", x: 245, y: 105, score: 76 },
    { label: "Device Fingerprint", x: 210, y: 225, score: 68 },
    { label: "Payment Anomalies", x: 90, y: 225, score: 72 },
    { label: "Identity Match", x: 55, y: 105, score: 85 },
  ];

  // Calculate polygon points based on scores
  const getRadarPoints = (scores: number[]) => {
    const angleStep = (2 * Math.PI) / 5;
    return scores
      .map((score, i) => {
        const angle = -Math.PI / 2 + i * angleStep;
        const r = (score / 100) * 90;
        const x = 150 + r * Math.cos(angle);
        const y = 150 + r * Math.sin(angle);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  };

  const currentScores = [82, 76, 68, 72, 85];
  const safeScores = [25, 20, 30, 22, 18];

  return (
    <Card className="border-border/80 shadow-sm overflow-hidden">
      <CardHeader className="pb-4 border-b border-border/60 bg-slate-50/50 dark:bg-slate-900/40">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>{t("title")}</span>
                <Badge
                  variant="outline"
                  className="text-[10px] font-mono border-rose-500/30 text-rose-600 dark:text-rose-400 bg-rose-50/50 dark:bg-rose-950/40"
                >
                  REAL-TIME RISK RADAR
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs text-slate-500 dark:text-slate-400">
                {t("subtitle")}
              </CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-5 space-y-6">
        {/* ─── Top Grid: Risk Radar Visualization & Config Slider ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Visual SVG Risk Radar Chart */}
          <div className="lg:col-span-6 flex flex-col items-center justify-center p-4 rounded-xl bg-slate-50/70 dark:bg-slate-900/60 border border-border/60">
            <div className="w-full flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-rose-500" />
                {t("riskRadarTitle")}
              </span>
              <div className="flex items-center gap-3 text-[11px]">
                <span className="flex items-center gap-1 text-rose-500 font-bold">
                  <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
                  Active Threat
                </span>
                <span className="flex items-center gap-1 text-emerald-500">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                  Safe Baseline
                </span>
              </div>
            </div>

            <svg viewBox="0 0 300 300" className="w-full max-w-[280px] h-auto select-none">
              {/* Concentric Reference Rings */}
              {[25, 50, 75, 100].map((level) => {
                const r = (level / 100) * 90;
                return (
                  <circle
                    key={level}
                    cx="150"
                    cy="150"
                    r={r}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1"
                    strokeDasharray={level < 100 ? "3 3" : undefined}
                    className="text-slate-300 dark:text-slate-700/80"
                  />
                );
              })}

              {/* Radial Axis Spokes */}
              {radarAxes.map((axis, i) => {
                const angle = -Math.PI / 2 + i * ((2 * Math.PI) / 5);
                const x = 150 + 90 * Math.cos(angle);
                const y = 150 + 90 * Math.sin(angle);
                return (
                  <line
                    key={i}
                    x1="150"
                    y1="150"
                    x2={x}
                    y2={y}
                    stroke="currentColor"
                    strokeWidth="1"
                    className="text-slate-300 dark:text-slate-700"
                  />
                );
              })}

              {/* Safe Baseline Polygon */}
              <polygon
                points={getRadarPoints(safeScores)}
                fill="#10b981"
                fillOpacity="0.15"
                stroke="#10b981"
                strokeWidth="1.5"
              />

              {/* Active Threat Polygon */}
              <polygon
                points={getRadarPoints(currentScores)}
                fill="#f43f5e"
                fillOpacity="0.25"
                stroke="#f43f5e"
                strokeWidth="2"
                className="drop-shadow-[0_0_8px_rgba(244,63,94,0.4)]"
              />

              {/* Data Points */}
              {radarAxes.map((axis, i) => {
                const angle = -Math.PI / 2 + i * ((2 * Math.PI) / 5);
                const r = (currentScores[i] / 100) * 90;
                const x = 150 + r * Math.cos(angle);
                const y = 150 + r * Math.sin(angle);
                return (
                  <circle
                    key={i}
                    cx={x}
                    cy={y}
                    r="4"
                    fill="#f43f5e"
                    stroke="#ffffff"
                    strokeWidth="1.5"
                    className="animate-pulse"
                  />
                );
              })}

              {/* Labels */}
              <text
                x="150"
                y="24"
                textAnchor="middle"
                fontSize="10"
                fontWeight="bold"
                fill="currentColor"
                className="text-slate-700 dark:text-slate-300"
              >
                Velocity (82)
              </text>
              <text
                x="250"
                y="105"
                textAnchor="start"
                fontSize="10"
                fontWeight="bold"
                fill="currentColor"
                className="text-slate-700 dark:text-slate-300"
              >
                Geo Mismatch
              </text>
              <text
                x="215"
                y="240"
                textAnchor="start"
                fontSize="10"
                fontWeight="bold"
                fill="currentColor"
                className="text-slate-700 dark:text-slate-300"
              >
                Fingerprint
              </text>
              <text
                x="85"
                y="240"
                textAnchor="end"
                fontSize="10"
                fontWeight="bold"
                fill="currentColor"
                className="text-slate-700 dark:text-slate-300"
              >
                Payment Anomaly
              </text>
              <text
                x="50"
                y="105"
                textAnchor="end"
                fontSize="10"
                fontWeight="bold"
                fill="currentColor"
                className="text-slate-700 dark:text-slate-300"
              >
                Identity
              </text>
            </svg>
          </div>

          {/* Dynamic Rules Engine Configuration */}
          <div className="lg:col-span-6 p-4 rounded-xl bg-slate-50/70 dark:bg-slate-900/60 border border-border/60 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-border/60">
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Sliders className="h-3.5 w-3.5 text-indigo-500" />
                  {t("rulesConfigTitle")}
                </h4>
                <p className="text-[11px] text-slate-500">
                  Threshold triggers for automated settlement defense
                </p>
              </div>
              <Button
                size="sm"
                onClick={handleSaveRules}
                disabled={savingRules}
                className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer"
              >
                {t("saveRules")}
              </Button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <div className="flex justify-between font-mono mb-1">
                  <span className="text-slate-600 dark:text-slate-400">{t("autoApprove")}</span>
                  <span className="font-bold text-emerald-600">
                    {"< " + rules.autoApproveThreshold}
                  </span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="45"
                  value={rules.autoApproveThreshold}
                  onChange={(e) =>
                    setRules({ ...rules, autoApproveThreshold: Number(e.target.value) })
                  }
                  className="w-full accent-emerald-500 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between font-mono mb-1">
                  <span className="text-slate-600 dark:text-slate-400">{t("challenge3ds")}</span>
                  <span className="font-bold text-amber-600">
                    {rules.autoApproveThreshold + " - " + rules.manualReviewThreshold}
                  </span>
                </div>
                <input
                  type="range"
                  min="40"
                  max="75"
                  value={rules.challenge3dsThreshold}
                  onChange={(e) =>
                    setRules({ ...rules, challenge3dsThreshold: Number(e.target.value) })
                  }
                  className="w-full accent-amber-500 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between font-mono mb-1">
                  <span className="text-slate-600 dark:text-slate-400">{t("manualReview")}</span>
                  <span className="font-bold text-orange-600">
                    {rules.challenge3dsThreshold + " - " + rules.autoVoidThreshold}
                  </span>
                </div>
                <input
                  type="range"
                  min="70"
                  max="90"
                  value={rules.manualReviewThreshold}
                  onChange={(e) =>
                    setRules({ ...rules, manualReviewThreshold: Number(e.target.value) })
                  }
                  className="w-full accent-orange-500 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between font-mono mb-1">
                  <span className="text-slate-600 dark:text-slate-400">{t("autoVoid")}</span>
                  <span className="font-bold text-rose-600">{"> " + rules.autoVoidThreshold}</span>
                </div>
                <input
                  type="range"
                  min="85"
                  max="98"
                  value={rules.autoVoidThreshold}
                  onChange={(e) =>
                    setRules({ ...rules, autoVoidThreshold: Number(e.target.value) })
                  }
                  className="w-full accent-rose-500 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>

        {/* ─── Flagged Transactions Queue Table ─── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                {t("flaggedQueueTitle")}
              </h4>
              <p className="text-xs text-slate-500">{t("flaggedQueueDesc")}</p>
            </div>
          </div>

          <div className="rounded-xl border border-border/80 overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900/60 border-b border-border/60 text-slate-500">
                <tr>
                  <th className="py-2.5 px-3 text-left font-medium">Order / Customer</th>
                  <th className="py-2.5 px-3 text-left font-medium">Amount</th>
                  <th className="py-2.5 px-3 text-left font-medium">IP & Geo</th>
                  <th className="py-2.5 px-3 text-left font-medium">{t("riskScore")}</th>
                  <th className="py-2.5 px-3 text-left font-medium">Recommendation</th>
                  <th className="py-2.5 px-3 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {transactions.map((tx) => {
                  const isCritical = tx.riskScore >= 80;
                  const isWarning = tx.riskScore >= 50 && tx.riskScore < 80;

                  return (
                    <tr
                      key={tx.id}
                      className="hover:bg-slate-50/50 dark:hover:bg-slate-900/40 transition-colors"
                    >
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900 dark:text-white font-mono">
                          {tx.orderNumber}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate max-w-[140px]">
                          {tx.customerName}
                        </div>
                      </td>

                      <td className="py-3 px-3 font-mono font-bold text-slate-900 dark:text-white">
                        {formatMoney(tx.amount)}
                      </td>

                      <td className="py-3 px-3">
                        <div className="font-mono text-slate-700 dark:text-slate-300">
                          {tx.ipAddress}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Region: {tx.country} {tx.riskFactors.proxyTorVpn && "• ⚠️ VPN/Tor"}
                        </div>
                      </td>

                      <td className="py-3 px-3 font-mono">
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded-full font-bold text-xs inline-block",
                            isCritical
                              ? "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300"
                              : isWarning
                                ? "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
                                : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300",
                          )}
                        >
                          {tx.riskScore}/100
                        </span>
                      </td>

                      <td className="py-3 px-3 font-mono text-[11px]">
                        <span
                          className={cn(
                            "font-bold",
                            tx.recommendation === "AUTO_VOID"
                              ? "text-rose-600 dark:text-rose-400"
                              : tx.recommendation === "MANUAL_REVIEW"
                                ? "text-amber-600 dark:text-amber-400"
                                : tx.recommendation === "CHALLENGE_3DS"
                                  ? "text-sky-600 dark:text-cyan-400"
                                  : "text-emerald-600 dark:text-emerald-400",
                          )}
                        >
                          {tx.recommendation}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenDossier(tx)}
                          className="h-7 text-xs border-indigo-500/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 cursor-pointer"
                        >
                          <FileCheck className="h-3.5 w-3.5 mr-1" />
                          {t("viewDossier")}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </CardContent>

      {/* ─── Chargeback Dispute Defense Dossier Modal ─── */}
      <Dialog open={Boolean(selectedTx)} onOpenChange={(open) => !open && setSelectedTx(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="pb-3 border-b border-border/60">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCheck className="h-5 w-5 text-indigo-500" />
                <div>
                  <DialogTitle className="text-base font-bold">
                    {t("dossierModalTitle")}
                  </DialogTitle>
                  <DialogDescription className="text-xs">{t("dossierModalDesc")}</DialogDescription>
                </div>
              </div>
              {dossier && (
                <Badge
                  variant="outline"
                  className="font-mono text-xs text-indigo-600 border-indigo-400/40"
                >
                  {dossier.dossierId}
                </Badge>
              )}
            </div>
          </DialogHeader>

          {dossier ? (
            <div className="space-y-4 pt-2 text-xs">
              {/* Merkle Cryptographic Hash Banner */}
              <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="text-[10px] text-slate-500 font-mono block">
                    {t("merkleAuditHash")}
                  </span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200 break-all text-[11px]">
                    {dossier.merkleAuditHash}
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => copyToClipboard(dossier.merkleAuditHash, false)}
                  className="h-7 text-xs shrink-0 ml-2 cursor-pointer"
                >
                  {copiedHash ? (
                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>

              {/* Evidence Pack Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 rounded-lg border border-border/70 space-y-1">
                  <span className="text-slate-500 text-[11px] flex items-center gap-1">
                    <Globe className="h-3 w-3 text-sky-500" />
                    IP & ASN Telemetry
                  </span>
                  <p className="font-mono font-bold text-slate-900 dark:text-white">
                    {dossier.evidence.customerIp}
                  </p>
                  <p className="text-[11px] text-slate-500 truncate">{dossier.evidence.asnName}</p>
                </div>

                <div className="p-3 rounded-lg border border-border/70 space-y-1">
                  <span className="text-slate-500 text-[11px] flex items-center gap-1">
                    <Smartphone className="h-3 w-3 text-purple-500" />
                    {t("deviceFingerprint")}
                  </span>
                  <p className="font-mono font-bold text-slate-900 dark:text-white truncate">
                    {dossier.evidence.deviceFingerprintHash}
                  </p>
                  <p className="text-[11px] text-emerald-600 font-bold">● High Trust Match</p>
                </div>

                <div className="p-3 rounded-lg border border-border/70 space-y-1">
                  <span className="text-slate-500 text-[11px] flex items-center gap-1">
                    <CreditCard className="h-3 w-3 text-emerald-500" />
                    {t("threeDsStatus")}
                  </span>
                  <p className="font-mono font-bold text-emerald-600">
                    {dossier.evidence.threeDsStatus} (Frictionless)
                  </p>
                  <p className="text-[11px] text-slate-500">
                    AVS: {dossier.evidence.avsMatch} • CVV: {dossier.evidence.cvvMatch}
                  </p>
                </div>

                <div className="p-3 rounded-lg border border-border/70 space-y-1">
                  <span className="text-slate-500 text-[11px] flex items-center gap-1">
                    <Truck className="h-3 w-3 text-amber-500" />
                    {t("carrierProof")}
                  </span>
                  <p className="font-mono font-bold text-slate-900 dark:text-white">
                    {dossier.evidence.carrierTrackingNumber}
                  </p>
                  <p className="text-[11px] text-emerald-600 font-bold">
                    Signed Physical Delivery Proof Available
                  </p>
                </div>
              </div>

              {/* Recommended Issuer Statement */}
              <div className="p-3 rounded-xl border border-indigo-500/30 bg-indigo-50/40 dark:bg-indigo-950/20 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 dark:text-white text-xs">
                    {t("issuerStatement")}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(dossier.recommendedStatement, true)}
                    className="h-6 text-[11px] border-indigo-400 text-indigo-700 dark:text-indigo-300 cursor-pointer"
                  >
                    {copiedStatement ? (
                      <Check className="h-3 w-3 mr-1 text-emerald-500" />
                    ) : (
                      <Copy className="h-3 w-3 mr-1" />
                    )}
                    Copy Statement
                  </Button>
                </div>
                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-serif italic bg-background/80 p-2.5 rounded-lg border border-border/60">
                  &ldquo;{dossier.recommendedStatement}&rdquo;
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60">
                <Button
                  size="sm"
                  onClick={() => {
                    toast.success(t("dossierGenerated"));
                    setSelectedTx(null);
                  }}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5 mr-1" />
                  {t("downloadDossier")}
                </Button>
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-slate-500">Generating forensic dossier...</div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
