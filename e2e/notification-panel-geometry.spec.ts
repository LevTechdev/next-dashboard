import { test, expect, type Page } from "@playwright/test";
import { loginAs, SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD } from "./helpers";

/**
 * Notification panel geometry on tablet & phone.
 *
 * Below `lg` the standalone bell is hidden and the panel is opened from the
 * avatar menu, rendering as a viewport-anchored sheet. The shell must not clip
 * it or capture its containing block — historically a `position: fixed` panel
 * inside the header landed hundreds of pixels off-screen at phone widths, so
 * the panel is portaled to <body> on compact viewports.
 *
 * Pinned here:
 *   1. the panel is a DIRECT child of <body> on compact widths (portaled),
 *   2. its box sits fully inside the viewport with sane margins,
 *   3. tapping outside closes it.
 */

async function openNotifications(page: Page) {
  // The avatar dropdown's Notifications item dispatches this event; using the
  // event directly keeps the spec independent of avatar-initial rendering.
  // Re-dispatched because a dispatch before hydration is silently dropped.
  const panel = page.getByTestId("notification-panel");
  await expect
    .poll(
      async () => {
        if (await panel.isVisible().catch(() => false)) return true;
        await page.evaluate(() =>
          window.dispatchEvent(new CustomEvent("dashboard:open-notifications")),
        );
        return panel.isVisible().catch(() => false);
      },
      { timeout: 20_000, intervals: [400, 600, 800] },
    )
    .toBe(true);
  return panel;
}

async function expectPortaledAndInsideViewport(page: Page) {
  const geometry = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="notification-panel"]');
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    // Walk up: the portal wrapper is the panel's parent; it must be a body child.
    const wrapper = el.parentElement;
    return {
      wrapperIsBodyChild: wrapper?.parentElement === document.body,
      position: getComputedStyle(el).position,
      rect: {
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
      },
      viewport: { w: window.innerWidth, h: window.innerHeight },
    };
  });

  expect(geometry).not.toBeNull();
  const g = geometry!;
  expect(g.position).toBe("fixed");
  expect(g.wrapperIsBodyChild).toBe(true);
  // Never overflows the viewport on any edge.
  expect(g.rect.left).toBeGreaterThanOrEqual(0);
  expect(g.rect.top).toBeGreaterThanOrEqual(0);
  expect(g.rect.right).toBeLessThanOrEqual(g.viewport.w + 0.5);
  expect(g.rect.bottom).toBeLessThanOrEqual(g.viewport.h + 0.5);
  // Anchored below the header, not pushed off the top.
  expect(g.rect.top).toBeGreaterThan(8);
  expect(g.rect.top).toBeLessThan(140);
}

test.describe("Notification panel geometry", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD);
  });

  test("phone (375px): portaled sheet inside the viewport, closes on outside tap", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 720 });
    await page.goto("/en/admin/dashboard");
    await openNotifications(page);
    await expectPortaledAndInsideViewport(page);

    // Tap outside the panel (near the bottom of the screen) → panel closes.
    await page.mouse.click(180, 700);
    await expect(page.getByTestId("notification-panel")).toHaveCount(0);
  });

  test("tablet (820px): portaled sheet inside the viewport", async ({ page }) => {
    await page.setViewportSize({ width: 820, height: 1180 });
    await page.goto("/en/admin/dashboard");
    await openNotifications(page);
    await expectPortaledAndInsideViewport(page);
  });
});
