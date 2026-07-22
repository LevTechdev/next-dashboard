import { test, expect } from "@playwright/test";

/**
 * Register E2E (pw4).
 * Seed the DB first: `npm run db:seed`.
 * Seeded email for the duplicate test: admin@dashboard.com.
 *
 * The register form (src/app/[locale]/(auth)/register/page.tsx):
 * - name     <input type="text"  placeholder="John Doe">
 * - email    <input type="email" placeholder="you@example.com">
 * - password <input placeholder="Min. 6 characters">
 * - confirm  <input placeholder="Repeat your password">
 * - submit   <button>Create Account</button>
 *   NOTE: disabled unless password === confirmPassword, so confirm must always match.
 * - feedback via sonner toasts; success navigates to /en/dashboard.
 */
test.describe("Register", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/en/register");
  });

  test("creates an account with a unique email and lands on the dashboard", async ({ page }) => {
    const uniqueEmail = `test-${Date.now()}@example.com`;

    await page.getByPlaceholder("John Doe").fill("Test User");
    await page.getByPlaceholder("you@example.com").fill(uniqueEmail);
    await page.getByPlaceholder("Min. 6 characters").fill("password123");
    await page.getByPlaceholder("Repeat your password").fill("password123");

    await page.getByRole("button", { name: "Create Account" }).click();

    await expect(page).toHaveURL(/\/en\/dashboard/);
  });

  test("rejects a password shorter than 6 characters and stays on /register", async ({ page }) => {
    await page.getByPlaceholder("John Doe").fill("Test User");
    await page.getByPlaceholder("you@example.com").fill(`short-${Date.now()}@example.com`);
    // Confirm must match so the submit button is enabled; the client length<6 check fires first.
    await page.getByPlaceholder("Min. 6 characters").fill("123");
    await page.getByPlaceholder("Repeat your password").fill("123");

    await page.getByRole("button", { name: "Create Account" }).click();

    await expect(page.getByText(/at least 6 characters/i).first()).toBeVisible();
    await expect(page).toHaveURL(/\/en\/register/);
  });

  test("rejects a duplicate email and stays on /register", async ({ page }) => {
    await page.getByPlaceholder("John Doe").fill("Test User");
    await page.getByPlaceholder("you@example.com").fill("admin@dashboard.com");
    await page.getByPlaceholder("Min. 6 characters").fill("password123");
    await page.getByPlaceholder("Repeat your password").fill("password123");

    await page.getByRole("button", { name: "Create Account" }).click();

    await expect(page.getByText(/already in use|already exists|failed/i).first()).toBeVisible();
    await expect(page).toHaveURL(/\/en\/register/);
  });
});
