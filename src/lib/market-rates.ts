import "server-only";

import { DEFAULT_EXCHANGE_RATES, type SupportedCurrencyCode } from "@/lib/currency";

/**
 * Live mid-market exchange rates.
 *
 * The dashboard shipped with hardcoded rates (`DEFAULT_EXCHANGE_RATES`), which
 * is fine for a demo and wrong for pricing: the Indonesian rupiah moves every
 * day, and a list price converted at a two-year-old rate is simply a different
 * price. This module pulls the *mid-market* rate — the midpoint between buy and
 * sell, which is the number Google, Xe, Wise and OANDA all show — from free
 * providers that need no key, and falls back to the built-in table rather than
 * failing.
 *
 * What it deliberately does NOT do is pretend a mid-market rate is what anyone
 * actually transacts at. Banks and cards earn their money on the spread between
 * the mid-market rate and their own kurs jual (the rate at which they sell you
 * dollars). That is a *settlement* concern, modelled separately in
 * `settlement-rails.ts` — never folded into this number, so the card can show
 * both honestly and let the difference be the point.
 */

export type RateSourceId =
  /** ExchangeRate-API's open endpoint — free, no key, quotes IDR. */
  | "open-er-api"
  /** Fawazahmed0's currency-api on jsDelivr — free, no key, quotes IDR. */
  | "currency-api"
  /** Frankfurter — ECB reference rates. No IDR; a last resort for the majors. */
  | "frankfurter"
  /** The bundled static table. Used when every provider is unreachable. */
  | "builtin";

export interface ProviderDefinition {
  id: RateSourceId;
  /** Human-facing provenance, shown next to the converted price. */
  label: string;
  url: string;
  /** Extract `{ USD: n }`-style rates (1 USD = n units) from a payload. */
  parse: (payload: unknown) => Record<string, number> | null;
}

function numericRates(input: unknown): Record<string, number> | null {
  if (!input || typeof input !== "object") return null;
  const out: Record<string, number> = {};
  for (const [code, value] of Object.entries(input as Record<string, unknown>)) {
    const n = typeof value === "number" ? value : Number(value);
    if (Number.isFinite(n) && n > 0) out[code.toUpperCase()] = n;
  }
  return Object.keys(out).length ? out : null;
}

/**
 * The chain, in preference order. Each entry is only trusted for the currencies
 * it actually quotes, which is why a payload missing IDR is rejected outright
 * instead of producing a price that silently falls back per currency.
 */
export const RATE_PROVIDERS: ProviderDefinition[] = [
  {
    id: "open-er-api",
    label: "ExchangeRate-API",
    url: "https://open.er-api.com/v6/latest/USD",
    parse: (payload) => {
      const body = payload as { result?: string; rates?: unknown } | null;
      if (body?.result && body.result !== "success") return null;
      return numericRates(body?.rates);
    },
  },
  {
    id: "currency-api",
    label: "currency-api",
    url: "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json",
    parse: (payload) => numericRates((payload as { usd?: unknown } | null)?.usd),
  },
  {
    id: "frankfurter",
    label: "ECB reference rates",
    url: "https://api.frankfurter.app/latest?from=USD",
    parse: (payload) => numericRates((payload as { rates?: unknown } | null)?.rates),
  },
];

export interface MarketRates {
  base: "USD";
  /** 1 USD = `rates[code]` units, for the codes the panel cares about. */
  rates: Partial<Record<SupportedCurrencyCode, number>>;
  source: RateSourceId;
  sourceLabel: string;
  /** ISO timestamp of the fetch (or of the fallback's construction). */
  fetchedAt: string;
  /** True when the value is the bundled table, not a market quote. */
  stale: boolean;
  /** Provider id whose payload was rejected most recently, for diagnostics. */
  lastError?: string;
}

/** Currencies the rate panel must be able to quote. */
const REQUIRED: SupportedCurrencyCode[] = ["USD", "IDR", "JPY", "EUR", "SGD", "CNY"];

/** How long a fetched quote is reused before another provider call is made. */
export const RATE_TTL_MS = 10 * 60_000;

interface CacheEntry {
  rates: MarketRates;
  at: number;
}

// Process-local cache: the endpoint is read on page load, and a warm server
// answering hundreds of requests should not hit the provider hundreds of times.
// A cold start simply refetches — the TTL is a courtesy to the provider, not a
// correctness requirement.
let cache: CacheEntry | null = null;

export function resetMarketRateCache(): void {
  cache = null;
}

/** The bundled fallback, shaped exactly like a live quote. */
export function builtinRates(reason?: string): MarketRates {
  return {
    base: "USD",
    rates: { ...DEFAULT_EXCHANGE_RATES },
    source: "builtin",
    sourceLabel: "Built-in reference rates",
    fetchedAt: new Date().toISOString(),
    stale: true,
    ...(reason ? { lastError: reason } : {}),
  };
}

/**
 * Pick the provider payload worth trusting.
 *
 * Pure, so the acceptance rules are testable without a network: a payload is
 * only usable when it quotes every currency the panel needs at a sane
 * magnitude. A truncated response with three currencies is not "good enough" —
 * showing seven prices live and one at a stale built-in rate is worse than
 * showing all seven as references.
 */
export function acceptProviderRates(
  providerId: RateSourceId,
  payload: unknown,
): Record<string, number> | null {
  const provider = RATE_PROVIDERS.find((p) => p.id === providerId);
  if (!provider) return null;
  const raw = provider.parse(payload);
  if (!raw) return null;

  const picked: Record<string, number> = { USD: 1 };
  for (const code of REQUIRED) {
    if (code === "USD") continue;
    const value = raw[code];
    if (!Number.isFinite(value) || value <= 0) return null;
    picked[code] = value;
  }
  return picked;
}

/**
 * Fetch the current mid-market rates, preferring a live provider and falling
 * back to the bundled table. Never throws.
 *
 * `minIntervalMs` (default {@link RATE_TTL_MS}) controls reuse: pass 0 to force
 * a fresh call, e.g. from the Settings "refresh rates" action.
 */
export async function fetchMidMarketRates(
  opts: { minIntervalMs?: number; timeoutMs?: number; force?: boolean } = {},
): Promise<MarketRates> {
  const minInterval = opts.minIntervalMs ?? RATE_TTL_MS;
  const timeoutMs = opts.timeoutMs ?? 3500;

  if (!opts.force && cache && Date.now() - cache.at < minInterval) {
    return cache.rates;
  }

  let lastError = "";
  for (const provider of RATE_PROVIDERS) {
    try {
      const res = await fetch(provider.url, {
        // Providers are third-party CDNs; a quote is not worth a hanging page.
        signal: AbortSignal.timeout(timeoutMs),
        headers: { accept: "application/json" },
        cache: "no-store",
      });
      if (!res.ok) {
        lastError = `${provider.id}: HTTP ${res.status}`;
        continue;
      }
      const picked = acceptProviderRates(provider.id, await res.json());
      if (!picked) {
        lastError = `${provider.id}: payload missing required currencies`;
        continue;
      }

      const result: MarketRates = {
        base: "USD",
        rates: picked as Partial<Record<SupportedCurrencyCode, number>>,
        source: provider.id,
        sourceLabel: provider.label,
        fetchedAt: new Date().toISOString(),
        stale: false,
      };
      cache = { rates: result, at: Date.now() };
      return result;
    } catch (err) {
      lastError = `${provider.id}: ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  // Every provider is down or unusable: keep the last good quote if one exists
  // (it is still closer than the bundled table), otherwise say so out loud.
  if (cache) return { ...cache.rates, stale: true, lastError };

  const fallback = builtinRates(lastError);
  cache = { rates: fallback, at: Date.now() };
  return fallback;
}
