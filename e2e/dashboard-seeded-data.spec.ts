import { test, expect } from "@playwright/test";
import { loginAs, SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD } from "./helpers";

/**
 * Seeded-data regression spec.
 *
 * Guards against the "empty dashboard despite a seeded DB" class of bug: the
 * seed created orders/customers/products/discounts/campaigns WITHOUT a
 * tenantId while the API routes filter everything by the session's tenant
 * (`where: { tenantId }`), so the seed admin's dashboard showed Rp 0 / 0 / 0 / 0
 * even though the DB had hundreds of orders, 10 customers, 12 products, etc.
 *
 * The suite is seeded ONCE by globalSetup before any worker (e2e/global-setup.ts)
 * — this spec must NOT re-seed here: with parallel workers, one spec's re-seed
 * would wipe the DB out from under another spec's in-flight login. The seed is
 * guaranteed fresh at run start, and nothing else re-seeds mid-run.
 * Seed data: ~360 orders spread across all 12 months (counts vary per run via
 * jitter), 10 customers, 12 products. Revenue is random, so it's asserted
 * non-zero rather than exact.
 */

test.describe("Dashboard seeded data", () => {
  test("API returns non-zero tenant-scoped stats for the seed admin", async ({ request }) => {
    const login = await request.post("/api/auth/login", {
      data: { email: SEED_ADMIN_EMAIL, password: SEED_ADMIN_PASSWORD },
    });
    expect(login.status()).toBe(200);
    const { token } = await login.json();
    expect(token).toBeTruthy();

    const res = await request.get("/api/dashboard", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const data = await res.json();

    // /api/dashboard returns all-zero stats on error OR when the tenant-scoped
    // queries see nothing — so every stat must be non-zero here.
    expect(data.stats.totalRevenue).toBeGreaterThan(0);
    expect(data.stats.totalOrders).toBeGreaterThan(0);
    expect(data.stats.totalCustomers).toBeGreaterThan(0);
    expect(data.stats.totalProducts).toBeGreaterThan(0);
    expect(data.recentOrders.length).toBeGreaterThan(0);
    expect(data.topProducts.length).toBeGreaterThan(0);
  });

  test("dashboard stat cards render non-zero seeded values", async ({ page }) => {
    await loginAs(page);

    // Stat cards are `.stat-card-premium`; each holds a `p.text-sm` title and
    // a `p.text-2xl` value rendered by AnimatedCounter (id-ID currency for the
    // revenue card — "Rp 99.072.110"). toHaveText auto-retries, so the ~1.6s
    // count-up animation is absorbed.
    const revenueCard = page
      .locator(".stat-card-premium")
      .filter({ has: page.getByText("Total Revenue") });
    await expect(revenueCard.locator("p.text-2xl")).toHaveText(/^Rp\s[1-9][0-9.,]*$/);

    for (const title of ["Total Orders", "Total Customers", "Total Products"]) {
      const card = page.locator(".stat-card-premium").filter({ has: page.getByText(title) });
      await expect(card.locator("p.text-2xl")).toHaveText(/^[1-9][0-9]*$/);
    }
  });
});
