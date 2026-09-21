import { test, expect } from "@playwright/test";
import {
  loginAs,
  logoutViaHeader,
  SEED_ADMIN_EMAIL,
  SEED_ADMIN_PASSWORD,
  FETCH_GATED,
} from "./helpers";

/** Seed non-admin (Mike Wilson, STAFF) — password is the seed staff password. */
const SEED_STAFF_EMAIL = "mike@dashboard.com";
const SEED_STAFF_PASSWORD = "staff123";

/**
 * Settings → Scheduler health card.
 *
 * The card is admin-only (GET /api/scheduler/status 403s for everyone else
 * and the component renders null):
 *   1. Admin sees the card with an Enabled/Disabled state badge and exactly
 *      the registered jobs — "Never ran" is a valid state for a cold instance.
 *   2. A non-admin (STAFF seed account) gets no card at all, and the API
 *      answers 403 directly.
 */

/**
 * The scheduler's job registry (src/lib/scheduler.ts). Pinned in full: the card
 * renders one row per registered job, so growing the registry without updating
 * this list should fail here rather than silently render an extra row.
 */
const JOB_ROWS = [
  "usage-digest",
  "auto-payout",
  "webhook-retry",
  "auto-reorder",
  "supabase-sync",
  "supabase-leaf-sync",
  "trial-sweep",
  "scheduled-reports",
  "backup-verify",
  "recovery-drift",
];

test.describe("Scheduler status card", () => {
  test("admin sees the card with every registered job row and a state badge", async ({ page }) => {
    await loginAs(page, SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD);
    await page.goto("/en/settings", FETCH_GATED);

    const card = page.getByTestId("scheduler-status");
    await expect(card).toBeVisible();

    // State badge: either enabled or disabled is valid, but it must be one of
    // them (data-scheduler-enabled drives the badge variant).
    const badge = card.locator("[data-scheduler-enabled]");
    await expect(badge).toHaveCount(1);
    const state = await badge.getAttribute("data-scheduler-enabled");
    expect(["true", "false"]).toContain(state ?? "");

    // Exactly the registered jobs, each with a last-run cell.
    for (const job of JOB_ROWS) {
      await expect(card.locator(`[data-scheduler-job="${job}"]`), `job row ${job}`).toBeVisible();
    }
    const rows = card.locator("[data-scheduler-job]");
    await expect(rows).toHaveCount(JOB_ROWS.length);
  });

  test("non-admin gets no card and the status API answers 403", async ({ page }) => {
    // Mike Wilson is the STAFF seed account.
    await loginAs(page, SEED_STAFF_EMAIL, SEED_STAFF_PASSWORD);
    await page.goto("/en/settings", FETCH_GATED);

    await expect(page.getByTestId("scheduler-status")).toHaveCount(0);

    const res = await page.request.get("/api/scheduler/status");
    expect(res.status()).toBe(403);

    await logoutViaHeader(page);
  });
});
