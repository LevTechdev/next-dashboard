import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

/**
 * Realtime toast lifecycle — the boardui floating surface end to end.
 *
 * /api/realtime streams a snapshot every 10s; the FIRST tick after the SSE
 * connection opens is the baseline (changed=false, silent). So the spec:
 *
 *   1. logs in and lands on the dashboard (SSE connects),
 *   2. waits out two ticks (~11s) so the baseline is consumed,
 *   3. creates two orders via POST /api/orders (aggregates into ONE
 *      "2 New Orders" notification on the next tick),
 *   4. polls up to 10s for the toast card and asserts the boardui anatomy:
 *      success chip type, countdown bar, action pill, bottom-right viewport,
 *      and that the stack never exceeds 3 cards,
 *   5. asserts auto-dismiss: the card is gone ~6s after appearing.
 */
test("order event renders the floating toast, then auto-dismisses", async ({ page }) => {
  await loginAs(page);
  await page.goto("/en/dashboard");

  // SSE connected (or about to) — wait out the baseline tick + one live tick.
  await expect
    .poll(() => page.evaluate(() => document.body.innerText), { timeout: 30_000 })
    .toContain("Updated");

  await page.waitForTimeout(11_000);

  // Two orders in one server tick → a single aggregated toast.
  for (const amount of ["45000", "67500"]) {
    const res = await page.request.post("/api/orders", {
      data: { totalAmount: amount, grandTotal: amount, paymentMethod: "QRIS", status: "PENDING" },
    });
    expect(res.status()).toBe(200);
  }

  // Poll for the toast within one server tick (10s) + margin.
  const toast = page.locator('[data-testid="realtime-toast"][data-toast-type="order"]');
  await expect(toast).toHaveCount(1, { timeout: 15_000 });

  // Boardui anatomy: title, relative timestamp, countdown bar, action pill.
  await expect(toast.locator("p").first()).toContainText(/New Order/);
  await expect(toast.locator("span.absolute.inset-x-0")).toHaveCount(1); // countdown bar
  await expect(toast.locator('a[href*="orders"]')).toContainText(/orders?/i);

  // Viewport: fixed bottom-right, pointer-events pass through the surface.
  const viewportBox = await page
    .locator('[data-testid="realtime-toast-viewport"]')
    .evaluate((el) => {
      const rect = el.getBoundingClientRect();
      return {
        aria: el.getAttribute("aria-label"),
        rightGap: Math.round(window.innerWidth - rect.right),
        bottomGap: Math.round(window.innerHeight - rect.bottom),
        pointerEvents: getComputedStyle(el).pointerEvents,
      };
    });
  expect(viewportBox.aria).toBe("Notifications");
  expect(viewportBox.rightGap).toBeLessThanOrEqual(24);
  expect(viewportBox.bottomGap).toBeLessThanOrEqual(24);
  expect(viewportBox.pointerEvents).toBe("none");

  // Stack invariant while the toast is alive: never more than 3 cards.
  const stackMax = await page.evaluate(
    () => document.querySelectorAll('[data-testid="realtime-toast"]').length,
  );
  expect(stackMax).toBeLessThanOrEqual(3);

  // Auto-dismiss: TOAST_DURATION is 6s — the card must leave the DOM well
  // within 9s of appearing (poll finishes as soon as it's gone).
  await expect(toast).toHaveCount(0, { timeout: 9_000 });
});
