"use client";

import { useState } from "react";
import {
  Zap,
  ShoppingCart,
  CreditCard,
  Share2,
  AlertTriangle,
  Play,
  CheckCircle2,
  Sparkles,
  Sliders,
  Send,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useRealtime } from "@/components/realtime-provider";
import { useTranslations } from "next-intl";

interface WebhookEventSimulatorProps {
  onSimulateOrder?: (amount: number) => void;
  className?: string;
}

export function WebhookEventSimulator({ onSimulateOrder, className }: WebhookEventSimulatorProps) {
  const t = useTranslations("dashboard");
  const [open, setOpen] = useState(false);
  const { addNotification, triggerRefresh } = useRealtime();

  // Custom Simulator Form
  const [customAmount, setCustomAmount] = useState("199.00");
  const [customChannel, setCustomChannel] = useState("Instagram");
  const [customRegion, setCustomRegion] = useState("ap-seasia");
  const [customCustomer, setCustomCustomer] = useState("Aditya Pratama");

  const triggerSimulation = (
    type: "instagram_order" | "midtrans_qris" | "affiliate_payout" | "low_stock" | "custom",
  ) => {
    const timestamp = new Date();

    if (type === "instagram_order") {
      const amount = 249.99;
      // 1. Dispatch custom event for GlobalSalesMap & CRT Telemetry
      window.dispatchEvent(
        new CustomEvent("simulate-order", {
          detail: {
            region: "ap-seasia",
            city: "Jakarta, ID",
            amount,
            channel: "Instagram",
            orderId: "ORD-2850",
          },
        }),
      );

      // 2. Add unread real-time notification (increments bell badge in Header)
      addNotification({
        id: `notif-${Date.now()}`,
        title: "⚡ Order via Instagram",
        description: "Sarah Wilson purchased Premium Dashboard Pro for $249.99",
        type: "order",
        timestamp,
        read: false,
      });

      if (onSimulateOrder) onSimulateOrder(amount);
      triggerRefresh();
      toast.success("⚡ Webhook Received: Order #ORD-2850 ($249.99 via Instagram) reconciled!", {
        description: "Global Sales Map pin updated & revenue counter adjusted.",
      });
    } else if (type === "midtrans_qris") {
      const amount = 148.5;
      window.dispatchEvent(
        new CustomEvent("simulate-order", {
          detail: {
            region: "ap-seasia",
            city: "Surabaya, ID",
            amount,
            channel: "Online Store",
            orderId: "ORD-2851",
          },
        }),
      );

      addNotification({
        id: `notif-${Date.now()}`,
        title: "💳 Midtrans QRIS Settled",
        description: "Order #ORD-2851 payment verified via Bank BCA QRIS ($148.50)",
        type: "revenue",
        timestamp,
        read: false,
      });

      if (onSimulateOrder) onSimulateOrder(amount);
      triggerRefresh();
      toast.success("💳 Midtrans Iris Webhook: QRIS Settlement Confirmed ($148.50)");
    } else if (type === "affiliate_payout") {
      addNotification({
        id: `notif-${Date.now()}`,
        title: "🤝 Affiliate Payout Approved",
        description: "Disbursement #PAY-9815 ($350.00) transferred via Stripe Connect",
        type: "milestone",
        timestamp,
        read: false,
      });

      toast.success("🤝 Affiliate Webhook: Payout #PAY-9815 ($350.00) Approved & Disbursed");
    } else if (type === "low_stock") {
      addNotification({
        id: `notif-${Date.now()}`,
        title: "⚠️ Low Inventory Warning",
        description: "'Premium Dashboard Pro' stock reached critical threshold (2 remaining)",
        type: "alert",
        timestamp,
        read: false,
      });

      toast.warning(
        "⚠️ Inventory Alert: 'Premium Dashboard Pro' critical stock level (2 units left)",
      );
    } else if (type === "custom") {
      const amt = parseFloat(customAmount) || 100;
      window.dispatchEvent(
        new CustomEvent("simulate-order", {
          detail: {
            region: customRegion,
            city:
              customRegion === "us-east"
                ? "New York, USA"
                : customRegion === "eu-central"
                  ? "Frankfurt, DE"
                  : "Jakarta, ID",
            amount: amt,
            channel: customChannel,
            orderId: `ORD-${Math.floor(2852 + Math.random() * 500)}`,
          },
        }),
      );

      addNotification({
        id: `notif-${Date.now()}`,
        title: `⚡ New Order (${customChannel})`,
        description: `${customCustomer} purchased for $${amt.toFixed(2)}`,
        type: "order",
        timestamp,
        read: false,
      });

      if (onSimulateOrder) onSimulateOrder(amt);
      triggerRefresh();
      toast.success(
        `⚡ Custom Webhook: $${amt.toFixed(2)} from ${customCustomer} via ${customChannel}!`,
      );
      setOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 hover:border-amber-500/60 shadow-xs cursor-pointer font-semibold transition-all hover:scale-105 active:scale-95"
        >
          <Zap className="h-4 w-4 fill-amber-500 text-amber-500 animate-pulse" />
          <span>{t("eventSimulator")}</span>
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Zap className="h-5 w-5 text-amber-500" />
            {t("eventSimulatorTitle")}
          </DialogTitle>
          <p className="text-xs text-muted-foreground">{t("eventSimulatorDesc")}</p>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Quick Presets Grid */}
          <div>
            <label className="text-xs font-semibold text-foreground uppercase tracking-wider mb-2.5 block">
              {t("presetsTitle")}
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                onClick={() => triggerSimulation("instagram_order")}
                className="flex items-start gap-3 p-3 rounded-xl border border-border/80 bg-background hover:bg-muted/60 transition-all text-left group cursor-pointer hover:border-emerald-500/50"
              >
                <div className="p-2 rounded-lg bg-pink-500/10 text-pink-600 dark:text-pink-400 shrink-0">
                  <ShoppingCart className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-foreground">{t("instagramOrder")}</p>
                    <Badge
                      variant="outline"
                      className="text-[9px] bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                    >
                      +$249.99
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {t("instagramOrderDesc")}
                  </p>
                </div>
              </button>

              <button
                onClick={() => triggerSimulation("midtrans_qris")}
                className="flex items-start gap-3 p-3 rounded-xl border border-border/80 bg-background hover:bg-muted/60 transition-all text-left group cursor-pointer hover:border-blue-500/50"
              >
                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0">
                  <CreditCard className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-foreground">{t("midtransQris")}</p>
                    <Badge
                      variant="outline"
                      className="text-[9px] bg-blue-500/10 text-blue-600 border-blue-500/30"
                    >
                      +$148.50
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {t("midtransQrisDesc")}
                  </p>
                </div>
              </button>

              <button
                onClick={() => triggerSimulation("affiliate_payout")}
                className="flex items-start gap-3 p-3 rounded-xl border border-border/80 bg-background hover:bg-muted/60 transition-all text-left group cursor-pointer hover:border-purple-500/50"
              >
                <div className="p-2 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 shrink-0">
                  <Share2 className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-foreground">{t("affiliatePayout")}</p>
                    <Badge
                      variant="outline"
                      className="text-[9px] bg-purple-500/10 text-purple-600 border-purple-500/30"
                    >
                      $350.00
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {t("affiliatePayoutDesc")}
                  </p>
                </div>
              </button>

              <button
                onClick={() => triggerSimulation("low_stock")}
                className="flex items-start gap-3 p-3 rounded-xl border border-border/80 bg-background hover:bg-muted/60 transition-all text-left group cursor-pointer hover:border-amber-500/50"
              >
                <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
                  <AlertTriangle className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-foreground">{t("lowStock")}</p>
                    <Badge
                      variant="outline"
                      className="text-[9px] bg-amber-500/10 text-amber-600 border-amber-500/30"
                    >
                      2 left
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{t("lowStockDesc")}</p>
                </div>
              </button>
            </div>
          </div>

          {/* Custom Webhook Event Builder */}
          <div className="pt-2 border-t border-border/60">
            <div className="flex items-center gap-1.5 mb-2.5">
              <Sliders className="h-3.5 w-3.5 text-primary" />
              <label className="text-xs font-semibold text-foreground uppercase tracking-wider">
                {t("customSimulatorTitle")}
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground font-medium">
                  {t("customerName")}
                </label>
                <Input
                  value={customCustomer}
                  onChange={(e) => setCustomCustomer(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground font-medium">
                  {t("orderAmount")}
                </label>
                <Input
                  type="number"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground font-medium">
                  {t("salesChannel")}
                </label>
                <Select value={customChannel} onValueChange={setCustomChannel}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Instagram">Instagram</SelectItem>
                    <SelectItem value="Online Store">Online Store</SelectItem>
                    <SelectItem value="TikTok">TikTok Shop</SelectItem>
                    <SelectItem value="Shopify">Shopify</SelectItem>
                    <SelectItem value="Facebook">Facebook</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground font-medium">
                  {t("targetRegion")}
                </label>
                <Select value={customRegion} onValueChange={setCustomRegion}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ap-seasia">Southeast Asia (Jakarta/SG)</SelectItem>
                    <SelectItem value="us-east">North America East (NY)</SelectItem>
                    <SelectItem value="us-west">North America West (SF)</SelectItem>
                    <SelectItem value="eu-central">Europe Central (Frankfurt)</SelectItem>
                    <SelectItem value="ap-japan">East Asia (Tokyo)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button
              onClick={() => triggerSimulation("custom")}
              size="sm"
              className="w-full gap-2 text-xs font-semibold"
            >
              <Send className="h-3.5 w-3.5" />
              {t("dispatchWebhook")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
