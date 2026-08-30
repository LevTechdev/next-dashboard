import { test, expect, type Page } from "@playwright/test";
import {
  loginAs,
  expectHiddenScrollbar,
  assertProgrammaticScrollWorks,
  expectThinScrollbarStyles,
  assertThumbRecolorsInDarkMode,
  assertThumbRecolorsBidirectionally,
} from "./helpers";

/**
 * Notification panel filter pills at a 375px (phone) viewport.
 *
 * The filter-pill strip (All / Orders / Customers / Inventory / Campaigns /
 * Discounts / Alerts) is wider than the popover, so it scrolls internally via
 * overflow-x-auto. This spec pins the focus contract: keyboard (Tab) focus
 * reaching the last pill scrolls it into view (useScrollFocusedIntoView on
 * the pill row). The pills are plain buttons, so Tab — not arrows — moves
 * focus between them.
 *
 * The pill row also hides its scrollbar via the real `.scrollbar-none`
 * utility (globals.css: `scrollbar-width: none` + a WebKit pseudo
 * `display: none` — the same treatment as the tabs bar), so the last two
 * tests pin that the bar is genuinely hidden — under the light AND dark
 * themes — while programmatic scrolling still works (hiding a scrollbar
 * never disables scrolling). The dark test additionally proves the panel's
 * notification list (its visible thin scrollbar) re-colors its thumb under
 * the dark theme — the pill row's own thumb is display:none, so there is
 * nothing to recolor there.
 */
test.describe("Notification panel filter pills on mobile", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test.beforeEach(async ({ page }) => {
    await loginAs(page);
    await page.goto("/en/dashboard");
  });

  test("tab focus scrolls the last filter pill into view", async ({ page }) => {
    // exact: the close button is "Close notifications", which would also match
    // a substring query.
    const bell = page.getByRole("button", { name: "Notifications", exact: true });
    const pillRow = page.locator("header div.overflow-x-auto.scrollbar-none");
    const lastPill = pillRow.locator("button").last();

    // Open the popover. Retry the click until it appears — a click during
    // hydration is silently dropped; the pill row only renders once open.
    await expect(bell).toBeVisible();
    await expect
      .poll(
        async () => {
          await bell.click();
          return pillRow.isVisible();
        },
        { timeout: 15_000 },
      )
      .toBe(true);

    // The strip must actually overflow at this viewport, starting unscrolled.
    const { scrollable, scrollLeft: initialScroll } = await pillRow.evaluate((el) => ({
      scrollable: el.scrollWidth > el.clientWidth + 1,
      scrollLeft: el.scrollLeft,
    }));
    expect(scrollable).toBe(true);
    expect(initialScroll).toBe(0);

    // Keyboard path: Tab from the bell until the last pill (Alerts) is
    // focused, skipping the popover header controls in between.
    await bell.focus();
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

  test("close button is keyboard-reachable and Enter closes the popover", async ({ page }) => {
    // exact: the close button is "Close notifications", which would also match
    // a substring query.
    const bell = page.getByRole("button", { name: "Notifications", exact: true });
    const pillRow = page.locator("header div.overflow-x-auto.scrollbar-none");
    const closeButton = page.getByRole("button", { name: "Close notifications" });

    // Open the popover (same hydration-safe retry as the other test).
    await expect(bell).toBeVisible();
    await expect
      .poll(
        async () => {
          await bell.click();
          return pillRow.isVisible();
        },
        { timeout: 15_000 },
      )
      .toBe(true);

    // Keyboard path: Tab from the bell until the close (X) button is
    // focused — it sits after the popover's Test / mark-all-as-read actions.
    await bell.focus();
    for (let i = 0; i < 15; i++) {
      await page.keyboard.press("Tab");
      if (await closeButton.evaluate((el) => document.activeElement === el)) break;
    }
    await expect(closeButton).toBeFocused();

    // Enter activates it — the popover unmounts.
    await page.keyboard.press("Enter");
    await expect(pillRow).not.toBeVisible();
  });

  /** Open the notification popover (hydration-safe retry, shared by the
      hidden-scrollbar tests). */
  const openPanel = async (page: Page) => {
    const bell = page.getByRole("button", { name: "Notifications", exact: true });
    const pillRow = page.locator("header div.overflow-x-auto.scrollbar-none");
    await expect(bell).toBeVisible();
    await expect
      .poll(
        async () => {
          await bell.click();
          return pillRow.isVisible();
        },
        { timeout: 15_000 },
      )
      .toBe(true);
    return pillRow;
  };

  test("pill row hides its scrollbar via the real scrollbar-none utility and still scrolls", async ({
    page,
  }) => {
    const pillRow = await openPanel(page);
    await expectHiddenScrollbar(page, pillRow, "notification pill row", "x");
    await assertProgrammaticScrollWorks(page, pillRow, "notification pill row");

    // The pill row's own thumb is display:none (nothing to recolor there), so
    // the recolor proof targets the panel's visible thin list — the same
    // surface the dark test asserts. Toggle in-page in BOTH directions and
    // prove the thumb color follows: light -> dark changes it, dark -> light
    // restores the exact light value.
    const list = page.locator("header div.overflow-y-auto.scrollbar-thin");
    await expect(list).toBeVisible();
    await expectThinScrollbarStyles(page, list, "notification list");

    await assertThumbRecolorsBidirectionally(page, list, "notification list");
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

    const pillRow = await openPanel(page);
    // Hiding is theme-independent — the same real-utility proofs hold.
    await expectHiddenScrollbar(page, pillRow, "notification pill row (dark)", "x");
    await assertProgrammaticScrollWorks(page, pillRow, "notification pill row (dark)");

    // The panel's notification list is its visible thin scrollbar — assert
    // the dark theme re-colors ITS thumb (the pill row's own thumb is
    // display:none, so there is nothing to recolor there).
    const list = page.locator("header div.overflow-y-auto.scrollbar-thin");
    await expect(list).toBeVisible();
    await expectThinScrollbarStyles(page, list, "notification list (dark)");
    await assertThumbRecolorsInDarkMode(page, list, "notification list");
  });
});
