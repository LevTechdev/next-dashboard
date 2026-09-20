import { test, expect, type Page, type Locator } from "@playwright/test";
import { loginAs, FETCH_GATED } from "./helpers";

/**
 * Glass tooltip theme pin — light + dark variants on the revenue chart.
 *
 * The shared GlassChartTooltip (src/components/charts/glass-tooltip.tsx) must
 * render BOTH theme variants:
 *  - light: translucent white glass (bg-white/70 + backdrop-blur-md)
 *  - dark:  elevated card surface (dark:bg-card/95) — pure white glass is
 *           illegible on near-black charts
 *
 * This spec locks the class contract AND the computed dark surface so a
 * refactor can't silently drop the dark variant again (the original bug:
 * the tooltip stayed light in dark mode).
 */

/** Hover recipe for recharts bars: short capsules are tiny targets and the
 * chart re-renders on scroll, so pick the TALLEST bar (stable hit area),
 * scroll it into view, then drive raw mouse input to its center. Synthetic
 * dispatched events don't reach recharts' handler — native CDP input does. */
async function hoverRevenueBar(page: Page): Promise<void> {
  await page.goto("/en/dashboard");
  const anyBar = page.locator('[data-testid^="revenue-bar-"]').first();
  await expect(anyBar).toBeVisible(FETCH_GATED);
  // Let the bar animation finish — heights animate from 0 on mount.
  await page.waitForTimeout(1200);

  const idx = await page.locator('[data-testid^="revenue-bar-"]').evaluateAll((els) => {
    let best = 0;
    let bestI = 0;
    els.forEach((el, i) => {
      const h = (el as SVGRectElement).getBBox().height;
      if (h > best) {
        best = h;
        bestI = i;
      }
    });
    return bestI;
  });

  const bar = page.locator(`[data-testid="revenue-bar-${idx}"]`);
  await bar.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  const box = await bar.boundingBox();
  expect(box, "tallest bar must have geometry").toBeTruthy();

  const cx = box!.x + box!.width / 2;
  const cy = box!.y + box!.height / 2;
  await page.mouse.move(cx - 80, cy);
  await page.waitForTimeout(150);
  await page.mouse.move(cx, cy);
}

/** The visible glass tooltip inside any revenue-chart wrapper. */
function visibleGlassTooltip(page: Page): Locator {
  return page.locator(".recharts-tooltip-wrapper .backdrop-blur-md").first();
}

test.describe("Revenue chart glass tooltip", () => {
  test("light mode: white blur glass surface", async ({ page }) => {
    await loginAs(page);
    await hoverRevenueBar(page);

    const tooltip = visibleGlassTooltip(page);
    await expect(tooltip).toBeVisible();

    const cls = (await tooltip.getAttribute("class")) ?? "";
    expect(cls).toContain("bg-white/70");
    expect(cls).toContain("backdrop-blur-md");
    // Dark variant is compiled into the same class list; both themes always
    // ship together (the original bug shipped a tooltip with no dark half).
    expect(cls).toContain("dark:bg-card/95");
    expect(cls).toContain("dark:border-border");

    // Currency-formatted value rendered (bold right-aligned figure).
    await expect(tooltip.locator("span.ml-auto.font-bold").first()).not.toBeEmpty();
  });

  test("dark mode: elevated card surface replaces white glass", async ({ page }) => {
    await loginAs(page);
    // Flip theme before the chart mounts so the tooltip renders under dark
    // tokens (the app's theme is a `dark` class on <html>).
    await page.evaluate(() => {
      try {
        localStorage.setItem("theme", "dark");
      } catch {
        /* ignore */
      }
      document.documentElement.classList.add("dark");
    });
    await hoverRevenueBar(page);

    const tooltip = visibleGlassTooltip(page);
    await expect(tooltip).toBeVisible();

    // The computed surface in dark mode must be the elevated card color,
    // not the translucent white — this is the exact regression that shipped.
    const bg = await tooltip.evaluate((el) => getComputedStyle(el).backgroundColor);
    const rgb = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    expect(rgb, `expected rgb() background, got ${bg}`).toBeTruthy();
    const [, r, g, b] = rgb!.map(Number) as unknown as number[];
    // bg-card in dark theme resolves to a near-black surface; the broken
    // state resolved to white glass (255,255,255).
    expect(r!, "dark tooltip surface must not be white glass").toBeLessThan(60);
    expect(g!).toBeLessThan(60);
    expect(b!).toBeLessThan(60);
  });
});
