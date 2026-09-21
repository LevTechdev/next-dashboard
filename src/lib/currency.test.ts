import { describe, it, expect, afterEach } from "vitest";

import {
  CURRENCIES,
  DEFAULT_EXCHANGE_RATES,
  setLiveRates,
  getLiveRates,
  convertCurrency,
  convertFromUSD,
  toBaseUsd,
} from "./currency";

/** Undo any live-rate pollution so tests stay order-independent. */
afterEach(() => {
  setLiveRates({});
});

describe("live-rate store", () => {
  it("falls back to the bundled table until a live quote lands", () => {
    expect(getLiveRates()).toEqual(DEFAULT_EXCHANGE_RATES);
  });

  it("publishes only known, positive, finite codes", () => {
    setLiveRates({
      IDR: 17790,
      EUR: Number.NaN,
      SGD: -1,
      XXX: 42,
    } as unknown as Partial<Record<keyof typeof CURRENCIES, number>>);
    const rates = getLiveRates();
    expect(rates.IDR).toBe(17790);
    expect(rates.EUR).toBe(DEFAULT_EXCHANGE_RATES.EUR);
    expect(rates.SGD).toBe(DEFAULT_EXCHANGE_RATES.SGD);
    expect((rates as Record<string, number>).XXX).toBeUndefined();
  });

  it("moves convertFromUSD off the bundled rate", () => {
    const bundled = convertFromUSD(100, "IDR");
    setLiveRates({ IDR: 17790 });
    const live = convertFromUSD(100, "IDR");
    expect(bundled).toBe(100 * DEFAULT_EXCHANGE_RATES.IDR);
    expect(live).toBe(1_779_000);
  });

  it("explicit customRates still win over the live store", () => {
    setLiveRates({ IDR: 17790 });
    expect(convertFromUSD(1, "IDR", { IDR: 16000 })).toBe(16000);
  });

  it("reverse-converts IDR amounts through the live rate, not 15850", () => {
    setLiveRates({ IDR: 17790 });
    // Untyped amounts above the 1000 heuristic are treated as IDR-base.
    expect(toBaseUsd(1_779_000)).toBe(100);
    expect(toBaseUsd(1_779_000, "IDR")).toBe(100);
  });

  it("format-level conversion round-trips at one live rate", () => {
    setLiveRates({ IDR: 17790 });
    const local = convertFromUSD(50, "IDR");
    expect(toBaseUsd(local, "IDR")).toBeCloseTo(50, 6);
  });

  it("keeps convertCurrency semantics for explicit sources", () => {
    setLiveRates({ IDR: 17790 });
    // 885,000 IDR at the live rate = 50 USD, rendered back in IDR unchanged.
    expect(convertCurrency(885_000, "IDR", "IDR")).toBe(885_000);
    expect(convertCurrency(885_000, "USD", "IDR")).toBeCloseTo(49.747, 2);
  });
});
