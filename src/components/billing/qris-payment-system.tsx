"use client";

import React, { useState, useEffect, useId } from "react";
import QRCode from "qrcode";
import { useTranslations } from "next-intl";
import {
  CreditCard,
  Building2,
  ArrowDownRight,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  RefreshCw,
  Wallet,
  Smartphone,
  ExternalLink,
  ShieldCheck,
  Receipt,
  Download,
  FileCheck,
  Printer,
} from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  QrisBrandIcon,
  DanaBrandIcon,
  AlipayBrandIcon,
  LinkAjaBrandIcon,
  VisaBrandIcon,
  MastercardBrandIcon,
} from "@/components/ui/brand-icons";
import { formatCurrency, cn } from "@/lib/utils";
import type { QrisTransaction, WithdrawalDisbursement, WithdrawalMethod } from "@/lib/qris-engine";

export function QrisPaymentSystem() {
  const t = useTranslations("billing");
  const tcommon = useTranslations("common");

  // Ledger state
  const [availableBalance, setAvailableBalance] = useState<number>(18750000);
  const [pendingBalance, setPendingBalance] = useState<number>(0);
  const [totalWithdrawn, setTotalWithdrawn] = useState<number>(12500000);
  const [totalInbound, setTotalInbound] = useState<number>(31250000);
  const [transactions, setTransactions] = useState<QrisTransaction[]>([]);
  const [disbursements, setDisbursements] = useState<WithdrawalDisbursement[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // QR Terminal State
  const [inputAmount, setInputAmount] = useState<string>("150000");
  const [customerName, setCustomerName] = useState<string>("Pelanggan Kasir");
  const [currentTx, setCurrentTx] = useState<QrisTransaction | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [generatingQr, setGeneratingQr] = useState<boolean>(false);
  const [simulatingPayment, setSimulatingPayment] = useState<boolean>(false);
  const [simulatedBank, setSimulatedBank] = useState<string>("BCA Mobile");
  const [copiedPayload, setCopiedPayload] = useState<boolean>(false);

  // Withdrawal Wizard State
  const [isWithdrawOpen, setIsWithdrawOpen] = useState<boolean>(false);
  const [withdrawMethod, setWithdrawMethod] = useState<WithdrawalMethod>("dana");
  const [withdrawAmount, setWithdrawAmount] = useState<string>("500000");
  const [destAccount, setDestAccount] = useState<string>("");
  const [destName, setDestName] = useState<string>("");
  const [bankCode, setBankCode] = useState<string>("BCA");
  const [cardType, setCardType] = useState<"visa" | "mastercard">("visa");
  const [withdrawNotes, setWithdrawNotes] = useState<string>("");
  const [withdrawing, setWithdrawing] = useState<boolean>(false);
  const [withdrawError, setWithdrawError] = useState<string>("");

  // Receipt Modal State
  const [receiptDisb, setReceiptDisb] = useState<WithdrawalDisbursement | null>(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState<boolean>(false);

  // Standee Modal State
  const [isStandeeOpen, setIsStandeeOpen] = useState<boolean>(false);

  // Load ledger state from API
  const fetchLedger = async () => {
    try {
      setRefreshing(true);
      const res = await fetch("/api/billing/qris");
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setAvailableBalance(data.availableBalance);
          setPendingBalance(data.pendingBalance);
          setTotalWithdrawn(data.totalWithdrawn);
          setTotalInbound(data.totalInbound);
          setTransactions(data.transactions || []);
          setDisbursements(data.disbursements || []);
        }
      }
    } catch (e) {
      console.error("Failed to fetch QRIS ledger:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLedger();
  }, []);

  // Real-time SSE Stream Auto-sensing for POS Terminal & Ledger
  useEffect(() => {
    let es: EventSource | null = null;
    try {
      es = new EventSource("/api/billing/qris/stream");
      es.addEventListener("payment_confirmed", (e) => {
        try {
          const payload = JSON.parse(e.data);
          if (payload?.transaction) {
            setTransactions((prev) => {
              const exists = prev.some((t) => t.id === payload.transaction.id);
              if (exists) {
                return prev.map((t) => (t.id === payload.transaction.id ? payload.transaction : t));
              }
              return [payload.transaction, ...prev];
            });

            if (payload.availableBalance !== undefined) {
              setAvailableBalance(payload.availableBalance);
            }
            if (payload.pendingBalance !== undefined) {
              setPendingBalance(payload.pendingBalance);
            }

            setCurrentTx((prev) => {
              if (
                prev &&
                (prev.id === payload.transaction.id ||
                  prev.invoiceNumber === payload.transaction.invoiceNumber)
              ) {
                return payload.transaction;
              }
              return prev;
            });

            toast.success(
              `⚡ Payment Verified! Rp ${payload.transaction.amount.toLocaleString("id-ID")} received via ${payload.transaction.sourceBank}`,
            );
          }
        } catch {
          // ignore
        }
      });

      es.addEventListener("withdrawal_completed", (e) => {
        try {
          const payload = JSON.parse(e.data);
          if (payload?.disbursement) {
            setDisbursements((prev) => [payload.disbursement, ...prev]);
            if (payload.availableBalance !== undefined) {
              setAvailableBalance(payload.availableBalance);
            }
          }
        } catch {
          // ignore
        }
      });
    } catch {
      // EventSource failed or not supported in environment
    }

    return () => {
      if (es) es.close();
    };
  }, []);

  // Generate QR image whenever currentTx changes
  useEffect(() => {
    if (currentTx?.qrisPayload) {
      QRCode.toDataURL(currentTx.qrisPayload, {
        width: 300,
        margin: 1,
        color: {
          dark: "#0F172A",
          light: "#FFFFFF",
        },
      })
        .then(setQrDataUrl)
        .catch(console.error);
    }
  }, [currentTx]);

  // Handle Generate Dynamic QRIS
  const handleGenerateQris = async (amountNum?: number) => {
    try {
      setGeneratingQr(true);
      const amt = amountNum ?? Number(inputAmount);
      if (!amt || amt <= 0) return;

      const res = await fetch("/api/billing/qris", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amt,
          customerName: customerName || "Customer",
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.transaction) {
          setCurrentTx(data.transaction);
          fetchLedger();
        }
      }
    } catch (e) {
      console.error("Failed to generate QRIS:", e);
    } finally {
      setGeneratingQr(false);
    }
  };

  // Initialize first QR code on mount
  useEffect(() => {
    if (!currentTx && !generatingQr) {
      handleGenerateQris(150000);
    }
  }, []);

  // Handle Simulate Bank Payment
  const handleSimulatePayment = async () => {
    if (!currentTx || currentTx.status === "PAID") return;
    try {
      setSimulatingPayment(true);
      const res = await fetch("/api/billing/qris", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactionId: currentTx.id,
          sourceBank: simulatedBank,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.transaction) {
          setCurrentTx(data.transaction);
          setAvailableBalance(data.availableBalance);
          setPendingBalance(data.pendingBalance);
          fetchLedger();
        }
      }
    } catch (e) {
      console.error("Failed to simulate QR payment:", e);
    } finally {
      setSimulatingPayment(false);
    }
  };

  // Handle Withdraw Submission
  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    setWithdrawError("");
    const amt = Number(withdrawAmount);

    if (!amt || amt <= 0) {
      setWithdrawError("Please enter a valid withdrawal amount");
      return;
    }

    if (amt > availableBalance) {
      setWithdrawError("Insufficient available balance");
      return;
    }

    if (!destAccount.trim()) {
      setWithdrawError("Destination account / phone / card number is required");
      return;
    }

    if (!destName.trim()) {
      setWithdrawError("Beneficiary name is required");
      return;
    }

    try {
      setWithdrawing(true);
      const res = await fetch("/api/billing/qris/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method: withdrawMethod,
          destinationName: destName,
          destinationAccount: destAccount,
          amount: amt,
          bankCode: withdrawMethod === "bank_transfer" ? bankCode : undefined,
          cardType: withdrawMethod === "card_oct" ? cardType : undefined,
          notes: withdrawNotes,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setWithdrawError(data.error || "Failed to process withdrawal");
        return;
      }

      setIsWithdrawOpen(false);
      setReceiptDisb(data.disbursement);
      setIsReceiptOpen(true);
      fetchLedger();
    } catch (err: any) {
      setWithdrawError(err.message || "Failed to process withdrawal");
    } finally {
      setWithdrawing(false);
    }
  };

  const copyPayload = () => {
    if (currentTx?.qrisPayload) {
      navigator.clipboard.writeText(currentTx.qrisPayload);
      setCopiedPayload(true);
      setTimeout(() => setCopiedPayload(false), 2000);
    }
  };

  // Quick preset amounts
  const presets = [50000, 100000, 250000, 500000, 1000000, 2500000];

  return (
    <div className="space-y-6">
      {/* Top Banner / Hero Overview */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-red-700 p-6 text-white shadow-lg">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold backdrop-blur-md">
              <QrisBrandIcon size={14} className="text-white" />
              <span>Stand-Alone QRIS & Direct Bank Payout Engine</span>
              <span className="rounded bg-emerald-400 px-1.5 py-0.2 text-[10px] font-bold text-gray-900">
                Independent (No Midtrans)
              </span>
            </div>
            <h2 className="text-2xl font-black tracking-tight sm:text-3xl">
              QRIS Instant Payment & Multi-Channel Income Settlement
            </h2>
            <p className="max-w-2xl text-sm text-red-100">
              Receive real-money payments from 30+ Indonesian banks & e-wallets (BCA, Mandiri, BRI,
              BNI, DANA, GoPay, OVO). Withdraw your store earnings directly to DANA, Bank Transfer,
              Visa/Mastercard OCT, Alipay, or LinkAja with instant real-time ledger clearance.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsStandeeOpen(true)}
              className="border-white/30 bg-white/10 text-white hover:bg-white/20"
            >
              <Printer className="mr-1.5 h-3.5 w-3.5" />
              Counter Standee (A5/A6)
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchLedger}
              disabled={refreshing}
              className="border-white/30 bg-white/10 text-white hover:bg-white/20"
            >
              <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", refreshing && "animate-spin")} />
              Sync Ledger
            </Button>
            <Button
              onClick={() => {
                setWithdrawError("");
                setIsWithdrawOpen(true);
              }}
              className="bg-white text-red-700 shadow-md hover:bg-red-50 font-semibold"
            >
              <ArrowDownRight className="mr-1.5 h-4 w-4 text-red-600" />
              Withdraw Incomes
            </Button>
          </div>
        </div>

        {/* Decorative background glow */}
        <div className="absolute -right-10 -bottom-10 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
      </div>

      {/* Balance & Ledger KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Available Income */}
        <Card className="border-l-4 border-l-emerald-500 shadow-sm">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Available Income
              </span>
              <div className="rounded-lg bg-emerald-100 dark:bg-emerald-950/50 p-2 text-emerald-600">
                <Wallet className="h-4 w-4" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {formatCurrency(availableBalance, "IDR")}
            </div>
            <p className="mt-1 flex items-center text-xs text-emerald-600 font-medium">
              <CheckCircle2 className="mr-1 h-3 w-3" />
              Ready for immediate payout
            </p>
          </CardContent>
        </Card>

        {/* Pending Settlement */}
        <Card className="border-l-4 border-l-amber-500 shadow-sm">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Pending Settlement
              </span>
              <div className="rounded-lg bg-amber-100 dark:bg-amber-950/50 p-2 text-amber-600">
                <Clock className="h-4 w-4" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {formatCurrency(pendingBalance, "IDR")}
            </div>
            <p className="mt-1 flex items-center text-xs text-amber-600 font-medium">
              <Clock className="mr-1 h-3 w-3" />
              Unpaid customer dynamic QR
            </p>
          </CardContent>
        </Card>

        {/* Total Inbound QRIS */}
        <Card className="border-l-4 border-l-blue-500 shadow-sm">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Total Inbound QRIS
              </span>
              <div className="rounded-lg bg-blue-100 dark:bg-blue-950/50 p-2 text-blue-600">
                <ArrowUpRight className="h-4 w-4" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {formatCurrency(totalInbound, "IDR")}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Lifetime sales via QRIS</p>
          </CardContent>
        </Card>

        {/* Total Withdrawn */}
        <Card className="border-l-4 border-l-purple-500 shadow-sm">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Total Withdrawn
              </span>
              <div className="rounded-lg bg-purple-100 dark:bg-purple-950/50 p-2 text-purple-600">
                <ArrowDownRight className="h-4 w-4" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {formatCurrency(totalWithdrawn, "IDR")}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Disbursed to Bank & DANA</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Grid: QRIS POS Terminal & Live Operations */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: QR Terminal Generator & Simulation Controls (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <QrisBrandIcon size={20} className="text-red-600" />
                    Interactive QRIS Merchant Point of Sale
                  </CardTitle>
                  <CardDescription>
                    Generate EMVCo-compliant ASPI dynamic QR code for any billing charge
                  </CardDescription>
                </div>
                <Badge
                  variant="outline"
                  className="text-xs font-mono border-red-200 text-red-600 dark:border-red-800"
                >
                  NMID: ID1020030040050
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    Payment Amount (IDR)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-sm font-semibold text-gray-400">
                      Rp
                    </span>
                    <Input
                      type="number"
                      value={inputAmount}
                      onChange={(e) => setInputAmount(e.target.value)}
                      className="pl-9 font-semibold text-base"
                      placeholder="50000"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    Customer / Table Reference
                  </label>
                  <Input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Customer Name / Order #"
                  />
                </div>
              </div>

              {/* Quick Preset Buttons */}
              <div className="space-y-1.5">
                <span className="text-xs text-muted-foreground">Quick Presets:</span>
                <div className="flex flex-wrap gap-2">
                  {presets.map((p) => (
                    <Button
                      key={p}
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setInputAmount(p.toString());
                        handleGenerateQris(p);
                      }}
                      className={cn(
                        "text-xs h-7",
                        Number(inputAmount) === p &&
                          "border-red-500 bg-red-50 text-red-600 dark:bg-red-950/40",
                      )}
                    >
                      {formatCurrency(p, "IDR")}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <Button
                  onClick={() => handleGenerateQris()}
                  disabled={generatingQr}
                  className="bg-red-600 hover:bg-red-700 text-white font-medium flex-1"
                >
                  {generatingQr ? "Generating..." : "Generate New Dynamic QRIS"}
                </Button>
              </div>

              {/* Bank Transfer Simulation Section */}
              <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-700 p-4 bg-gray-50/50 dark:bg-gray-900/40 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Smartphone className="h-4 w-4 text-emerald-600" />
                    <span className="text-xs font-bold uppercase text-gray-700 dark:text-gray-300 tracking-wider">
                      Real-Money / Bank Scan Simulator
                    </span>
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    Test live bank-to-ledger clearance
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <Select value={simulatedBank} onValueChange={setSimulatedBank}>
                    <SelectTrigger className="w-full sm:w-[200px] h-9">
                      <SelectValue placeholder="Source Bank / Wallet" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BCA Mobile">BCA Mobile</SelectItem>
                      <SelectItem value="Mandiri Livin">Mandiri Livin</SelectItem>
                      <SelectItem value="BRImo">BRImo</SelectItem>
                      <SelectItem value="BNI Mobile">BNI Mobile</SelectItem>
                      <SelectItem value="DANA">DANA e-Wallet</SelectItem>
                      <SelectItem value="GoPay">GoPay</SelectItem>
                      <SelectItem value="ShopeePay">ShopeePay</SelectItem>
                      <SelectItem value="LinkAja">LinkAja</SelectItem>
                    </SelectContent>
                  </Select>

                  <Button
                    onClick={handleSimulatePayment}
                    disabled={!currentTx || currentTx.status === "PAID" || simulatingPayment}
                    className={cn(
                      "w-full sm:w-auto h-9 font-semibold",
                      currentTx?.status === "PAID"
                        ? "bg-emerald-600 text-white hover:bg-emerald-600"
                        : "bg-emerald-600 hover:bg-emerald-700 text-white",
                    )}
                  >
                    {simulatingPayment ? (
                      <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : currentTx?.status === "PAID" ? (
                      <CheckCircle2 className="mr-1.5 h-4 w-4" />
                    ) : (
                      <Smartphone className="mr-1.5 h-4 w-4" />
                    )}
                    {currentTx?.status === "PAID"
                      ? "Payment Confirmed (Paid)"
                      : `Simulate Scan & Pay with ${simulatedBank}`}
                  </Button>
                </div>

                {currentTx?.status === "PAID" && (
                  <div className="rounded-md bg-emerald-50 dark:bg-emerald-950/40 p-2.5 text-xs text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      Paid via <strong>{currentTx.sourceBank}</strong>. RRN:{" "}
                      <code className="font-mono">{currentTx.rrn}</code>
                    </span>
                    <span className="font-bold">
                      +{formatCurrency(currentTx.amount, "IDR")} Credited
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Raw EMVCo Payload Inspector */}
          {currentTx && (
            <Card className="shadow-sm">
              <CardHeader className="p-4 pb-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4 text-emerald-600" />
                    ASPI QRIS Standard Payload & CRC-16 Checksum
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={copyPayload}
                    className="h-7 px-2 text-xs gap-1"
                  >
                    {copiedPayload ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        Copy Raw
                      </>
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-1">
                <div className="rounded-md bg-zinc-900 p-3 font-mono text-xs text-emerald-400 break-all leading-relaxed select-all">
                  {currentTx.qrisPayload}
                </div>
                <div className="mt-2 flex flex-wrap items-center justify-between text-[11px] text-muted-foreground gap-2">
                  <span>Standard: ASPI / BI-FAST Merchant Presented Mode</span>
                  <span className="font-mono text-gray-600 dark:text-gray-400">
                    CRC16: {currentTx.qrisPayload.slice(-4)} (CCITT Verified)
                  </span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: Authentic QRIS Standee Visual Card (5 cols) */}
        <div className="lg:col-span-5 flex flex-col items-center">
          <div className="w-full max-w-sm rounded-2xl border-2 border-red-500 bg-white p-5 text-gray-900 shadow-2xl dark:bg-zinc-950 dark:text-zinc-100 dark:border-red-600">
            {/* Authentic QRIS Header Banner */}
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="rounded bg-red-600 p-1.5 text-white">
                  <QrisBrandIcon size={24} />
                </div>
                <div>
                  <h3 className="text-base font-black tracking-tight leading-none text-red-600">
                    QRIS
                  </h3>
                  <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-widest">
                    Quick Response Code Indonesia Standard
                  </p>
                </div>
              </div>
              <span className="rounded bg-gray-100 dark:bg-zinc-800 px-2 py-0.5 text-[10px] font-bold text-gray-600 dark:text-gray-300">
                GPN
              </span>
            </div>

            {/* Merchant Details */}
            <div className="py-3 text-center">
              <h4 className="text-sm font-bold tracking-tight uppercase">NEXUS COMMERCE STORE</h4>
              <p className="text-[11px] text-gray-500 dark:text-zinc-400">
                NMID: ID1020030040050 • A01
              </p>
              <div className="mt-2 inline-flex items-center rounded-full bg-red-50 dark:bg-red-950/50 px-3 py-1 text-base font-extrabold text-red-600">
                {currentTx ? formatCurrency(currentTx.amount, "IDR") : "Rp 0"}
              </div>
            </div>

            {/* QR Matrix Render */}
            <div className="relative my-1 flex items-center justify-center rounded-xl bg-white p-4 shadow-inner border border-gray-200">
              {qrDataUrl ? (
                <img src={qrDataUrl} alt="QRIS Payment Code" className="h-56 w-56 object-contain" />
              ) : (
                <div className="flex h-56 w-56 items-center justify-center text-xs text-gray-400">
                  <RefreshCw className="h-6 w-6 animate-spin" />
                </div>
              )}

              {/* Center ASPI Emblem */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="rounded-lg bg-white p-1.5 shadow-md border border-gray-200">
                  <QrisBrandIcon size={20} className="text-red-600" />
                </div>
              </div>

              {/* Status Overlay if Paid */}
              {currentTx?.status === "PAID" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center rounded-xl bg-emerald-950/85 backdrop-blur-sm text-white animate-in fade-in zoom-in">
                  <CheckCircle2 className="h-16 w-16 text-emerald-400" />
                  <span className="mt-2 text-base font-black uppercase tracking-wider text-emerald-300">
                    Payment Verified
                  </span>
                  <span className="text-xs text-emerald-100">{currentTx.sourceBank}</span>
                </div>
              )}
            </div>

            {/* Card Footer: Accepted Wallets / Apps */}
            <div className="mt-4 pt-3 border-t border-gray-100 dark:border-zinc-800 text-center">
              <p className="text-[10px] text-gray-400 mb-2">
                Supported for direct scanning by all banking apps & e-wallets:
              </p>
              <div className="flex items-center justify-center gap-3 text-xs opacity-75 grayscale hover:grayscale-0 transition-all">
                <DanaBrandIcon size={18} />
                <LinkAjaBrandIcon size={18} />
                <span className="font-bold text-[10px] text-blue-600">BCA</span>
                <span className="font-bold text-[10px] text-amber-600">MANDIRI</span>
                <span className="font-bold text-[10px] text-blue-700">BRI</span>
                <span className="font-bold text-[10px] text-orange-600">BNI</span>
              </div>
              <div className="mt-3 flex items-center justify-between text-[10px] text-gray-400">
                <span>Invoice: {currentTx?.invoiceNumber || "INV-..."}</span>
                <span>Ref: {currentTx?.rrn || "..."}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Transactions & Withdrawals Tables */}
      <Tabs defaultValue="inbound" className="w-full">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-3">
          <TabsList>
            <TabsTrigger value="inbound" className="gap-2">
              <ArrowUpRight className="h-4 w-4 text-emerald-600" />
              Inbound Payments ({transactions.length})
            </TabsTrigger>
            <TabsTrigger value="disbursements" className="gap-2">
              <ArrowDownRight className="h-4 w-4 text-purple-600" />
              Income Withdrawals ({disbursements.length})
            </TabsTrigger>
          </TabsList>

          <Button
            size="sm"
            onClick={() => {
              setWithdrawError("");
              setIsWithdrawOpen(true);
            }}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5"
          >
            <ArrowDownRight className="h-3.5 w-3.5" />
            Withdraw Income to DANA / Bank / Card
          </Button>
        </div>

        {/* Tab 1: Inbound QRIS Payments */}
        <TabsContent value="inbound" className="pt-4">
          <Card>
            <CardHeader className="p-4 pb-3">
              <CardTitle className="text-base font-bold">Inbound QRIS Payments History</CardTitle>
              <CardDescription>
                Live record of incoming QR transactions from mobile banking and digital wallets
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Source Provider</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>RRN</TableHead>
                      <TableHead>Date / Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          No transactions recorded yet
                        </TableCell>
                      </TableRow>
                    ) : (
                      transactions.map((tx) => (
                        <TableRow key={tx.id}>
                          <TableCell className="font-mono text-xs font-semibold">
                            {tx.invoiceNumber}
                          </TableCell>
                          <TableCell className="text-sm font-medium">{tx.customerName}</TableCell>
                          <TableCell>
                            <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                              {tx.sourceBank.includes("DANA") ? (
                                <DanaBrandIcon size={14} />
                              ) : (
                                <Building2 className="h-3.5 w-3.5 text-blue-600" />
                              )}
                              {tx.sourceBank}
                            </span>
                          </TableCell>
                          <TableCell className="font-bold text-sm text-emerald-600">
                            +{formatCurrency(tx.amount, "IDR")}
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={cn(
                                "text-[11px]",
                                tx.status === "PAID"
                                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                  : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
                              )}
                            >
                              {tx.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {tx.rrn}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {new Date(tx.paidAt || tx.createdAt).toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Withdrawals & Disbursements */}
        <TabsContent value="disbursements" className="pt-4">
          <Card>
            <CardHeader className="p-4 pb-3">
              <CardTitle className="text-base font-bold">
                Income Withdrawal & Payout Ledger
              </CardTitle>
              <CardDescription>
                Transfers sent to DANA, Bank accounts (BCA, Mandiri, BRI, BNI), Visa/Mastercard OCT,
                and Alipay
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Payout ID</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Destination</TableHead>
                      <TableHead>Gross Amount</TableHead>
                      <TableHead>Fee</TableHead>
                      <TableHead>Net Transferred</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Receipt</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {disbursements.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                          No disbursements made yet
                        </TableCell>
                      </TableRow>
                    ) : (
                      disbursements.map((d) => (
                        <TableRow key={d.id}>
                          <TableCell className="font-mono text-xs font-semibold">
                            {d.disbursementNumber}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              {d.method === "dana" && <DanaBrandIcon size={16} />}
                              {d.method === "bank_transfer" && (
                                <Building2 className="h-4 w-4 text-blue-600" />
                              )}
                              {d.method === "card_oct" &&
                                (d.cardType === "mastercard" ? (
                                  <MastercardBrandIcon size={16} />
                                ) : (
                                  <VisaBrandIcon size={16} />
                                ))}
                              {d.method === "alipay" && <AlipayBrandIcon size={16} />}
                              {d.method === "linkaja" && <LinkAjaBrandIcon size={16} />}
                              <span className="text-xs font-medium capitalize">
                                {d.method.replace("_", " ")}
                                {d.bankCode && ` (${d.bankCode})`}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-xs font-medium">{d.destinationName}</div>
                            <div className="font-mono text-[11px] text-muted-foreground">
                              {d.destinationAccount}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs font-medium">
                            {formatCurrency(d.grossAmount, "IDR")}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {d.fee === 0 ? "Free" : formatCurrency(d.fee, "IDR")}
                          </TableCell>
                          <TableCell className="font-bold text-sm text-purple-600">
                            {formatCurrency(d.netAmount, "IDR")}
                          </TableCell>
                          <TableCell>
                            <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-[11px]">
                              {d.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setReceiptDisb(d);
                                setIsReceiptOpen(true);
                              }}
                              className="h-7 px-2 text-xs gap-1 text-red-600 hover:text-red-700"
                            >
                              <Receipt className="h-3.5 w-3.5" />
                              Proof
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* Modal 1: Withdrawal Wizard                                         */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <Dialog open={isWithdrawOpen} onOpenChange={setIsWithdrawOpen}>
        <DialogContent className="sm:max-w-[540px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-red-600" />
              Withdraw Store Income
            </DialogTitle>
            <DialogDescription>
              Direct payout of available balance to your preferred wallet, bank, or card.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleWithdraw} className="space-y-4 pt-2">
            {/* Balance Badge */}
            <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/40 p-3 flex items-center justify-between border border-emerald-200 dark:border-emerald-800">
              <span className="text-xs text-emerald-800 dark:text-emerald-300 font-medium">
                Available to Withdraw
              </span>
              <span className="text-base font-bold text-emerald-700 dark:text-emerald-200">
                {formatCurrency(availableBalance, "IDR")}
              </span>
            </div>

            {/* Channel Selection */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                Payout Channel
              </label>
              <Tabs
                value={withdrawMethod}
                onValueChange={(v) => setWithdrawMethod(v as WithdrawalMethod)}
                className="w-full"
              >
                <TabsList className="grid grid-cols-5 w-full h-auto p-1">
                  <TabsTrigger value="dana" className="py-2 text-xs gap-1">
                    <DanaBrandIcon size={14} />
                    <span>DANA</span>
                  </TabsTrigger>
                  <TabsTrigger value="bank_transfer" className="py-2 text-xs gap-1">
                    <Building2 className="h-3.5 w-3.5" />
                    <span>Bank</span>
                  </TabsTrigger>
                  <TabsTrigger value="card_oct" className="py-2 text-xs gap-1">
                    <CreditCard className="h-3.5 w-3.5" />
                    <span>Card</span>
                  </TabsTrigger>
                  <TabsTrigger value="alipay" className="py-2 text-xs gap-1">
                    <AlipayBrandIcon size={14} />
                    <span>Alipay</span>
                  </TabsTrigger>
                  <TabsTrigger value="linkaja" className="py-2 text-xs gap-1">
                    <LinkAjaBrandIcon size={14} />
                    <span>LinkAja</span>
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* Method-Specific Inputs */}
            {withdrawMethod === "dana" && (
              <div className="space-y-3 rounded-lg border p-3 bg-gray-50 dark:bg-zinc-900/50">
                <div className="flex items-center gap-2 text-xs font-semibold text-blue-600">
                  <DanaBrandIcon size={16} />
                  DANA Instant Payout (Fee: Free)
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">DANA Mobile Number</label>
                  <Input
                    placeholder="e.g. 0812-3456-7890"
                    value={destAccount}
                    onChange={(e) => setDestAccount(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Registered User Name</label>
                  <Input
                    placeholder="e.g. Budi Santoso"
                    value={destName}
                    onChange={(e) => setDestName(e.target.value)}
                    required
                  />
                </div>
              </div>
            )}

            {withdrawMethod === "bank_transfer" && (
              <div className="space-y-3 rounded-lg border p-3 bg-gray-50 dark:bg-zinc-900/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-semibold text-blue-600">
                    <Building2 className="h-4 w-4" />
                    Indonesian Bank Transfer (BI-FAST Fee: Rp 2,500)
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Bank</label>
                    <Select value={bankCode} onValueChange={setBankCode}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="BCA">BCA (Bank Central Asia)</SelectItem>
                        <SelectItem value="MANDIRI">Bank Mandiri</SelectItem>
                        <SelectItem value="BRI">BRI (Bank Rakyat Indonesia)</SelectItem>
                        <SelectItem value="BNI">BNI (Bank Negara Indonesia)</SelectItem>
                        <SelectItem value="CIMB">CIMB Niaga</SelectItem>
                        <SelectItem value="PERMATA">Permata Bank</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Account Number</label>
                    <Input
                      placeholder="Account number"
                      value={destAccount}
                      onChange={(e) => setDestAccount(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Account Holder Name</label>
                  <Input
                    placeholder="As printed on bank passbook"
                    value={destName}
                    onChange={(e) => setDestName(e.target.value)}
                    required
                  />
                </div>
              </div>
            )}

            {withdrawMethod === "card_oct" && (
              <div className="space-y-3 rounded-lg border p-3 bg-gray-50 dark:bg-zinc-900/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-semibold text-indigo-600">
                    <CreditCard className="h-4 w-4" />
                    Visa / Mastercard Direct OCT Payout (Fee: Rp 5,000)
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Card Network</label>
                    <Select value={cardType} onValueChange={(v) => setCardType(v as any)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="visa">Visa Debit / Credit</SelectItem>
                        <SelectItem value="mastercard">Mastercard Debit / Credit</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">16-Digit Card Number</label>
                    <Input
                      placeholder="4000 1234 5678 9010"
                      value={destAccount}
                      onChange={(e) => setDestAccount(e.target.value)}
                      maxLength={19}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Cardholder Full Name</label>
                  <Input
                    placeholder="Name embossed on card"
                    value={destName}
                    onChange={(e) => setDestName(e.target.value)}
                    required
                  />
                </div>
                <div className="rounded-md bg-blue-50 dark:bg-blue-950/40 p-2.5 text-xs space-y-1 text-blue-800 dark:text-blue-300">
                  <div className="flex justify-between font-semibold">
                    <span>Indicative FX Rate:</span>
                    <span className="font-mono">1 USD = Rp 15,850</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Estimated Net Credited:</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                      ${Math.max(0, (Number(withdrawAmount) - 5000) / 15850).toFixed(2)} USD
                    </span>
                  </div>
                </div>
              </div>
            )}

            {withdrawMethod === "alipay" && (
              <div className="space-y-3 rounded-lg border p-3 bg-gray-50 dark:bg-zinc-900/50">
                <div className="flex items-center gap-2 text-xs font-semibold text-blue-600">
                  <AlipayBrandIcon size={16} />
                  Alipay Cross-Border Settlement (Fee: Rp 3,500)
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">
                    Alipay Account (Email or Phone)
                  </label>
                  <Input
                    placeholder="e.g. merchant@alipay.com"
                    value={destAccount}
                    onChange={(e) => setDestAccount(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Account Holder Real Name</label>
                  <Input
                    placeholder="English or Pinyin Full Name"
                    value={destName}
                    onChange={(e) => setDestName(e.target.value)}
                    required
                  />
                </div>
                <div className="rounded-md bg-blue-50 dark:bg-blue-950/40 p-2.5 text-xs space-y-1 text-blue-800 dark:text-blue-300">
                  <div className="flex justify-between font-semibold">
                    <span>Indicative FX Rate:</span>
                    <span className="font-mono">1 CNY = Rp 2,192</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Estimated Net Credited:</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                      ¥{Math.max(0, (Number(withdrawAmount) - 3500) / 2192).toFixed(2)} CNY
                    </span>
                  </div>
                </div>
              </div>
            )}

            {withdrawMethod === "linkaja" && (
              <div className="space-y-3 rounded-lg border p-3 bg-gray-50 dark:bg-zinc-900/50">
                <div className="flex items-center gap-2 text-xs font-semibold text-red-600">
                  <LinkAjaBrandIcon size={16} />
                  LinkAja Wallet Payout (Fee: Free)
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">LinkAja Mobile Number</label>
                  <Input
                    placeholder="e.g. 0811-2345-6789"
                    value={destAccount}
                    onChange={(e) => setDestAccount(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Account Holder Name</label>
                  <Input
                    placeholder="Full Registered Name"
                    value={destName}
                    onChange={(e) => setDestName(e.target.value)}
                    required
                  />
                </div>
              </div>
            )}

            {/* Withdrawal Amount */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Amount to Withdraw (IDR)
                </label>
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  onClick={() => setWithdrawAmount(availableBalance.toString())}
                  className="h-auto p-0 text-xs text-red-600"
                >
                  Withdraw All
                </Button>
              </div>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-sm font-semibold text-gray-400">
                  Rp
                </span>
                <Input
                  type="number"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  className="pl-9 font-semibold"
                  placeholder="500000"
                  required
                />
              </div>
            </div>

            {withdrawError && (
              <div className="rounded-md bg-red-50 dark:bg-red-950/50 p-2.5 text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{withdrawError}</span>
              </div>
            )}

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsWithdrawOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={withdrawing}
                className="bg-red-600 hover:bg-red-700 text-white font-semibold"
              >
                {withdrawing ? (
                  <>
                    <RefreshCw className="mr-1.5 h-4 w-4 animate-spin" />
                    Processing Payout...
                  </>
                ) : (
                  <>
                    <ArrowDownRight className="mr-1.5 h-4 w-4" />
                    Confirm & Disburse Now
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* Modal 2: Official Transfer Proof Receipt                           */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <Dialog open={isReceiptOpen} onOpenChange={setIsReceiptOpen}>
        <DialogContent className="sm:max-w-[460px]">
          {receiptDisb && (
            <div className="space-y-4">
              <div className="text-center pt-2">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 mb-2">
                  <CheckCircle2 className="h-7 w-7" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                  Transfer Successful & Disbursed
                </h3>
                <p className="text-xs text-muted-foreground">
                  Funds cleared and transferred to beneficiary account
                </p>
              </div>

              {/* Receipt Body */}
              <div className="rounded-xl border border-gray-200 dark:border-zinc-800 bg-gray-50/70 dark:bg-zinc-900/60 p-4 space-y-3 text-xs">
                <div className="flex items-center justify-between border-b pb-2 border-dashed">
                  <span className="text-muted-foreground">Disbursement #</span>
                  <span className="font-mono font-bold">{receiptDisb.disbursementNumber}</span>
                </div>
                <div className="flex items-center justify-between border-b pb-2 border-dashed">
                  <span className="text-muted-foreground">Bank / Network Ref</span>
                  <span className="font-mono font-bold text-emerald-600">
                    {receiptDisb.referenceNumber}
                  </span>
                </div>
                <div className="flex items-center justify-between border-b pb-2 border-dashed">
                  <span className="text-muted-foreground">Channel</span>
                  <span className="font-semibold uppercase flex items-center gap-1.5">
                    {receiptDisb.method === "dana" && <DanaBrandIcon size={14} />}
                    {receiptDisb.method === "bank_transfer" && (
                      <Building2 className="h-3.5 w-3.5" />
                    )}
                    {receiptDisb.method.replace("_", " ")}
                    {receiptDisb.bankCode && ` (${receiptDisb.bankCode})`}
                  </span>
                </div>
                <div className="flex items-center justify-between border-b pb-2 border-dashed">
                  <span className="text-muted-foreground">Beneficiary Name</span>
                  <span className="font-semibold">{receiptDisb.destinationName}</span>
                </div>
                <div className="flex items-center justify-between border-b pb-2 border-dashed">
                  <span className="text-muted-foreground">Destination Account</span>
                  <span className="font-mono">{receiptDisb.destinationAccount}</span>
                </div>
                <div className="flex items-center justify-between border-b pb-2 border-dashed">
                  <span className="text-muted-foreground">Gross Amount</span>
                  <span>{formatCurrency(receiptDisb.grossAmount, "IDR")}</span>
                </div>
                <div className="flex items-center justify-between border-b pb-2 border-dashed">
                  <span className="text-muted-foreground">Transaction Fee</span>
                  <span>
                    {receiptDisb.fee === 0 ? "Free" : formatCurrency(receiptDisb.fee, "IDR")}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-1 font-bold text-sm">
                  <span>Net Amount Received</span>
                  <span className="text-purple-600">
                    {formatCurrency(receiptDisb.netAmount, "IDR")}
                  </span>
                </div>
                {receiptDisb.destinationCurrency && receiptDisb.destinationCurrency !== "IDR" && (
                  <div className="flex items-center justify-between border-t pt-2 border-dashed text-blue-600 dark:text-blue-400">
                    <span className="font-semibold">Foreign Currency Disbursed</span>
                    <span className="font-bold font-mono text-sm">
                      {receiptDisb.destinationCurrency === "USD" ? "$" : "¥"}
                      {receiptDisb.destinationAmount?.toFixed(2)} {receiptDisb.destinationCurrency}
                    </span>
                  </div>
                )}
                <div className="text-[10px] text-gray-400 text-center pt-2">
                  Timestamp: {new Date(receiptDisb.timestamp).toLocaleString()} • Status: COMPLETED
                </div>
              </div>

              <DialogFooter className="sm:justify-between gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const receiptText = `TRANSFER PROOF RECEIPT\nRef: ${receiptDisb.referenceNumber}\nAmount: Rp ${receiptDisb.netAmount.toLocaleString("id-ID")}\nTo: ${receiptDisb.destinationName} (${receiptDisb.destinationAccount})\nDate: ${new Date(receiptDisb.timestamp).toLocaleString()}`;
                    navigator.clipboard.writeText(receiptText);
                  }}
                  className="gap-1.5 text-xs"
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copy Text
                </Button>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.print()}
                    className="gap-1.5 text-xs"
                  >
                    <Printer className="h-3.5 w-3.5" />
                    Print Receipt
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setIsReceiptOpen(false)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                  >
                    Done
                  </Button>
                </div>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* Modal 3: Printable A5/A6 Tabletop QRIS Counter Standee              */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <Dialog open={isStandeeOpen} onOpenChange={setIsStandeeOpen}>
        <DialogContent className="sm:max-w-[480px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Printer className="h-5 w-5 text-red-600" />
              Printable QRIS Counter Standee
            </DialogTitle>
            <DialogDescription>
              High-resolution tabletop acrylic standee formatted for A5/A6 prints with Bank
              Indonesia & ASPI specifications.
            </DialogDescription>
          </DialogHeader>

          {/* Standee Frame Card (Printable) */}
          <div className="rounded-2xl border-4 border-gray-900 dark:border-white bg-white dark:bg-zinc-950 p-6 text-center space-y-4 shadow-2xl">
            {/* Header Logos */}
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-1.5">
                <QrisBrandIcon size={28} />
              </div>
              <div className="text-right">
                <span className="text-[9px] font-bold uppercase tracking-widest text-gray-500">
                  PEMBAYARAN DIGITAL
                </span>
                <p className="text-xs font-black tracking-tight text-red-600">GPN / ASPI</p>
              </div>
            </div>

            {/* Merchant Info */}
            <div className="space-y-0.5">
              <h3 className="text-base font-black text-gray-900 dark:text-gray-100 tracking-tight">
                LEVTECH COMMERCE UNIFIED
              </h3>
              <p className="text-[11px] font-mono text-gray-500">
                NMID:{" "}
                <span className="font-bold text-gray-800 dark:text-gray-200">ID1020084729101</span>
              </p>
              <p className="text-[10px] text-gray-400">A01 • JAKARTA PUSAT</p>
            </div>

            {/* QR Code Presentation */}
            <div className="p-3 bg-white rounded-xl border-2 border-gray-900 inline-block shadow-md">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="Merchant QRIS Standee"
                  className="w-52 h-52 object-contain mx-auto"
                />
              ) : (
                <div className="w-52 h-52 flex items-center justify-center bg-gray-100 text-xs text-gray-400">
                  Generating QR...
                </div>
              )}
            </div>

            {/* Accepted Networks */}
            <div className="space-y-2 pt-1 border-t">
              <p className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">
                Menerima Pembayaran Dari Seluruh Aplikasi
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] font-semibold text-gray-700 dark:text-gray-300">
                <span className="px-2 py-0.5 rounded bg-gray-100 dark:bg-zinc-800">BCA Mobile</span>
                <span className="px-2 py-0.5 rounded bg-gray-100 dark:bg-zinc-800">
                  Livin&apos; Mandiri
                </span>
                <span className="px-2 py-0.5 rounded bg-gray-100 dark:bg-zinc-800">BRImo</span>
                <span className="px-2 py-0.5 rounded bg-gray-100 dark:bg-zinc-800">BNI</span>
                <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-950 flex items-center gap-1">
                  <DanaBrandIcon size={12} /> DANA
                </span>
                <span className="px-2 py-0.5 rounded bg-gray-100 dark:bg-zinc-800">GoPay</span>
                <span className="px-2 py-0.5 rounded bg-purple-50 text-purple-700 dark:bg-purple-950">
                  OVO
                </span>
                <span className="px-2 py-0.5 rounded bg-orange-50 text-orange-700 dark:bg-orange-950">
                  ShopeePay
                </span>
                <span className="px-2 py-0.5 rounded bg-red-50 text-red-700 dark:bg-red-950 flex items-center gap-1">
                  <LinkAjaBrandIcon size={12} /> LinkAja
                </span>
              </div>
            </div>

            <p className="text-[9px] text-gray-400 font-mono">
              Dicetak sesuai standar ASPI & Bank Indonesia • Settle Real-Time
            </p>
          </div>

          <DialogFooter className="sm:justify-between gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsStandeeOpen(false)}>
              Close
            </Button>
            <Button
              size="sm"
              onClick={() => window.print()}
              className="bg-red-600 hover:bg-red-700 text-white font-semibold gap-1.5"
            >
              <Printer className="h-4 w-4" />
              Print Tabletop Standee (A5/A6)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
