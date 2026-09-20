import { test, expect, devices } from "@playwright/test";
import { loginAs, FETCH_GATED } from "./helpers";

/**
 * Mobile dock More drawer — role-gated menu surface.
 *
 * The drawer mirrors the sidebar's groups (main / ADMIN / ACCOUNT) and is
 * filtered by the same permission layer. The seed admin sees all 18 tiles;
 * the CLIENT member (client@dashboard.com) sees only the reduced
 * CLIENT-accessible set — owner/admin surfaces (Admin Console, Roles, SSO,
 * API Docs, Team, Audit Log, …) are hidden.
 */

test.use({ viewport: { width: 390, height: 844 } });

const ADMIN_TILES = [
  "Analytics",
  "Sales",
  "Inventory",
  "Marketing",
  "Affiliates",
  "Discounts",
  "Reports",
  "Audit Log",
  "Billing",
  "Admin",
  "Roles",
  "Integrations",
  "SSO",
  "API Docs",
  "Team",
  "Notifications",
  "Security",
  "Settings",
];

async function openMoreDrawer(page: import("@playwright/test").Page) {
  await page.getByTestId("mobile-dock").getByRole("button", { name: /more/i }).click();
  const drawer = page.getByTestId("mobile-dock-drawer");
  await expect(drawer).toBeVisible();
  return drawer;
}

test.describe("mobile More drawer role gating", () => {
  test("admin sees the full menu surface with grouped sections", async ({ page }) => {
    await loginAs(page);

    await page.goto("/en/dashboard");
    const drawer = await openMoreDrawer(page);

    // All 18 tiles, each exactly once.
    for (const label of ADMIN_TILES) {
      await expect(drawer.getByRole("link", { name: new RegExp(`^${label}`, "i") })).toHaveCount(1);
    }

    // Group headers from the sidebar structure (localized nav keys). Scoped
    // to paragraphs — the Admin *tile link* also matches ^admin$.
    await expect(drawer.getByRole("paragraph").filter({ hasText: /^admin$/i })).toBeVisible();
    await expect(drawer.getByRole("paragraph").filter({ hasText: /^account$/i })).toBeVisible();

    // Sales-channel brand links stay sidebar-only.
    expect(await drawer.locator("a[href*='channel=']").count()).toBe(0);
  });

  test("CLIENT member sees a reduced, role-gated set", async ({ page }) => {
    await loginAs(page, "client@dashboard.com", "staff123");

    await page.goto("/en/dashboard");
    const drawer = await openMoreDrawer(page);

    // Starter-tier (REGULAR) CLIENT surfaces: billing, notifications and
    // security come from PAGE_ACCESS; analytics/reports need PRO+.
    for (const visible of ["Billing", "Notifications", "Security"]) {
      await expect(
        drawer.getByRole("link", { name: new RegExp(`^${visible}`, "i") }),
      ).toBeVisible();
    }

    // Owner/admin surfaces are hidden by the permission layer.
    for (const hidden of [
      "Admin",
      "Roles",
      "SSO",
      "API Docs",
      "Team",
      "Audit Log",
      "Integrations",
      "Reports",
      "Affiliates",
      "Marketing",
    ]) {
      await expect(drawer.getByRole("link", { name: new RegExp(`^${hidden}`, "i") })).toHaveCount(
        0,
      );
    }

    // Strictly fewer tiles than the admin view.
    const tileCount = await drawer.getByRole("link").count();
    expect(tileCount).toBeGreaterThan(0);
    expect(tileCount).toBeLessThan(ADMIN_TILES.length);
  });
});
