import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

/**
 * Mobile dock "More" drawer at a 375px-wide, very short (320px) viewport.
 *
 * The drawer was redesigned to match the header profile dropdown (glass
 * surface, rounded-t-[26px], user card, list rows). It must stay reachable on
 * very short viewports: the whole drawer fits inside the 320px height budget
 * (max-h-[85vh] + internal scroll), and every language option is reachable by
 * scrolling.
 */
test.describe("Mobile dock language drawer", () => {
  test.use({ viewport: { width: 375, height: 320 } });

  test("stays in view and all languages reachable by scrolling at a very short viewport", async ({
    page,
  }) => {
    await loginAs(page);

    const dock = page.getByTestId("mobile-dock");
    await dock.getByRole("button", { name: "More" }).click();

    const drawer = page.getByTestId("mobile-dock-drawer");
    await expect(drawer).toBeVisible();

    // The drawer caps itself to 85vh, so on the 320px viewport its top stays
    // inside the viewport (pre-redesign, an unclipped sheet could overflow).
    // Poll: the box is measured mid-slide until the entrance tween settles.
    await expect
      .poll(
        async () => {
          const b = await drawer.boundingBox();
          if (!b) return false;
          return b.y >= 0 && b.y + b.height <= 320 + 1;
        },
        { timeout: 5_000, message: "drawer settles fully inside the viewport" },
      )
      .toBe(true);

    // The localized language section header is in view.
    await expect(drawer.getByText("Language")).toBeVisible();

    // The drawer genuinely scrolls: content taller than the capped height.
    // Polled: under parallel-worker argon2 contention the drawer can be
    // measured a beat before React finishes rendering the tile grid — but 18
    // tiles + the language section MUST overflow the 85vh cap once rendered.
    await expect
      .poll(
        async () => {
          const dims = await drawer.evaluate((el) => ({
            clientH: el.clientHeight,
            scrollH: el.scrollHeight,
          }));
          return dims.scrollH > dims.clientH;
        },
        { timeout: 10_000, message: "drawer content overflows its cap" },
      )
      .toBe(true);
    const overflow = await drawer.evaluate((el) => ({
      clientH: el.clientHeight,
      scrollH: el.scrollHeight,
      overflowY: getComputedStyle(el).overflowY,
    }));
    expect(overflow.overflowY === "auto" || overflow.overflowY === "scroll", "drawer scrolls").toBe(
      true,
    );

    // Every language option is reachable: scrolling to the bottom brings the
    // last one (日本語) fully into view.
    const lastLang = drawer.getByRole("button", { name: /日本語/ });
    await drawer.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    await expect
      .poll(
        async () => {
          const b = await lastLang.boundingBox();
          return b ? b.y >= 0 && b.y + b.height <= 320 + 1 : false;
        },
        { timeout: 5_000, message: "last language reachable after scrolling the drawer" },
      )
      .toBe(true);
    await expect(lastLang).toBeVisible();
  });
});
