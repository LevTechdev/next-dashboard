"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Zap,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Loader2,
  Terminal,
  ShieldCheck,
  ArrowRight,
  Code2,
  Activity,
  Send,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useRealtime } from "@/components/realtime-provider";

interface WebhookSimulatorProps {
  onSimulationSuccess?: () => void;
  pendingTransactions?: Array<{
    id: string;
    invoiceNumber: string;
    amount: number;
    status: string;
  }>;
  className?: string;
}

export function PaymentGatewayWebhookSimulator({
  onSimulationSuccess,
  pendingTransactions = [],
  className,
}: WebhookSimulatorProps) {
  const t = useTranslations("webhookSimulator");
  const { addNotification, triggerRefresh } = useRealtime();

  const [open, setOpen] = useState(false);
  const [eventType, setEventType] = useState("qris.payment_success");
  const [selectedTxId, setSelectedTxId] = useState<string>("auto");
  const [amount, setAmount] = useState<string>("250000");
  const [bank, setBank] = useState<string>("BCA Mobile");
  const [customerName, setCustomerName] = useState<string>("Rian Kusuma");
  const [targetUrl, setTargetUrl] = useState<string>("");
  const [simulating, setSimulating] = useState(false);
  const [lastResult, setLastResult] = useState<any | null>(null);
  const [copiedPayload, setCopiedPayload] = useState(false);

  // Play subtle synthesis chime upon successful simulated settlement
  const playSettlementChime = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.exponentialRampToValueAtTime(880.0, now + 0.12); // A5

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.36);
    } catch {
      // Audio context might be restricted before first click
    }
  };

  const handleSimulate = async () => {
    try {
      setSimulating(true);
      const payload: any = {
        eventType,
        amount: Number(amount.replace(/[^0-9]/g, "")) || 250000,
        bank,
        customerName: customerName.trim() || "Walk-in Customer",
      };

      if (selectedTxId !== "auto") {
        payload.transactionId = selectedTxId;
      }

      if (targetUrl.trim().startsWith("http")) {
        payload.targetUrl = targetUrl.trim();
      }

      const res = await fetch("/api/webhooks/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setLastResult(data);
        playSettlementChime();

        // Broadcast real-time event & toast
        addNotification({
          id: `wh-${Date.now()}`,
          title:
            eventType === "qris.payment_success"
              ? "⚡ QRIS Payment Received"
              : eventType === "payment.dispute_created"
                ? "⚠️ Payment Dispute Alert"
                : "💳 Settlement Batch Reconciled",
          description: `${data.transaction.invoiceNumber} • Rp ${Number(data.transaction.amount).toLocaleString("id-ID")} via ${bank}`,
          type: eventType === "payment.dispute_created" ? "alert" : "revenue",
          timestamp: new Date(),
          read: false,
        });

        toast.success(t("successToast", { event: eventType }), {
          description: `${data.transaction.invoiceNumber} status: ${data.transaction.status}`,
        });

        if (onSimulationSuccess) {
          onSimulationSuccess();
        }
        triggerRefresh();
      } else {
        toast.error(t("errorToast", { error: data.error || "Simulation error" }));
      }
    } catch (err: any) {
      toast.error(t("errorToast", { error: err.message || "Network error" }));
    } finally {
      setSimulating(false);
    }
  };

  const handleCopyPayload = () => {
    if (!lastResult) return;
    navigator.clipboard.writeText(JSON.stringify(lastResult.payload, null, 2));
    setCopiedPayload(true);
    setTimeout(() => setCopiedPayload(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "gap-2 text-xs font-semibold h-9 px-3.5 border-primary/20 bg-primary/5 hover:bg-primary/10 text-primary transition-all",
            className,
          )}
        >
          <Zap className="h-4 w-4" />
          <span>{t("simulateWebhook")}</span>
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-2">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary border border-primary/20">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">{t("title")}</DialogTitle>
              <DialogDescription className="text-xs">{t("subtitle")}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-2 pb-6 space-y-4">
          {/* Form Settings */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Event Type */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                {t("eventType")}
              </label>
              <Select value={eventType} onValueChange={setEventType}>
                <SelectTrigger className="text-xs h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="qris.payment_success" className="text-xs">
                    {t("eventQrisSuccess")}
                  </SelectItem>
                  <SelectItem value="qris.settlement_completed" className="text-xs">
                    {t("eventSettlement")}
                  </SelectItem>
                  <SelectItem value="payment.dispute_created" className="text-xs">
                    {t("eventDispute")}
                  </SelectItem>
                  <SelectItem value="payment.failed" className="text-xs">
                    {t("eventExpired")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Target Transaction */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                {t("selectTransaction")}
              </label>
              <Select value={selectedTxId} onValueChange={setSelectedTxId}>
                <SelectTrigger className="text-xs h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto" className="text-xs font-medium">
                    ✨ {t("autoGenerate")}
                  </SelectItem>
                  {pendingTransactions.map((tx) => (
                    <SelectItem key={tx.id} value={tx.id} className="text-xs font-mono">
                      {tx.invoiceNumber} (Rp {tx.amount.toLocaleString("id-ID")})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Amount */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                {t("amount")}
              </label>
              <Input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="250000"
                className="text-xs font-mono h-9"
              />
            </div>

            {/* Bank / E-Wallet */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                {t("sourceBank")}
              </label>
              <Select value={bank} onValueChange={setBank}>
                <SelectTrigger className="text-xs h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BCA Mobile" className="text-xs">
                    BCA Mobile
                  </SelectItem>
                  <SelectItem value="Livin' Mandiri" className="text-xs">
                    Livin&apos; Mandiri
                  </SelectItem>
                  <SelectItem value="BRImo" className="text-xs">
                    BRImo
                  </SelectItem>
                  <SelectItem value="BNI Mobile" className="text-xs">
                    BNI Mobile
                  </SelectItem>
                  <SelectItem value="DANA" className="text-xs">
                    DANA Wallet
                  </SelectItem>
                  <SelectItem value="ShopeePay" className="text-xs">
                    ShopeePay
                  </SelectItem>
                  <SelectItem value="LinkAja" className="text-xs">
                    LinkAja
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Customer Name */}
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                {t("customerName")}
              </label>
              <Input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Customer Name"
                className="text-xs h-9"
              />
            </div>

            {/* Optional External Dispatch */}
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                {t("customEndpoint")} (Optional)
              </label>
              <Input
                value={targetUrl}
                onChange={(e) => setTargetUrl(e.target.value)}
                placeholder="https://api.yourdomain.com/webhooks/payment"
                className="text-xs font-mono h-9"
              />
            </div>
          </div>

          {/* Action Button */}
          <div className="flex justify-end pt-1">
            <Button
              onClick={handleSimulate}
              disabled={simulating}
              className="gap-2 text-xs font-semibold h-9 px-4 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
            >
              {simulating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              <span>{simulating ? t("simulating") : t("simulateBtn")}</span>
            </Button>
          </div>

          {/* Live Inspector Panel */}
          {lastResult && (
            <div className="mt-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/60 p-4 space-y-3 animate-in fade-in-50 duration-200">
              <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800 pb-2">
                <div className="flex items-center gap-2">
                  <Badge variant="success" className="gap-1 text-[11px] font-semibold">
                    <CheckCircle2 className="h-3 w-3" />
                    {t("statusDelivered")}
                  </Badge>
                  <Badge variant="outline" className="gap-1 text-[11px] font-mono">
                    <ShieldCheck className="h-3 w-3 text-emerald-500" />
                    {t("signatureValid")}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-gray-400 font-mono">
                  <span>{lastResult.delivery?.latencyMs}ms latency</span>
                  <span>•</span>
                  <span>HTTP {lastResult.delivery?.statusCode}</span>
                </div>
              </div>

              {/* Signed Headers */}
              <div>
                <p className="text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  {t("headers")}
                </p>
                <div className="p-2.5 rounded-lg bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 font-mono text-[11px] text-gray-600 dark:text-gray-300 space-y-1">
                  <div>
                    <span className="text-gray-400">X-Webhook-Event:</span>{" "}
                    <span className="text-primary font-semibold">{lastResult.event}</span>
                  </div>
                  <div className="truncate">
                    <span className="text-gray-400">X-Webhook-Signature:</span>{" "}
                    <span className="text-emerald-600 dark:text-emerald-400">
                      {lastResult.signature}
                    </span>
                  </div>
                </div>
              </div>

              {/* JSON Payload with Copy Button */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">
                    {t("payload")}
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopyPayload}
                    className="h-6 px-2 text-[11px] gap-1 text-gray-500 hover:text-gray-900 dark:hover:text-gray-100"
                  >
                    {copiedPayload ? (
                      <Check className="h-3 w-3 text-emerald-500" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                    <span>{copiedPayload ? "Copied" : "Copy"}</span>
                  </Button>
                </div>
                <pre className="p-3 rounded-lg bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 font-mono text-[11px] text-gray-700 dark:text-gray-300 max-h-48 overflow-y-auto leading-relaxed">
                  {JSON.stringify(lastResult.payload, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
