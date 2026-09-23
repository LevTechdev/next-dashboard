import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { CurrencyProvider, useCurrency } from "@/components/currency-provider";
import { CurrencySwitcher } from "@/components/layout/currency-switcher";
import { PremiumStatCard } from "@/components/ui/premium-stat-card";
import { setLiveRates, getLiveRates } from "@/lib/currency";
import { formatCurrency } from "@/lib/utils";

/**
 * Live market rates must reach every money surface, not just the pricing page.
 *
 * The dashboard renders money through three independent paths, and each can go
 * stale on its own — so each gets its own pinner:
 *
 * 1. provider-backed cards (PremiumStatCard → useCurrency().formatMoney),
 * 2. the provider-less helper utils.formatCurrency used by ~38 dashboard call
 *    sites (orders, customers, reports, sales, affiliates…), which converts
 *    through the module-level live-rate store the provider publishes to,
 * 3. the currency switcher dropdown, which displays each rate's provenance
 *    (live vs reference) so a stale table can't masquerade as a market quote.
 *
 * Every test pins the move off the bundled table (15,850) to a live quote
 * (17,790 — what the market feed actually returned while verifying), so a
 * regression to hardcoded rates cannot ship silently.
 */

const LIVE_RATES = { USD: 1, IDR: 17_790, JPY: 148.2, EUR: 0.91, SGD: 1.33, CNY: 7.11 };

/** The switcher's trigger; opening it is enough to assert the rate rows. */
function SwitcherProbe() {
  const { ratesStale } = useCurrency();
  return (
    <>
      <span data-testid="probe-stale">{String(ratesStale)}</span>
      <CurrencySwitcher />
    </>
  );
}

function stubRates(overrides: Record<string, unknown> = {}) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => ({
        base: "USD",
        rates: LIVE_RATES,
        source: "open-er-api",
        sourceLabel: "ExchangeRate-API",
        fetchedAt: new Date().toISOString(),
        stale: false,
        ...overrides,
      }),
    })),
  );
}

/** The card is the only money text on screen; the counter renders synchronously. */
function statValue() {
  return screen.getByText(/^Rp /).textContent ?? "";
}

const WalletIcon = ({ size = 20 }: { size?: number }) => (
  <span data-testid="wallet-icon" style={{ width: size, height: size }} />
);

function renderStatCard() {
  return render(
    <CurrencyProvider>
      <PremiumStatCard
        title="Total Revenue"
        endValue={50}
        icon={WalletIcon}
        color="text-emerald-500"
        bg="bg-emerald-50 dark:bg-emerald-900/20"
        isCurrency
      />
    </CurrencyProvider>,
  );
}

describe("live rates reach the dashboard cards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    setLiveRates({});
  });

  afterEach(() => {
    setLiveRates({}); // keep the module store clean for the next test
    vi.unstubAllGlobals();
  });

  it("re-formats the revenue stat card when a live quote lands", async () => {
    stubRates();
    window.localStorage.setItem("app-preferred-currency", "IDR");

    renderStatCard();

    // First paint is bundled (50 × 15,850 = 792,500); AnimatedCounter is
    // mocked to render synchronously, so this never flakes on animation.
    expect(statValue()).toBe("Rp 792,500");

    // Live quote lands: 50 × 17,790 = 889,500 — and the card follows the
    // user's currency preference without a remount.
    await waitFor(() => expect(statValue()).toBe("Rp 889,500"));
  });

  it("stays at the bundled table when the feed is down, and says so in the switcher", async () => {
    // A fully-down feed serves the bundled table flagged stale — never live
    // numbers wearing a reference-rate badge.
    stubRates({
      stale: true,
      source: "builtin",
      sourceLabel: "Built-in reference rates",
      rates: { USD: 1, IDR: 15_850, JPY: 155.2, EUR: 0.92, SGD: 1.34, CNY: 7.23 },
    });
    window.localStorage.setItem("app-preferred-currency", "IDR");

    render(
      <CurrencyProvider>
        <SwitcherProbe />
      </CurrencyProvider>,
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /change display currency/i }));
    const menu = await screen.findByRole("menu");

    // The IDR row shows the reference table and is visibly NOT live.
    const idr = within(menu).getByTestId("currency-rate-IDR");
    expect(idr).toHaveTextContent("~15,850");
    expect(idr.getAttribute("data-stale")).toBe("true");
    expect(screen.getByTestId("probe-stale")).toHaveTextContent("true");
  });

  it("converts at the published store rate even without the provider", () => {
    // The ~38 provider-less call sites (orders, customers, reports…) read the
    // module-level store — no fetch needed, the provider published already.
    setLiveRates({ IDR: 17_790 });
    window.localStorage.setItem("app-preferred-currency", "IDR");
    // 50 USD × 17,790 = 889,500 — not the bundled 792,500.
    expect(formatCurrency(50)).toBe("Rp 889,500");
  });

  it("never divides by undefined: empty store falls back to the bundled table", () => {
    window.localStorage.setItem("app-preferred-currency", "IDR");
    expect(getLiveRates().IDR).toBe(15_850);
    expect(formatCurrency(50)).toBe("Rp 792,500");
  });

  it("ignores junk published to the store instead of poisoning conversions", () => {
    setLiveRates({
      IDR: Number.NaN,
      EUR: -3,
      NOPE: 42,
      JPY: 0,
    } as unknown as Record<string, number>);
    // Every invalid entry keeps its bundled value.
    expect(getLiveRates()).toMatchObject({
      IDR: 15_850,
      EUR: 0.92,
      JPY: 155.2,
    });
    expect((getLiveRates() as Record<string, number>).NOPE).toBeUndefined();
  });
});

describe("currency switcher shows live provenance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    setLiveRates({});
  });

  afterEach(() => {
    setLiveRates({});
    vi.unstubAllGlobals();
  });

  it("displays the live rate and its source once the quote lands", async () => {
    stubRates();
    render(
      <CurrencyProvider>
        <SwitcherProbe />
      </CurrencyProvider>,
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /change display currency/i }));
    const menu = await screen.findByRole("menu");

    const idr = await within(menu)
      .findByTestId("currency-rate-IDR")
      .then((el) =>
        waitFor(() => {
          expect(el).toHaveTextContent("~17,790");
          return el;
        }),
      );
    expect(idr.getAttribute("data-stale")).toBe("false");
    expect(screen.getByTestId("probe-stale")).toHaveTextContent("false");
  });
});
