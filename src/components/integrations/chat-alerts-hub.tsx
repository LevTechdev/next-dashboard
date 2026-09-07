"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import {
  SendIcon,
  RefreshCwIcon,
  CheckIcon,
  EyeIcon,
  ZapIcon,
  ActivityIcon,
  ClockIcon,
} from "lucide-animated";
import {
  MessageSquare,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Plus,
  Trash2,
  Copy,
  ShieldAlert,
  HelpCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  ChatChannelConfig,
  ChatAlertTriggerRules,
  ChatDeliveryLog,
  ChatAlertsData,
} from "@/lib/chat-alerts-store";
import { ChatPlatform, ChatAlertType } from "@/lib/chat-alerts";

export function ChatAlertsHub() {
  const t = useTranslations("chatAlerts");
  const tc = useTranslations("common");

  const [data, setData] = useState<ChatAlertsData | null>(null);
  const [loading, setLoading] = useState(true);

  // Add/Edit Dialog
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [formData, setFormData] = useState<{
    id?: string;
    name: string;
    platform: ChatPlatform;
    webhookUrl: string;
    channelName: string;
    avatarUrl: string;
    enabledEvents: ChatAlertType[];
  }>({
    name: "",
    platform: "slack",
    webhookUrl: "",
    channelName: "",
    avatarUrl: "",
    enabledEvents: ["stockout", "vip_order", "daily_digest"],
  });
  const [savingChannel, setSavingChannel] = useState(false);

  // Trigger Rules State
  const [rules, setRules] = useState<ChatAlertTriggerRules>({
    stockoutDoiThreshold: 7,
    vipOrderMinAmount: 500,
    paymentAlertsEnabled: true,
    dailyDigestTime: "09:00",
    dailyDigestEnabled: true,
  });
  const [savingRules, setSavingRules] = useState(false);

  // Test Ping Modal
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [testPlatform, setTestPlatform] = useState<ChatPlatform>("slack");
  const [testEvent, setTestEvent] = useState<ChatAlertType>("stockout");
  const [testWebhookUrl, setTestWebhookUrl] = useState("");
  const [testChannelId, setTestChannelId] = useState("");
  const [sendingTest, setSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);

  // Delivery payload viewer modal
  const [inspectDelivery, setInspectDelivery] = useState<ChatDeliveryLog | null>(null);

  // Copy helper
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchConfig = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/integrations/chat-alerts");
      if (res.ok) {
        const json: ChatAlertsData = await res.json();
        setData(json);
        setRules(json.rules);
      }
    } catch {
      toast.error(t("loadError"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const handleSaveChannel = async () => {
    if (!formData.name || !formData.webhookUrl) {
      toast.error(t("fillRequiredFields"));
      return;
    }

    try {
      setSavingChannel(true);
      const res = await fetch("/api/integrations/chat-alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) throw new Error("Failed to save channel");
      toast.success(t("channelSaved"));
      setShowAddDialog(false);
      fetchConfig();
    } catch (err: any) {
      toast.error(err.message || "Failed to save channel");
    } finally {
      setSavingChannel(false);
    }
  };

  const handleDeleteChannel = async (id: string) => {
    if (!confirm(t("confirmDeleteChannel"))) return;

    try {
      const res = await fetch(`/api/integrations/chat-alerts?id=${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success(t("channelDeleted"));
        fetchConfig();
      }
    } catch {
      toast.error("Failed to delete channel");
    }
  };

  const handleSaveRules = async () => {
    try {
      setSavingRules(true);
      const res = await fetch("/api/integrations/chat-alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_rules", rules }),
      });
      if (res.ok) {
        toast.success(t("rulesUpdated"));
        fetchConfig();
      }
    } catch {
      toast.error("Failed to update trigger rules");
    } finally {
      setSavingRules(false);
    }
  };

  const handleOpenTest = (chan?: ChatChannelConfig) => {
    if (chan) {
      setTestPlatform(chan.platform);
      setTestWebhookUrl(chan.webhookUrl);
      setTestChannelId(chan.id);
      setTestEvent(chan.enabledEvents[0] || "stockout");
    } else {
      setTestPlatform("slack");
      setTestWebhookUrl(
        "mock://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX",
      );
      setTestChannelId("manual-test");
      setTestEvent("stockout");
    }
    setTestResult(null);
    setTestModalOpen(true);
  };

  const handleDispatchTest = async () => {
    try {
      setSendingTest(true);
      setTestResult(null);

      const res = await fetch("/api/integrations/chat-alerts/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channelId: testChannelId || "test-dispatch",
          platform: testPlatform,
          webhookUrl: testWebhookUrl,
          event: testEvent,
        }),
      });

      const json = await res.json();
      setTestResult(json);
      if (json.success) {
        toast.success(json.isSimulated ? t("simulatedPingSuccess") : t("livePingSuccess"));
        fetchConfig();
      } else {
        toast.error(json.error || "Failed to dispatch test alert");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to dispatch test");
    } finally {
      setSendingTest(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast.success(tc("copied"));
  };

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-4 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800">
        <RefreshCwIcon size={32} className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
          {t("loadingChatConfig")}
        </p>
      </div>
    );
  }

  const channels = data?.channels || [];
  const deliveries = data?.deliveries || [];

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">{t("hubTitle")}</h2>
            <Badge variant="outline" className="text-xs">
              {channels.length} {t("connectorsActive")}
            </Badge>
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-300 max-w-xl">{t("hubDescription")}</p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleOpenTest()}
            className="text-xs gap-1.5 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <SendIcon size={14} className="h-3.5 w-3.5 text-primary" animateOnHover />
            {t("testPingAction")}
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setFormData({
                name: "",
                platform: "slack",
                webhookUrl: "",
                channelName: "",
                avatarUrl: "",
                enabledEvents: ["stockout", "vip_order", "daily_digest"],
              });
              setShowAddDialog(true);
            }}
            className="text-xs gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            {t("addChannelAction")}
          </Button>
        </div>
      </div>

      {/* Grid: Connectors & Trigger Rules */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Connectors List (2 cols) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">
              {t("configuredChannels")}
            </h3>
            <Button
              size="sm"
              variant="ghost"
              onClick={fetchConfig}
              className="h-8 text-xs text-gray-500"
            >
              <RefreshCwIcon size={12} className="h-3 w-3 mr-1" />
              {tc("refresh")}
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {channels.map((chan) => {
              const isSlack = chan.platform === "slack";
              return (
                <Card
                  key={chan.id}
                  className="rounded-2xl border-gray-200 dark:border-gray-800 shadow-sm hover:border-primary/40 transition-colors"
                >
                  <CardContent className="p-5 space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm",
                            isSlack ? "bg-[#4A154B] text-white" : "bg-[#5865F2] text-white",
                          )}
                        >
                          {isSlack ? "#" : "👾"}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-sm text-gray-900 dark:text-white">
                              {chan.name}
                            </h4>
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px] uppercase font-semibold",
                                chan.status === "ACTIVE"
                                  ? "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200"
                                  : "text-gray-500 bg-gray-100 dark:bg-gray-800",
                              )}
                            >
                              {chan.status}
                            </Badge>
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            {isSlack ? "Slack Webhook" : "Discord Webhook"} &bull;{" "}
                            <span className="font-mono text-primary font-medium">
                              {chan.channelName}
                            </span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenTest(chan)}
                          className="h-8 text-xs gap-1 hover:bg-primary/10 hover:text-primary"
                        >
                          <SendIcon size={12} className="h-3 w-3 text-primary" />
                          {t("testBtn")}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteChannel(chan.id)}
                          className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Subscribed Events */}
                    <div className="space-y-1.5 pt-2 border-t border-gray-100 dark:border-gray-800">
                      <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                        {t("subscribedEventsLabel")}:
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {chan.enabledEvents.map((evt) => (
                          <Badge key={evt} variant="outline" className="text-[11px] font-medium">
                            {evt === "stockout" && "🚨 " + t("evtStockout")}
                            {evt === "vip_order" && "💎 " + t("evtVipOrder")}
                            {evt === "payment_failed" && "⚠️ " + t("evtPaymentFailed")}
                            {evt === "daily_digest" && "☕ " + t("evtDailyDigest")}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {/* Webhook URL & Ping Telemetry */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-100 dark:border-gray-800 gap-2">
                      <div className="flex items-center gap-1.5 font-mono text-[11px] truncate max-w-xs text-gray-400">
                        <span>{chan.webhookUrl.slice(0, 32)}...</span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(chan.webhookUrl, chan.id)}
                          className="hover:text-primary transition-colors ml-1"
                          title={tc("copy")}
                        >
                          {copiedId === chan.id ? (
                            <CheckIcon size={12} className="h-3 w-3 text-emerald-500" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </button>
                      </div>

                      <div className="flex items-center gap-2 text-[11px]">
                        {chan.lastPingAt ? (
                          <span>
                            {t("lastPing")}:{" "}
                            <strong>
                              {new Date(chan.lastPingAt).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </strong>
                          </span>
                        ) : (
                          <span className="text-gray-400">{t("neverTested")}</span>
                        )}
                        {chan.lastStatus && (
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[9px] px-1.5 py-0 uppercase",
                              chan.lastStatus === "SUCCESS"
                                ? "text-emerald-600 border-emerald-300"
                                : "text-rose-600 border-rose-300",
                            )}
                          >
                            {chan.lastStatus}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Trigger Rules Configuration (1 col) */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
            <Sliders className="h-4 w-4 text-primary" />
            {t("triggerRulesTitle")}
          </h3>

          <Card className="rounded-2xl border-gray-200 dark:border-gray-800 shadow-sm">
            <CardContent className="p-5 space-y-5">
              {/* Critical Stockout DOI Threshold */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <Label className="font-semibold text-gray-700 dark:text-gray-300">
                    {t("stockoutThresholdLabel")}
                  </Label>
                  <span className="font-mono font-bold text-primary">
                    ≤ {rules.stockoutDoiThreshold} {t("daysUnit")}
                  </span>
                </div>
                <Input
                  type="number"
                  min={1}
                  max={30}
                  value={rules.stockoutDoiThreshold}
                  onChange={(e) =>
                    setRules({
                      ...rules,
                      stockoutDoiThreshold: parseInt(e.target.value, 10) || 7,
                    })
                  }
                  className="h-8 text-xs font-mono"
                />
                <p className="text-[11px] text-gray-500">{t("stockoutThresholdHelp")}</p>
              </div>

              {/* VIP Order Minimum Amount */}
              <div className="space-y-1.5 pt-3 border-t border-gray-100 dark:border-gray-800">
                <div className="flex items-center justify-between text-xs">
                  <Label className="font-semibold text-gray-700 dark:text-gray-300">
                    {t("vipOrderThresholdLabel")}
                  </Label>
                  <span className="font-mono font-bold text-emerald-600">
                    ≥ ${rules.vipOrderMinAmount}
                  </span>
                </div>
                <Input
                  type="number"
                  min={50}
                  step={50}
                  value={rules.vipOrderMinAmount}
                  onChange={(e) =>
                    setRules({
                      ...rules,
                      vipOrderMinAmount: parseInt(e.target.value, 10) || 500,
                    })
                  }
                  className="h-8 text-xs font-mono"
                />
                <p className="text-[11px] text-gray-500">{t("vipOrderThresholdHelp")}</p>
              </div>

              {/* Payment Settlement Alert Switch */}
              <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-800">
                <div>
                  <Label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                    {t("paymentAlertSwitchLabel")}
                  </Label>
                  <p className="text-[11px] text-gray-500">{t("paymentAlertSwitchHelp")}</p>
                </div>
                <Switch
                  checked={rules.paymentAlertsEnabled}
                  onCheckedChange={(val) => setRules({ ...rules, paymentAlertsEnabled: val })}
                />
              </div>

              {/* Daily 09:00 Standup Briefing */}
              <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-800">
                <div>
                  <Label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                    {t("dailyDigestSwitchLabel")}
                  </Label>
                  <p className="text-[11px] text-gray-500">
                    {t("dailyDigestSwitchHelp", { time: rules.dailyDigestTime })}
                  </p>
                </div>
                <Switch
                  checked={rules.dailyDigestEnabled}
                  onCheckedChange={(val) => setRules({ ...rules, dailyDigestEnabled: val })}
                />
              </div>

              <Button
                size="sm"
                onClick={handleSaveRules}
                disabled={savingRules}
                className="w-full text-xs gap-1.5 mt-2"
              >
                {savingRules ? (
                  <RefreshCwIcon size={14} className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                )}
                {t("saveRulesBtn")}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Delivery Audit Trail Log */}
      <Card className="rounded-2xl border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
        <CardHeader className="border-b border-gray-100 dark:border-gray-800 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <ActivityIcon size={16} className="h-4 w-4 text-emerald-500" />
                {t("auditTrailTitle")}
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                {t("auditTrailSubtitle")}
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-xs font-mono">
              {deliveries.length} {t("logsCount")}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
                  <th className="text-left py-3 px-4 font-semibold text-gray-600 dark:text-gray-400">
                    {t("logPlatformCol")}
                  </th>
                  <th className="text-left py-3 px-3 font-semibold text-gray-600 dark:text-gray-400">
                    {t("logEventCol")}
                  </th>
                  <th className="text-left py-3 px-3 font-semibold text-gray-600 dark:text-gray-400">
                    {t("logPayloadCol")}
                  </th>
                  <th className="text-center py-3 px-2 font-semibold text-gray-600 dark:text-gray-400 w-20">
                    {t("logStatusCol")}
                  </th>
                  <th className="text-center py-3 px-2 font-semibold text-gray-600 dark:text-gray-400 w-20">
                    {t("logLatencyCol")}
                  </th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-600 dark:text-gray-400 w-28">
                    {t("logTimeCol")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60">
                {deliveries.map((log) => (
                  <tr
                    key={log.id}
                    className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors cursor-pointer"
                    onClick={() => setInspectDelivery(log)}
                  >
                    <td className="py-2.5 px-4 font-semibold text-gray-900 dark:text-white capitalize flex items-center gap-2">
                      <span
                        className={cn(
                          "w-2 h-2 rounded-full",
                          log.platform === "slack" ? "bg-[#4A154B]" : "bg-[#5865F2]",
                        )}
                      />
                      {log.platform}
                    </td>
                    <td className="py-2.5 px-3">
                      <Badge variant="outline" className="text-[10px] font-mono">
                        {log.event}
                      </Badge>
                    </td>
                    <td className="py-2.5 px-3 text-gray-600 dark:text-gray-300 font-mono text-[11px] truncate max-w-sm">
                      {log.payloadPreview}
                    </td>
                    <td className="py-2.5 px-2 text-center">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] font-semibold uppercase",
                          log.status === "DELIVERED"
                            ? "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200"
                            : log.status === "SIMULATED"
                              ? "text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200"
                              : "text-rose-600 bg-rose-50 dark:bg-rose-950/40 border-rose-200",
                        )}
                      >
                        {log.status}
                      </Badge>
                    </td>
                    <td className="py-2.5 px-2 text-center font-mono text-[11px] text-gray-500">
                      {log.durationMs}ms
                    </td>
                    <td className="py-2.5 px-4 text-right text-gray-400 font-mono text-[11px]">
                      {new Date(log.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Add / Edit Channel Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("dialogAddTitle")}</DialogTitle>
            <DialogDescription>{t("dialogAddDesc")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{t("formPlatformLabel")}</Label>
              <Select
                value={formData.platform}
                onValueChange={(val: ChatPlatform) => setFormData({ ...formData, platform: val })}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="slack">Slack (Incoming Webhook Block Kit)</SelectItem>
                  <SelectItem value="discord">Discord (Channel Webhook Embeds)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{t("formNameLabel")}</Label>
              <Input
                placeholder="e.g. Ops Team Slack"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{t("formWebhookUrlLabel")}</Label>
              <Input
                placeholder="https://hooks.slack.com/services/..."
                value={formData.webhookUrl}
                onChange={(e) => setFormData({ ...formData, webhookUrl: e.target.value })}
                className="h-9 text-xs font-mono"
              />
              <p className="text-[10px] text-gray-400">{t("webhookUrlSimulationNote")}</p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{t("formChannelNameLabel")}</Label>
              <Input
                placeholder={formData.platform === "slack" ? "#alerts-logistics" : "#general-ops"}
                value={formData.channelName}
                onChange={(e) => setFormData({ ...formData, channelName: e.target.value })}
                className="h-9 text-xs font-mono"
              />
            </div>

            <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-gray-800">
              <Label className="text-xs font-semibold">{t("formEventsLabel")}</Label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: "stockout", label: t("evtStockout") },
                  { id: "vip_order", label: t("evtVipOrder") },
                  { id: "payment_failed", label: t("evtPaymentFailed") },
                  { id: "daily_digest", label: t("evtDailyDigest") },
                ].map((item) => {
                  const isChecked = formData.enabledEvents.includes(item.id as ChatAlertType);
                  return (
                    <label
                      key={item.id}
                      className="flex items-center gap-2 p-2 rounded-lg border border-gray-200 dark:border-gray-800 text-xs cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          const next = e.target.checked
                            ? [...formData.enabledEvents, item.id as ChatAlertType]
                            : formData.enabledEvents.filter((ev) => ev !== item.id);
                          setFormData({ ...formData, enabledEvents: next });
                        }}
                        className="rounded text-primary"
                      />
                      <span>{item.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowAddDialog(false)}>
              {tc("cancel")}
            </Button>
            <Button
              size="sm"
              onClick={handleSaveChannel}
              disabled={savingChannel}
              className="gap-1.5"
            >
              {savingChannel && <RefreshCwIcon size={14} className="h-3.5 w-3.5 animate-spin" />}
              {tc("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Interactive Test Dispatcher Dialog */}
      <Dialog open={testModalOpen} onOpenChange={setTestModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <SendIcon size={20} className="h-5 w-5 text-primary" />
              {t("testDispatcherTitle")}
            </DialogTitle>
            <DialogDescription>{t("testDispatcherDesc")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">{t("testPlatform")}</Label>
                <Select
                  value={testPlatform}
                  onValueChange={(val: ChatPlatform) => setTestPlatform(val)}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="slack">Slack</SelectItem>
                    <SelectItem value="discord">Discord</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">{t("testEvent")}</Label>
                <Select value={testEvent} onValueChange={(val: ChatAlertType) => setTestEvent(val)}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="stockout">🚨 {t("evtStockout")}</SelectItem>
                    <SelectItem value="vip_order">💎 {t("evtVipOrder")}</SelectItem>
                    <SelectItem value="payment_failed">⚠️ {t("evtPaymentFailed")}</SelectItem>
                    <SelectItem value="daily_digest">☕ {t("evtDailyDigest")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{t("targetWebhookUrl")}</Label>
              <Input
                value={testWebhookUrl}
                onChange={(e) => setTestWebhookUrl(e.target.value)}
                placeholder="https://hooks.slack.com/services/..."
                className="h-9 text-xs font-mono"
              />
            </div>

            {testResult && (
              <div
                className={cn(
                  "p-3 rounded-xl border text-xs space-y-1.5",
                  testResult.success
                    ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200"
                    : "bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200",
                )}
              >
                <div className="flex items-center justify-between font-bold">
                  <span>{testResult.success ? "✓ Dispatch Successful" : "✗ Dispatch Failed"}</span>
                  <span className="font-mono text-[11px]">
                    HTTP {testResult.statusCode} &bull; {testResult.durationMs}ms
                  </span>
                </div>
                <p className="font-mono text-[11px] opacity-80">{testResult.responseText}</p>
                {testResult.isSimulated && (
                  <Badge
                    variant="outline"
                    className="text-[10px] mt-1 bg-white/50 dark:bg-black/30"
                  >
                    {t("simulatedExecutionBadge")}
                  </Badge>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setTestModalOpen(false)}>
              {tc("close")}
            </Button>
            <Button
              size="sm"
              onClick={handleDispatchTest}
              disabled={sendingTest}
              className="gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              {sendingTest ? (
                <RefreshCwIcon size={14} className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <SendIcon size={14} className="h-3.5 w-3.5" animateOnHover />
              )}
              {t("sendTestPingBtn")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Inspect Delivery Detail Dialog */}
      {inspectDelivery && (
        <Dialog open={!!inspectDelivery} onOpenChange={() => setInspectDelivery(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <EyeIcon size={16} className="h-4 w-4 text-primary" animateOnHover />
                {t("deliveryDetailTitle")}
              </DialogTitle>
              <DialogDescription className="text-xs">
                {inspectDelivery.id} &bull; {new Date(inspectDelivery.createdAt).toLocaleString()}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2.5 rounded-lg bg-gray-50 dark:bg-gray-800">
                  <span className="text-gray-400 block text-[10px] uppercase font-semibold">
                    Platform
                  </span>
                  <span className="font-bold text-gray-900 dark:text-white capitalize">
                    {inspectDelivery.platform}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-gray-50 dark:bg-gray-800">
                  <span className="text-gray-400 block text-[10px] uppercase font-semibold">
                    Status
                  </span>
                  <span className="font-bold text-emerald-600">
                    {inspectDelivery.status} ({inspectDelivery.statusCode})
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-gray-900 text-gray-100 font-mono text-[11px] overflow-x-auto max-h-48">
                <p className="text-gray-400 mb-1">{"// Dispatch Preview:"}</p>
                <pre>{inspectDelivery.payloadPreview}</pre>
                {inspectDelivery.responseText && (
                  <>
                    <p className="text-gray-400 mt-2 mb-1">{"// Server Response:"}</p>
                    <pre>{inspectDelivery.responseText}</pre>
                  </>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button size="sm" variant="outline" onClick={() => setInspectDelivery(null)}>
                {tc("close")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
