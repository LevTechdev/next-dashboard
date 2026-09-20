import { test, expect } from "@playwright/test";
import { loginAs, FETCH_GATED } from "./helpers";

/**
 * CLIENT-tier read-only usage card.
 *
 * The seeded CLIENT member (client@dashboard.com) inherits the workspace
 * owner's plan, so /en/billing renders the usage metering card in read-only
 * mode: `data-usage-view="client-read-only"`, no owner-facing upgrade CTA,
 * and the handoff note pointing billing questions at the workspace owner.
 *
 * The real seeded API payload is used (no route mocks) — the assertions are
 * structural (roles/CTA/note), not value-based, so quota drift in seeds
 * cannot flake the spec.
 */

const CLIENT_EMAIL = "client@dashboard.com";
const CLIENT_PASSWORD = "staff123";

test.describe("CLIENT-tier read-only usage card", () => {
  test("renders the read-only view without an upgrade CTA", async ({ page }) => {
    await loginAs(page, CLIENT_EMAIL, CLIENT_PASSWORD);

    await page.goto("/en/billing");
    await expect(page).toHaveURL(/\/en\/billing/, FETCH_GATED);

    const card = page.locator('[data-usage-view="client-read-only"]');
    await expect(card).toBeVisible(FETCH_GATED);

    // The owner-facing upgrade CTA must not exist anywhere inside the card.
    await expect(card.getByRole("link", { name: /upgrade/i })).toHaveCount(0);
    await expect(card.getByRole("button", { name: /upgrade/i })).toHaveCount(0);
  });

  test("shows quota metrics and the monthly trend section", async ({ page }) => {
    await loginAs(page, CLIENT_EMAIL, CLIENT_PASSWORD);

    await page.goto("/en/billing");
    const card = page.locator('[data-usage-view="client-read-only"]');
    await expect(card).toBeVisible(FETCH_GATED);

    // Quota rows: Orders / Team members / API keys (localized labels may
    // differ; the metric ratio "N / M" pattern is locale-stable).
    await expect(card.getByText(/^\d+\s*\/\s*\d+$/).first()).toBeVisible(FETCH_GATED);

    // Trend chart heading (the per-cycle UsageRecord chart).
    await expect(card.getByText(/trend|tren|トレンド|趋势/i).first()).toBeVisible(FETCH_GATED);
  });

  test("displays the workspace-owner handoff note instead of billing controls", async ({
    page,
  }) => {
    await loginAs(page, CLIENT_EMAIL, CLIENT_PASSWORD);

    await page.goto("/en/billing");
    const card = page.locator('[data-usage-view="client-read-only"]');
    await expect(card).toBeVisible(FETCH_GATED);

    // The handoff note is registered in all 4 locales; assert on the English
    // copy (spec runs under /en).
    await expect(card.getByText(/managed by the workspace owner/i)).toBeVisible(FETCH_GATED);

    // Owner-only billing mutations are absent for CLIENT viewers.
    await expect(page.getByRole("button", { name: /cancel plan/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /choose|reactivate|switch plan/i })).toHaveCount(
      0,
    );
  });

  test("owner session still gets the editable view with an upgrade CTA", async ({ page }) => {
    // Control case: the seed admin (plan owner) sees the owner card —
    // guarding against the read-only branch accidentally matching everyone.
    await loginAs(page);

    await page.goto("/en/billing");
    const ownerCard = page.locator('[data-usage-view="owner"]');
    await expect(ownerCard).toBeVisible(FETCH_GATED);
    await expect(page.locator('[data-usage-view="client-read-only"]')).toHaveCount(0);
  });
});
