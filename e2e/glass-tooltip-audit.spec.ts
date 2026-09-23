import { test, expect, type Page } from "@playwright/test";
import { loginAs, FETCH_GATED } from "./helpers";

/**
 * Glass-tooltip audit — dashboard + analytics chart surfaces.
 *
 * Guards the boardui tooltip contract end to end:
 *   1. Every chart that uses GlassChartTooltip renders a node with
 *      [data-chart-tooltip="glass"] when the pointer hovers the plot.
 *   2. The default recharts tooltip (.recharts-tooltip-wrapper showing its
 *      default content / contentStyle) never appears on the audited pages.
 *
 * The audit hovers the chart's plot area (mouse.move into the surface), the
 * reliable way to trip recharts' onMouseMove in real input terms. Charts
 * behind tabs are reached by clicking their tab first.
 */

/** Glass classes the shared tooltip must carry (theme-dependent). */
const GLASS_LIGHT = /bg-white\/70/;

async function hoverCenter(page: Page, locator: ReturnType<Page["locator"]>, steps = 5) {
  const box = await locator.boundingBox();
  if (!box) throw new Error("hover target has no bounding box");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps });
  // Allow recharts' throttled tooltip state to settle.
  await page.waitForTimeout(250);
}

async function expectGlassTooltip(page: Page, pageName: string) {
  const glass = page.locator('[data-chart-tooltip="glass"]').first();
  await expect
    .poll(
      async () => {
        const cls = await glass.getAttribute("class", { timeout: 1_500 }).catch(() => null);
        return cls ? "present" : "absent";
      },
      {
        timeout: 8_000,
        intervals: [400],
        message: `${pageName}: no [data-chart-tooltip=glass] appeared on hover`,
      },
    )
    .toBe("present");
  // The glass contract: translucent white blur surface in light mode.
  await expect(glass).toHaveClass(GLASS_LIGHT);
}

test.describe("Glass tooltip audit", () => {
  test("dashboard revenue chart uses the shared glass tooltip", async ({ page }) => {
    await loginAs(page);
    await page.goto("/en/dashboard");
    // NOTE: no networkidle here — the realtime SSE stream never idles.

    // The revenue chart's bars carry per-bar test ids; the tallest bar is a
    // stable hover target (its center is always inside the plot's hitbox).
    const bars = page.locator('[data-testid^="revenue-bar-"]');
    await expect(bars.first()).toBeVisible({ timeout: FETCH_GATED.timeout });
    const count = await bars.count();
    let target = bars.first();
    let bestH = -1;
    for (let i = 0; i < count; i += 1) {
      const h = (await bars.nth(i).boundingBox())?.height ?? 0;
      if (h > bestH) {
        bestH = h;
        target = bars.nth(i);
      }
    }
    await target.scrollIntoViewIfNeeded();
    await hoverCenter(page, target, 7);

    await expectGlassTooltip(page, "dashboard");

    // No default recharts tooltip content anywhere on the page.
    await expect(page.locator(".recharts-tooltip-wrapper .recharts-default-tooltip")).toHaveCount(
      0,
    );
  });

  test("analytics channel tabs use the shared glass tooltip", async ({ page }) => {
    await loginAs(page);
    await page.goto("/en/analytics");

    // The analytics page opens on the funnel tab; the channels tab carries
    // the donut + trend area + activity rings, all GlassChartTooltip-backed.
    const channelsTab = page.getByRole("tab", { name: /channel/i }).first();
    if (await channelsTab.isVisible().catch(() => false)) {
      await channelsTab.click();
    }

    const surface = page.locator(".recharts-surface").first();
    await expect(surface).toBeVisible({ timeout: FETCH_GATED.timeout });
    await hoverCenter(page, surface, 7);
    await hoverCenter(page, surface, 4);

    await expectGlassTooltip(page, "analytics");
    await expect(page.locator(".recharts-tooltip-wrapper .recharts-default-tooltip")).toHaveCount(
      0,
    );
  });
});
