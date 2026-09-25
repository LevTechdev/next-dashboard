import { test, expect } from "@playwright/test";
import { loginAs, SEED_ADMIN_EMAIL } from "./helpers";

/**
 * Admin user management — real data, destructive guards.
 *
 * prisma/seed.ts plants the account directory the page reads through
 * GET /api/admin/users:
 *
 *   • nextdashboards@gmail.com — ADMIN (the seed admin; super-admin legacy
 *     rows normalize to the same scope)
 *   • sarah@dashboard.com — MANAGER
 *   • mike@dashboard.com  — STAFF
 *   • client@dashboard.com — CLIENT
 *   • legacy-root@dashboard.com — SUPER_ADMIN (legacy, normalized)
 *
 * Covers the three contract changes from the security sweep:
 *   • the table renders REAL users (name/email rows from the API, not mocks)
 *   • self-deletion is disabled in the kebab menu for the signed-in admin
 *   • the delete action always asks for confirmation (Sora dialog) before
 *     calling DELETE
 */
test.describe("Admin user management", () => {
  test("renders real user rows and disables self-deletion", async ({ page }) => {
    await loginAs(page);
    await page.goto("/en/admin");
    await page.waitForURL("**/en/admin**");

    // Stats cards hydrate from the fetched directory.
    await expect(page.getByTestId("admin-stat-users")).not.toHaveText("—");

    // Real rows: seed accounts visible with their emails.
    const rows = page.locator('[data-testid="admin-user-row"]');
    await expect(rows.first()).toBeVisible();
    await expect(page.locator('[data-user-email="sarah@dashboard.com"]')).toBeVisible();
    await expect(page.locator('[data-user-email="mike@dashboard.com"]')).toBeVisible();

    // The signed-in admin's own row has its delete action disabled.
    const ownRow = page.locator(`[data-user-email="${SEED_ADMIN_EMAIL}"]`);
    await expect(ownRow).toBeVisible();
    await ownRow.getByRole("button").click();
    const deleteItem = page.getByRole("menuitem", { name: /delete user/i });
    await expect(deleteItem).toBeDisabled();
    await page.keyboard.press("Escape");
  });

  test("delete asks for confirmation before hitting the API", async ({ page }) => {
    await loginAs(page);
    await page.goto("/en/admin");
    await page.waitForURL("**/en/admin**");

    const rows = page.locator('[data-testid="admin-user-row"]');
    await expect(rows.first()).toBeVisible();

    // Arm an API spy — DELETE must not fire until the dialog is confirmed.
    const deleteCalls: string[] = [];
    await page.route("**/api/admin/users?*", (route) => {
      if (route.request().method() === "DELETE") deleteCalls.push(route.request().url());
      return route.fallback();
    });

    // Open a non-self row's kebab menu and choose Delete user.
    const target = page.locator('[data-user-email="sarah@dashboard.com"]');
    await target.getByRole("button").click();
    await page.getByRole("menuitem", { name: /delete user/i }).click();

    // The Sora confirm dialog appears with destructive styling…
    const dialog = page.getByRole("alertdialog").or(page.getByRole("dialog"));
    await expect(dialog.first()).toBeVisible();

    // …and no DELETE has been sent yet.
    expect(deleteCalls).toHaveLength(0);

    // Dismiss with Cancel — still no DELETE.
    await page.getByRole("button", { name: /cancel/i }).click();
    await expect(dialog.first()).toBeHidden();
    expect(deleteCalls).toHaveLength(0);
  });

  test("audit-health card reports chain, attribution, and outbox", async ({ page }) => {
    await loginAs(page);
    await page.goto("/en/admin");
    await page.waitForURL("**/en/admin**");

    // The card hydrates from GET /api/admin/audit-health (the CI gate's
    // dashboard twin). On a seeded DB the chain verifies and attribution is
    // intact, so both sections read healthy; the outbox may legitimately hold
    // pending rows, so only its presence is asserted.
    const chain = page.getByTestId("audit-chain-health");
    await expect(chain).toBeVisible();
    await expect(chain).toContainText(/\d+\/\d+/);
    await expect(chain).toHaveAttribute("data-state", "ok");

    await expect(page.getByTestId("audit-attribution-health")).toHaveAttribute("data-state", "ok");

    await expect(page.getByTestId("audit-mail-health")).toBeVisible();
  });
});
