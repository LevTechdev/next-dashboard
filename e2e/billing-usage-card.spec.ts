import { test, expect } from "@playwright/test";
import { loginAs, FETCH_GATED } from "./helpers";

/**
 * Billing usage card — quota bars, saturation styling, upgrade CTA, deep link.
 *
 * The seed admin sits on the Starter (REGULAR) plan, so every quota in
 * GET /api/usage is capped (orders 100, seats 3, API keys 2) and the usage
 * card renders with an upgrade CTA. Quota saturation is simulated with a
 * route intercept answering a saturated payload (92% / 100% / 50%) so the
 * amber/destructive bar states and the upgrade block are deterministic —
 * the same payload shape the real API emits, extended with the history array
 * the trend chart consumes.
 *
 * Covered:
 *  1. Overview tab renders the usage card with quota rows + progressbars.
 *  2. Saturated bars (≥80%) get amber warning state and a bordered card.
 *  3. The upgrade CTA deep-links into the Plans tab (?tab=plans).
 *  4. Navigating straight to /en/billing?tab=plans lands on Plans directly.
 */

const SATURATED_USAGE_BODY = JSON.stringify({
  period: {
    start: new Date(new Date().setDate(1)).toISOString(),
    end: new Date(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1)).toISOString(),
  },
  plan: { name: "Starter", tier: "REGULAR" },
  orders: { used: 92, limit: 100 },
  teamMembers: { used: 3, limit: 3 },
  apiKeys: { used: 1, limit: 2 },
  history: [
    {
      cycle: "2026-07",
      periodStart: "2026-07-01T00:00:00.000Z",
      orders: 61,
      teamMembers: 2,
      apiKeys: 1,
    },
    {
      cycle: "2026-08",
      periodStart: "2026-08-01T00:00:00.000Z",
      orders: 74,
      teamMembers: 3,
      apiKeys: 1,
    },
  ],
});

async function interceptUsage(page: import("@playwright/test").Page) {
  await page.route("**/api/usage", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: SATURATED_USAGE_BODY }),
  );
}

test.describe("Billing usage quota card", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page);
  });

  test("renders quota rows and saturated bars with the upgrade CTA", async ({ page }) => {
    await interceptUsage(page);
    await page.goto("/en/billing");

    const card = page.getByTestId("usage-quota-card");
    await expect(card).toBeVisible(FETCH_GATED);

    // All three capped quota rows render with numeric used/limit values.
    await expect(card.getByTestId("usage-orders")).toContainText("92 / 100");
    await expect(card.getByTestId("usage-teamMembers")).toContainText("3 / 3");
    await expect(card.getByTestId("usage-apiKeys")).toContainText("1 / 2");

    // Saturated rows carry progressbars in warning state (≥80% → amber).
    const bars = card.getByRole("progressbar");
    await expect(bars).toHaveCount(3);
    const orderBar = card.getByTestId("usage-orders").getByRole("progressbar");
    await expect(orderBar).toHaveAttribute("aria-valuenow", "92");
    const seatBar = card.getByTestId("usage-teamMembers").getByRole("progressbar");
    await expect(seatBar).toHaveAttribute("aria-valuenow", "100");

    // 100%-saturated bar is destructive red; ≥80% amber warnings show.
    await expect(seatBar.locator("div").first()).toHaveClass(/bg-destructive/);
    await expect(orderBar.locator("div").first()).toHaveClass(/bg-amber-500/);
    await expect(card.getByTestId("usage-orders").locator(".text-amber-500")).toBeVisible();

    // The trend chart mounts from the history array.
    await expect(card.getByTestId("usage-trend")).toBeVisible();

    // Starter + capped → upgrade block with CTA.
    const cta = card.getByTestId("usage-upgrade-cta");
    await expect(cta).toBeVisible();
    await expect(cta).toHaveAttribute("href", /\/billing\?tab=plans$/);
  });

  test("upgrade CTA deep-links into the Plans tab", async ({ page }) => {
    await interceptUsage(page);
    await page.goto("/en/billing");

    const cta = page.getByTestId("usage-upgrade-cta");
    await expect(cta).toBeVisible(FETCH_GATED);
    await cta.click();

    // Plans tab becomes the active panel (plan cards + billing period toggle).
    await expect(page.getByRole("tab", { name: "Plans" })).toHaveAttribute("data-state", "active");
    await expect(page.getByRole("tab", { name: "Overview" })).toHaveAttribute(
      "data-state",
      "inactive",
    );
  });

  test("?tab=plans deep link opens Plans directly", async ({ page }) => {
    // No usage intercept needed — the Plans tab is what's under test here.
    await page.goto("/en/billing?tab=plans");

    await expect(page).toHaveURL(/\/en\/billing\?tab=plans/);
    await expect(page.getByRole("tab", { name: "Plans" })).toHaveAttribute(
      "data-state",
      "active",
      FETCH_GATED,
    );
    await expect(page.getByRole("tab", { name: "Overview" })).toHaveAttribute(
      "data-state",
      "inactive",
    );
  });
});
