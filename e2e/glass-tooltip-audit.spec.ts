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
    // the bar chart + donut + trend area, all glass-tooltip-backed. The tab
    // MUST be clicked — waiting for hydration instead of skipping (an early
    // isVisible()===false used to skip the click, leaving the funnel panel
    // active where no audited chart exists).
    const channelsTab = page.getByRole("tab", { name: /Sales by Channel/i });
    await expect(channelsTab).toBeVisible({ timeout: FETCH_GATED.timeout });
    await channelsTab.click();

    // Scope bars to the channels PANEL by CONTENT (the heading inside it):
    // this page has multiple Radix tablists and Radix panels carry no
    // accessible name, while Radix's generated `radix-_r_N_-content-*` ids
    // can churn between SSR and the hydrated client — a captured id waits on
    // a node that hydration has since replaced. A has-filter re-resolves on
    // every retry, so it survives that churn.
    const panel = page
      .locator('[role="tabpanel"]')
      .filter({ has: page.getByRole("heading", { name: /Sales by Channel/i }) });
    await expect(panel).toBeVisible({ timeout: FETCH_GATED.timeout });
    // Hover a BAR LAYER, not the bare surface center: a surface-center hover
    // can land in empty plot space (or in the donut's hole). A bar's own
    // bounding box is always filled — the same "stable target" trick the
    // dashboard test uses with the tallest bar. Target the recharts bar
    // LAYER (`g.recharts-bar-rectangle`), not a shape inside it: recharts
    // renders the shape as <rect> for square corners but as <path> when the
    // bar has a radius, so the layer is the only stable handle. Pick the
    // largest layer — its center cannot fall in the axis gutter.
    const barLayers = panel.locator(".recharts-bar-rectangle");
    await expect(barLayers.first()).toBeVisible({ timeout: FETCH_GATED.timeout });
    const layerCount = await barLayers.count();
    let target = barLayers.first();
    let bestArea = -1;
    for (let i = 0; i < layerCount; i += 1) {
      const b = await barLayers.nth(i).boundingBox();
      const area = b ? b.width * b.height : 0;
      if (area > bestArea) {
        bestArea = area;
        target = barLayers.nth(i);
      }
    }
    await target.scrollIntoViewIfNeeded();
    await hoverCenter(page, target, 7);
    await hoverCenter(page, target, 4);

    await expectGlassTooltip(page, "analytics");
    await expect(page.locator(".recharts-tooltip-wrapper .recharts-default-tooltip")).toHaveCount(
      0,
    );
  });
});
