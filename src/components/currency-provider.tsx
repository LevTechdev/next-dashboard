"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import {
  SupportedCurrencyCode,
  CurrencyConfig,
  CURRENCIES,
  DEFAULT_EXCHANGE_RATES,
  convertFromUSD as convertFx,
  FormatMoneyOptions,
  formatMoney as formatFx,
  formatCompactMoney as formatCompactFx,
} from "@/lib/currency";

interface CurrencyContextValue {
  currency: SupportedCurrencyCode;
  setCurrency: (code: SupportedCurrencyCode) => void;
  rates: Record<SupportedCurrencyCode, number>;
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
  currentConfig: CURRENCIES.USD,
  isBase: true,
  formatMoney: (val, src, opts) => formatFx(val, "USD", src, undefined, opts),
  formatCurrency: (val, src, opts) => formatFx(val, "USD", src, undefined, opts),
  formatCompactMoney: (val, src) => formatCompactFx(val, "USD", src),
  convertFromUSD: (val) => val,
});

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = useState<SupportedCurrencyCode>("USD");
  const [rates] = useState<Record<SupportedCurrencyCode, number>>(DEFAULT_EXCHANGE_RATES);

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
