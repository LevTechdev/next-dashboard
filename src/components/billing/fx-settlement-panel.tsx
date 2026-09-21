"use client";

import { useTranslations } from "next-intl";
import { ArrowRight, BadgeCheck, Banknote, Info, RefreshCw } from "lucide-react";

import { useCurrency } from "@/components/currency-provider";
import {
  bankCounterQuotes,
  bestSettlementRail,
  rankSettlementRails,
  SPREADS_AS_OF,
} from "@/lib/settlement-rails";
import { cn } from "@/lib/utils";

/**
 * "What this plan costs you in rupiah."
 *
 * A dollar list price is only half a price for a buyer in Jakarta: the number
 * that leaves their account depends on the rail they pay through, and that gap
 * is bigger than most people assume (a bank's kurs jual is ~1.5–2% off the
 * mid-market rate you see on Google, a card can be ~3%). This panel shows the
 * live mid-market rate it used, prices the rails against it, names the cheapest
 * one, and says plainly that the spreads are indicative.
 *
 * It renders only for a rupiah display currency — the settlement rails modelled
 * here are Indonesian, and showing them to a euro buyer would be noise.
 */
export function FxSettlementPanel({
  amountUsd,
  periodLabel,
  className,
}: {
  amountUsd: number;
  /** "per month" / "per year" — names the amount so the table is unambiguous. */
  periodLabel: string;
  className?: string;
}) {
  const t = useTranslations("pricingPage");
  const {
    currency,
    rates,
    ratesSource,
    ratesSourceLabel,
    ratesUpdatedAt,
    ratesStale,
    formatMoney,
    refreshRates,
  } = useCurrency();

  const idr = rates.IDR;
  if (currency !== "IDR" || !idr) return null;

  const rails = rankSettlementRails(amountUsd, idr);
  const best = bestSettlementRail(amountUsd, idr);
  const banks = bankCounterQuotes(amountUsd, idr);
  const midTotal = amountUsd * idr;
  // The most expensive bank counter is the honest comparison for "what you save".
  const priciestBank = banks[banks.length - 1];

  const updatedLabel = ratesUpdatedAt ? relativeStamp(ratesUpdatedAt) : null;

  return (
    <section
      data-testid="fx-settlement-panel"
      data-rate-source={ratesSource}
      data-rate-stale={ratesStale ? "true" : "false"}
      className={cn(
        "rounded-3xl border border-border bg-background p-6 sm:p-8 text-left",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-xl font-bold tracking-tight text-foreground">{t("fxTitle")}</h2>
        <span
          data-testid="fx-rate-badge"
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
            ratesStale ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary",
          )}
        >
          {ratesStale ? <Info className="h-3 w-3" /> : <BadgeCheck className="h-3 w-3" />}
          {ratesStale ? t("fxStale") : t("fxLive")}
        </span>
        <button
          type="button"
          onClick={() => void refreshRates()}
          className="ml-auto inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
          aria-label={t("fxRefresh")}
        >
          <RefreshCw className="h-3 w-3" />
          {updatedLabel ? t("fxUpdated", { time: updatedLabel }) : t("fxRefresh")}
        </button>
      </div>

      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{t("fxSubtitle")}</p>

      <div className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-2xl border border-border bg-muted/40 px-4 py-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("fxMidMarketLabel")}
        </span>
        <span className="text-sm font-semibold" data-testid="fx-mid-rate">
          1 USD = {formatMoney(idr, "IDR")}
        </span>
        <span className="text-xs text-muted-foreground" data-testid="fx-rate-source">
          {t("fxSource", { source: ratesSourceLabel || ratesSource })}
        </span>
      </div>

      {best && priciestBank && (
        <p className="mt-4 flex items-start gap-2 text-sm leading-relaxed" data-testid="fx-best">
          <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <span>
            <strong className="font-semibold">{t("fxBestTitle")}</strong>{" "}
            {t("fxBestBody", {
              rail: t(`settlementRail_${best.id}`),
              amount: formatMoney(best.localCost, "IDR"),
              pct: percent(priciestBank.localCost / best.localCost - 1),
            })}
          </span>
        </p>
      )}

      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="py-2 pr-4 font-semibold">{t("fxRailColumn")}</th>
              <th className="py-2 pr-4 font-semibold">{t("fxRailCostColumn")}</th>
              <th className="py-2 font-semibold">{t("fxRailBasisColumn")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rails.map((rail) => (
              <tr
                key={rail.id}
                data-rail={rail.id}
                data-cheapest={rail.cheapest ? "true" : "false"}
              >
                <td className="py-2.5 pr-4">
                  <span className="flex items-center gap-2">
                    <span
                      className={cn(
                        "font-medium",
                        rail.kind === "reference" && "text-muted-foreground",
                      )}
                    >
                      {t(`settlementRail_${rail.id}`)}
                    </span>
                    {rail.cheapest && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                        {t("fxCheapest")}
                      </span>
                    )}
                  </span>
                </td>
                <td className="py-2.5 pr-4 tabular-nums">
                  {formatMoney(rail.localCost, "IDR")}
                  {rail.kind === "rail" && rail.extraPct > 0 && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      +{percent(rail.extraPct)}
                    </span>
                  )}
                </td>
                <td className="py-2.5 text-xs text-muted-foreground">
                  {t(`settlementBasis_${rail.basis}`)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-5 rounded-2xl border border-border bg-muted/30 p-4">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Banknote className="h-3.5 w-3.5" />
          {t("fxBankTitle")}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{t("fxBankSubtitle")}</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {banks.map((bank) => (
            <div
              key={bank.id}
              data-bank={bank.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background px-3 py-2 text-xs"
            >
              <span className="font-semibold">{t(`bank_${bank.id}`)}</span>
              <span className="text-muted-foreground">
                {t("fxKursJual")} {formatMoney(bank.kursJual, "IDR")}
              </span>
              <span className="tabular-nums font-medium">{formatMoney(bank.localCost, "IDR")}</span>
            </div>
          ))}
        </div>
      </div>

      <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
        {t("fxIndicative", { asOf: SPREADS_AS_OF, period: periodLabel })}{" "}
        {t("fxMidTotal", { amount: formatMoney(midTotal, "IDR") })}
      </p>
    </section>
  );
}

/** "2m ago" / "3h ago" / "5d ago" — compact provenance stamp. */
function relativeStamp(iso: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86_400)}d`;
}

function percent(fraction: number): string {
  return `${(fraction * 100).toFixed(1)}%`;
}
