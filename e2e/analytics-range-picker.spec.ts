import { test, expect } from "@playwright/test";
import { loginAs, SEED_ADMIN_EMAIL } from "./helpers";

/**
 * Analytics date-range picker.
 *
 * The range lives in the URL (?from=&to=) so it is shareable and survives
 * navigation — the spec pins:
 *   1. choosing a preset scopes the funnel widget (visitor counts change);
 *   2. the active range is reflected in the URL and the comparison bar with
 *      per-metric deltas appears;
 *   3. the range composes with the ?month= deep-link chip (both filters apply);
 *   4. a ?from=&to= deep link restores the picker state after reload.
 */

test.describe("Analytics date-range picker", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, SEED_ADMIN_EMAIL, "admin123");
    await page.goto("/en/analytics");
    await expect(page.getByTestId("analytics-funnel")).toBeVisible({ timeout: 30_000 });
  });

  test("preset scopes the funnel, writes ?from=&to=, and shows the comparison bar", async ({
    page,
  }) => {
    const funnel = page.getByTestId("analytics-funnel");
    const before = await funnel.textContent();

    // Open the picker and pick "Last 7 days". With an active range the
    // trigger button shows "Sep 12 – Sep 18" instead of "Date Range".
    await page.getByRole("button", { name: /date range|\w{3} \d+ – \w{3} \d+/i }).click();
    await page.getByRole("button", { name: /last 7 days/i }).click();

    // URL now carries the range.
    await expect.poll(() => page.url(), { timeout: 10_000 }).toMatch(/[?&]from=\d{4}-\d{2}-\d{2}/);
    expect(page.url()).toMatch(/[?&]to=\d{4}-\d{2}-\d{2}/);

    // Funnel re-scoped to the narrower window (fewer or equal visitors).
    await expect
      .poll(async () => (await funnel.textContent()) ?? "", { timeout: 10_000 })
      .not.toBe(before);

    // The comparison bar renders with three per-metric deltas.
    await expect(page.getByTestId("analytics-comparison-bar")).toBeVisible();
    await expect(page.getByTestId("analytics-delta-revenue")).toBeVisible();
    await expect(page.getByTestId("analytics-delta-orders")).toBeVisible();
    await expect(page.getByTestId("analytics-delta-customers")).toBeVisible();
  });

  test("range composes with the month deep-link chip", async ({ page }) => {
    const month = new Date().toISOString().slice(0, 7);
    await page.goto(`/en/analytics?month=${month}`);
    await expect(page.getByTestId("analytics-month-chip")).toBeVisible({ timeout: 15_000 });

    // Applying a range must NOT clear the month chip — both filters compose.
    await page.getByRole("button", { name: /date range|\w{3} \d+ – \w{3} \d+/i }).click();
    await page.getByRole("button", { name: /last 30 days/i }).click();
    await expect(page.getByTestId("analytics-month-chip")).toBeVisible();
    await expect(page.getByTestId("analytics-comparison-bar")).toBeVisible();
  });

  test("a ?from=&to= deep link restores the range after reload", async ({ page }) => {
    await page.goto("/en/analytics?from=2026-09-01&to=2026-09-14");
    await expect(page.getByTestId("analytics-comparison-bar")).toBeVisible({ timeout: 15_000 });

    // Reload: the range survives because it lives in the URL.
    await page.reload();
    await expect(page.getByTestId("analytics-comparison-bar")).toBeVisible({ timeout: 15_000 });
    expect(page.url()).toMatch(/from=2026-09-01/);
    expect(page.url()).toMatch(/to=2026-09-14/);
  });
});
