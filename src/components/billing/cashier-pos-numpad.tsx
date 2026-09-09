"use client";

import React, { useState, useEffect, useCallback, useId } from "react";
import { useTranslations } from "next-intl";
import QRCode from "qrcode";
import {
  Calculator,
  RotateCcw,
  Delete,
  QrCode,
  CheckCircle2,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Receipt,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Building2,
  Clock,
  Printer,
  Copy,
  Check,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { generateQrisPayload } from "@/lib/qris-engine";
import { useAppearance } from "@/hooks/use-appearance";
import {
  DanaBrandIcon,
  LinkAjaBrandIcon,
  QrisBrandIcon,
} from "@/components/ui/brand-icons";

interface CashierPosNumpadProps {
  onTransactionComplete?: (tx: {
    amount: number;
    invoiceNumber: string;
    note: string;
  }) => void;
  className?: string;
}

const PRESET_AMOUNTS = [
  { label: "10K", value: 10000 },
  { label: "25K", value: 25000 },
  { label: "50K", value: 50000 },
  { label: "100K", value: 100000 },
  { label: "250K", value: 250000 },
  { label: "500K", value: 500000 },
];

export function CashierPosNumpad({
  onTransactionComplete,
  className,
}: CashierPosNumpadProps) {
  const t = useTranslations("qris");
  const { settings: appearance } = useAppearance();

  // Numpad state
  const [amountStr, setAmountStr] = useState<string>("0");
  const [orderNote, setOrderNote] = useState<string>("");
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // Active generated charge state
  const [activeQr, setActiveQr] = useState<{
    invoiceNumber: string;
    amount: number;
    qrDataUrl: string;
    payload: string;
    note: string;
    createdAt: Date;
    expiresAt: Date;
    status: "PENDING" | "PAID";
  } | null>(null);

  const [customerModalOpen, setCustomerModalOpen] = useState<boolean>(false);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(300);
  const [copiedPayload, setCopiedPayload] = useState<boolean>(false);

  const rawAmount = parseInt(amountStr.replace(/\D/g, "") || "0", 10);

  // Synthesize pleasant checkout audio chime
  const playAudioChime = useCallback((type: "key" | "generate" | "paid") => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      if (type === "key") {
        osc.type = "sine";
        osc.frequency.setValueAtTime(440, now);
        gain.gain.setValueAtTime(0.04, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.07);
      } else if (type === "generate") {
        osc.type = "triangle";
        osc.frequency.setValueAtTime(523.25, now); // C5
        osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.1); // E5
        gain.gain.setValueAtTime(0.09, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.26);
      } else if (type === "paid") {
        // Two-tone cheerful success chord
        osc.type = "sine";
        osc.frequency.setValueAtTime(587.33, now); // D5
        osc.frequency.exponentialRampToValueAtTime(880.0, now + 0.12); // A5
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.46);
      }
    } catch {
      // Ignore audio restriction
    }
  }, [soundEnabled]);

  // Numpad key handlers
  const handleDigit = (digit: string) => {
    playAudioChime("key");
    setAmountStr((prev) => {
      const digits = prev.replace(/\D/g, "");
      if (digits === "0") return digit;
      if (digits.length >= 9) return prev; // Limit max ~999M
      return digits + digit;
    });
  };

  const handleDoubleZero = (zeroes: string) => {
    playAudioChime("key");
    setAmountStr((prev) => {
      const digits = prev.replace(/\D/g, "");
      if (digits === "0" || digits === "") return "0";
      if (digits.length + zeroes.length > 9) return prev;
      return digits + zeroes;
    });
  };

  const handleBackspace = () => {
    playAudioChime("key");
    setAmountStr((prev) => {
      const digits = prev.replace(/\D/g, "");
      if (digits.length <= 1) return "0";
      return digits.slice(0, -1);
    });
  };

  const handleClear = () => {
    playAudioChime("key");
    setAmountStr("0");
  };

  const handlePreset = (val: number) => {
    playAudioChime("key");
    setAmountStr(val.toString());
  };

  // Generate dynamic QRIS from numpad
  const handleGenerateCharge = async () => {
    if (rawAmount <= 0) {
      toast.error("Please enter a valid transaction amount");
      return;
    }

    const inv = `POS-${Math.floor(100000 + Math.random() * 900000)}`;
    const payload = generateQrisPayload({
      amount: rawAmount,
      invoiceNumber: inv,
    });

    try {
      const qrDataUrl = await QRCode.toDataURL(payload, {
        width: 320,
        margin: 2,
        errorCorrectionLevel: "M",
        color: {
          dark: "#09090b",
          light: "#ffffff",
        },
      });

      const expires = new Date(Date.now() + 300 * 1000);
      setActiveQr({
        invoiceNumber: inv,
        amount: rawAmount,
        qrDataUrl,
        payload,
        note: orderNote.trim() || "Walk-in Customer",
        createdAt: new Date(),
        expiresAt: expires,
        status: "PENDING",
      });

      setSecondsRemaining(300);
      playAudioChime("generate");
      toast.success(`Generated dynamic QRIS for Rp ${rawAmount.toLocaleString("id-ID")}`);
    } catch {
      toast.error("Failed to generate QRIS payload");
    }
  };

  // Countdown timer for active QR
  useEffect(() => {
    if (!activeQr || activeQr.status === "PAID") return;
    const interval = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [activeQr]);

  // Simulate payment confirmation on POS
  const handleSimulatePayment = () => {
    if (!activeQr) return;
    setActiveQr((prev) => (prev ? { ...prev, status: "PAID" } : null));
    playAudioChime("paid");
    toast.success(
      `⚡ LUNAS! Rp ${activeQr.amount.toLocaleString("id-ID")} received via QRIS Bank Transfer`,
      {
        description: `Invoice: ${activeQr.invoiceNumber} | Ref: ${activeQr.note}`,
      }
    );
    if (onTransactionComplete) {
      onTransactionComplete({
        amount: activeQr.amount,
        invoiceNumber: activeQr.invoiceNumber,
        note: activeQr.note,
      });
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  const handleCopyPayload = () => {
    if (!activeQr) return;
    navigator.clipboard.writeText(activeQr.payload);
    setCopiedPayload(true);
    setTimeout(() => setCopiedPayload(false), 2000);
    toast.info("Raw ASPI QRIS payload copied to clipboard");
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* POS Top Control Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/70 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
              <Calculator className="h-5 w-5 text-primary" />
              Cashier POS Quick-Numpad Terminal
            </h3>
            <Badge variant="outline" className="text-[10px] font-mono border-border">
              NMID: ID1020030040050
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Rapid walk-in billing terminal with real-time dynamic QRIS generation and audio feedback
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="h-8 px-2.5 text-xs gap-1.5 cursor-pointer"
            title={soundEnabled ? "Audio chimes enabled" : "Muted"}
          >
            {soundEnabled ? (
              <>
                <Volume2 className="h-3.5 w-3.5 text-primary" />
                <span>Audio On</span>
              </>
            ) : (
              <>
                <VolumeX className="h-3.5 w-3.5 text-muted-foreground" />
                <span>Audio Muted</span>
              </>
            )}
          </Button>

          {activeQr && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCustomerModalOpen(true)}
              className="h-8 px-2.5 text-xs gap-1.5 cursor-pointer"
            >
              <Maximize2 className="h-3.5 w-3.5 text-primary" />
              <span>Customer Display</span>
            </Button>
          )}
        </div>
      </div>

      {/* POS Grid: Numpad on Left, Live Standee on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Cashier Pad (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Large Digital Amount Display */}
          <div className="rounded-xl border border-border/80 bg-muted/30 p-5 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-muted-foreground pb-2">
              <span className="font-medium uppercase tracking-wider">Total Charge Due</span>
              <span className="font-mono">IDR (Indonesian Rupiah)</span>
            </div>
            <div className="flex items-baseline justify-between py-2 border-b border-border/50">
              <span className="text-xl font-bold text-muted-foreground">Rp</span>
              <span className="text-4xl sm:text-5xl font-extrabold font-mono tracking-tight text-foreground truncate select-all">
                {rawAmount.toLocaleString("id-ID")}
              </span>
            </div>

            {/* Quick Denomination Chips */}
            <div className="pt-3">
              <div className="text-[11px] text-muted-foreground font-medium mb-1.5">
                Quick Amount Presets:
              </div>
              <div className="grid grid-cols-6 gap-1.5">
                {PRESET_AMOUNTS.map((chip) => (
                  <button
                    key={chip.value}
                    type="button"
                    onClick={() => handlePreset(chip.value)}
                    className="py-1 px-1.5 rounded-lg border border-border/70 hover:border-primary/60 bg-background hover:bg-primary/5 text-xs font-semibold text-foreground transition-all text-center cursor-pointer shadow-2xs"
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Reference Note Input */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-foreground">
              Order Tag / Table / Customer Note (Optional)
            </label>
            <Input
              placeholder="e.g. Table 04, Latte + Croissant, Order #9281"
              value={orderNote}
              onChange={(e) => setOrderNote(e.target.value)}
              className="text-xs h-9 bg-background"
            />
          </div>

          {/* Touch Numpad Grid */}
          <div className="rounded-xl border border-border/80 bg-background p-3 shadow-xs">
            <div className="grid grid-cols-4 gap-2">
              {/* Row 1 */}
              <button
                type="button"
                onClick={() => handleDigit("7")}
                className="h-14 rounded-lg border border-border/60 hover:border-primary/60 bg-muted/20 hover:bg-primary/5 active:scale-95 text-xl font-bold text-foreground transition-all cursor-pointer shadow-2xs flex items-center justify-center"
              >
                7
              </button>
              <button
                type="button"
                onClick={() => handleDigit("8")}
                className="h-14 rounded-lg border border-border/60 hover:border-primary/60 bg-muted/20 hover:bg-primary/5 active:scale-95 text-xl font-bold text-foreground transition-all cursor-pointer shadow-2xs flex items-center justify-center"
              >
                8
              </button>
              <button
                type="button"
                onClick={() => handleDigit("9")}
                className="h-14 rounded-lg border border-border/60 hover:border-primary/60 bg-muted/20 hover:bg-primary/5 active:scale-95 text-xl font-bold text-foreground transition-all cursor-pointer shadow-2xs flex items-center justify-center"
              >
                9
              </button>
              <button
                type="button"
                onClick={handleClear}
                className="h-14 rounded-lg border border-border/60 hover:border-destructive/60 bg-muted/30 hover:bg-destructive/10 active:scale-95 text-xs font-bold text-destructive transition-all cursor-pointer shadow-2xs flex items-center justify-center gap-1"
              >
                <RotateCcw className="h-4 w-4" />
                CLR
              </button>

              {/* Row 2 */}
              <button
                type="button"
                onClick={() => handleDigit("4")}
                className="h-14 rounded-lg border border-border/60 hover:border-primary/60 bg-muted/20 hover:bg-primary/5 active:scale-95 text-xl font-bold text-foreground transition-all cursor-pointer shadow-2xs flex items-center justify-center"
              >
                4
              </button>
              <button
                type="button"
                onClick={() => handleDigit("5")}
                className="h-14 rounded-lg border border-border/60 hover:border-primary/60 bg-muted/20 hover:bg-primary/5 active:scale-95 text-xl font-bold text-foreground transition-all cursor-pointer shadow-2xs flex items-center justify-center"
              >
                5
              </button>
              <button
                type="button"
                onClick={() => handleDigit("6")}
                className="h-14 rounded-lg border border-border/60 hover:border-primary/60 bg-muted/20 hover:bg-primary/5 active:scale-95 text-xl font-bold text-foreground transition-all cursor-pointer shadow-2xs flex items-center justify-center"
              >
                6
              </button>
              <button
                type="button"
                onClick={handleBackspace}
                className="h-14 rounded-lg border border-border/60 hover:border-primary/60 bg-muted/30 hover:bg-primary/5 active:scale-95 text-xs font-bold text-foreground transition-all cursor-pointer shadow-2xs flex items-center justify-center gap-1"
              >
                <Delete className="h-4 w-4" />
                DEL
              </button>

              {/* Row 3 */}
              <button
                type="button"
                onClick={() => handleDigit("1")}
                className="h-14 rounded-lg border border-border/60 hover:border-primary/60 bg-muted/20 hover:bg-primary/5 active:scale-95 text-xl font-bold text-foreground transition-all cursor-pointer shadow-2xs flex items-center justify-center"
              >
                1
              </button>
              <button
                type="button"
                onClick={() => handleDigit("2")}
                className="h-14 rounded-lg border border-border/60 hover:border-primary/60 bg-muted/20 hover:bg-primary/5 active:scale-95 text-xl font-bold text-foreground transition-all cursor-pointer shadow-2xs flex items-center justify-center"
              >
                2
              </button>
              <button
                type="button"
                onClick={() => handleDigit("3")}
                className="h-14 rounded-lg border border-border/60 hover:border-primary/60 bg-muted/20 hover:bg-primary/5 active:scale-95 text-xl font-bold text-foreground transition-all cursor-pointer shadow-2xs flex items-center justify-center"
              >
                3
              </button>
              <button
                type="button"
                onClick={() => handleDoubleZero("00")}
                className="h-14 rounded-lg border border-border/60 hover:border-primary/60 bg-muted/20 hover:bg-primary/5 active:scale-95 text-lg font-bold text-foreground transition-all cursor-pointer shadow-2xs flex items-center justify-center"
              >
                00
              </button>

              {/* Row 4 */}
              <button
                type="button"
                onClick={() => handleDigit("0")}
                className="h-14 rounded-lg border border-border/60 hover:border-primary/60 bg-muted/20 hover:bg-primary/5 active:scale-95 text-xl font-bold text-foreground transition-all cursor-pointer shadow-2xs flex items-center justify-center"
              >
                0
              </button>
              <button
                type="button"
                onClick={() => handleDoubleZero("000")}
                className="h-14 rounded-lg border border-border/60 hover:border-primary/60 bg-muted/20 hover:bg-primary/5 active:scale-95 text-base font-bold text-foreground transition-all cursor-pointer shadow-2xs flex items-center justify-center"
              >
                000
              </button>
              <button
                type="button"
                onClick={handleGenerateCharge}
                disabled={rawAmount <= 0}
                className="col-span-2 h-14 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-base transition-all active:scale-[0.98] cursor-pointer shadow-md flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
              >
                <QrCode className="h-5 w-5" />
                <span>Charge & Generate QRIS</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Customer Standee & Live Dynamic QR (5 cols) */}
        <div className="lg:col-span-5 flex flex-col items-center justify-start">
          {activeQr ? (
            <div className="w-full max-w-sm rounded-2xl border-2 border-border/80 bg-card p-5 text-card-foreground shadow-xl">
              {/* Standee Header */}
              <div className="flex items-center justify-between border-b border-border/70 pb-3">
                <div className="flex items-center gap-2">
                  <div className="rounded-lg bg-primary/10 p-1.5 text-primary border border-primary/20">
                    <QrisBrandIcon size={22} />
                  </div>
                  <div>
                    <h4 className="text-base font-black tracking-tight leading-none text-foreground">
                      QRIS DYNAMIC
                    </h4>
                    <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest mt-0.5">
                      Merchant Presented Mode
                    </p>
                  </div>
                </div>
                <Badge
                  variant={activeQr.status === "PAID" ? "default" : "outline"}
                  className="text-xs font-semibold"
                >
                  {activeQr.status === "PAID" ? (
                    <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="h-3.5 w-3.5" /> LUNAS
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-primary">
                      <Clock className="h-3 w-3" /> {formatTime(secondsRemaining)}
                    </span>
                  )}
                </Badge>
              </div>

              {/* Merchant Title */}
              <div className="text-center pt-3 pb-1">
                <h5 className="text-sm font-bold tracking-tight">NEXUS COMMERCE STORE</h5>
                <p className="text-[10px] text-muted-foreground">
                  NMID: ID1020030040050 • A01
                </p>
                <div className="mt-2 inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-base font-extrabold text-primary border border-primary/20">
                  Rp {activeQr.amount.toLocaleString("id-ID")}
                </div>
              </div>

              {/* QR Code Container with High-Contrast White Background */}
              <div className="my-3 flex flex-col items-center justify-center p-3 rounded-xl bg-white border border-border shadow-inner">
                {activeQr.status === "PAID" ? (
                  <div className="w-56 h-56 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 flex flex-col items-center justify-center text-center p-4 border border-emerald-200 dark:border-emerald-800">
                    <CheckCircle2 className="h-16 w-16 text-emerald-600 dark:text-emerald-400 mb-2 animate-bounce" />
                    <span className="text-lg font-black text-emerald-700 dark:text-emerald-300">
                      PAYMENT SUCCESS
                    </span>
                    <span className="text-xs text-muted-foreground mt-1 font-mono">
                      {activeQr.invoiceNumber}
                    </span>
                  </div>
                ) : (
                  <img
                    src={activeQr.qrDataUrl}
                    alt="Customer Scan QRIS"
                    className="w-56 h-56 object-contain rounded-md"
                  />
                )}
                <div className="mt-2 flex items-center justify-center gap-1.5 text-[10px] font-bold text-zinc-900 tracking-wider">
                  <QrisBrandIcon size={14} />
                  <span>SATU QRIS UNTUK SEMUA</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-1">
                {activeQr.status === "PENDING" && (
                  <Button
                    size="sm"
                    onClick={handleSimulatePayment}
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs h-9 gap-1.5 cursor-pointer shadow-xs"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Simulate Customer Payment
                  </Button>
                )}

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopyPayload}
                    className="flex-1 text-xs h-8 gap-1 cursor-pointer"
                  >
                    {copiedPayload ? (
                      <>
                        <Check className="h-3 w-3 text-primary" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" />
                        <span>Payload</span>
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCustomerModalOpen(true)}
                    className="flex-1 text-xs h-8 gap-1 cursor-pointer"
                  >
                    <Maximize2 className="h-3 w-3" />
                    <span>Expand</span>
                  </Button>
                </div>
              </div>

              {/* Footer Note */}
              <div className="mt-3 pt-2 border-t border-border/60 flex items-center justify-between text-[10px] text-muted-foreground">
                <span>Ref: {activeQr.note}</span>
                <span className="font-mono">{activeQr.invoiceNumber}</span>
              </div>
            </div>
          ) : (
            <div className="w-full max-w-sm rounded-2xl border border-dashed border-border/80 p-8 flex flex-col items-center justify-center text-center text-muted-foreground space-y-3 min-h-[380px]">
              <div className="p-4 rounded-full bg-muted/50 text-muted-foreground">
                <QrCode className="h-12 w-12 stroke-1" />
              </div>
              <h5 className="text-sm font-semibold text-foreground">Terminal Ready for Billing</h5>
              <p className="text-xs max-w-[220px]">
                Enter transaction amount on the numpad and press <strong>Charge</strong> to generate dynamic QRIS.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Customer Facing Fullscreen Display Modal */}
      {activeQr && (
        <Dialog open={customerModalOpen} onOpenChange={setCustomerModalOpen}>
          <DialogContent className="sm:max-w-[440px] text-center p-6">
            <DialogHeader>
              <div className="flex items-center justify-center gap-2 mb-1">
                <div className="rounded-lg bg-primary/10 p-1.5 text-primary border border-primary/20">
                  <QrisBrandIcon size={20} />
                </div>
                <DialogTitle className="text-lg font-black tracking-tight">
                  SCAN UNTUK MEMBAYAR
                </DialogTitle>
              </div>
              <DialogDescription className="text-xs">
                NEXUS COMMERCE STORE • ID1020030040050
              </DialogDescription>
            </DialogHeader>

            <div className="py-2">
              <div className="text-2xl font-black text-primary font-mono py-1">
                Rp {activeQr.amount.toLocaleString("id-ID")}
              </div>
              <div className="p-4 bg-white rounded-2xl border border-border my-2 flex justify-center shadow-lg">
                <img
                  src={activeQr.qrDataUrl}
                  alt="Customer QRIS Code"
                  className="w-64 h-64 object-contain"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Scan dengan BCA, Mandiri, BRI, BNI, DANA, GoPay, OVO, ShopeePay, atau LinkAja
              </p>
            </div>

            {activeQr.status === "PENDING" && (
              <Button
                onClick={() => {
                  handleSimulatePayment();
                  setCustomerModalOpen(false);
                }}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs h-9 gap-1.5"
              >
                <CheckCircle2 className="h-4 w-4" />
                Simulate Customer Scan & Pay
              </Button>
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
