/**
 * What a converted price actually costs.
 *
 * The mid-market rate (`market-rates.ts`) is the number everyone quotes and
 * nobody transacts at. The gap between it and the rate you are actually given is
 * where the money goes: an Indonesian bank sells you dollars at its own kurs
 * jual, a card network adds an FX markup on top of the issuer's, and a
 * multi-currency transfer service charges a small explicit fee instead of a
 * hidden spread.
 *
 * This module turns that into a comparison a buyer can read: for the same USD
 * price, what do you part with in local currency, and which rail is cheapest.
 * Pure and client-safe — the pricing card recomputes it whenever the currency
 * or the billing period changes.
 *
 * Every spread here is INDICATIVE. It models the *shape* of the cost (a percent
 * spread, sometimes a flat fee) using typical published pricing, and the card
 * says so. It is a shopping aid, not a quote.
 */

export type SettlementRailId =
  /** The mid-market number itself — a yardstick, not something you can buy. */
  | "midMarket"
  /** Multi-currency transfer services (Wise/Revolut class): small explicit fee. */
  | "transfer"
  /** Indonesian bank TT/RTGS: the bank's own kurs jual, spread baked in. */
  | "bankWire"
  /** Card networks: FX markup plus the issuer's cross-border fee. */
  | "cardOct"
  /** Domestic wallets (DANA/OVO/GoPay) topped up in IDR. */
  | "ewallet";

export interface SettlementRail {
  id: SettlementRailId;
  /** `reference` rails are yardsticks; only real rails can be "cheapest". */
  kind: "reference" | "rail";
  /** Cost above mid-market, as a fraction (0.005 = 0.5% worse than mid). */
  spreadPct: number;
  /** Fixed fee charged in the source currency (USD here). */
  flatFeeUsd: number;
  /**
   * How the spread was derived — surfaced so a buyer can tell a published fee
   * (a transfer service) from an estimated one (a card network's markup).
   */
  basis: "publicFee" | "publishedSpread" | "estimated";
}

/** Month the indicative spreads below were last reviewed. */
export const SPREADS_AS_OF = "2026-09";

/**
 * Typical total cost over mid-market, per rail.
 *
 * Sources of shape, not live quotes: multi-currency services publish a ~0.4–0.6%
 * conversion fee; Indonesian banks' USD/IDR kurs jual sits roughly 1–2% off mid
 * (and moves every day); card cross-border markups are commonly ~1% network +
 * ~1–2% issuer.
 */
export const SETTLEMENT_RAILS: SettlementRail[] = [
  { id: "midMarket", kind: "reference", spreadPct: 0, flatFeeUsd: 0, basis: "publishedSpread" },
  { id: "transfer", kind: "rail", spreadPct: 0.005, flatFeeUsd: 0, basis: "publicFee" },
  { id: "ewallet", kind: "rail", spreadPct: 0.01, flatFeeUsd: 0, basis: "estimated" },
  { id: "bankWire", kind: "rail", spreadPct: 0.0175, flatFeeUsd: 0, basis: "publishedSpread" },
  { id: "cardOct", kind: "rail", spreadPct: 0.029, flatFeeUsd: 0, basis: "estimated" },
];

export interface RankedSettlementRail extends SettlementRail {
  /** Local-currency amount parted with, mid-market conversion + spread + fee. */
  localCost: number;
  /** The rate you effectively receive: localCost / amountUsd. */
  effectiveRate: number;
  /** Extra local currency this rail costs over the mid-market number. */
  extraLocal: number;
  /** That extra as a fraction of the mid-market total. */
  extraPct: number;
  /** Cheapest REAL rail (reference rails never win). */
  cheapest: boolean;
}

/**
 * Price every rail for one USD amount.
 *
 * Sorted best-first by what you actually pay, with the mid-market reference
 * always available (its cost is the baseline, so its `extraLocal` is 0 — which
 * is exactly why it must not be labelled "cheapest"). Returns `[]` for a
 * non-positive amount or rate: there is nothing to compare, and inventing a
 * rank would be worse than showing none.
 */
export function rankSettlementRails(
  amountUsd: number,
  midRate: number,
  rails: SettlementRail[] = SETTLEMENT_RAILS,
): RankedSettlementRail[] {
  if (!Number.isFinite(amountUsd) || amountUsd <= 0) return [];
  if (!Number.isFinite(midRate) || midRate <= 0) return [];

  const baseline = amountUsd * midRate;

  const priced = rails.map((rail) => {
    const localCost = amountUsd * (1 + rail.spreadPct) * midRate + rail.flatFeeUsd * midRate;
    const extraLocal = localCost - baseline;
    return {
      ...rail,
      localCost,
      effectiveRate: localCost / amountUsd,
      extraLocal,
      extraPct: baseline > 0 ? extraLocal / baseline : 0,
      cheapest: false,
    };
  });

  const bestReal = priced
    .filter((r) => r.kind === "rail")
    .sort((a, b) => a.localCost - b.localCost)[0];

  return priced
    .map((r) => ({ ...r, cheapest: !!bestReal && r.id === bestReal.id }))
    .sort((a, b) => a.localCost - b.localCost);
}

/** The cheapest real rail, or null when nothing is priceable. */
export function bestSettlementRail(
  amountUsd: number,
  midRate: number,
  rails: SettlementRail[] = SETTLEMENT_RAILS,
): RankedSettlementRail | null {
  return rankSettlementRails(amountUsd, midRate, rails).find((r) => r.cheapest) ?? null;
}

// ─── Bank counter reference ──────────────────────────────────────────────────

export interface BankCounterRate {
  /** Bank id — its display name comes from the locale bundle. */
  id: "bca" | "mandiri" | "bni" | "bri";
  /** Spread the bank applies on top of mid when it SELLS you USD (kurs jual). */
  kursJualSpreadPct: number;
  /** Its buy rate (kurs beli) sits on the other side of mid. */
  kursBeliSpreadPct: number;
}

/**
 * The four national banks a business most often wires through, with the spread
 * direction that matters when paying a USD invoice: you are buying dollars, so
 * you get the bank's kurs jual — above mid-market.
 */
export const BANK_COUNTER_RAILS: BankCounterRate[] = [
  { id: "bca", kursJualSpreadPct: 0.015, kursBeliSpreadPct: 0.012 },
  { id: "mandiri", kursJualSpreadPct: 0.017, kursBeliSpreadPct: 0.013 },
  { id: "bni", kursJualSpreadPct: 0.016, kursBeliSpreadPct: 0.0125 },
  { id: "bri", kursJualSpreadPct: 0.018, kursBeliSpreadPct: 0.014 },
];

export interface BankCounterQuote extends BankCounterRate {
  /** The rate the bank sells USD at (you pay this many local units per USD). */
  kursJual: number;
  /** The rate the bank buys USD at. */
  kursBeli: number;
  /** Local amount parted with for `amountUsd` at kurs jual. */
  localCost: number;
  /** Extra over mid-market, as a fraction of the mid-market total. */
  extraPct: number;
}

/** Indicative counter rates for one amount, oldest-cheapest-relevant first. */
export function bankCounterQuotes(amountUsd: number, midRate: number): BankCounterQuote[] {
  if (!Number.isFinite(amountUsd) || amountUsd <= 0) return [];
  if (!Number.isFinite(midRate) || midRate <= 0) return [];

  const baseline = amountUsd * midRate;
  return BANK_COUNTER_RAILS.map((bank) => {
    const kursJual = midRate * (1 + bank.kursJualSpreadPct);
    const kursBeli = midRate * (1 - bank.kursBeliSpreadPct);
    const localCost = amountUsd * kursJual;
    return {
      ...bank,
      kursJual,
      kursBeli,
      localCost,
      extraPct: (localCost - baseline) / baseline,
    };
  }).sort((a, b) => a.localCost - b.localCost);
}
