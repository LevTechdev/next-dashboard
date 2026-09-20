import { test, expect } from "@playwright/test";
import { loginAs, FETCH_GATED } from "./helpers";

/**
 * Subscription tier-gate UI (402 → upgrade surface).
 *
 * The seed admin is on the Starter (REGULAR) tier, so the gated analytics
 * read answers 402 from the API — this spec asserts the UI *surfaces* the
 * upgrade path:
 *
 * 1. Analytics → Retention tab: the cohort retention heatmap swaps its data
 *    view for the branded upsell card (title, Retry, "View plans" CTA).
 *    (Radix Tabs unmount inactive content, so the fetch — and the 402 — fire
 *    only when the tab is selected.)
 * 2. Orders → the page's orderLimit gate opens the shared Sora upgrade
 *    dialog and keeps a persistent gradient banner with an Upgrade CTA above
 *    the table. GET /api/orders only 402s once the Starter plan's monthly
 *    order cap is reached, so the 402 condition is simulated with a route
 *    intercept — the dialog/banner contract is what's under test, and the
 *    same payload shape the real API emits (plan_limit_reached, 402) is used.
 */

const ANALYTICS_URL = "/en/analytics";

const PLAN_LIMIT_402_BODY = JSON.stringify({
  error: "plan_limit_reached",
  limit: "orders",
  max: 100,
  requiredTier: "PRO",
});

test.describe("Tier-gate upgrade surfaces", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page);
  });

  test("analytics cohort heatmap shows the PRO upsell card on 402", async ({ page }) => {
    const resp = page.waitForResponse(
      (r) => r.url().includes("/api/analytics/cohorts") && r.status() === 402,
      { timeout: 45_000 },
    );
    await page.goto(ANALYTICS_URL);
    // The heatmap lives in the "Cohort Retention" tab — selecting it mounts
    // the component and fires the gated fetch.
    await page.getByRole("tab", { name: "Cohort Retention" }).click();
    await resp;

    const upsell = page.getByText("Cohort analytics is a Professional feature");
    await expect(upsell).toBeVisible(FETCH_GATED);
    // The upsell card's copy and CTAs render together.
    await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
    await expect(page.getByRole("link", { name: "View plans" })).toBeVisible();
  });

  test("analytics upsell View plans CTA routes to billing", async ({ page }) => {
    await page.goto(ANALYTICS_URL);
    await page.getByRole("tab", { name: "Cohort Retention" }).click();

    const cta = page.getByRole("link", { name: "View plans" });
    await expect(cta).toBeVisible(FETCH_GATED);
    await cta.click();
    await expect(page).toHaveURL(/\/en\/billing/);
  });

  test("orders page opens the upgrade dialog and keeps the limit banner on 402", async ({
    page,
  }) => {
    // Simulate the Starter plan's monthly order cap: the API's real 402
    // (plan_limit_reached) is emitted only past 100 orders/month.
    await page.route("**/api/orders*", (route) =>
      route.fulfill({ status: 402, contentType: "application/json", body: PLAN_LIMIT_402_BODY }),
    );

    await page.goto("/en/orders");

    // Shared upgrade dialog auto-opens once per mount.
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Upgrade to unlock this feature")).toBeVisible(FETCH_GATED);
    // Feature copy for the orderLimit key.
    await expect(dialog.getByText("Higher monthly order volume")).toBeVisible();

    // Close it — the persistent banner remains.
    await dialog.getByRole("button", { name: "Not now" }).click();
    await expect(dialog).toBeHidden();

    const banner = page.getByText("You’ve reached the Starter plan’s monthly order limit");
    await expect(banner).toBeVisible();
    await expect(page.getByRole("button", { name: "Upgrade" })).toBeVisible();
  });

  test("orders limit banner Upgrade CTA re-opens the upgrade dialog", async ({ page }) => {
    await page.route("**/api/orders*", (route) =>
      route.fulfill({ status: 402, contentType: "application/json", body: PLAN_LIMIT_402_BODY }),
    );

    await page.goto("/en/orders");

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Upgrade to unlock this feature")).toBeVisible(FETCH_GATED);
    await dialog.getByRole("button", { name: "Not now" }).click();
    await expect(dialog).toBeHidden();

    // The banner CTA re-opens the shared dialog on demand.
    await page.getByRole("button", { name: "Upgrade" }).click();
    await expect(dialog.getByText("Upgrade to unlock this feature")).toBeVisible();
  });
});
