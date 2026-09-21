import { NextResponse } from "next/server";

import { fetchMidMarketRates, RATE_TTL_MS } from "@/lib/market-rates";

export const dynamic = "force-dynamic";

/**
 * Live mid-market rates for price display.
 *
 * Public on purpose: the pricing page is a marketing surface, and a visitor has
 * to see the local price before they have an account. It exposes nothing but
 * public FX data — no tenant, session or billing detail.
 *
 * `?refresh=1` bypasses the short cache (the Settings "refresh rates" action),
 * and `?amount=` also returns the settlement comparison for that USD amount so a
 * server-rendered surface can quote a total without reimplementing the model.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const force = searchParams.get("refresh") === "1";

  const rates = await fetchMidMarketRates({ force });

  const amountRaw = searchParams.get("amount");
  const amount = amountRaw === null ? null : Number(amountRaw);
  const idr = rates.rates.IDR;

  // The settlement comparison is IDR-specific by design (Indonesian banks,
  // wallets and the card rails merchants here actually use).
  const wantsComparison = amount !== null && Number.isFinite(amount) && amount > 0 && !!idr;

  if (!wantsComparison) {
    return NextResponse.json({
      base: rates.base,
      rates: rates.rates,
      source: rates.source,
      sourceLabel: rates.sourceLabel,
      fetchedAt: rates.fetchedAt,
      stale: rates.stale,
      ttlMs: RATE_TTL_MS,
      ...(rates.lastError ? { lastError: rates.lastError } : {}),
    });
  }

  const { rankSettlementRails, bankCounterQuotes, SPREADS_AS_OF } =
    await import("@/lib/settlement-rails");

  return NextResponse.json({
    base: rates.base,
    rates: rates.rates,
    source: rates.source,
    sourceLabel: rates.sourceLabel,
    fetchedAt: rates.fetchedAt,
    stale: rates.stale,
    ttlMs: RATE_TTL_MS,
    amountUsd: amount,
    currency: "IDR",
    midRate: idr,
    rails: rankSettlementRails(amount, idr!),
    bankCounters: bankCounterQuotes(amount, idr!),
    spreadsAsOf: SPREADS_AS_OF,
    ...(rates.lastError ? { lastError: rates.lastError } : {}),
  });
}
