import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

/**
 * Integrations tab bar at a 375px (phone) viewport.
 *
 * The 4 tabs (API Keys / Webhooks / Delivery Log / Playground) with icons are
 * wider than a phone screen, so the shared TabsList renders full-width,
 * left-aligned and horizontally scrollable below md. This spec pins that
 * contract: the bar must stay inside the viewport (no page-level horizontal
 * overflow) and every tab must be reachable and clickable.
 */
test.describe("Integrations tab bar on mobile", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test.beforeEach(async ({ page }) => {
    await loginAs(page);
    await page.goto("/en/integrations");
    // The API Keys tab's toolbar only renders after hydration + the initial
    // fetch resolves; waiting on it doubles as the gate that the tab bar is
    // fully interactive (a click during hydration is silently dropped).
    await expect(
      page.getByRole("button", { name: "Create API Key", exact: true }).first(),
    ).toBeVisible();
  });

  test("keeps the tab bar inside the viewport, scrollable internally", async ({ page }) => {
    const tabList = page.getByRole("tablist");
    await expect(tabList).toBeVisible();

    const viewportWidth = await page.evaluate(() => window.innerWidth);
    expect(viewportWidth).toBe(375);
    const box = await tabList.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewportWidth + 1);

    // The labels + icons are wider than the pill, so it scrolls internally
    // (scrollWidth > clientWidth) instead of widening the page.
    const { scrollable } = await tabList.evaluate((el) => ({
      scrollable: el.scrollWidth > el.clientWidth,
    }));
    expect(scrollable).toBe(true);
  });

  test("every tab is clickable and activates its panel", async ({ page }) => {
    const tabs = [
      { name: "API Keys", marker: "Create API Key" },
      { name: "Webhooks", marker: "Add Endpoint" },
      { name: "Delivery Log", marker: "Refresh" },
      { name: "Playground", marker: "Send request" },
    ];
    for (const { name, marker } of tabs) {
      await page.getByRole("tab", { name }).click();
      await expect(page.getByRole("tab", { name })).toHaveAttribute("aria-selected", "true");
      // The marker is the tab's distinctive control; .first() tolerates the
      // empty-state duplicates (e.g. two "Create API Key" buttons).
      await expect(page.getByRole("button", { name: marker, exact: true }).first()).toBeVisible();
    }
  });

  test("arrow-key focus auto-scrolls the focused tab into view", async ({ page }) => {
    const tabList = page.getByRole("tablist");
    const viewportWidth = await page.evaluate(() => window.innerWidth);

    // Move focus right across the fold (Playground starts outside the pill's
    // visible area at 375px); the pill must scroll so it becomes visible.
    // Radix roving focus moves focus inside a setTimeout, so wait for each
    // step to land before pressing again — otherwise consecutive keydowns
    // all compute from the still-focused element and only advance one tab.
    await page.getByRole("tab", { name: "API Keys" }).focus();
    await expect(page.getByRole("tab", { name: "API Keys" })).toBeFocused();
    for (const name of ["Webhooks", "Delivery Log", "Playground"]) {
      await page.keyboard.press("ArrowRight");
      await expect(page.getByRole("tab", { name })).toBeFocused();
    }

    // Poll because scrollIntoView uses smooth behavior. The pill scrolled…
    await expect.poll(async () => tabList.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
    // …and the focused tab's right edge is inside the viewport.
    await expect
      .poll(async () => {
        const box = await page.getByRole("tab", { name: "Playground" }).boundingBox();
        return box ? box.x + box.width : Number.POSITIVE_INFINITY;
      })
      .toBeLessThanOrEqual(viewportWidth);
  });

  test("Home/End/PageUp/PageDown roving focus scrolls the pill to the first/last tab", async ({
    page,
  }) => {
    const tabList = page.getByRole("tablist");
    const maxScroll = await tabList.evaluate((el) => el.scrollWidth - el.clientWidth);
    expect(maxScroll).toBeGreaterThan(0);

    await page.getByRole("tab", { name: "API Keys" }).focus();
    await expect(page.getByRole("tab", { name: "API Keys" })).toBeFocused();

    // End / PageDown jump to the last tab; the pill scrolls to its far end.
    for (const key of ["End", "PageDown"]) {
      await page.keyboard.press(key);
      await expect(page.getByRole("tab", { name: "Playground" })).toBeFocused();
      await expect
        .poll(async () => tabList.evaluate((el) => el.scrollLeft), { timeout: 10_000 })
        .toBeGreaterThanOrEqual(maxScroll - 5);
    }

    // Home / PageUp jump back to the first tab; the pill scrolls to its start.
    for (const key of ["Home", "PageUp"]) {
      await page.keyboard.press(key);
      await expect(page.getByRole("tab", { name: "API Keys" })).toBeFocused();
      await expect
        .poll(async () => tabList.evaluate((el) => el.scrollLeft), { timeout: 10_000 })
        .toBeLessThanOrEqual(5);
    }
  });
});
