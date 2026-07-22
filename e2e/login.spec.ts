import { test, expect } from "@playwright/test";

/**
 * Login E2E (pw3).
 * Seed the DB first: `npm run db:seed`.
 * Seed admin creds: admin@dashboard.com / admin123.
 *
 * The login form (src/app/[locale]/(auth)/login/page.tsx):
 * - email  <input type="email" placeholder="admin@dashboard.com">
 * - password <input placeholder="Enter your password">
 * - submit <button>Sign In</button> (disabled until both fields are filled)
 * - feedback via sonner toasts; success navigates to /en/dashboard.
 */
test.describe("Login", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/en/login");
  });

  test("logs in with valid seed credentials and lands on the dashboard", async ({ page }) => {
    await page.getByPlaceholder("admin@dashboard.com").fill("admin@dashboard.com");
    await page.getByPlaceholder("Enter your password").fill("admin123");

    await page.getByRole("button", { name: "Sign In" }).click();

    await expect(page).toHaveURL(/\/en\/dashboard/);
  });

  test("shows an error and stays on /login for invalid credentials", async ({ page }) => {
    await page.getByPlaceholder("admin@dashboard.com").fill("admin@dashboard.com");
    await page.getByPlaceholder("Enter your password").fill("wrong-password");

    await page.getByRole("button", { name: "Sign In" }).click();

    // Feedback is surfaced via a sonner toast, not an inline element.
    await expect(page.getByText(/invalid|failed|incorrect/i).first()).toBeVisible();
    await expect(page).toHaveURL(/\/en\/login/);
  });
});
