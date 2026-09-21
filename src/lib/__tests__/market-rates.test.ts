import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * market-rates.ts — the live mid-market quote.
 *
 * The behaviour that matters is what happens when the outside world misbehaves:
 * a provider that answers with a partial payload, one that is slow, and all of
 * them being down at once. A price panel that silently converts at a wrong rate
 * is worse than one that admits it is using reference rates, so every fallback
 * here is asserted rather than assumed.
 */

vi.mock("server-only", () => ({}));

import {
  acceptProviderRates,
  builtinRates,
  fetchMidMarketRates,
  RATE_PROVIDERS,
  resetMarketRateCache,
} from "@/lib/market-rates";
import { DEFAULT_EXCHANGE_RATES } from "@/lib/currency";

const FULL_PAYLOAD = {
  IDR: 15912,
  JPY: 148.2,
  EUR: 0.91,
  SGD: 1.33,
  CNY: 7.11,
};

function jsonResponse(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body } as unknown as Response;
}

describe("market rates", () => {
  beforeEach(() => {
    resetMarketRateCache();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe("payload acceptance", () => {
    it("reads each provider's own shape into one USD table", () => {
      expect(
        acceptProviderRates("open-er-api", { result: "success", rates: FULL_PAYLOAD }),
      ).toMatchObject({ IDR: 15912 });
      expect(
        acceptProviderRates("currency-api", { date: "2026-09-22", usd: FULL_PAYLOAD }),
      ).toMatchObject({ IDR: 15912 });
      expect(
        acceptProviderRates("frankfurter", { base: "USD", rates: FULL_PAYLOAD }),
      ).toMatchObject({ IDR: 15912 });
    });

    it("rejects a payload that does not quote every currency the panel needs", () => {
      // Three of six currencies is not "good enough": half the prices would be
      // live and half stale, which is exactly the confusion to avoid.
      expect(acceptProviderRates("open-er-api", { rates: { IDR: 15912, JPY: 148 } })).toBeNull();
    });

    it("rejects garbage instead of inventing a rate", () => {
      expect(acceptProviderRates("open-er-api", { rates: { ...FULL_PAYLOAD, IDR: 0 } })).toBeNull();
      expect(
        acceptProviderRates("open-er-api", { rates: { ...FULL_PAYLOAD, IDR: "n/a" } }),
      ).toBeNull();
      expect(acceptProviderRates("open-er-api", null)).toBeNull();
      expect(acceptProviderRates("open-er-api", "not json")).toBeNull();
    });

    it("refuses a payload a provider itself flagged as failed", () => {
      expect(
        acceptProviderRates("open-er-api", { result: "error", rates: FULL_PAYLOAD }),
      ).toBeNull();
    });
  });

  describe("provider chain", () => {
    it("uses the first provider that answers usefully", async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(jsonResponse({ result: "success", rates: FULL_PAYLOAD }));
      vi.stubGlobal("fetch", fetchMock);

      const rates = await fetchMidMarketRates();

      expect(rates.source).toBe("open-er-api");
      expect(rates.sourceLabel).toBe("ExchangeRate-API");
      expect(rates.rates.IDR).toBe(15912);
      expect(rates.stale).toBe(false);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("moves down the chain when a provider is down or short", async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({}, false, 503))
        .mockResolvedValueOnce(jsonResponse({ usd: FULL_PAYLOAD }));
      vi.stubGlobal("fetch", fetchMock);

      const rates = await fetchMidMarketRates();

      expect(rates.source).toBe("currency-api");
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("falls back to the bundled table when every provider fails", async () => {
      const fetchMock = vi.fn().mockRejectedValue(new Error("ENOTFOUND"));
      vi.stubGlobal("fetch", fetchMock);

      const rates = await fetchMidMarketRates();

      expect(rates.source).toBe("builtin");
      expect(rates.stale).toBe(true);
      expect(rates.rates).toEqual(DEFAULT_EXCHANGE_RATES);
      expect(rates.lastError).toContain("ENOTFOUND");
      expect(fetchMock).toHaveBeenCalledTimes(RATE_PROVIDERS.length);
    });

    it("serves a cached quote without another provider call", async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(jsonResponse({ result: "success", rates: FULL_PAYLOAD }));
      vi.stubGlobal("fetch", fetchMock);

      await fetchMidMarketRates();
      const second = await fetchMidMarketRates();

      expect(second.rates.IDR).toBe(15912);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("re-fetches when the caller forces a refresh", async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(jsonResponse({ result: "success", rates: FULL_PAYLOAD }));
      vi.stubGlobal("fetch", fetchMock);

      await fetchMidMarketRates();
      await fetchMidMarketRates({ force: true });

      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("keeps the last good quote when a later refresh fails", async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({ result: "success", rates: FULL_PAYLOAD }))
        .mockRejectedValue(new Error("offline"));
      vi.stubGlobal("fetch", fetchMock);

      await fetchMidMarketRates();
      const degraded = await fetchMidMarketRates({ force: true });

      // Still the market's number, but flagged — and it says why.
      expect(degraded.rates.IDR).toBe(15912);
      expect(degraded.stale).toBe(true);
      expect(degraded.lastError).toContain("offline");
    });

    it("marks the bundled table as reference data", () => {
      const builtin = builtinRates("no network");
      expect(builtin.stale).toBe(true);
      expect(builtin.source).toBe("builtin");
      expect(builtin.rates.IDR).toBe(DEFAULT_EXCHANGE_RATES.IDR);
    });
  });
});
