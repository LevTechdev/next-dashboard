import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

import { FxSettlementPanel } from "@/components/billing/fx-settlement-panel";
import { CurrencyProvider } from "@/components/currency-provider";

/**
 * The rupiah settlement panel.
 *
 * Two things must hold whatever the network does: the panel never presents a
 * reference rate as a live one, and it never recommends the mid-market figure —
 * that is a yardstick, not a rail anyone can buy dollars through.
 */

const LIVE_RATES = { USD: 1, IDR: 16_000, JPY: 148, EUR: 0.91, SGD: 1.33, CNY: 7.11 };

function stubRates(payload: Record<string, unknown>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, json: async () => payload })),
  );
}

function renderPanel(currency: "IDR" | "JPY" = "IDR", amountUsd = 79) {
  window.localStorage.setItem("app-preferred-currency", currency);
  return render(
    <CurrencyProvider>
      <FxSettlementPanel amountUsd={amountUsd} periodLabel="/month" />
    </CurrencyProvider>,
  );
}

describe("FxSettlementPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    stubRates({
      base: "USD",
      rates: LIVE_RATES,
      source: "open-er-api",
      sourceLabel: "ExchangeRate-API",
      fetchedAt: new Date().toISOString(),
      stale: false,
    });
  });

  it("shows the live rate it converted at, with its provenance", async () => {
    renderPanel();

    const panel = await screen.findByTestId("fx-settlement-panel");
    await waitFor(() => expect(panel.getAttribute("data-rate-source")).toBe("open-er-api"));
    expect(panel.getAttribute("data-rate-stale")).toBe("false");
    // The mid-market rate itself is displayed, so the conversion is auditable.
    // (Grouping follows the app-wide formatter — see the follow-up note about
    // making rupiah amounts locale-aware.)
    expect(screen.getByTestId("fx-mid-rate")).toHaveTextContent("1 USD = Rp 16,000");
    expect(screen.getByTestId("fx-rate-source")).toHaveTextContent("ExchangeRate-API");
    expect(screen.getByTestId("fx-rate-badge")).toHaveTextContent("Live rate");
  });

  it("prices every rail and marks a real one as cheapest", async () => {
    renderPanel();

    const panel = await screen.findByTestId("fx-settlement-panel");
    await waitFor(() => expect(panel.querySelectorAll("tr[data-rail]")).toHaveLength(5));

    const cheapest = panel.querySelectorAll('tr[data-cheapest="true"]');
    expect(cheapest).toHaveLength(1);
    expect(cheapest[0].getAttribute("data-rail")).not.toBe("midMarket");

    // The bank counter block names all four national banks.
    expect(panel.querySelectorAll("[data-bank]")).toHaveLength(4);
  });

  it("names the cheapest rail and how much it saves over the counter", async () => {
    renderPanel(undefined, 79);

    const best = await screen.findByTestId("fx-best");
    // "Multi-currency transfer — about Rp … for this plan, roughly …% less
    // than the most expensive bank counter."
    expect(best).toHaveTextContent(/Multi-currency transfer/);
    expect(best).toHaveTextContent(/Rp/);
    expect(best).toHaveTextContent(/% less than the most expensive bank counter/);
  });

  it("says plainly that it is using reference rates when the feed is down", async () => {
    stubRates({
      base: "USD",
      rates: LIVE_RATES,
      source: "builtin",
      sourceLabel: "Built-in reference rates",
      fetchedAt: "2026-09-01T00:00:00.000Z",
      stale: true,
    });
    renderPanel();

    const panel = await screen.findByTestId("fx-settlement-panel");
    await waitFor(() => expect(panel.getAttribute("data-rate-stale")).toBe("true"));
    expect(screen.getByTestId("fx-rate-badge")).toHaveTextContent("Reference rate");
  });

  it("renders nothing for a currency whose rails it does not model", async () => {
    renderPanel("JPY");

    // Yen buyers see the converted list price on the cards (and the provenance
    // line); Indonesian bank counters would be noise here.
    await waitFor(() =>
      expect(screen.queryByTestId("fx-settlement-panel")).not.toBeInTheDocument(),
    );
  });

  it("prices the yearly amount when the period says so", async () => {
    window.localStorage.setItem("app-preferred-currency", "IDR");
    render(
      <CurrencyProvider>
        <FxSettlementPanel amountUsd={159} periodLabel="/year" />
      </CurrencyProvider>,
    );

    const panel = await screen.findByTestId("fx-settlement-panel");
    await waitFor(() => expect(panel.querySelectorAll("tr[data-rail]")).toHaveLength(5));
    // 159 USD at 16,000 = Rp 2,544,000 — the mid-market baseline is stated.
    expect(panel).toHaveTextContent("Rp 2,544,000");
  });
});
