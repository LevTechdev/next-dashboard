"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import {
  RotateCcwIcon,
  RefreshCwIcon,
  ShieldCheckIcon,
  CheckIcon,
  CopyIcon,
  LoaderCircleIcon,
  EyeIcon,
  ActivityIcon,
} from "lucide-animated";
import { Webhook, AlertTriangle, Trash2, Play, Layers, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip } from "@/components/ui/tooltip";

interface DlqEntry {
  id: string;
  platform: "shopify" | "tiktok" | "shopee" | "woocommerce";
  event: string;
  errorMessage: string;
  retryCount: number;
  maxRetries: number;
  status: "FAILED" | "RETRYING" | "RESOLVED";
  createdAt: string;
  lastAttemptAt: string;
  payload: any;
}

const PLATFORMS = [
  {
    id: "shopify",
    name: "Shopify Store",
    color:
      "from-emerald-500/10 to-teal-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400",
    header: "X-Shopify-Hmac-SHA256",
    endpoint: "/api/webhooks/inbound/shopify",
  },
  {
    id: "tiktok",
    name: "TikTok Shop",
    color: "from-pink-500/10 to-rose-500/10 border-pink-500/20 text-pink-600 dark:text-pink-400",
    header: "X-TikTok-Signature",
    endpoint: "/api/webhooks/inbound/tiktok",
  },
  {
    id: "shopee",
    name: "Shopee Open Platform",
    color:
      "from-orange-500/10 to-amber-500/10 border-orange-500/20 text-orange-600 dark:text-orange-400",
    header: "X-Shopee-Signature",
    endpoint: "/api/webhooks/inbound/shopee",
  },
  {
    id: "woocommerce",
    name: "WooCommerce REST",
    color:
      "from-purple-500/10 to-indigo-500/10 border-purple-500/20 text-purple-600 dark:text-purple-400",
    header: "X-WC-Webhook-Signature",
    endpoint: "/api/webhooks/inbound/woocommerce",
  },
];

export function InboundWebhookSync() {
  const t = useTranslations("inboundWebhooks");
  const tc = useTranslations("common");
  const [dlqEntries, setDlqEntries] = useState<DlqEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [selectedPayload, setSelectedPayload] = useState<any | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [activePlatform, setActivePlatform] = useState("shopify");
  const [simulateFailure, setSimulateFailure] = useState(false);

  const fetchDlq = async () => {
    try {
      const res = await fetch("/api/webhooks/inbound/dlq");
      if (res.ok) {
        const data = await res.json();
        setDlqEntries(data.entries || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDlq();
  }, []);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success(t("copiedToClipboard"));
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleRetry = async (id: string) => {
    try {
      const res = await fetch("/api/webhooks/inbound/dlq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "retry", id }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        toast.success(data.message || t("retrySuccess"));
        fetchDlq();
      } else {
        toast.error(data.error || t("retryFailed"));
      }
    } catch (err: any) {
      toast.error(err?.message || t("retryFailed"));
    }
  };

  const handlePurge = async (id: string) => {
    try {
      const res = await fetch("/api/webhooks/inbound/dlq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "purge", id }),
      });
      if (res.ok) {
        toast.success(t("purgeSuccess"));
        fetchDlq();
      }
    } catch (err: any) {
      toast.error(err?.message || t("purgeFailed"));
    }
  };

  const handleSimulate = async () => {
    setSimulating(true);
    try {
      const res = await fetch("/api/webhooks/inbound/dlq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "simulate",
          platform: activePlatform,
          simulateFailure,
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        toast.success(t("simulationSuccess"));
      } else if (simulateFailure) {
        toast.warning(t("simulationFailureEnqueued"));
      } else {
        toast.error(data.error || "Simulation error");
      }
      fetchDlq();
    } catch (err: any) {
      toast.error(err?.message || "Simulation failed");
    } finally {
      setSimulating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-primary/10 text-primary">
              <Webhook className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                {t("title")}
                <Badge variant="success" className="text-[10px]">
                  <ShieldCheckIcon size={14} className="h-3.5 w-3.5 mr-1" />
                  HMAC SHA-256
                </Badge>
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t("description")}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchDlq}
              className="text-xs flex items-center gap-1.5 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <RefreshCwIcon size={14} className="h-3.5 w-3.5" animateOnHover />
              {t("refresh")}
            </Button>
          </div>
        </div>
      </div>

      {/* Platform Endpoints Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {PLATFORMS.map((plat) => (
          <div
            key={plat.id}
            className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-sm space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                {plat.name}
              </span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40">
                {t("activeSecured")}
              </span>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
                {t("inboundEndpoint")}
              </label>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={`https://api.yourdomain.com${plat.endpoint}`}
                  className="flex-1 px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-xs font-mono text-gray-700 dark:text-gray-300"
                />
                <Tooltip content={tc("copyUrl")} side="top">
                  <button
                    type="button"
                    onClick={() =>
                      handleCopy(`https://api.yourdomain.com${plat.endpoint}`, plat.id)
                    }
                    className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    aria-label={tc("copyUrl")}
                  >
                    {copiedKey === plat.id ? (
                      <CheckIcon size={14} className="h-3.5 w-3.5 text-emerald-500" />
                    ) : (
                      <CopyIcon size={14} className="h-3.5 w-3.5 text-gray-400" animateOnHover />
                    )}
                  </button>
                </Tooltip>
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] pt-2 border-t border-gray-100 dark:border-gray-800 text-gray-500 dark:border-gray-700/50">
              <span>
                Header:{" "}
                <code className="text-gray-700 dark:text-gray-300 font-mono">{plat.header}</code>
              </span>
              <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-medium">
                <CheckIcon size={14} className="h-3.5 w-3.5" /> Auto Stock Sync
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Inbound Simulator Panel */}
      <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 via-white to-primary/10 dark:from-indigo-950/20 dark:via-gray-900 dark:to-purple-950/10 p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <Play className="h-4 w-4 text-primary" />
              {t("simulatorTitle")}
            </h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t("simulatorDesc")}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">
              {t("platformLabel")}
            </label>
            <select
              value={activePlatform}
              onChange={(e) => setActivePlatform(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs text-gray-900 dark:text-gray-100"
            >
              <option value="shopify">Shopify Store</option>
              <option value="tiktok">TikTok Shop</option>
              <option value="shopee">Shopee Open Platform</option>
              <option value="woocommerce">WooCommerce REST</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">
              {t("simulationScenario")}
            </label>
            <select
              value={simulateFailure ? "failure" : "success"}
              onChange={(e) => setSimulateFailure(e.target.value === "failure")}
              className="w-full px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs text-gray-900 dark:text-gray-100"
            >
              <option value="success">{t("scenarioSuccess")}</option>
              <option value="failure">{t("scenarioFailure")}</option>
            </select>
          </div>

          <div className="flex items-end">
            <Button
              onClick={handleSimulate}
              disabled={simulating}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground text-xs h-9 shadow-sm transition-all hover:scale-[1.01] active:scale-[0.98]"
            >
              {simulating ? (
                <>
                  <LoaderCircleIcon size={14} className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  {t("dispatching")}
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5 mr-1.5 fill-current" />
                  {t("dispatchTestWebhook")}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Dead-Letter Queue (DLQ) Table */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {t("dlqTitle")}
            </h4>
            <Badge variant="warning" className="text-[10px]">
              {dlqEntries.filter((e) => e.status === "FAILED").length} {t("activeFailures")}
            </Badge>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">{t("dlqSub")}</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-800 text-gray-500">
              <tr>
                <th className="py-2.5 px-4 font-medium">{t("colPlatform")}</th>
                <th className="py-2.5 px-4 font-medium">{t("colErrorReason")}</th>
                <th className="py-2.5 px-4 font-medium">{t("colAttempts")}</th>
                <th className="py-2.5 px-4 font-medium">{t("colStatus")}</th>
                <th className="py-2.5 px-4 font-medium">{t("colTimestamp")}</th>
                <th className="py-2.5 px-4 font-medium text-right">{t("colActions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-400">
                    <LoaderCircleIcon size={20} className="h-5 w-5 animate-spin mx-auto mb-1" />
                    {t("loading")}
                  </td>
                </tr>
              ) : dlqEntries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-400">
                    {t("noDlqEntries")}
                  </td>
                </tr>
              ) : (
                dlqEntries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                    <td className="py-3 px-4 font-medium capitalize flex items-center gap-1.5 text-gray-900 dark:text-gray-100">
                      <Webhook className="h-3.5 w-3.5 text-indigo-500" />
                      {entry.platform}
                    </td>
                    <td
                      className="py-3 px-4 text-red-600 dark:text-red-400 max-w-xs truncate font-mono text-[11px]"
                      title={entry.errorMessage}
                    >
                      {entry.errorMessage}
                    </td>
                    <td className="py-3 px-4 text-gray-600 dark:text-gray-300">
                      {entry.retryCount} / {entry.maxRetries}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
                          entry.status === "RESOLVED"
                            ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300"
                            : "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
                        }`}
                      >
                        {entry.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-500 text-[11px]">
                      {new Date(entry.createdAt).toLocaleTimeString()}
                    </td>
                    <td className="py-3 px-4 text-right space-x-1">
                      <Tooltip side="top" content={t("viewPayload")}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedPayload(entry.payload)}
                          aria-label={t("viewPayload")}
                          className="h-7 px-2 text-xs hover:text-primary transition-all hover:scale-105"
                        >
                          <EyeIcon size={14} className="h-3.5 w-3.5" animateOnHover />
                        </Button>
                      </Tooltip>
                      <Tooltip side="top" content={t("replayWebhook")}>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRetry(entry.id)}
                          disabled={entry.status === "RESOLVED"}
                          className="h-7 px-2 text-xs text-primary border-primary/20 hover:bg-primary/10 transition-all hover:scale-105"
                        >
                          <RotateCcwIcon size={14} className="h-3 w-3 mr-1" animateOnHover />
                          {t("replay")}
                        </Button>
                      </Tooltip>
                      <Tooltip side="top" content={t("purge")}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handlePurge(entry.id)}
                          aria-label={t("purge")}
                          className="h-7 px-2 text-xs text-red-500 hover:text-red-700 transition-all hover:scale-105"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </Tooltip>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payload Modal */}
      <Dialog open={!!selectedPayload} onOpenChange={() => setSelectedPayload(null)}>
        <DialogContent className="max-w-xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold flex items-center gap-2">
              <EyeIcon size={16} className="h-4 w-4 text-primary" />
              {t("inspectedPayload")}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto bg-gray-950 text-gray-200 p-3 rounded-lg font-mono text-xs">
            <pre>{JSON.stringify(selectedPayload, null, 2)}</pre>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
