import { test, expect } from "@playwright/test";
import { loginAs, FETCH_GATED } from "./helpers";

/**
 * Affiliate lifecycle — the seeded end-to-end journey.
 *
 * prisma/seed.ts plants a SEED-LIFECYCLE affiliate link with:
 *  - one PENDING conversion ($540 commission) — awaiting approval
 *  - one APPROVED conversion ($780 commission) — approved, unpaid
 * and a SCHEDULED payout (PAY-SEED-SCHEDULED, $780) in the JSON store the
 * payouts API merges into GET responses — the same store the monthly
 * auto-payout scheduler writes, so the payouts table demonstrates the
 * full journey: pending → approved → scheduled.
 *
 * Assertions are structural (statuses present, payout row exists) rather
 * than value-based so unrelated seed drift cannot flake the spec.
 */

test.describe("affiliate lifecycle", () => {
  test("conversions tab shows Pending and Approved states", async ({ page }) => {
    await loginAs(page);

    await page.goto("/en/affiliates");
    const conversionsTab = page.getByRole("tab", { name: /conversions/i });
    await conversionsTab.click();

    const panel = page
      .locator('[role="tabpanel"][data-state="active"], [role="tabpanel"]:visible')
      .first();
    await expect(panel).toBeVisible(FETCH_GATED);

    // Both lifecycle states from the seed must be represented.
    await expect(panel.getByText(/pending/i).first()).toBeVisible(FETCH_GATED);
    await expect(panel.getByText(/approved/i).first()).toBeVisible(FETCH_GATED);
  });

  test("payouts table contains the SCHEDULED seed payout", async ({ page }) => {
    await loginAs(page);

    await page.goto("/en/affiliates");
    await page.getByRole("tab", { name: /payouts/i }).click();

    const panel = page
      .locator('[role="tabpanel"][data-state="active"], [role="tabpanel"]:visible')
      .first();
    await expect(panel).toBeVisible(FETCH_GATED);

    // The persisted seed payout (auto-payout store) appears in the table
    // with a Scheduled status badge.
    const scheduledRow = panel.locator("tr", { hasText: "PAY-SEED-SCHEDULED" });
    await expect(scheduledRow).toBeVisible(FETCH_GATED);
    await expect(scheduledRow.locator("text=/^scheduled$/i")).toBeVisible();

    // And the summary cards expose the commission pipeline.
    await expect(panel.getByText(/available commission/i).first()).toBeVisible(FETCH_GATED);
  });

  test("payout summary shows a consistent available balance", async ({ page }) => {
    await loginAs(page);

    await page.goto("/en/affiliates");
    await page.getByRole("tab", { name: /payouts/i }).click();

    const panel = page
      .locator('[role="tabpanel"][data-state="active"], [role="tabpanel"]:visible')
      .first();
    const available = panel.getByText(/available commission/i).first();
    await expect(available).toBeVisible(FETCH_GATED);

    // Balance renders as currency (never a bare number / raw NaN).
    const value = panel.locator("text=/\\$[\\d,]+(\\.\\d{2})?/").first();
    await expect(value).toBeVisible();
    await expect(panel.getByText(/NaN/i)).toHaveCount(0);
  });
});
