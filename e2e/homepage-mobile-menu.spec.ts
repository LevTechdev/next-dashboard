import { test, expect, type Page } from "@playwright/test";

/**
 * Homepage mobile menu at a 375px viewport.
 *
 * The marketing nav's hamburger opens a full-screen frosted-glass overlay
 * (`fixed inset-0 ... overflow-y-auto`, `lg:hidden`): nav links on top, then a
 * language switcher + sign-in/sign-up section. The layout contract pinned here
 * (broken before the fix in the marketing layout):
 *   1. The overlay fills the viewport exactly — no dead blank space below the
 *      menu content.
 *   2. The sign-in section is pinned to the BOTTOM edge (`min-h-full flex-col`
 *      on the content column + `mb-auto` on the last nav item), so it sits at
 *      the bottom of the viewport on a tall phone and stays fully in view on a
 *      short one — instead of being cut off with no way to reach it.
 *   3. On a very short viewport the overlay itself scrolls (`overflow-y-auto`),
 *      so the whole bottom section — language switcher AND sign-in row — is
 *      reachable by scrolling even when the menu content is taller than the
 *      viewport.
 */
test.describe("Homepage mobile menu", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  async function openMenu(page: Page) {
    await page.getByRole("button", { name: "Toggle menu" }).click();
    // The bottom section is the LAST stagger child of the entrance animation
    // (starts ~0.5s in, animates 0.4s), so give it a full beat before reading
    // any geometry.
    await page.waitForTimeout(1200);
  }

  test("overlay fills the viewport with the sign-in section pinned to the bottom", async ({
    page,
  }) => {
    await page.goto("/en");
    await openMenu(page);

    // The overlay is `fixed inset-0` — it must cover the viewport exactly.
    const overlay = page.locator("div.fixed.inset-0.overflow-y-auto");
    await expect(overlay).toBeVisible();
    const ov = await overlay.boundingBox();
    expect(ov).not.toBeNull();
    expect(Math.round(ov!.x), "overlay x").toBe(0);
    expect(Math.round(ov!.y), "overlay y").toBe(0);
    expect(Math.round(ov!.width), "overlay width").toBe(375);
    expect(Math.round(ov!.height), "overlay height").toBe(812);

    // No dead blank space: the content column is min-h-full, so the menu's
    // last element reaches the overlay's bottom edge.
    const dims = await overlay.evaluate((el) => ({
      clientH: el.clientHeight,
      scrollH: el.scrollHeight,
    }));
    expect(dims.scrollH, "content exactly fills the overlay").toBe(dims.clientH);

    // The sign-in section (language switcher + auth row, the `space-y-2 pt-2`
    // block) is pinned to the bottom edge: its bottom sits at the overlay's
    // bottom minus the pb-6 (24px) bottom padding — not floating mid-screen
    // where the pre-fix blank space was. (The link itself sits a few px inside
    // its glow wrapper, so the SECTION is the pinned surface to measure.)
    const section = overlay.locator("div.space-y-2.pt-2");
    const sec = await section.boundingBox();
    expect(sec, "sign-in section present").not.toBeNull();
    expect(
      Math.abs(Math.round(sec!.y + sec!.height) - (812 - 24)),
      "sign-in section pinned to the bottom edge",
    ).toBeLessThanOrEqual(2);
    // …and its content is fully in view without any scrolling.
    const signIn = page.getByRole("link", { name: "Sign in" });
    const sb = await signIn.boundingBox();
    expect(sb, "sign-in link present").not.toBeNull();
    expect(sb!.y, "sign-in top inside viewport").toBeGreaterThanOrEqual(0);
    expect(sb!.y + sb!.height, "sign-in bottom inside viewport").toBeLessThanOrEqual(812);
    await expect(signIn).toBeVisible();
  });

  test("sign-in section is reachable by scrolling the overlay on a very short viewport", async ({
    page,
  }) => {
    // 375x400: short enough that the menu content (6 nav rows + divider +
    // language pill + the sign-in row) exceeds the viewport height.
    await page.setViewportSize({ width: 375, height: 400 });
    await page.goto("/en");
    await openMenu(page);

    const overlay = page.locator("div.fixed.inset-0.overflow-y-auto");
    await expect(overlay).toBeVisible();
    const ov = await overlay.boundingBox();
    expect(ov).not.toBeNull();
    expect(Math.round(ov!.height), "overlay fills the short viewport").toBe(400);

    // The content overflows, so the overlay must be genuinely scrollable —
    // nothing may be permanently cut off.
    const dims = await overlay.evaluate((el) => ({
      clientH: el.clientHeight,
      scrollH: el.scrollHeight,
    }));
    expect(dims.scrollH, "menu content overflows the short viewport").toBeGreaterThan(dims.clientH);

    // Before scrolling, the sign-in section is below the fold (cut off).
    const signIn = page.getByRole("link", { name: "Sign in" });
    const sb0 = await signIn.boundingBox();
    expect(sb0, "sign-in link present").not.toBeNull();
    expect(sb0!.y + sb0!.height, "sign-in starts below the fold").toBeGreaterThan(400);

    // Scrolling the overlay to the bottom brings it fully into view.
    await overlay.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    await expect
      .poll(
        async () => {
          const b = await signIn.boundingBox();
          return b ? b.y >= 0 && b.y + b.height <= 400 + 1 : false;
        },
        { timeout: 5_000, message: "sign-in reachable after scrolling the overlay" },
      )
      .toBe(true);
    await expect(signIn).toBeVisible();
  });

  test("language switcher stays reachable by scrolling the overlay at a very short viewport", async ({
    page,
  }) => {
    // 375x360: short enough that even the language switcher — the FIRST row of
    // the bottom section — starts fully below the fold (probed: top 403 in a
    // 360px viewport), so it pins the scroll-reachability contract for the
    // whole bottom section, not just the sign-in row.
    await page.setViewportSize({ width: 375, height: 360 });
    await page.goto("/en");
    await openMenu(page);

    const overlay = page.locator("div.fixed.inset-0.overflow-y-auto");
    await expect(overlay).toBeVisible();
    const ov = await overlay.boundingBox();
    expect(ov).not.toBeNull();
    expect(Math.round(ov!.height), "overlay fills the short viewport").toBe(360);

    // The content overflows, so the overlay must be genuinely scrollable.
    const dims = await overlay.evaluate((el) => ({
      clientH: el.clientHeight,
      scrollH: el.scrollHeight,
    }));
    expect(dims.scrollH, "menu content overflows the short viewport").toBeGreaterThan(dims.clientH);

    // The language switcher starts below the fold — cut off without scrolling.
    const lang = page.getByRole("button", { name: "English", exact: true });
    const lb0 = await lang.boundingBox();
    expect(lb0, "language switcher present").not.toBeNull();
    expect(lb0!.y, "language switcher starts below the fold").toBeGreaterThanOrEqual(360);

    // Scrolling the overlay to the bottom brings it fully into view.
    await overlay.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    await expect
      .poll(
        async () => {
          const b = await lang.boundingBox();
          return b ? b.y >= 0 && b.y + b.height <= 360 + 1 : false;
        },
        { timeout: 5_000, message: "language switcher reachable after scrolling the overlay" },
      )
      .toBe(true);
    await expect(lang).toBeVisible();
  });
});
