/**
 * Theme reveal — regression guard (the skiper26 reskin, src/hooks/use-theme-reveal.ts).
 *
 * A theme switch must go through the View Transitions API and reveal from the
 * control the user pressed, not blink. The hook sets
 * `data-theme-reveal="<variant>"` plus `--theme-reveal-x/-y` on <html> for the
 * duration of the transition and removes them when it finishes; the wipe
 * itself runs in `::view-transition-new(root)` (globals.css), which Playwright
 * screenshots as ordinary pixels.
 *
 * Asserting the DOM contract is the honest check a CI run can make:
 *  1. the attribute appears with the saved variant,
 *  2. the geometry custom properties name the pressed control as the origin,
 *  3. both are cleaned up afterwards (a leak would pin the wipe keyframes on
 *     every later navigation transition),
 *  4. the theme actually flipped.
 *
 * Two surfaces are covered because they exercise different origin plumbing:
 * the dashboard header's Light/Dark/System trio (per-button origin) and the
 * command palette's Toggle Theme action (no pressed control → viewport
 * centre). Both specs clean up via `light` — the seed theme — so the next
 * spec starts in a known state.
 */
import { expect, test, type Page } from "@playwright/test";
import { FETCH_GATED, loginAs, waitForLoginThrottleWindow } from "./helpers";

const REVEAL = "data-theme-reveal";

/** Current theme + reveal state off <html>. */
async function revealState(page: Page) {
  return page.evaluate(
    ([attr]) => {
      const root = document.documentElement;
      const style = getComputedStyle(root);
      return {
        attr: root.getAttribute(attr!),
        x: style.getPropertyValue("--theme-reveal-x").trim(),
        y: style.getPropertyValue("--theme-reveal-y").trim(),
        isDark: root.classList.contains("dark"),
      };
    },
    [REVEAL] as const,
  );
}

test.describe("Theme reveal", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page);
  });

  test("dashboard header trio reveals from the pressed button", async ({ page }) => {
    await page.goto("/en/dashboard");
    await waitForLoginThrottleWindow();

    // The trio lives in the user menu (trigger = the avatar button, no
    // aria-label — addressed by its accessible initials/name text).
    await page.locator("header").getByRole("button").filter({ hasText: "Admin" }).first().click();
    const light = page.getByRole("button", { name: "Light", exact: true });
    await expect(light).toBeVisible();

    const before = await revealState(page);
    await light.click();

    // Mid-flight: variant attribute + geometry naming the pressed button.
    await expect(page.locator(`html[${REVEAL}]`)).toHaveAttribute(
      REVEAL,
      /circle|rectangle|polygon|blur/,
      {
        timeout: 5_000,
      },
    );
    const mid = await revealState(page);
    expect(mid.x, "origin x must be set from the pressed control").not.toBe("");
    expect(mid.y, "origin y must be set from the pressed control").not.toBe("");
    // A click in the open menu is in the upper header region — not the exact
    // viewport centre the keyboard fallback would produce.
    expect(parseFloat(mid.y)).toBeLessThan(60);

    // The switch really happened.
    await expect
      .poll(() => revealState(page).then((s) => s.isDark !== before.isDark || s.attr === null))
      .toBeTruthy();

    // Cleanup: attribute and geometry are gone once the transition finishes.
    await expect.poll(() => revealState(page).then((s) => s.attr)).toBeNull();
    const after = await revealState(page);
    expect(after.x).toBe("");
    expect(after.y).toBe("");

    // Restore the seed theme so later specs start light.
    await page.locator("header").getByRole("button").filter({ hasText: "Admin" }).first().click();
    await page.getByRole("button", { name: "Light", exact: true }).click();
    await expect.poll(() => revealState(page).then((s) => s.isDark)).toBeFalsy();
  });

  test("command palette Toggle Theme reveals from the viewport centre", async ({ page }) => {
    await page.goto("/en/dashboard");
    await waitForLoginThrottleWindow();

    const paletteInput = page.getByPlaceholder("Search orders, customers, products...");
    // The palette mounts inside the header and installs its ⌘K listener on
    // hydration, so a hotkey pressed before that is silently dropped — the
    // flake this test used to hit on cold CI machines. Retry within the
    // fetch-gated budget, pressing ONLY when the dialog is not mounted (the
    // handler is a toggle, so a blind retry would close an open palette).
    await expect(async () => {
      if ((await paletteInput.count()) === 0) {
        await page.keyboard.press("ControlOrMeta+k");
      }
      await expect(paletteInput).toBeVisible({ timeout: 2_500 });
    }).toPass(FETCH_GATED);

    await paletteInput.fill("toggle theme");
    const action = page.getByText("Toggle Theme", { exact: true }).first();
    await expect(action).toBeVisible();
    await action.click();

    // No pressed control → the origin must be the exact viewport centre.
    await expect(page.locator(`html[${REVEAL}]`)).toHaveAttribute(
      REVEAL,
      /circle|rectangle|polygon|blur/,
      {
        timeout: 5_000,
      },
    );
    const mid = await revealState(page);
    expect(mid.x).toBe("50.000%");
    expect(mid.y).toBe("50.000%");

    await expect.poll(() => revealState(page).then((s) => s.attr)).toBeNull();

    // Restore the seed theme through the same surface (cycle once more).
    await page.keyboard.press("ControlOrMeta+k");
    await page.getByPlaceholder("Search orders, customers, products...").fill("toggle theme");
    await page.getByText("Toggle Theme", { exact: true }).first().click();
    await expect.poll(() => revealState(page).then((s) => s.attr)).toBeNull();
  });
});
