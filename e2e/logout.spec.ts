import { test, expect } from "@playwright/test";

/**
 * Logout + protected-route E2E (pw5).
 * Seed the DB first: `npm run db:seed`.
 * Seed admin creds: admin@dashboard.com / admin123.
 *
 * Logout UI (src/components/layout/header.tsx):
 * - The user menu is a ghost <button> containing the user's name/avatar.
 * - Opening it reveals a "Logout" menuitem wired to logout() ->
 *   POST /api/auth/logout, which clears the token cookie and
 *   router.push("/en/login").
 *
 * Protected route:
 * - There is NO client-side redirect guard (no middleware). Route
 *   protection is enforced at the API layer: /api/auth/me returns 401
 *   without a valid token cookie.
 */
test.describe("Logout", () => {
  test("logs out from the header menu and returns to /login", async ({ page }) => {
    // Sign in first (same flow as login.spec.ts).
    await page.goto("/en/login");
    await page.getByPlaceholder("admin@dashboard.com").fill("admin@dashboard.com");
    await page.getByPlaceholder("Enter your password").fill("admin123");
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page).toHaveURL(/\/en\/dashboard/);

    // Open the user menu (ghost button showing the signed-in user's name).
    await page.getByRole("button", { name: /admin/i }).first().click();

    // Click the Logout menuitem.
    await page.getByRole("menuitem", { name: /logout/i }).click();

    // logout() redirects back to the login page.
    await expect(page).toHaveURL(/\/en\/login/);
  });
});

test.describe("Protected route", () => {
  test("returns 401 from /api/auth/me without a session cookie", async ({ request }) => {
    const res = await request.get("/api/auth/me");
    expect(res.status()).toBe(401);
  });
});
