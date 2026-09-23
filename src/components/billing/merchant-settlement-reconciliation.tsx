"use client";

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import {
  FileSpreadsheet,
  Download,
  Building2,
  CheckCircle2,
  Clock,
  ArrowRight,
  ShieldCheck,
  Percent,
  Receipt,
  Layers,
  RefreshCw,
  ExternalLink,
  ChevronRight,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useCurrency } from "@/components/currency-provider";

export type MerchantCategory = "UMI_MICRO" | "REGULAR" | "GOV_NONPROFIT";

interface SettlementBatch {
  id: string;
  batchNumber: string;
  period: string;
  txCount: number;
  grossAmount: number;
  mdrRate: number;
  mdrAmount: number;
  clearingFee: number;
  netPayout: number;
  status: "SETTLED" | "READY_FOR_PAYOUT" | "PROCESSING";
  disbursedAt?: string;
  channel: string;
}

const INITIAL_BATCHES: SettlementBatch[] = [
  {
    id: "batch-001",
    batchNumber: "BATCH-20260908-01",
    period: "08 Sep 2026 (00:00 - 12:00)",
    txCount: 14,
    grossAmount: 3850000,
    mdrRate: 0.003,
    mdrAmount: 11550,
    clearingFee: 2500,
    netPayout: 3835950,
    status: "READY_FOR_PAYOUT",
    channel: "BI-FAST (BCA)",
  },
  {
    id: "batch-002",
    batchNumber: "BATCH-20260907-02",
    period: "07 Sep 2026 (12:00 - 23:59)",
    txCount: 22,
    grossAmount: 6420000,
    mdrRate: 0.003,
    mdrAmount: 19260,
    clearingFee: 2500,
    netPayout: 6398240,
    status: "SETTLED",
    disbursedAt: "2026-09-08 08:30:15",
    channel: "BI-FAST (Mandiri)",
  },
  {
    id: "batch-003",
    batchNumber: "BATCH-20260907-01",
    period: "07 Sep 2026 (00:00 - 12:00)",
    txCount: 18,
    grossAmount: 5120000,
    mdrRate: 0.003,
    mdrAmount: 15360,
    clearingFee: 2500,
    netPayout: 5102140,
    status: "SETTLED",
    disbursedAt: "2026-09-07 14:15:00",
    channel: "BI-FAST (BRI)",
  },
  {
    id: "batch-004",
    batchNumber: "BATCH-20260906-02",
    period: "06 Sep 2026 (12:00 - 23:59)",
    txCount: 29,
    grossAmount: 8940000,
    mdrRate: 0.003,
    mdrAmount: 26820,
    clearingFee: 2500,
    netPayout: 8910680,
    status: "SETTLED",
    disbursedAt: "2026-09-07 08:30:00",
    channel: "DANA Direct",
  },
];

export function MerchantSettlementReconciliation({ className }: { className?: string }) {
  const [category, setCategory] = useState<MerchantCategory>("UMI_MICRO");
  const [batches, setBatches] = useState<SettlementBatch[]>(INITIAL_BATCHES);
  const [disbursingId, setDisbursingId] = useState<string | null>(null);

  const mdrPercentage = category === "UMI_MICRO" ? 0.3 : category === "REGULAR" ? 0.7 : 0.0;
  const mdrFactor = mdrPercentage / 100;

  // Re-calculate batches based on active merchant MDR classification
  const calculatedBatches = batches.map((b) => {
    const mdr = Math.round(b.grossAmount * mdrFactor);
    const net = b.grossAmount - mdr - b.clearingFee;
    return {
      ...b,
      mdrRate: mdrFactor,
      mdrAmount: mdr,
      netPayout: net,
    };
  });

  const totalGross = calculatedBatches.reduce((acc, b) => acc + b.grossAmount, 0);
  const totalMdr = calculatedBatches.reduce((acc, b) => acc + b.mdrAmount, 0);
  const totalClearing = calculatedBatches.reduce((acc, b) => acc + b.clearingFee, 0);
  const totalNet = calculatedBatches.reduce((acc, b) => acc + b.netPayout, 0);
  const totalTx = calculatedBatches.reduce((acc, b) => acc + b.txCount, 0);

  // Trigger BI-FAST scheduled disbursement
  const handleDisburseBatch = (batchId: string) => {
    setDisbursingId(batchId);
    setTimeout(() => {
      setBatches((prev) =>
        prev.map((b) =>
          b.id === batchId
            ? {
                ...b,
                status: "SETTLED",
                disbursedAt: new Date().toISOString().replace("T", " ").substring(0, 19),
              }
            : b,
        ),
      );
      setDisbursingId(null);
      toast.success("BI-FAST Instant Disbursement Completed!", {
        description: `Batch ${batchId} net funds cleared to destination bank account.`,
      });
    }, 1200);
  };

  // Export reconciliation CSV
  const handleExportCsv = () => {
    const headers = [
      "Batch Number",
      "Period",
      "Transactions",
      "Gross Volume (IDR)",
      "MDR Rate (%)",
      "MDR Fee (IDR)",
      "BI-FAST Clearing Fee (IDR)",
      "Net Merchant Payout (IDR)",
      "Settlement Status",
      "Payout Channel",
      "Disbursed At",
    ];

    const rows = calculatedBatches.map((b) => [
      b.batchNumber,
      `"${b.period}"`,
      b.txCount,
      b.grossAmount,
      (b.mdrRate * 100).toFixed(1) + "%",
      b.mdrAmount,
      b.clearingFee,
      b.netPayout,
      b.status,
      b.channel,
      b.disbursedAt || "Pending",
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `settlement-reconciliation-${category.toLowerCase()}-2026.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success("Reconciliation Statement CSV Exported", {
      description: "BI-FAST & QRIS MDR compliance ledger downloaded successfully.",
    });
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* Top Header & Classification Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/70 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
              Merchant Settlement Reconciliation & Multi-Channel Payouts
            </h3>
            <Badge variant="outline" className="text-[10px] font-mono border-border">
              Bank Indonesia PADG 24/1/2022
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Automated BI QRIS MDR deduction, batch settlement reconciliation, and one-click BI-FAST
            payouts
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 bg-muted/40 p-1 rounded-lg border border-border">
            <span className="text-xs font-semibold px-2 text-muted-foreground">MDR Tier:</span>
            <Select value={category} onValueChange={(val) => setCategory(val as MerchantCategory)}>
              <SelectTrigger className="text-xs h-8 w-44 bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="UMI_MICRO" className="text-xs">
                  Micro-Merchant (UMI) - 0.3%
                </SelectItem>
                <SelectItem value="REGULAR" className="text-xs">
                  Regular Merchant - 0.7%
                </SelectItem>
                <SelectItem value="GOV_NONPROFIT" className="text-xs">
                  Gov / Non-Profit - 0.0%
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            className="h-9 px-3 text-xs gap-1.5 cursor-pointer"
          >
            <Download className="h-3.5 w-3.5 text-primary" />
            <span>Export CSV</span>
          </Button>
        </div>
      </div>

      {/* Summary Telemetry KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border/70 shadow-xs">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Gross Inbound Volume
              </span>
              <div className="rounded-lg bg-primary/10 p-2 text-primary">
                <Receipt className="h-4 w-4" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-foreground font-mono">
              Rp {totalGross.toLocaleString("id-ID")}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Across {totalTx} QRIS customer payments
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-xs">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                BI QRIS MDR Withheld
              </span>
              <div className="rounded-lg bg-primary/10 p-2 text-primary">
                <Percent className="h-4 w-4" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-foreground font-mono">
              Rp {totalMdr.toLocaleString("id-ID")}
            </div>
            <p className="mt-1 text-xs text-muted-foreground font-mono">
              Rate applied: {mdrPercentage.toFixed(1)}% ({category.replace("_", " ")})
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-xs">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                BI-FAST Clearing Fees
              </span>
              <div className="rounded-lg bg-primary/10 p-2 text-primary">
                <Building2 className="h-4 w-4" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-foreground font-mono">
              Rp {totalClearing.toLocaleString("id-ID")}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Rp 2,500 per batch clearing</p>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-xs">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Net Merchant Payout
              </span>
              <div className="rounded-lg bg-primary/10 p-2 text-primary">
                <CheckCircle2 className="h-4 w-4" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-foreground font-mono">
              Rp {totalNet.toLocaleString("id-ID")}
            </div>
            <p className="mt-1 text-xs text-primary font-medium flex items-center gap-1">
              <ShieldCheck className="h-3 w-3" />
              Direct to verified accounts
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Settlement Batches Table */}
      <Card className="border-border/70 shadow-xs">
        <CardHeader className="p-4 pb-3 border-b border-border/60">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold">
                Settlement Batches & Clearance Log
              </CardTitle>
              <CardDescription>
                Audited transaction batches scheduled for automated BI-FAST bank disbursement
              </CardDescription>
            </div>
            <span className="text-xs text-muted-foreground font-mono">
              {calculatedBatches.length} batches recorded
            </span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Batch Reference</TableHead>
                  <TableHead className="text-xs">Clearing Period</TableHead>
                  <TableHead className="text-xs text-center">Tx Count</TableHead>
                  <TableHead className="text-xs text-right">Gross Inbound</TableHead>
                  <TableHead className="text-xs text-right">
                    MDR Withheld ({mdrPercentage}%)
                  </TableHead>
                  <TableHead className="text-xs text-right">Net Payout</TableHead>
                  <TableHead className="text-xs">Channel</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {calculatedBatches.map((batch) => (
                  <TableRow key={batch.id} className="hover:bg-muted/40 transition-colors">
                    <TableCell className="font-mono text-xs font-semibold">
                      {batch.batchNumber}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{batch.period}</TableCell>
                    <TableCell className="text-xs text-center font-mono font-medium">
                      {batch.txCount}
                    </TableCell>
                    <TableCell className="text-xs text-right font-mono font-medium">
                      Rp {batch.grossAmount.toLocaleString("id-ID")}
                    </TableCell>
                    <TableCell className="text-xs text-right font-mono text-muted-foreground">
                      -Rp {batch.mdrAmount.toLocaleString("id-ID")}
                    </TableCell>
                    <TableCell className="text-xs text-right font-mono font-bold text-foreground">
                      Rp {batch.netPayout.toLocaleString("id-ID")}
                    </TableCell>
                    <TableCell className="text-xs">
                      <span className="inline-flex items-center gap-1 font-medium">
                        <Building2 className="h-3 w-3 text-primary" />
                        {batch.channel}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs">
                      {batch.status === "SETTLED" ? (
                        <Badge
                          variant="outline"
                          className="text-[10px] text-emerald-600 border-emerald-300 dark:border-emerald-800 gap-1 font-medium"
                        >
                          <CheckCircle2 className="h-2.5 w-2.5" /> Settled
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="text-[10px] text-primary border-primary/30 gap-1 font-medium"
                        >
                          <Clock className="h-2.5 w-2.5" /> Ready Payout
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-right">
                      {batch.status === "READY_FOR_PAYOUT" ? (
                        <Button
                          size="sm"
                          disabled={disbursingId === batch.id}
                          onClick={() => handleDisburseBatch(batch.id)}
                          className="h-7 px-2.5 text-xs gap-1 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold cursor-pointer shadow-2xs"
                        >
                          {disbursingId === batch.id ? (
                            <RefreshCw className="h-3 w-3 animate-spin" />
                          ) : (
                            <ArrowRight className="h-3 w-3" />
                          )}
                          <span>Disburse BI-FAST</span>
                        </Button>
                      ) : (
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {batch.disbursedAt?.split(" ")[1]} WIB
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
