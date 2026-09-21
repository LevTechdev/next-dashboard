/**
 * Real-Time Multi-Currency & FX Exchange Conversion Engine
 * Base currency is USD ($) across database models and ledger transactions.
 */

export type SupportedCurrencyCode = "USD" | "IDR" | "JPY" | "EUR" | "SGD" | "CNY";

export interface CurrencyConfig {
  code: SupportedCurrencyCode;
  symbol: string;
  name: string;
  flag: string;
  rate: number; // 1 USD = rate units
  decimals: number;
  formatPrefix: boolean; // e.g. $100 vs 100€
}

export const CURRENCIES: Record<SupportedCurrencyCode, CurrencyConfig> = {
  USD: {
    code: "USD",
    symbol: "$",
    name: "US Dollar",
    flag: "🇺🇸",
    rate: 1.0,
    decimals: 2,
    formatPrefix: true,
  },
  IDR: {
    code: "IDR",
    symbol: "Rp",
    name: "Indonesian Rupiah",
    flag: "🇮🇩",
    rate: 15850.0,
    decimals: 0,
    formatPrefix: true,
  },
  JPY: {
    code: "JPY",
    symbol: "¥",
    name: "Japanese Yen",
    flag: "🇯🇵",
    rate: 155.2,
    decimals: 0,
    formatPrefix: true,
  },
  EUR: {
    code: "EUR",
    symbol: "€",
    name: "Euro",
    flag: "🇪🇺",
    rate: 0.92,
    decimals: 2,
    formatPrefix: true,
  },
  SGD: {
    code: "SGD",
    symbol: "S$",
    name: "Singapore Dollar",
    flag: "🇸🇬",
    rate: 1.34,
    decimals: 2,
    formatPrefix: true,
  },
  CNY: {
    code: "CNY",
    symbol: "¥",
    name: "Chinese Yuan",
    flag: "🇨🇳",
    rate: 7.23,
    decimals: 2,
    formatPrefix: true,
  },
};

/**
 * Module-level live-rate store.
 *
 * `CurrencyProvider` publishes every live quote it fetches here so the
 * *non-React* conversion helpers (`convertCurrency`, `convertFromUSD`,
 * `toBaseUsd`) and every caller that formats without the provider —
 * `utils.formatCurrency` and its 38 call sites across orders, customers,
 * reports, sales, affiliates, discounts and marketing — convert at the same
 * market rate the provider-backed cards show, instead of silently falling
 * back to the two-year-old bundled table.
 *
 * Falls back to `DEFAULT_EXCHANGE_RATES` per code until a live quote lands,
 * so nothing ever divides by undefined.
 */
let liveRates: Partial<Record<SupportedCurrencyCode, number>> = {};

/** Publish a live quote (from CurrencyProvider) for all non-React converters. */
export function setLiveRates(rates: Partial<Record<SupportedCurrencyCode, number>>): void {
  const clean: Partial<Record<SupportedCurrencyCode, number>> = {};
  for (const [code, value] of Object.entries(rates)) {
    const n = typeof value === "number" ? value : Number(value);
    if (CURRENCIES[code as SupportedCurrencyCode] && Number.isFinite(n) && n > 0) {
      clean[code as SupportedCurrencyCode] = n;
    }
  }
  liveRates = clean;
}

/** The rates non-React conversion currently uses: live codes over bundled. */
export function getLiveRates(): Record<SupportedCurrencyCode, number> {
  return { ...DEFAULT_EXCHANGE_RATES, ...liveRates };
}

export const DEFAULT_EXCHANGE_RATES: Record<SupportedCurrencyCode, number> = {
  USD: 1.0,
  IDR: 15850.0,
  JPY: 155.2,
  EUR: 0.92,
  SGD: 1.34,
  CNY: 7.23,
};

/**
 * Normalizes high-denomination IDR or arbitrary local values to USD base.
 * Values > 1000 without explicit source are treated as IDR database amounts.
 *
 * The hardcoded 15850 divider becomes a live lookup once a market quote has
 * landed — otherwise an Indonesian merchant viewing live-rate stat cards
 * would reverse-convert their orders at a rate twelve percent stale.
 */
export function toBaseUsd(amount: number, sourceCurrency?: SupportedCurrencyCode): number {
  if (!amount || isNaN(amount)) return 0;
  const rates = getLiveRates();
  if (sourceCurrency === "IDR") return amount / rates.IDR;
  if (sourceCurrency && sourceCurrency !== "USD") {
    return amount / (rates[sourceCurrency] ?? 1.0);
  }
  return amount > 1000 ? amount / rates.IDR : amount;
}

/**
 * Converts an arbitrary amount to the target currency.
 */
export function convertCurrency(
  amount: number,
  targetCurrency: SupportedCurrencyCode,
  sourceCurrency?: SupportedCurrencyCode,
  customRates?: Partial<Record<SupportedCurrencyCode, number>>,
): number {
  if (!amount || isNaN(amount)) return 0;
  if (sourceCurrency === targetCurrency) return amount;
  // USD is the base currency: an explicitly-USD target never converts, even
  // when the source is untyped (the >1000 IDR heuristic below is reserved
  // for untyped amounts rendered in a non-USD target).
  if (!sourceCurrency && targetCurrency === "USD") return amount;
  if (!sourceCurrency && targetCurrency === "IDR" && amount > 1000) return amount;

  const usdAmount = toBaseUsd(amount, sourceCurrency);
  const rate = customRates?.[targetCurrency] ?? getLiveRates()[targetCurrency] ?? 1.0;
  return usdAmount * rate;
}

/**
 * Converts an amount explicitly denominated in USD to the target currency
 */
export function convertFromUSD(
  amountUSD: number,
  targetCurrency: SupportedCurrencyCode,
  customRates?: Partial<Record<SupportedCurrencyCode, number>>,
): number {
  if (!amountUSD || isNaN(amountUSD)) return 0;
  const rate = customRates?.[targetCurrency] ?? getLiveRates()[targetCurrency] ?? 1.0;
  return amountUSD * rate;
}

export interface FormatMoneyOptions {
  compact?: boolean;
  maximumFractionDigits?: number;
}

/**
 * Formats an amount into localized display string in target currency
 */
export function formatMoney(
  amount: number,
  currencyCode: SupportedCurrencyCode = "USD",
  sourceCurrency?: SupportedCurrencyCode,
  customRates?: Partial<Record<SupportedCurrencyCode, number>>,
  options?: FormatMoneyOptions,
): string {
  const cfg = CURRENCIES[currencyCode] || CURRENCIES.USD;
  const converted = convertCurrency(amount, currencyCode, sourceCurrency, customRates);

  if (options?.compact) {
    const compactStr = new Intl.NumberFormat("en-US", {
      notation: "compact",
      compactDisplay: "short",
      maximumFractionDigits: options.maximumFractionDigits ?? 1,
    }).format(converted);
    return `${cfg.symbol} ${compactStr}`.trim();
  }

  if (cfg.decimals === 0) {
    const formatted = Math.round(converted).toLocaleString("en-US");
    return `${cfg.symbol} ${formatted}`;
  }

  const formatted = converted.toLocaleString("en-US", {
    minimumFractionDigits: cfg.decimals,
    maximumFractionDigits: options?.maximumFractionDigits ?? cfg.decimals,
  });

  return `${cfg.symbol}${formatted}`;
}

export function formatCompactMoney(
  amount: number,
  currencyCode: SupportedCurrencyCode = "USD",
  sourceCurrency?: SupportedCurrencyCode,
  customRates?: Partial<Record<SupportedCurrencyCode, number>>,
): string {
  return formatMoney(amount, currencyCode, sourceCurrency, customRates, { compact: true });
}
