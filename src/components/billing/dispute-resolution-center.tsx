"use client";

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import {
  ShieldAlert,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Upload,
  FileText,
  FileCheck2,
  Lock,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  ExternalLink,
  MessageSquare,
  Scale,
  XCircle,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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

interface DisputeCase {
  id: string;
  disputeNumber: string;
  invoiceNumber: string;
  rrn: string;
  customerName: string;
  amount: number;
  reason: string;
  status: "NEEDS_RESPONSE" | "UNDER_REVIEW" | "RESOLVED_WON" | "RESOLVED_LOST";
  dueInDays: number;
  filedAt: string;
  evidenceSubmittedAt?: string;
  sourceBank: string;
}

const INITIAL_DISPUTES: DisputeCase[] = [
  {
    id: "disp-101",
    disputeNumber: "DSP-2026-0042",
    invoiceNumber: "INV-2026-9182",
    rrn: "000281948201",
    customerName: "Ahmad Fauzi",
    amount: 750000,
    reason: "Claimed unrecognized transaction via BCA Mobile QRIS",
    status: "NEEDS_RESPONSE",
    dueInDays: 4,
    filedAt: "2026-09-05 14:20:00",
    sourceBank: "BCA Mobile",
  },
  {
    id: "disp-102",
    disputeNumber: "DSP-2026-0038",
    invoiceNumber: "INV-2026-8840",
    rrn: "000192837465",
    customerName: "Siti Rahmawati",
    amount: 1200000,
    reason: "Product not received / shipment delayed past delivery guarantee",
    status: "UNDER_REVIEW",
    dueInDays: 1,
    filedAt: "2026-09-02 11:10:00",
    evidenceSubmittedAt: "2026-09-04 16:45:00",
    sourceBank: "Livin' Mandiri",
  },
  {
    id: "disp-103",
    disputeNumber: "DSP-2026-0031",
    invoiceNumber: "INV-2026-8104",
    rrn: "000182736452",
    customerName: "Hendrik Tan",
    amount: 450000,
    reason: "Duplicate charge claimed on same order checkout",
    status: "RESOLVED_WON",
    dueInDays: 0,
    filedAt: "2026-08-28 09:30:00",
    evidenceSubmittedAt: "2026-08-29 10:15:00",
    sourceBank: "DANA Wallet",
  },
];

export function DisputeResolutionCenter({
  className,
}: {
  className?: string;
}) {
  const [disputes, setDisputes] = useState<DisputeCase[]>(INITIAL_DISPUTES);
  const [selectedDispute, setSelectedDispute] = useState<DisputeCase | null>(null);
  const [evidenceModalOpen, setEvidenceModalOpen] = useState(false);

  // Evidence submission state
  const [trackingNumber, setTrackingNumber] = useState("");
  const [evidenceNotes, setEvidenceNotes] = useState("");
  const [submittingEvidence, setSubmittingEvidence] = useState(false);

  // Total held balance in dispute escrow
  const heldBalance = disputes
    .filter((d) => d.status === "NEEDS_RESPONSE" || d.status === "UNDER_REVIEW")
    .reduce((sum, d) => sum + d.amount, 0);

  const needsResponseCount = disputes.filter((d) => d.status === "NEEDS_RESPONSE").length;
  const underReviewCount = disputes.filter((d) => d.status === "UNDER_REVIEW").length;
  const wonCount = disputes.filter((d) => d.status === "RESOLVED_WON").length;

  const handleOpenEvidence = (dispute: DisputeCase) => {
    setSelectedDispute(dispute);
    setTrackingNumber("");
    setEvidenceNotes("");
    setEvidenceModalOpen(true);
  };

  const handleSubmitEvidence = () => {
    if (!selectedDispute) return;
    setSubmittingEvidence(true);

    setTimeout(() => {
      setDisputes((prev) =>
        prev.map((d) =>
          d.id === selectedDispute.id
            ? {
                ...d,
                status: "UNDER_REVIEW",
                evidenceSubmittedAt: new Date().toISOString().replace("T", " ").substring(0, 19),
              }
            : d
        )
      );
      setSubmittingEvidence(false);
      setEvidenceModalOpen(false);
      toast.success("Contest Evidence Submitted to Clearing Network", {
        description: `Case ${selectedDispute.disputeNumber} is now under ASPI arbitrator review.`,
      });
    }, 1000);
  };

  const handleAcceptDispute = (disputeId: string) => {
    setDisputes((prev) =>
      prev.map((d) =>
        d.id === disputeId
          ? {
              ...d,
              status: "RESOLVED_LOST",
            }
          : d
      )
    );
    toast.info("Dispute Accepted & Refund Released", {
      description: "Held escrow funds released back to customer account.",
    });
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/70 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
              <Scale className="h-5 w-5 text-primary" />
              Dispute & Chargeback Resolution Center
            </h3>
            <Badge variant="outline" className="text-[10px] font-mono border-border">
              ASPI 7-Day SLA Workflow
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage customer payment claims, upload fulfillment proof, and protect merchant escrow funds
          </p>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border/70 shadow-xs">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Escrow Funds Held
              </span>
              <div className="rounded-lg bg-primary/10 p-2 text-primary">
                <Lock className="h-4 w-4" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-foreground font-mono">
              Rp {heldBalance.toLocaleString("id-ID")}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Temporarily withheld during arbitration
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-xs">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Action Required
              </span>
              <div className="rounded-lg bg-primary/10 p-2 text-primary">
                <AlertTriangle className="h-4 w-4" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-foreground font-mono">
              {needsResponseCount}
            </div>
            <p className="mt-1 text-xs text-primary font-medium flex items-center gap-1">
              <Clock className="h-3 w-3" />
              SLA deadline approaching
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-xs">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Under Bank Review
              </span>
              <div className="rounded-lg bg-primary/10 p-2 text-primary">
                <ShieldCheck className="h-4 w-4" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-foreground font-mono">
              {underReviewCount}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Awaiting acquiring bank verdict
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-xs">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Cases Won / Protected
              </span>
              <div className="rounded-lg bg-primary/10 p-2 text-primary">
                <CheckCircle2 className="h-4 w-4" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-foreground font-mono">
              {wonCount}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Evidence validated successfully
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Dispute Queue Table */}
      <Card className="border-border/70 shadow-xs">
        <CardHeader className="p-4 pb-3 border-b border-border/60">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold">Dispute Queue & Arbitration Ledger</CardTitle>
              <CardDescription>
                Active customer claim tickets under ASPI dispute settlement guidelines
              </CardDescription>
            </div>
            <span className="text-xs text-muted-foreground font-mono">
              {disputes.length} active tickets
            </span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Case Reference</TableHead>
                  <TableHead className="text-xs">Customer & RRN</TableHead>
                  <TableHead className="text-xs">Claim Reason</TableHead>
                  <TableHead className="text-xs text-right">Disputed Amount</TableHead>
                  <TableHead className="text-xs">SLA Remaining</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {disputes.map((dispute) => (
                  <TableRow key={dispute.id} className="hover:bg-muted/40 transition-colors">
                    <TableCell className="font-mono text-xs font-semibold">
                      <div>{dispute.disputeNumber}</div>
                      <div className="text-[10px] text-muted-foreground">{dispute.invoiceNumber}</div>
                    </TableCell>
                    <TableCell className="text-xs">
                      <div className="font-medium text-foreground">{dispute.customerName}</div>
                      <div className="text-[10px] text-muted-foreground font-mono">
                        {dispute.sourceBank} • {dispute.rrn}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[220px]">
                      {dispute.reason}
                    </TableCell>
                    <TableCell className="text-xs text-right font-mono font-bold text-foreground">
                      Rp {dispute.amount.toLocaleString("id-ID")}
                    </TableCell>
                    <TableCell className="text-xs">
                      {dispute.status === "NEEDS_RESPONSE" ? (
                        <span className="inline-flex items-center gap-1 font-semibold text-primary">
                          <Clock className="h-3 w-3" /> {dispute.dueInDays} days left
                        </span>
                      ) : dispute.status === "UNDER_REVIEW" ? (
                        <span className="text-muted-foreground text-xs">Arbitration pending</span>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      {dispute.status === "NEEDS_RESPONSE" && (
                        <Badge variant="outline" className="text-[10px] text-primary border-primary/30 gap-1 font-semibold">
                          <AlertTriangle className="h-2.5 w-2.5" /> Action Required
                        </Badge>
                      )}
                      {dispute.status === "UNDER_REVIEW" && (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground border-border gap-1 font-medium">
                          <Clock className="h-2.5 w-2.5" /> Under Review
                        </Badge>
                      )}
                      {dispute.status === "RESOLVED_WON" && (
                        <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-300 dark:border-emerald-800 gap-1 font-medium">
                          <CheckCircle2 className="h-2.5 w-2.5" /> Case Won
                        </Badge>
                      )}
                      {dispute.status === "RESOLVED_LOST" && (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground border-border gap-1 font-medium">
                          <XCircle className="h-2.5 w-2.5" /> Accepted / Refunded
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-right">
                      {dispute.status === "NEEDS_RESPONSE" && (
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            onClick={() => handleOpenEvidence(dispute)}
                            className="h-7 px-2.5 text-xs gap-1 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold cursor-pointer shadow-2xs"
                          >
                            <Upload className="h-3 w-3" />
                            <span>Contest</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleAcceptDispute(dispute.id)}
                            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                          >
                            Accept
                          </Button>
                        </div>
                      )}
                      {dispute.status === "UNDER_REVIEW" && (
                        <span className="text-[10px] text-muted-foreground">
                          Evidence on file
                        </span>
                      )}
                      {(dispute.status === "RESOLVED_WON" || dispute.status === "RESOLVED_LOST") && (
                        <span className="text-[10px] text-muted-foreground font-mono">
                          Closed
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

      {/* Evidence Submission Dialog */}
      {selectedDispute && (
        <Dialog open={evidenceModalOpen} onOpenChange={setEvidenceModalOpen}>
          <DialogContent className="sm:max-w-[500px] max-h-[85vh] flex flex-col p-0 overflow-hidden">
            <DialogHeader className="p-6 pb-2">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-primary/10 text-primary border border-primary/20">
                  <Upload className="h-4 w-4" />
                </div>
                <div>
                  <DialogTitle className="text-base font-bold">
                    Submit Dispute Evidence: {selectedDispute.disputeNumber}
                  </DialogTitle>
                  <DialogDescription className="text-xs">
                    Disputed Amount: Rp {selectedDispute.amount.toLocaleString("id-ID")} • {selectedDispute.customerName}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto px-6 py-2 space-y-4">
              <div className="rounded-lg bg-muted/40 border border-border p-3 text-xs space-y-1">
                <div className="font-semibold text-foreground">Customer Claim:</div>
                <div className="text-muted-foreground">{selectedDispute.reason}</div>
              </div>

              {/* Delivery / Fulfillment Tracking Number */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Shipment Tracking / Airway Bill (AWB) or Transaction Trace
                </label>
                <Input
                  placeholder="e.g. JNE-092819201948 or POS-REF-2910"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  className="text-xs h-9 font-mono"
                />
              </div>

              {/* Attached Evidence Checklist */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground">
                  Attached Verification Evidence
                </label>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 p-2 rounded-md border border-border/70 bg-background text-xs">
                    <FileCheck2 className="h-4 w-4 text-primary shrink-0" />
                    <span className="font-medium text-foreground">Official Computerized Tax Invoice</span>
                    <Badge variant="outline" className="ml-auto text-[9px] font-mono">
                      {selectedDispute.invoiceNumber}.pdf
                    </Badge>
                  </div>

                  <div className="flex items-center gap-2 p-2 rounded-md border border-border/70 bg-background text-xs">
                    <FileCheck2 className="h-4 w-4 text-primary shrink-0" />
                    <span className="font-medium text-foreground">ASPI EMVCo Clearing Audit Trail</span>
                    <Badge variant="outline" className="ml-auto text-[9px] font-mono">
                      RRN: {selectedDispute.rrn}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Explanation Textarea */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Merchant Statement to Clearing Arbitrator
                </label>
                <textarea
                  rows={3}
                  value={evidenceNotes}
                  onChange={(e) => setEvidenceNotes(e.target.value)}
                  placeholder="Describe order fulfillment, customer communications, or digital delivery confirmation..."
                  className="w-full text-xs rounded-lg border border-border bg-background p-2.5 outline-none focus:ring-2 focus:ring-primary text-foreground"
                />
              </div>
            </div>

            <DialogFooter className="p-4 border-t bg-muted/20 flex items-center justify-between sm:justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEvidenceModalOpen(false)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={submittingEvidence}
                onClick={handleSubmitEvidence}
                className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs gap-1.5 font-semibold"
              >
                {submittingEvidence ? (
                  <>
                    <RefreshCw className="h-3 w-3 animate-spin" />
                    <span>Submitting to Bank...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="h-3.5 w-3.5" />
                    <span>Submit Contest Evidence</span>
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
