import { test, expect } from "@playwright/test";

/**
 * Live-rate pricing (E2E).
 *
 * The pricing page used to convert with a hardcoded rate. It now quotes a live
 * mid-market rate, says where that number came from, and prices the rupiah
 * settlement rails against it. This spec proves the whole chain in a browser:
 * the currency switcher, the converted list price, the provenance stamp, the
 * rail table and the "cheapest" recommendation.
 *
 * The rate feed is genuinely external here, so the spec accepts EITHER outcome —
 * a live quote or a flagged reference rate — and asserts the honesty contract in
 * both cases: whatever number is shown, its provenance is stated, and the
 * recommendation is never the mid-market yardstick.
 */
test.describe("Pricing in local currency", () => {
  test("quotes a live rate, converts the list price, and recommends a real rail", async ({
    page,
  }) => {
    await page.goto("/en/pricing");

    // ── 1. Switching currency converts every plan's list price. ──
    const idr = page.getByTestId("fx-currency-IDR");
    await expect(idr).toBeVisible();
    await idr.click();
    await expect(idr).toHaveAttribute("aria-pressed", "true");

    for (const plan of ["starter", "professional", "enterprise"]) {
      const converted = page.getByTestId(`fx-price-${plan}`);
      await expect(converted).toBeVisible();
      await expect(converted).toHaveAttribute("data-currency", "IDR");
      // A rupiah figure, not the dollar price echoed back.
      expect((await converted.textContent()) ?? "").toMatch(/Rp/);
    }

    // ── 2. The settlement panel states the rate AND its source. ──
    const panel = page.getByTestId("fx-settlement-panel");
    await expect(panel).toBeVisible();

    const source = await panel.getAttribute("data-rate-source");
    const stale = await panel.getAttribute("data-rate-stale");
    const mid = page.getByTestId("fx-mid-rate");
    await expect(mid).toContainText("1 USD = Rp");
    // Rate and label agree: a live badge means a provider, not the built-in table.
    if (stale === "false") {
      expect(["open-er-api", "currency-api", "frankfurter"]).toContain(source);
      await expect(page.getByTestId("fx-rate-badge")).toHaveText("Live rate");
    } else {
      expect(source).toBe("builtin");
      await expect(page.getByTestId("fx-rate-badge")).toHaveText("Reference rate");
    }
    // Either way the provenance is on screen, never implied.
    await expect(page.getByTestId("fx-rate-source")).not.toBeEmpty();

    // ── 3. Rails are priced, and the winner is a real one. ──
    const rows = panel.locator("tr[data-rail]");
    await expect(rows).toHaveCount(5);
    const cheapest = panel.locator('tr[data-cheapest="true"]');
    await expect(cheapest).toHaveCount(1);
    expect(await cheapest.getAttribute("data-rail")).not.toBe("midMarket");

    // The mid-market reference is present as the yardstick, and it is the
    // cheapest number on screen — which is precisely why it must not be the
    // recommendation.
    await expect(panel).toContainText("Mid-market (reference)");
    await expect(page.getByTestId("fx-best")).toBeVisible();
    await expect(panel.locator("[data-bank]")).toHaveCount(4);

    // ── 4. Back to dollars: the conversion and the panel both go away. ──
    await page.getByTestId("fx-currency-USD").click();
    await expect(page.getByTestId("fx-price-professional")).toHaveCount(0);
    await expect(panel).toHaveCount(0);
  });

  test("the rate endpoint answers publicly and quotes every supported currency", async ({
    request,
  }) => {
    // The pricing page is a marketing surface — no session involved.
    const res = await request.get("/api/billing/fx-rates");
    expect(res.status()).toBe(200);

    const body = await res.json();
    for (const code of ["IDR", "JPY", "EUR", "SGD", "CNY"]) {
      expect(typeof body.rates[code], code).toBe("number");
      expect(body.rates[code], code).toBeGreaterThan(0);
    }
    expect(["open-er-api", "currency-api", "frankfurter", "builtin"]).toContain(body.source);
    if (body.source === "builtin") expect(body.stale).toBe(true);

    // With an amount, the same endpoint returns the priced comparison.
    const withAmount = await request.get("/api/billing/fx-rates?amount=79");
    const priced = await withAmount.json();
    expect(priced.currency).toBe("IDR");
    expect(priced.rails).toHaveLength(5);
    expect(priced.bankCounters).toHaveLength(4);
    expect(priced.rails.filter((r: { cheapest: boolean }) => r.cheapest)).toHaveLength(1);
    expect(priced.spreadsAsOf).toMatch(/^\d{4}-\d{2}$/);
  });
});
