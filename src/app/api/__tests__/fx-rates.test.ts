import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * /api/billing/fx-rates — the public rate feed behind the pricing page.
 *
 * It is unauthenticated by design (a visitor sees the local price before they
 * have an account), so the tests that matter are about what it refuses to leak
 * and how it degrades: rates and provenance only, never a session or billing
 * detail, and a flagged fallback rather than an invented quote.
 */

const LIVE = { IDR: 16000, JPY: 148, EUR: 0.91, SGD: 1.33, CNY: 7.11 };

vi.mock("server-only", () => ({}));

const { resetMarketRateCache } = await import("@/lib/market-rates");
const route = await import("../billing/fx-rates/route");

function req(query = "") {
  return new Request(`http://localhost:3010/api/billing/fx-rates${query}`);
}

describe("/api/billing/fx-rates", () => {
  beforeEach(() => {
    resetMarketRateCache();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ result: "success", rates: LIVE }),
      })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("answers a visitor with rates and provenance, nothing else", async () => {
    const res = await route.GET(req());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.rates.IDR).toBe(16000);
    expect(body.source).toBe("open-er-api");
    expect(body.stale).toBe(false);
    expect(typeof body.fetchedAt).toBe("string");
    // No settlement comparison unless an amount was asked for.
    expect(body.rails).toBeUndefined();
    expect(body.amountUsd).toBeUndefined();
  });

  it("prices the rupiah rails when given an amount", async () => {
    const body = await (await route.GET(req("?amount=79"))).json();

    expect(body.currency).toBe("IDR");
    expect(body.amountUsd).toBe(79);
    expect(body.midRate).toBe(16000);
    expect(body.rails).toHaveLength(5);
    expect(body.bankCounters).toHaveLength(4);
    const winners = body.rails.filter((r: { cheapest: boolean }) => r.cheapest);
    expect(winners).toHaveLength(1);
    expect(winners[0].id).not.toBe("midMarket");
    // The comparison states when its spreads were last reviewed.
    expect(body.spreadsAsOf).toMatch(/^\d{4}-\d{2}$/);
  });

  it("ignores a nonsense amount instead of pricing it", async () => {
    for (const bad of ["?amount=-5", "?amount=abc", "?amount=0"]) {
      const body = await (await route.GET(req(bad))).json();
      expect(body.rails, bad).toBeUndefined();
    }
  });

  it("degrades to flagged reference rates when every provider is unreachable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Promise.reject(new Error("offline"))),
    );
    resetMarketRateCache();

    const body = await (await route.GET(req())).json();

    expect(body.source).toBe("builtin");
    expect(body.stale).toBe(true);
    // Still quotable — a marketing page must render a price, not a blank.
    expect(body.rates.IDR).toBeGreaterThan(0);
  });

  it("bypasses the cache when asked to refresh", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ result: "success", rates: LIVE }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    await route.GET(req());
    await route.GET(req("?refresh=1"));

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
