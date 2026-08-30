import { test, expect, type Page } from "@playwright/test";
import {
  loginAs,
  expectHiddenScrollbar,
  assertProgrammaticScrollWorks,
  expectThinScrollbarStyles,
  assertThumbRecolorsInDarkMode,
} from "./helpers";

/**
 * Activity-feed filter pills at a 375px (phone) viewport.
 *
 * The filter-pill strip (All / Orders / Customers / Inventory / Campaigns /
 * Discounts / Alerts / Milestones / Revenue / Products) is wider than the
 * dashboard column, so it scrolls internally via overflow-x-auto. This spec
 * pins the focus contract: keyboard (Tab) focus reaching the last pill scrolls
 * it into view (useScrollFocusedIntoView on the pill row). The pills are plain
 * buttons, so Tab — not arrows — moves focus between them.
 *
 * The pill row also hides its scrollbar via the real `.scrollbar-none`
 * utility (globals.css: `scrollbar-width: none` + a WebKit pseudo
 * `display: none` — the same treatment as the tabs bar and notification
 * panel), so the last two tests pin that the bar is genuinely hidden — under
 * the light AND dark themes — while programmatic scrolling still works
 * (hiding a scrollbar never disables scrolling). The dark test additionally
 * proves the feed list (the card's visible thin scrollbar) re-colors its
 * thumb under the dark theme — the pill row's own thumb is display:none, so
 * there is nothing to recolor there.
 */
test.describe("Activity feed filter pills on mobile", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test.beforeEach(async ({ page }) => {
    await loginAs(page);
    await page.goto("/en/dashboard");
  });

  test("tab focus scrolls the last filter pill into view", async ({ page }) => {
    const activityCard = page
      .getByText("Activity Feed", { exact: true })
      .locator("xpath=ancestor::div[contains(@class,'flex flex-col overflow-hidden')]")
      .first();
    const pillRow = activityCard.locator("div.overflow-x-auto").first();
    const firstPill = pillRow.getByRole("button").first();
    const lastPill = pillRow.getByRole("button").last();

    // The feed fetches on mount; wait for the loading state to clear so the
    // row is fully hydrated (focus before that is dropped) and the pills have
    // their final counts. The loading text is also SSR'd, so this doubles as
    // the hydration gate.
    await expect(pillRow).toBeVisible();
    await expect
      .poll(async () => (await page.getByText("Loading activity...").count()) === 0, {
        timeout: 15_000,
      })
      .toBe(true);

    // The strip must actually overflow at this viewport, starting unscrolled.
    const { scrollable, scrollLeft: initialScroll } = await pillRow.evaluate((el) => ({
      scrollable: el.scrollWidth > el.clientWidth + 1,
      scrollLeft: el.scrollLeft,
    }));
    expect(scrollable).toBe(true);
    expect(initialScroll).toBe(0);

    // Keyboard path: focus the first pill, then Tab to the last (Products).
    await firstPill.focus();
    for (let i = 0; i < 15; i++) {
      await page.keyboard.press("Tab");
      if (await lastPill.evaluate((el) => document.activeElement === el)) break;
    }
    await expect(lastPill).toBeFocused();

    // The row scrolled so the focused pill sits inside its client area
    // (poll because scrollIntoView uses smooth behavior).
    await expect
      .poll(async () => pillRow.evaluate((el) => el.scrollLeft), { timeout: 10_000 })
      .toBeGreaterThan(initialScroll);
    const lastPillInside = await pillRow.evaluate((el) => {
      const last = el.querySelectorAll("button")[el.querySelectorAll("button").length - 1];
      const rect = last.getBoundingClientRect();
      const left = el.getBoundingClientRect().left;
      return rect.right <= left + el.clientWidth + 1;
    });
    expect(lastPillInside).toBe(true);
  });

  /** The activity feed's filter pill row, once the feed has hydrated. */
  const feedPillRow = async (page: Page) => {
    const activityCard = page
      .getByText("Activity Feed", { exact: true })
      .locator("xpath=ancestor::div[contains(@class,'flex flex-col overflow-hidden')]")
      .first();
    const pillRow = activityCard.locator("div.overflow-x-auto").first();

    // Same hydration gate as the focus test — the row must be fully hydrated
    // (the loading text is SSR'd, so this doubles as the hydration wait).
    await expect(pillRow).toBeVisible();
    await expect
      .poll(async () => (await page.getByText("Loading activity...").count()) === 0, {
        timeout: 15_000,
      })
      .toBe(true);
    return pillRow;
  };

  test("pill row hides its scrollbar via the real scrollbar-none utility and still scrolls", async ({
    page,
  }) => {
    const pillRow = await feedPillRow(page);
    await expectHiddenScrollbar(page, pillRow, "activity-feed pill row", "x");
    await assertProgrammaticScrollWorks(page, pillRow, "activity-feed pill row");
  });

  test("pill row keeps its scrollbar hidden under the dark theme", async ({ page }) => {
    // beforeEach already logged in (this page is authenticated — calling
    // loginAs again would loop forever: /en/login redirects the logged-in
    // session back to /en/dashboard). Instead, apply the dark theme to the
    // next navigation: the theme-init script (layout.tsx) reads
    // localStorage.theme before paint, so the whole session is dark.
    await page.addInitScript(() => localStorage.setItem("theme", "dark"));
    await page.goto("/en/dashboard");

    // Gate: the dark theme actually applied (prevents a silently-light run).
    await expect(page.locator("html")).toHaveClass(/dark/);

    const pillRow = await feedPillRow(page);
    // Hiding is theme-independent — the same real-utility proofs hold.
    await expectHiddenScrollbar(page, pillRow, "activity-feed pill row (dark)", "x");
    await assertProgrammaticScrollWorks(page, pillRow, "activity-feed pill row (dark)");

    // The feed list is the card's visible thin scrollbar — assert the dark
    // theme re-colors ITS thumb (the pill row's own thumb is display:none,
    // so there is nothing to recolor there).
    const feed = page.getByRole("log", { name: "Live activity feed" });
    await expect(feed).toBeVisible();
    await expectThinScrollbarStyles(page, feed, "activity feed list (dark)");
    await assertThumbRecolorsInDarkMode(page, feed, "activity feed list");
  });
});
