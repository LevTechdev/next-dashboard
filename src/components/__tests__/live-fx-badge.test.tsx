import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

/**
 * LiveFxBadge — the dashboard's FX provenance pill.
 *
 * Dashboard figures are converted through the currency provider, so the badge
 * has one job: say which rates produced them and how old the quote is. These
 * tests pin the three states a user can actually meet — a live rupiah quote, the
 * built-in fallback table, and the base USD view — plus the data attributes the
 * E2E specs read.
 */

const refreshRates = vi.fn();
let currencyState: Record<string, unknown>;

vi.mock("@/components/currency-provider", () => ({
  useCurrency: () => currencyState,
}));

import { LiveFxBadge } from "@/components/currency/live-fx-badge";

function setCurrency(overrides: Record<string, unknown> = {}) {
  currencyState = {
    currency: "IDR",
    currentConfig: { code: "IDR", symbol: "Rp", decimals: 0, rate: 17838 },
    rates: { USD: 1, IDR: 17838, JPY: 155, EUR: 0.92, SGD: 1.34, CNY: 7.23 },
    ratesSource: "open-er-api",
    ratesSourceLabel: "Open Exchange Rates",
    ratesUpdatedAt: null,
    ratesStale: false,
    refreshRates,
    ...overrides,
  };
}

describe("LiveFxBadge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setCurrency();
  });

  it("states the pair and the provider when the quote is live", () => {
    render(<LiveFxBadge />);
    const badge = screen.getByTestId("live-fx-badge");
    expect(badge).toHaveAttribute("data-rate-source", "open-er-api");
    expect(badge).toHaveAttribute("data-rate-stale", "false");
    expect(screen.getByText("1 USD = Rp17,838")).toBeInTheDocument();
    expect(screen.getByText(/Open Exchange Rates/)).toBeInTheDocument();
  });

  it("falls back to the reference table without pretending it is live", () => {
    setCurrency({ ratesStale: true, ratesSource: "builtin", ratesSourceLabel: "" });
    render(<LiveFxBadge />);
    const badge = screen.getByTestId("live-fx-badge");
    expect(badge).toHaveAttribute("data-rate-stale", "true");
    expect(screen.getByText("Reference rates")).toBeInTheDocument();
    expect(screen.queryByText(/^Live/)).not.toBeInTheDocument();
  });

  it("labels the base-currency view instead of quoting 1 USD = $1.00", () => {
    setCurrency({
      currency: "USD",
      currentConfig: { code: "USD", symbol: "$", decimals: 2, rate: 1 },
    });
    render(<LiveFxBadge />);
    expect(screen.getByText("Base USD ($)")).toBeInTheDocument();
    expect(screen.queryByText(/1 USD = \$1\.00/)).not.toBeInTheDocument();
  });

  it("re-quotes on demand", async () => {
    render(<LiveFxBadge />);
    screen.getByRole("button", { name: "Refresh rates" }).click();
    expect(refreshRates).toHaveBeenCalledTimes(1);
  });
});
