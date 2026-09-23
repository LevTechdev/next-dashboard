"use client";

import { useTranslations } from "next-intl";
import { RefreshCw } from "lucide-react";
import { useCurrency } from "@/components/currency-provider";
import { Tooltip } from "@/components/ui/tooltip";
import { relativeStamp } from "@/lib/relative-stamp";
import { cn } from "@/lib/utils";

/**
 * Live FX provenance for a dashboard surface.
 *
 * Every dashboard figure is converted through `CurrencyProvider`'s rates, but
 * nothing on the page said where those rates came from or when they were
 * quoted — so a converted revenue number read as a hardcoded constant. This
 * badge states the pair (`1 USD = Rp 17,838`), the provider, and the age of the
 * quote, and lets the user re-quote on demand.
 *
 * It also carries the honest fallback state: when the built-in table is in use
 * (`ratesStale`), the dot goes neutral and the label says so, so a grey badge is
 * never mistaken for a live market quote.
 *
 * Data attributes (`data-rate-source` / `data-rate-stale`) mirror the settlement
 * panel's, so E2E can assert provenance without scraping the copy.
 */
export function LiveFxBadge({
  className,
  showRefresh = true,
}: {
  className?: string;
  showRefresh?: boolean;
}) {
  const t = useTranslations("currency");
  const {
    currency,
    currentConfig,
    rates,
    ratesSource,
    ratesSourceLabel,
    ratesUpdatedAt,
    ratesStale,
    refreshRates,
  } = useCurrency();

  const quote = currency === "USD" ? null : rates[currency];
  const rateText =
    quote === undefined || quote === null
      ? null
      : quote.toLocaleString("en-US", {
          minimumFractionDigits: currentConfig.decimals,
          maximumFractionDigits: currentConfig.decimals,
        });
  const updatedLabel = ratesUpdatedAt ? relativeStamp(ratesUpdatedAt) : null;
  const source = ratesSourceLabel || ratesSource;

  return (
    <div
      data-testid="live-fx-badge"
      data-rate-source={ratesSource}
      data-rate-stale={ratesStale ? "true" : "false"}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-border bg-background/70 px-2.5 py-1",
        className,
      )}
    >
      <Tooltip side="bottom" content={t("liveRateHint")}>
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className={cn(
              "h-1.5 w-1.5 shrink-0 rounded-full",
              ratesStale ? "bg-muted-foreground/50" : "animate-pulse bg-emerald-500",
            )}
          />
          <span className="text-[11px] font-semibold tabular-nums text-foreground">
            {rateText
              ? t("fxBadgeRate", { rate: `${currentConfig.symbol}${rateText}` })
              : t("baseCurrencyLabel")}
          </span>
        </span>
      </Tooltip>

      <span className="hidden text-[10px] text-muted-foreground sm:inline">
        {ratesStale ? t("fxBadgeFallback") : t("fxBadgeLive", { source })}
      </span>
      {updatedLabel && !ratesStale && (
        <span className="hidden text-[10px] text-muted-foreground/70 md:inline">
          · {t("fxBadgeQuoted", { time: updatedLabel })}
        </span>
      )}

      {showRefresh && (
        <button
          type="button"
          onClick={() => void refreshRates()}
          aria-label={t("refreshRates")}
          className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <RefreshCw className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
