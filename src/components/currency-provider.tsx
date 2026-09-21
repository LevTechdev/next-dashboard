"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import {
  SupportedCurrencyCode,
  CurrencyConfig,
  CURRENCIES,
  DEFAULT_EXCHANGE_RATES,
  convertFromUSD as convertFx,
  setLiveRates,
  FormatMoneyOptions,
  formatMoney as formatFx,
  formatCompactMoney as formatCompactFx,
} from "@/lib/currency";

interface CurrencyContextValue {
  currency: SupportedCurrencyCode;
  setCurrency: (code: SupportedCurrencyCode) => void;
  rates: Record<SupportedCurrencyCode, number>;
  /** Where the rates came from: a live provider id, or "builtin" when offline. */
  ratesSource: string;
  /** Human-facing provenance, e.g. "ExchangeRate-API". */
  ratesSourceLabel: string;
  /** ISO timestamp of the quote, or null while the built-in table is in use. */
  ratesUpdatedAt: string | null;
  /** True when the displayed rates are NOT a live market quote. */
  ratesStale: boolean;
  refreshRates: () => Promise<void>;
  currentConfig: CurrencyConfig;
  isBase: boolean;
  formatMoney: (
    amount: number,
    sourceCurrency?: SupportedCurrencyCode,
    options?: FormatMoneyOptions,
  ) => string;
  formatCurrency: (
    amount: number,
    sourceCurrency?: SupportedCurrencyCode,
    options?: FormatMoneyOptions,
  ) => string;
  formatCompactMoney: (amount: number, sourceCurrency?: SupportedCurrencyCode) => string;
  convertFromUSD: (amountUSD: number) => number;
}

const CurrencyContext = createContext<CurrencyContextValue>({
  currency: "USD",
  setCurrency: () => {},
  rates: DEFAULT_EXCHANGE_RATES,
  ratesSource: "builtin",
  ratesSourceLabel: "",
  ratesUpdatedAt: null,
  ratesStale: true,
  refreshRates: async () => {},
  currentConfig: CURRENCIES.USD,
  isBase: true,
  formatMoney: (val, src, opts) => formatFx(val, "USD", src, undefined, opts),
  formatCurrency: (val, src, opts) => formatFx(val, "USD", src, undefined, opts),
  formatCompactMoney: (val, src) => formatCompactFx(val, "USD", src),
  convertFromUSD: (val) => val,
});

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = useState<SupportedCurrencyCode>("USD");
  // Live mid-market rates once they land; the bundled table until then, so
  // every formatMoney call in the app has a number to work with from the first
  // render and never shows a blank price.
  const [rates, setRates] = useState<Record<SupportedCurrencyCode, number>>(DEFAULT_EXCHANGE_RATES);
  const [ratesSource, setRatesSource] = useState("builtin");
  const [ratesSourceLabel, setRatesSourceLabel] = useState("");
  const [ratesUpdatedAt, setRatesUpdatedAt] = useState<string | null>(null);
  const [ratesStale, setRatesStale] = useState(true);

  const loadRates = useCallback(async (force = false) => {
    try {
      const res = await fetch(`/api/billing/fx-rates${force ? "?refresh=1" : ""}`);
      if (!res.ok) return;
      const data = (await res.json()) as {
        rates?: Partial<Record<SupportedCurrencyCode, number>>;
        source?: string;
        sourceLabel?: string;
        fetchedAt?: string;
        stale?: boolean;
      };
      if (!data.rates) return;
      const incoming = data.rates;
      setRates((prev) => {
        const next = { ...prev };
        for (const [code, value] of Object.entries(incoming)) {
          if (CURRENCIES[code as SupportedCurrencyCode] && typeof value === "number" && value > 0) {
            next[code as SupportedCurrencyCode] = value;
          }
        }
        return next;
      });
      setRatesSource(data.source ?? "builtin");
      setRatesSourceLabel(data.sourceLabel ?? "");
      setRatesUpdatedAt(data.fetchedAt ?? null);
      setRatesStale(data.stale ?? false);
      // Publish to the module-level store so provider-less formatters
      // (utils.formatCurrency and its 38 dashboard call sites) convert at the
      // same market rate as the provider-backed cards.
      setLiveRates(data.rates);
    } catch {
      // Offline or blocked: the bundled table stays in place, and `ratesStale`
      // keeps telling the truth about it.
    }
  }, []);

  useEffect(() => {
    // Refresh only sets state after an awaited fetch resolves; same pattern as
    // the dashboard layout's fetch effects.
    loadRates(); // eslint-disable-line react-hooks/set-state-in-effect
  }, [loadRates]);

  // Initialize from localStorage and listen to cross-component changes
  useEffect(() => {
    const readCurrency = () => {
      try {
        const saved = localStorage.getItem("app-preferred-currency") as SupportedCurrencyCode;
        if (saved && CURRENCIES[saved]) {
          setCurrencyState(saved);
        }
      } catch {
        // ignore
      }
    };

    readCurrency();
    const onCurrencyChange = (e: Event) => {
      const customEvent = e as CustomEvent<SupportedCurrencyCode>;
      if (customEvent.detail && CURRENCIES[customEvent.detail]) {
        setCurrencyState(customEvent.detail);
      } else {
        readCurrency();
      }
    };

    window.addEventListener("app-preferred-currency-changed", onCurrencyChange);
    window.addEventListener("storage", readCurrency);
    return () => {
      window.removeEventListener("app-preferred-currency-changed", onCurrencyChange);
      window.removeEventListener("storage", readCurrency);
    };
  }, []);

  const setCurrency = useCallback((code: SupportedCurrencyCode) => {
    if (CURRENCIES[code]) {
      setCurrencyState(code);
      try {
        localStorage.setItem("app-preferred-currency", code);
        window.dispatchEvent(new CustomEvent("app-preferred-currency-changed", { detail: code }));
      } catch {
        // ignore
      }
    }
  }, []);

  const currentConfig = useMemo(() => CURRENCIES[currency] || CURRENCIES.USD, [currency]);
  const isBase = currency === "USD";

  const formatMoney = useCallback(
    (amount: number, sourceCurrency?: SupportedCurrencyCode, options?: FormatMoneyOptions) => {
      return formatFx(amount, currency, sourceCurrency, rates, options);
    },
    [currency, rates],
  );

  const formatCompactMoney = useCallback(
    (amount: number, sourceCurrency?: SupportedCurrencyCode) => {
      return formatCompactFx(amount, currency, sourceCurrency, rates);
    },
    [currency, rates],
  );

  const convertFromUSD = useCallback(
    (amountUSD: number) => {
      return convertFx(amountUSD, currency, rates);
    },
    [currency, rates],
  );

  const value = useMemo(
    () => ({
      currency,
      setCurrency,
      rates,
      ratesSource,
      ratesSourceLabel,
      ratesUpdatedAt,
      ratesStale,
      refreshRates: () => loadRates(true),
      currentConfig,
      isBase,
      formatMoney,
      formatCurrency: formatMoney,
      formatCompactMoney,
      convertFromUSD,
    }),
    [
      currency,
      setCurrency,
      rates,
      ratesSource,
      ratesSourceLabel,
      ratesUpdatedAt,
      ratesStale,
      loadRates,
      currentConfig,
      isBase,
      formatMoney,
      formatCompactMoney,
      convertFromUSD,
    ],
  );

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error("useCurrency must be used within a CurrencyProvider");
  }
  return context;
}
