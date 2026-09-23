"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Loader2, TrendingDown, TrendingUp } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { PlanChangePreview } from "@/lib/plan-change";
import type { BillingInterval } from "@/lib/plan-change";

/**
 * The confirmation step for a self-serve plan change.
 *
 * A plan change moves real money, so the button is never one click away from
 * the pricing card: this dialog fetches the server's proration preview — the
 * SAME engine the apply route uses, so what is shown is what is charged — and
 * only then posts the change with `confirm: true`.
 *
 * The amounts are always USD: that is the currency the workspace is billed in,
 * whatever display currency the visitor is browsing with. Showing a converted
 * rupiah figure here would invite the reader to expect a rupiah charge.
 */
export function PlanChangeDialog({
  open,
  onOpenChange,
  planId,
  planName,
  billingInterval,
  currentInterval = "MONTHLY",
  onApplied,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planId: string | null;
  planName: string;
  billingInterval: BillingInterval;
  /** The interval the workspace is on today — for the "from" line. */
  currentInterval?: BillingInterval;
  onApplied?: () => void;
}) {
  const t = useTranslations("pricingPage");
  const locale = useLocale();
  const [preview, setPreview] = useState<PlanChangePreview | null>(null);
  const [currentPlanName, setCurrentPlanName] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [failed, setFailed] = useState(false);

  const money = useCallback(
    (value: number) =>
      new Intl.NumberFormat(locale, {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
      }).format(value),
    [locale],
  );

  useEffect(() => {
    if (!open || !planId) return;
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    setPreview(null);

    fetch(`/api/billing/plan-change?planId=${planId}&billingInterval=${billingInterval}`)
      .then(async (res) => {
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok || !data.preview) {
          setFailed(true);
          return;
        }
        setPreview(data.preview as PlanChangePreview);
        setCurrentPlanName(String(data.current?.planName ?? ""));
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, planId, billingInterval]);

  const confirm = async () => {
    if (!planId) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/billing/plan-change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, billingInterval, confirm: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t("change.error"));
      toast.success(t("change.success", { plan: planName }));
      onOpenChange(false);
      onApplied?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("change.error"));
    } finally {
      setSubmitting(false);
    }
  };

  const kind = preview?.kind ?? null;
  const dueToday = preview ? preview.dueToday : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" data-testid="plan-change-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {kind === "DOWNGRADE" ? (
              <TrendingDown className="h-5 w-5 text-muted-foreground" />
            ) : (
              <TrendingUp className="h-5 w-5 text-primary" />
            )}
            {t("change.title")}
          </DialogTitle>
          <DialogDescription>{t("change.desc")}</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-10" data-testid="plan-change-loading">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : failed || !preview ? (
          <p className="py-6 text-sm text-muted-foreground" data-testid="plan-change-failed">
            {t("change.error")}
          </p>
        ) : (
          <div className="space-y-4 py-2">
            <div className="rounded-xl border border-border bg-muted/30 p-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">{t("change.from")}</span>
                <span className="font-medium">
                  {currentPlanName} ·{" "}
                  {currentInterval === "YEARLY"
                    ? t("change.intervalYearly")
                    : t("change.intervalMonthly")}
                </span>
              </div>
              <div className="mt-1.5 flex items-center justify-between gap-3">
                <span className="text-muted-foreground">{t("change.to")}</span>
                <span className="font-medium text-primary">
                  {planName} ·{" "}
                  {billingInterval === "YEARLY"
                    ? t("change.intervalYearly")
                    : t("change.intervalMonthly")}
                </span>
              </div>
            </div>

            <dl className="space-y-2 text-sm" data-testid="plan-change-lines">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">{t("change.creditLabel")}</dt>
                <dd data-testid="plan-change-credit">−{money(preview.credit)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">{t("change.chargeLabel")}</dt>
                <dd data-testid="plan-change-charge">{money(preview.charge)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-border pt-2 font-semibold">
                <dt>{t("change.dueToday")}</dt>
                <dd data-testid="plan-change-due">{money(dueToday)}</dd>
              </div>
            </dl>

            <p className="text-xs text-muted-foreground">
              {dueToday < 0 ? t("change.creditNoteNote") : t("change.immediateNote")}
            </p>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            {t("change.cancel")}
          </Button>
          <Button
            onClick={confirm}
            disabled={loading || submitting || !preview?.changeable}
            data-testid="plan-change-confirm"
          >
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {t("change.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
