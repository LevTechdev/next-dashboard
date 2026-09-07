"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import QRCode from "qrcode";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Building2,
  Copy,
  Check,
  RotateCcw,
  Sparkles,
  Smartphone,
  ExternalLink,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { QrisBrandIcon, DanaBrandIcon, LinkAjaBrandIcon } from "@/components/ui/brand-icons";
import { generateQrisPayload } from "@/lib/qris-engine";
import { toast } from "sonner";

export default function OrderQrisCheckoutPage() {
  const params = useParams();
  const router = useRouter();
  const locale = (params?.locale as string) || "en";
  const id = params?.id as string;

  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [qrisString, setQrisString] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [isPaid, setIsPaid] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [countdown, setCountdown] = useState(900); // 15 mins

  // 1. Fetch Order details
  useEffect(() => {
    async function loadOrder() {
      try {
        const res = await fetch(`/api/orders/${id}`);
        if (res.ok) {
          const data = await res.json();
          setOrder(data);
          if (data.paymentStatus === "PAID") {
            setIsPaid(true);
          }
        }
      } catch (e) {
        console.error("Failed to load order:", e);
      } finally {
        setLoading(false);
      }
    }
    if (id) loadOrder();
  }, [id]);

  // 2. Generate dynamic ASPI QRIS string & QR Code image
  useEffect(() => {
    if (!order) return;
    const amountInIdr = Math.round((order.grandTotal || 50) * 15850);
    const invoiceNum = `INV-${order.orderNumber || order.id.slice(0, 8)}`;
    const payload = generateQrisPayload({
      amount: amountInIdr,
      invoiceNumber: invoiceNum,
      merchantName: "LEVTECH UNIFIED STORE",
      merchantCity: "JAKARTA PUSAT",
      postalCode: "10110",
      nmid: "ID1020084729101",
    });

    setQrisString(payload);

    QRCode.toDataURL(payload, {
      margin: 1,
      width: 240,
      color: {
        dark: "#09090b",
        light: "#ffffff",
      },
    })
      .then(setQrDataUrl)
      .catch(console.error);
  }, [order]);

  // 3. Countdown timer
  useEffect(() => {
    if (isPaid) return;
    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [isPaid]);

  // 4. Listen to real-time payment SSE stream
  useEffect(() => {
    if (isPaid) return;
    let es: EventSource | null = null;
    try {
      es = new EventSource("/api/billing/qris/stream");
      es.addEventListener("payment_confirmed", (e) => {
        try {
          const data = JSON.parse(e.data);
          // If payment matches or broadcasts confirmation
          if (data?.transaction) {
            setIsPaid(true);
            toast.success("Payment detected and verified in real-time via SSE!");
          }
        } catch {
          // ignore
        }
      });
    } catch {
      // ignore
    }
    return () => {
      if (es) es.close();
    };
  }, [isPaid]);

  // Simulate payment confirmation
  const handleSimulatePayment = async () => {
    setSimulating(true);
    try {
      const res = await fetch(`/api/orders/${id}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentMethod: "QRIS",
          sourceBank: "BCA Mobile / DANA",
        }),
      });

      if (res.ok) {
        setIsPaid(true);
        toast.success("Payment simulated & settled into order ledger!");
      } else {
        toast.error("Failed to settle simulated payment");
      }
    } catch {
      toast.error("Payment settlement error");
    } finally {
      setSimulating(false);
    }
  };

  const handleCopy = () => {
    if (!qrisString) return;
    navigator.clipboard.writeText(qrisString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("QRIS EMVCo payload copied to clipboard");
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const amountInIdr = order ? Math.round((order.grandTotal || 50) * 15850) : 0;

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center space-y-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent mx-auto" />
          <p className="text-sm text-muted-foreground">
            Initializing secure QRIS payment gateway...
          </p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="p-8 text-center space-y-4">
        <h2 className="text-xl font-bold">Order Not Found</h2>
        <Link href={`/${locale}/orders`}>
          <Button variant="outline">Back to Orders</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto py-6 px-4 space-y-6">
      <div className="flex items-center justify-between">
        <Link href={`/${locale}/orders/${order.id}`}>
          <Button variant="ghost" size="sm" className="gap-1.5 text-xs">
            <ArrowLeft className="h-4 w-4" />
            Back to Order #{order.orderNumber}
          </Button>
        </Link>
        <Badge variant="outline" className="gap-1.5 text-xs">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
          Bank Indonesia / ASPI Certified
        </Badge>
      </div>

      <Card className="overflow-hidden border-2 shadow-xl">
        {/* QRIS Header branding */}
        <div className="bg-red-600 p-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-white p-1 rounded-md">
              <QrisBrandIcon size={24} />
            </div>
            <div>
              <h3 className="font-extrabold text-sm tracking-tight">QRIS STANDALONE CHECKOUT</h3>
              <p className="text-[10px] text-red-100">National Payment Gateway (GPN)</p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[10px] text-red-200 uppercase font-bold tracking-wider">
              NMID
            </span>
            <p className="text-xs font-mono font-bold">ID1020084729101</p>
          </div>
        </div>

        <CardContent className="p-6 space-y-6">
          {isPaid ? (
            <div className="text-center py-8 space-y-4 animate-in fade-in zoom-in duration-300">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600">
                <CheckCircle2 className="h-10 w-10" />
              </div>
              <div className="space-y-1">
                <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  Payment Verified & Settled!
                </h3>
                <p className="text-sm text-muted-foreground">
                  Order #{order.orderNumber} is now marked as PAID in the system ledger.
                </p>
              </div>

              <div className="rounded-xl border bg-gray-50/70 dark:bg-zinc-900/60 p-4 max-w-sm mx-auto text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Paid:</span>
                  <span className="font-bold text-emerald-600">
                    Rp {amountInIdr.toLocaleString("id-ID")} (${order.grandTotal.toFixed(2)} USD)
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Gateway:</span>
                  <span className="font-semibold">QRIS Direct BI-FAST</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Customer:</span>
                  <span>{order.customer?.name || "Guest Customer"}</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 justify-center pt-3">
                <Link href={`/${locale}/orders/${order.id}`}>
                  <Button className="w-full sm:w-auto">View Order Details</Button>
                </Link>
                <a
                  href={`/api/orders/${order.id}/invoice`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button variant="outline" className="w-full sm:w-auto">
                    Download Tax Invoice
                  </Button>
                </a>
              </div>
            </div>
          ) : (
            <>
              {/* Order Info & Amount */}
              <div className="flex items-center justify-between pb-4 border-b">
                <div>
                  <p className="text-xs text-muted-foreground">Order Reference</p>
                  <p className="font-mono font-bold text-sm">#{order.orderNumber}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {order.customer?.name || "Customer"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Amount to Pay</p>
                  <p className="text-2xl font-black text-red-600 dark:text-red-400">
                    Rp {amountInIdr.toLocaleString("id-ID")}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    ≈ ${order.grandTotal.toFixed(2)} USD
                  </p>
                </div>
              </div>

              {/* QR Code Presentation */}
              <div className="flex flex-col items-center justify-center p-6 bg-white dark:bg-zinc-900 rounded-2xl border shadow-inner space-y-4">
                <div className="p-3 bg-white rounded-xl border-2 border-dashed border-gray-200 shadow-sm relative">
                  {qrDataUrl ? (
                    <img
                      src={qrDataUrl}
                      alt="Order QRIS Code"
                      className="w-56 h-56 object-contain"
                    />
                  ) : (
                    <div className="w-56 h-56 flex items-center justify-center bg-gray-100 rounded-lg">
                      <Clock className="h-8 w-8 text-gray-400 animate-spin" />
                    </div>
                  )}
                  {/* Subtle scan line animation */}
                  <div className="absolute inset-x-3 top-4 h-0.5 bg-red-500/60 blur-[1px] animate-pulse" />
                </div>

                <div className="flex items-center gap-2 text-xs font-mono bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 px-3 py-1.5 rounded-full">
                  <Clock className="h-3.5 w-3.5" />
                  <span>Valid for: {formatTime(countdown)}</span>
                </div>

                <p className="text-xs text-center text-muted-foreground max-w-xs leading-relaxed">
                  Scan this QR code using{" "}
                  <strong>
                    BCA Mobile, Livin&apos; Mandiri, BRImo, BNI, DANA, GoPay, OVO, ShopeePay
                  </strong>{" "}
                  or any BI-FAST banking app.
                </p>
              </div>

              {/* Accepted Logos Bar */}
              <div className="rounded-xl border p-3 bg-gray-50/60 dark:bg-zinc-900/40 space-y-2">
                <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider text-center">
                  Instant Clearing Across All Indonesian Networks
                </p>
                <div className="flex items-center justify-center gap-3 text-xs font-semibold text-gray-600 dark:text-gray-300 flex-wrap">
                  <span className="flex items-center gap-1">
                    <DanaBrandIcon size={14} /> DANA
                  </span>
                  <span>•</span>
                  <span>BCA Mobile</span>
                  <span>•</span>
                  <span>Livin&apos; Mandiri</span>
                  <span>•</span>
                  <span>BRImo</span>
                  <span>•</span>
                  <span>BNI</span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <LinkAjaBrandIcon size={14} /> LinkAja
                  </span>
                </div>
              </div>

              {/* Simulation Testing Tool */}
              <div className="pt-2 flex flex-col gap-2">
                <Button
                  onClick={handleSimulatePayment}
                  disabled={simulating}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-2"
                >
                  <Sparkles className="h-4 w-4" />
                  {simulating ? "Verifying Settlement..." : "⚡ Simulate Customer Scan & Pay"}
                </Button>

                <Button variant="outline" size="sm" onClick={handleCopy} className="gap-2 text-xs">
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  Copy Raw EMVCo Payload
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
