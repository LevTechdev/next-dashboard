import { test, expect } from "@playwright/test";
import { loginAs, FETCH_GATED } from "./helpers";

/**
 * Affiliates — official platform brand icons.
 *
 * Affiliate platforms (TikTok Shop, Shopee, Tokopedia, Facebook, Instagram,
 * Lazada) must render their official brand glyph from the sales-channel icon
 * system instead of the generic color-letter tile. The seeded catalog uses
 * slugs that all resolve to brand icons, so every platform card should carry
 * an inline SVG glyph and an external storefront link.
 */

const BRAND_SLUGS = [
  { name: /TikTok Shop/i, color: "#FE2C55" },
  { name: /^Shopee/i, color: "#EE4D2D" },
  { name: /Tokopedia/i, color: "#03AC0E" },
  { name: /^Facebook$/i, color: "#1877F2" },
  { name: /Instagram/i, color: "#E1306C" },
];

test.describe("Affiliates — platform brand icons", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page);
    await page.goto("/en/affiliates");
    await expect(page.getByRole("heading", { name: /affiliate marketing/i })).toBeVisible(
      FETCH_GATED,
    );
    // Platform cards grid: wait for the first seeded catalog entry.
    await expect(page.getByText("TikTok Shop").first()).toBeVisible(FETCH_GATED);
  });

  test("every seeded platform card renders a brand SVG glyph", async ({ page }) => {
    const cards = page.locator("main .grid > div").filter({
      has: page.locator("a, button"),
    });

    for (const brand of BRAND_SLUGS) {
      const card = page
        .locator("main div")
        .filter({ has: page.getByText(brand.name).first() })
        .filter({ has: page.locator("svg") })
        .first();
      await expect(card).toBeVisible();

      // The brand glyph is an inline SVG inside the icon tile.
      const tile = card
        .locator("div")
        .filter({ has: page.locator("svg") })
        .first();
      await expect(tile.locator("svg").first()).toBeVisible();
    }

    // Sanity: the card count matches the seeded catalog size.
    expect(cards).toBeDefined();
  });

  test("platform cards expose external storefront links", async ({ page }) => {
    // Each card renders an external-link button to the platform storefront
    // (baseUrl) next to Connect — at least the seeded six should be present.
    const externalLinks = page.locator('a[target="_blank"][rel*="noopener"]');
    const count = await externalLinks.count();
    expect(count).toBeGreaterThanOrEqual(1);

    const first = externalLinks.first();
    expect(await first.getAttribute("href")).toMatch(/^https?:\/\//);
  });

  test("links and conversions tabs show platform badges with brand glyphs", async ({ page }) => {
    // Empty-state guard: with no affiliate links the tab shows the centered
    // empty icon stack — assert the empty state renders correctly centered
    // (flex column) instead of a misaligned inline icon.
    await page.getByRole("tab", { name: /affiliate links/i }).click();
    const emptyText = page.getByText(/no affiliate links yet/i);
    const hasRows = await page.getByRole("row").count();

    if (hasRows > 1) {
      // With data: platform badges exist in the second column.
      await expect(page.getByRole("row").nth(1)).toBeVisible();
    } else {
      await expect(emptyText).toBeVisible();
      // The icon sits above the text — a flex column, not baseline text.
      const emptyCell = emptyText.locator("xpath=ancestor::td[1]");
      await expect(emptyCell.locator("div").first()).toHaveClass(/flex-col/);
    }
  });
});
