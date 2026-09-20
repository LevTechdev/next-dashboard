import { test, expect } from "@playwright/test";
import { registerFreshUser, FETCH_GATED } from "./helpers";

/**
 * Fresh-signup empty workspace — the tenant-isolation contract.
 *
 * A brand-new self-service account must land in its OWN empty workspace, not
 * the shared `default` tenant: total revenue, orders, customers, and products
 * all render $0/0 on the dashboard, and the orders API returns no rows from
 * the seed data. Before the personal-tenant provisioning, every fresh signup
 * saw the seed workspace's full dataset.
 *
 * Registers through the real signup form (unique email per run), skips OTP
 * via the session cookie set at registration, then reads both the dashboard
 * API payload (server-side proof) and the UI stat cards.
 */

test("fresh signup renders an empty workspace, isolated from seed data", async ({ page }) => {
  const email = await registerFreshUser(page, {
    emailPrefix: "clean-ws",
    name: "Clean WS",
  });

  // The register API already set the session cookie — go to the dashboard as
  // the unverified-but-authenticated fresh user.
  await page.goto("/en/dashboard");
  await expect(page).toHaveURL(/\/en\/dashboard/, { timeout: 45_000 });

  // ── Server-side proof: every aggregate is zero ─────────────────────────
  const dashRes = await page.request.get("/api/dashboard");
  expect(dashRes.ok()).toBeTruthy();
  const dash = await dashRes.json();
  expect(dash.stats.totalRevenue).toBe(0);
  expect(dash.stats.totalOrders).toBe(0);
  expect(dash.stats.totalCustomers).toBe(0);
  expect(dash.stats.totalProducts).toBe(0);

  // ── Orders API: not a single seed order leaks into the new tenant ──────
  const ordersRes = await page.request.get("/api/orders");
  expect(ordersRes.ok()).toBeTruthy();
  const orders = await ordersRes.json();
  expect(orders).toEqual([]);

  // ── UI proof: the hero renders the zeroed total ─────────────────────────
  await expect(page.getByText("$0.00").first()).toBeVisible(FETCH_GATED);
});
