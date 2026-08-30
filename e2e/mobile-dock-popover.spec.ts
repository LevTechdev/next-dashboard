import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

/**
 * Mobile dock language popover at a 375px-wide, very short (320px) viewport.
 *
 * The dashboard dock's language picker opens a popover ANCHORED ABOVE the dock
 * (`absolute bottom-full`). It used to be `overflow-hidden` with no height
 * cap, so on viewports shorter than ~340px its "Language" header clipped
 * against the top of the screen — cut off with nothing reachable. It now caps
 * itself to the space above the dock (`max-h-[calc(100dvh-5rem)]`) and scrolls
 * with the app's thin bar, so the whole popover stays in view and every
 * language option is reachable.
 */
test.describe("Mobile dock language popover", () => {
  test.use({ viewport: { width: 375, height: 320 } });

  test("stays in view and all languages reachable by scrolling at a very short viewport", async ({
    page,
  }) => {
    await loginAs(page);

    const dock = page.getByTestId("mobile-dock");
    await dock.getByRole("button", { name: "Switch language" }).click();

    const popover = page.locator("div.absolute.bottom-full.right-0.mb-3");
    await expect(popover).toBeVisible();

    // Nothing clips at the top: the popover fits entirely inside the 320px
    // viewport (pre-fix, its top sat at -13px and the header was cut off).
    const box = await popover.boundingBox();
    expect(box, "language popover present").not.toBeNull();
    expect(box!.y, "popover top inside viewport").toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height, "popover bottom inside viewport").toBeLessThanOrEqual(320 + 1);

    // The previously unreachable header is now in view.
    await expect(popover.getByText("Language")).toBeVisible();

    // The popover genuinely scrolls with the thin bar: its content is taller
    // than the capped height.
    const dims = await popover.evaluate((el) => ({
      clientH: el.clientHeight,
      scrollH: el.scrollHeight,
      overflowY: getComputedStyle(el).overflowY,
    }));
    expect(dims.scrollH, "popover content overflows its cap").toBeGreaterThan(dims.clientH);
    expect(dims.overflowY, "popover scrolls").toBe("auto");

    // Every language option is reachable: scrolling to the bottom brings the
    // last one (日本語) fully into view.
    const lastLang = popover.getByRole("button", { name: /日本語/ });
    await popover.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    await expect
      .poll(
        async () => {
          const b = await lastLang.boundingBox();
          return b ? b.y >= 0 && b.y + b.height <= 320 + 1 : false;
        },
        { timeout: 5_000, message: "last language reachable after scrolling the popover" },
      )
      .toBe(true);
    await expect(lastLang).toBeVisible();
  });
});
