import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

/**
 * Guided onboarding tour contract (src/components/ui/onboarding-tour.tsx).
 *
 * The tour auto-starts ~1.5s after hydration on the dashboard home for a
 * user who has never seen it — and it must stay hidden under automation:
 * Playwright contexts expose navigator.webdriver=true and the joyride
 * spotlight overlay would hijack every pointer/focus interaction on the
 * dashboard (regression: exactly that broke the notification spec until the
 * webdriver guard landed).
 *
 * Completion lives under the PER-USER key `onboarding-tour-done:<userId>`
 * (same keyspace as the onboarding checklist), so these legs assert that
 * keyspace rather than the legacy global `tour_completed` flag the old
 * implementation wrote and nothing has written since.
 *
 * Selectors: Joyride mounts an ALWAYS-PRESENT (empty when idle) portal
 * `#react-joyride-portal` whose children are fixed-position, so visibility is
 * asserted on the overlay svg path and the tooltip text INSIDE the portal —
 * never on the portal div itself.
 *
 * The "real user" legs neutralize the webdriver guard the honest way — the
 * browser conceals webdriver BEFORE any app script runs (what a human's
 * Chrome reports) — so the tour's own decision path is exercised end-to-end:
 * start → 4 steps → Finish/Skip → persisted flag → never re-offered.
 */

/** The tour's spotlight overlay — present only while the tour is running. */
const overlay = (page: import("@playwright/test").Page) =>
  page.locator('#react-joyride-portal path[fill-rule="evenodd"]');

/** Is the tour latched as seen for the signed-in user? */
const tourSeen = (page: import("@playwright/test").Page) =>
  page.evaluate(() =>
    Object.keys(localStorage)
      .filter((k) => k.startsWith("onboarding-tour-done:"))
      .some((k) => localStorage.getItem(k) === "true"),
  );

/** Back to the first-time state for the signed-in user. */
const clearTourFlag = (page: import("@playwright/test").Page) =>
  page.evaluate(() => {
    Object.keys(localStorage)
      .filter((k) => k.startsWith("onboarding-tour-done:"))
      .forEach((k) => localStorage.removeItem(k));
  });

test.describe("Guided onboarding tour", () => {
  test("stays hidden under automation (navigator.webdriver is honored)", async ({ page }) => {
    await loginAs(page);
    await page.goto("/en/dashboard");

    // The guard fires 1.5s after hydration — give it ample time, then assert
    // the portal stays EMPTY (no overlay, no tooltip) and the dashboard is
    // interactively clean.
    await page.waitForTimeout(3500);
    await expect(overlay(page)).toHaveCount(0);
    await expect(page.locator("#react-joyride-portal")).toHaveText("");
  });

  test("auto-starts for a real first-time user and completes via Finish", async ({ browser }) => {
    const context = await browser.newContext();
    // Conceal webdriver before any page script runs — this is what a real
    // user's browser reports, so the tour's guard lets it through.
    await context.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => false });
    });
    const page = await context.newPage();

    await loginAs(page);
    // Fresh visit: guarantee the first-time state BEFORE the app reads it.
    await page.goto("/en/dashboard");
    await clearTourFlag(page);
    await page.reload();

    // Auto-start: the spotlight overlay appears without any user action,
    // with the first step's counter in the tooltip.
    await expect(overlay(page)).toBeVisible({ timeout: 15_000 });
    const tooltipText = page.locator("#react-joyride-portal").getByText("of 4");
    await expect(tooltipText).toHaveText("1 of 4");

    // Step through the full tour. Joyride's own props override the buttons'
    // accessible names (its locale says Next/Last, not ours), so target the
    // stable data-action hooks inside the portal (also dodges Next.js
    // dev-tools' own "Next" button).
    const tour = page.locator("#react-joyride-portal");
    const primary = tour.locator('[data-action="primary"]');
    for (let i = 2; i <= 4; i++) {
      await primary.click();
      await expect(tooltipText).toHaveText(`${i} of 4`);
    }
    await primary.click();

    // The tour unmounts and completion is persisted for next time.
    await expect(overlay(page)).toHaveCount(0);
    expect(await tourSeen(page)).toBe(true);

    // A subsequent visit must NOT re-offer the tour.
    await page.reload();
    await page.waitForTimeout(3500);
    await expect(overlay(page)).toHaveCount(0);

    await context.close();
  });

  test("Skip tour ends it immediately and persists completion", async ({ browser }) => {
    const context = await browser.newContext();
    await context.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => false });
    });
    const page = await context.newPage();

    await loginAs(page);
    await page.goto("/en/dashboard");
    await clearTourFlag(page);
    await page.reload();

    await expect(overlay(page)).toBeVisible({ timeout: 15_000 });
    await page.locator("#react-joyride-portal").locator('[data-action="skip"]').click();
    await expect(overlay(page)).toHaveCount(0);
    expect(await tourSeen(page)).toBe(true);

    await context.close();
  });

  test("an abandoned tour still counts as seen — it does not replay on the next login", async ({
    browser,
  }) => {
    // Regression: completion used to be written ONLY on Finish/Skip, so a
    // tour the visitor walked away from left no trace and was re-offered on
    // every subsequent login.
    const context = await browser.newContext();
    await context.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => false });
    });
    const page = await context.newPage();

    await loginAs(page);
    await page.goto("/en/dashboard");
    await clearTourFlag(page);
    await page.reload();

    await expect(overlay(page)).toBeVisible({ timeout: 15_000 });
    // Advance a single step, then leave the tour hanging — neither Finish nor
    // Skip is ever pressed.
    await page.locator("#react-joyride-portal").locator('[data-action="primary"]').click();
    expect(await tourSeen(page)).toBe(true);

    // Coming back must not re-offer it.
    await page.goto("/en/dashboard");
    await page.reload();
    await page.waitForTimeout(3500);
    await expect(overlay(page)).toHaveCount(0);

    await context.close();
  });
});
