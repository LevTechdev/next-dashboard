import { test, expect } from "@playwright/test";
import {
  loginAs,
  registerFreshUser,
  seedActivityFeedNotifications,
  expectThinVerticalScrollbar,
  expectThinScrollbarStyles,
  assertThumbRecolorsInDarkMode,
  fillCopilotThreadUntilScrollable,
} from "./helpers";

/**
 * Thin-scrollbar contract for vertical scroll areas at a 375px (phone)
 * viewport.
 *
 * Every scrollable surface in the app ships the `.scrollbar-thin` utility
 * (globals.css): `scrollbar-width: thin` (the standard property — Firefox and
 * Chromium ≥121) plus a 4px WebKit bar (`::-webkit-scrollbar { width: 4px }`),
 * via the shared `ScrollContainer` component. This spec pins the *rendered*
 * result in a real browser for the two canonical vertical scroll areas — the
 * activity feed list and the AI copilot message thread — so a future
 * regression (e.g. swapping `ScrollContainer` for a bare overflow div) can't
 * silently bring back the ~15px default scrollbar. The dark-theme tests
 * repeat the thin contract under the dark theme — for the activity feed
 * list, the copilot message thread, AND the composer Textarea — and prove
 * the dark theme re-colors the bar (the `.dark .scrollbar-thin` thumb
 * override actually applies), and the light-mode Textarea test pins the
 * computed `scrollbar-width: thin` once its content overflows the 120px cap.
 */
test.describe("vertical scrollbars are thin (4px) on mobile", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("activity feed list shows a 4px thin vertical scrollbar", async ({ page }) => {
    // A fresh account keeps this isolated: the seed admin's feed is shared
    // with other specs, and STAFF has create permission on notifications.
    await registerFreshUser(page);
    const feed = page.getByRole("log", { name: "Live activity feed" });
    await expect(feed).toBeVisible();

    // The feed starts empty for a fresh user, so there is no vertical
    // scrollbar yet. Seed enough notifications (via the same authenticated
    // session) to overflow the feed's 380px cap.
    await seedActivityFeedNotifications(page);

    // Reload so the feed re-fetches with the seeded items.
    await page.reload();
    await expect(feed).toBeVisible();
    await expect(page.getByText("Scrollbar audit item 11")).toBeVisible();

    await expectThinVerticalScrollbar(page, feed, "activity feed");
  });

  test("activity feed list stays thin with the dark-theme thumb color", async ({ page }) => {
    // Set the theme BEFORE any navigation: the theme-init script (layout.tsx)
    // reads localStorage.theme before paint, so the whole session is dark.
    await page.addInitScript(() => localStorage.setItem("theme", "dark"));
    await registerFreshUser(page);

    // Gate: the dark theme actually applied (prevents a silently-light run).
    await expect(page.locator("html")).toHaveClass(/dark/);

    const feed = page.getByRole("log", { name: "Live activity feed" });
    await expect(feed).toBeVisible();
    await seedActivityFeedNotifications(page);
    await page.reload();
    await expect(feed).toBeVisible();
    await expect(page.getByText("Scrollbar audit item 11")).toBeVisible();

    // The thin contract holds unchanged under the dark theme.
    await expectThinVerticalScrollbar(page, feed, "activity feed (dark)");

    // The dark theme actually re-colors the bar: the `.dark .scrollbar-thin`
    // thumb override differs from the light-mode thumb color.
    await assertThumbRecolorsInDarkMode(page, feed, "activity feed");
  });

  test("AI copilot message thread shows a 4px thin vertical scrollbar", async ({ page }) => {
    await loginAs(page);
    const copilotButton = page.getByRole("button", { name: "Open AI Copilot" });
    await expect(copilotButton).toBeVisible();
    await copilotButton.click();

    const panel = page.getByTestId("ai-copilot-panel");
    await expect(panel).toBeVisible();
    // Wait for the entrance animation to finish before measuring geometry.
    await expect(panel).toHaveCSS("opacity", "1");

    // The message thread is the panel's scroll area (ScrollContainer).
    const thread = panel.locator("div.overflow-y-auto.scrollbar-thin").first();
    await fillCopilotThreadUntilScrollable(page, panel, thread);

    await expectThinVerticalScrollbar(page, thread, "copilot thread");
  });

  test("AI copilot message thread stays thin with the dark-theme thumb color", async ({ page }) => {
    // Set the theme BEFORE any navigation: the theme-init script (layout.tsx)
    // reads localStorage.theme before paint, so the whole session is dark.
    await page.addInitScript(() => localStorage.setItem("theme", "dark"));
    await loginAs(page);

    // Gate: the dark theme actually applied (prevents a silently-light run).
    await expect(page.locator("html")).toHaveClass(/dark/);

    const copilotButton = page.getByRole("button", { name: "Open AI Copilot" });
    await expect(copilotButton).toBeVisible();
    await copilotButton.click();

    const panel = page.getByTestId("ai-copilot-panel");
    await expect(panel).toBeVisible();
    // Wait for the entrance animation to finish before measuring geometry.
    await expect(panel).toHaveCSS("opacity", "1");

    const thread = panel.locator("div.overflow-y-auto.scrollbar-thin").first();
    await fillCopilotThreadUntilScrollable(page, panel, thread);

    // The thin contract holds unchanged under the dark theme.
    await expectThinVerticalScrollbar(page, thread, "copilot thread (dark)");

    // The dark theme actually re-colors the bar: the `.dark .scrollbar-thin`
    // thumb override differs from the light-mode thumb color.
    await assertThumbRecolorsInDarkMode(page, thread, "copilot thread");
  });

  test("AI copilot composer textarea reports scrollbar-width: thin at a small viewport", async ({
    page,
  }) => {
    await loginAs(page);
    const copilotButton = page.getByRole("button", { name: "Open AI Copilot" });
    await expect(copilotButton).toBeVisible();
    await copilotButton.click();

    const panel = page.getByTestId("ai-copilot-panel");
    await expect(panel).toBeVisible();
    // Wait for the entrance animation to finish before measuring geometry.
    await expect(panel).toHaveCSS("opacity", "1");

    // The composer is the shared ui/textarea — it ships `.scrollbar-thin`.
    const textarea = panel.locator("textarea");
    await expect(textarea).toBeEnabled();

    // The computed standard property is thin regardless of overflow.
    await expect(textarea).toHaveCSS("scrollbar-width", "thin");

    // Type enough that the auto-growing composer caps at 120px and scrolls,
    // so a vertical scrollbar actually renders — then assert the full thin
    // contract (real class, scrollbar-width: thin, 4px WebKit bar, 4px
    // gutter) on the textarea element itself.
    await textarea.fill("x".repeat(600));
    await expectThinVerticalScrollbar(page, textarea, "copilot composer textarea");
  });

  test("AI copilot composer textarea stays thin with the dark-theme thumb color", async ({
    page,
  }) => {
    // Set the theme BEFORE any navigation: the theme-init script (layout.tsx)
    // reads localStorage.theme before paint, so the whole session is dark.
    await page.addInitScript(() => localStorage.setItem("theme", "dark"));
    await loginAs(page);

    // Gate: the dark theme actually applied (prevents a silently-light run).
    await expect(page.locator("html")).toHaveClass(/dark/);

    const copilotButton = page.getByRole("button", { name: "Open AI Copilot" });
    await expect(copilotButton).toBeVisible();
    await copilotButton.click();

    const panel = page.getByTestId("ai-copilot-panel");
    await expect(panel).toBeVisible();
    // Wait for the entrance animation to finish before measuring geometry.
    await expect(panel).toHaveCSS("opacity", "1");

    const textarea = panel.locator("textarea");
    await expect(textarea).toBeEnabled();

    // The computed standard property is thin regardless of overflow.
    await expect(textarea).toHaveCSS("scrollbar-width", "thin");

    // Overflow to render the bar, then assert the full thin contract.
    await textarea.fill("x".repeat(600));
    await expectThinVerticalScrollbar(page, textarea, "copilot composer textarea (dark)");

    // The dark theme actually re-colors the bar: the `.dark .scrollbar-thin`
    // thumb override differs from the light-mode thumb color.
    await assertThumbRecolorsInDarkMode(page, textarea, "copilot composer textarea");
  });

  test("Select dropdown keeps its thin scrollbar with the dark-theme thumb color", async ({
    page,
  }) => {
    // Set the theme BEFORE any navigation: the theme-init script (layout.tsx)
    // reads localStorage.theme before paint, so the whole session is dark.
    await page.addInitScript(() => localStorage.setItem("theme", "dark"));
    await loginAs(page);

    // Gate: the dark theme actually applied (prevents a silently-light run).
    await expect(page.locator("html")).toHaveClass(/dark/);

    // Open a Radix Select inside the customers dialog.
    await page.goto("/en/customers");
    await page.getByRole("button", { name: "Add Customer" }).click();
    await page.waitForSelector("[role=dialog]");
    const trigger = page.locator("[role=dialog] [role=combobox]").first();
    await trigger.click();
    const viewport = page.locator("[data-radix-select-viewport]").first();
    await expect(viewport).toBeVisible();

    // The dropdown keeps the app's thin bar under the dark theme (this also
    // covers the light mode — the recolor check below toggles back to it).
    await expectThinScrollbarStyles(page, viewport, "select dropdown");

    // The dark theme actually re-colors the bar: the `.dark .scrollbar-thin`
    // thumb override differs from the light-mode thumb color.
    await assertThumbRecolorsInDarkMode(page, viewport, "select dropdown");
  });
});
