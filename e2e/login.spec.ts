import { test, expect } from "@playwright/test";
import { loginAs, SEED_ADMIN_EMAIL } from "./helpers";

/**
 * Login E2E (pw3).
 * Seed the DB first: `npm run db:seed`.
 * Seed admin creds: SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD (./helpers).
 *
 * The login form (src/app/[locale]/(auth)/login/page.tsx):
 * - email  <input type="email" placeholder="nextdashboards@gmail.com">
 * - password <input placeholder="Enter your password">
 * - submit <button>Sign In</button> (disabled until both fields are filled)
 * - feedback via sonner toasts; success navigates to /en/dashboard.
 */
test.describe("Login", () => {
  test("logs in with valid seed credentials and lands on the dashboard", async ({ page }) => {
    // Delegates to the shared loginAs helper (fills the form, waits for the
    // enabled Sign In button, and waits for the dashboard). loginAs navigates
    // itself, so this test has no goto in a beforeEach.
    await loginAs(page);
  });

  test("shows an error and stays on /login for invalid credentials", async ({ page }) => {
    await page.goto("/en/login");
    await page.locator('input[type="email"]').fill(SEED_ADMIN_EMAIL);
    await page.getByPlaceholder("Enter password").fill("wrong-password");

    await page.getByRole("button", { name: "Log in", exact: true }).click();

    // Feedback is surfaced via a sonner toast, not an inline element.
    await expect(page.getByText(/invalid|failed|incorrect/i).first()).toBeVisible();
    await expect(page).toHaveURL(/\/en\/login/);
  });
});
