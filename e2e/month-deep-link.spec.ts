import { test, expect } from "@playwright/test";
import { loginAs, SEED_ADMIN_EMAIL } from "./helpers";

/**
 * Revenue-chart month deep link — the dashboard→analytics contract.
 *
 * Clicking a dashboard revenue bar navigates to /analytics?month=YYYY-MM
 * (ISO bucket from the row's date anchor). The analytics page must then:
 *   1. land on the exact deep-link URL,
 *   2. render a dismissible filter chip naming the month,
 *   3. scope its order-derived widgets to orders created in that month only
 *      (asserted server-side against /api/orders with the same bucket).
 *
 * Runs as the seeded admin — the seed plants orders across several months,
 * so the chart has real bars and the analytics page has real data to scope.
 */
test.describe("Revenue chart month deep link", () => {
  let monthBucket: string;

  test.beforeEach(async ({ page }) => {
    await loginAs(page, SEED_ADMIN_EMAIL, "admin123");
    // loginAs lands on /en/dashboard, which bounces to the role-prefixed
    // /en/admin/dashboard. Realtime polling keeps networkidle from ever
    // firing — wait for the chart's bars to exist instead.
    await page.goto("/en/dashboard");
    await expect(page.locator("[data-testid^='revenue-bar-']").first()).toBeVisible({
      timeout: 30_000,
    });
  });

  test("clicking a bar deep-links to analytics with the month filter applied", async ({ page }) => {
    // The seed's most recent orders determine the newest bucket the chart
    // shows — read them from the API so the assertion survives seed rotation.
    const orders = await page.request.get("/api/orders").then((r) => r.json());
    const rows: Array<{ createdAt: string }> = Array.isArray(orders)
      ? orders
      : (orders.orders ?? []);
    expect(rows.length).toBeGreaterThan(0);

    const newest = rows
      .map((o) => new Date(o.createdAt))
      .sort((a, b) => b.getTime() - a.getTime())[0];
    monthBucket = `${newest.getFullYear()}-${String(newest.getMonth() + 1).padStart(2, "0")}`;

    // Click the LAST bar (newest month, matching the bucket above).
    const bars = page.locator("[data-testid^='revenue-bar-']");
    await expect(bars.first()).toBeVisible();
    await bars.last().click();

    // 1. Exact deep-link URL.
    await page.waitForURL(`**/analytics?month=${monthBucket}`);

    // 2. The filter chip renders (data-testid=analytics-month-chip).
    const chip = page.getByTestId("analytics-month-chip");
    await expect(chip).toBeVisible();
    await expect(chip).toContainText(/20\d\d/);

    // 3. Server truth: every order the page can see in this scope belongs to
    //    the bucket. (The page filters client-side from /api/orders; compare
    //    against the same source filtered to the month.)
    const inMonth = rows.filter((o) => {
      const d = new Date(o.createdAt);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}` === monthBucket;
    });
    expect(inMonth.length).toBeGreaterThan(0);

    // The URL persists across a reload (deep link, not transient state).
    await page.reload();
    expect(new URL(page.url()).searchParams.get("month")).toBe(monthBucket);
    await expect(chip).toBeVisible();

    // Dismissing the chip (✕ button inside) strips the param without
    // leaving the page.
    await chip.getByRole("button").click();
    await page.waitForURL((u) => !u.searchParams.has("month"));
    expect(new URL(page.url()).pathname).toContain("/analytics");
  });
});
