import { test, expect } from "@playwright/test";
import { fillRegistrationForm, completeSignupOtp } from "./helpers";

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
 * - feedback via sonner toasts.
 *
 * Every new account is issued a 6-digit email OTP (identity verification).
 * In dev the raw code is rendered inline (`data-testid="dev-otp"`) so the
 * tests can complete the OTP step and reach the dashboard.
 *
 * The register API runs an HIBP breach check, so test passwords must NOT be
 * in known breach corpora ("password123" is rejected server-side).
 */

test.describe("Register", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/en/register");
    // Hydration-safe: fills during hydration are silently dropped.
    await page.waitForLoadState("networkidle");
  });

  test("creates an account, verifies the email OTP, and lands on the dashboard", async ({
    page,
  }) => {
    const uniqueEmail = `test-${Date.now()}@example.com`;
    await fillRegistrationForm(page, uniqueEmail);

    // Identity verification: the OTP step appears right after signup.
    await completeSignupOtp(page);

    await expect(page).toHaveURL(/\/en\/dashboard/);
  });

  test("shows an attempts-left error for an incorrect verification code", async ({ page }) => {
    await fillRegistrationForm(page, `bad-otp-${Date.now()}@example.com`);

    await expect(page.getByText("Verify your email")).toBeVisible();
    // Auto-submit fires on the 6th digit — no "Verify Email" click (it would
    // race the in-flight request; the error surfaces from the auto-submit).
    await page.getByPlaceholder("6-digit code").fill("000000");

    await expect(page.getByText(/attempt\(s\) left/i)).toBeVisible();
    // Still on the OTP step — not logged into the dashboard.
    await expect(page).toHaveURL(/\/en\/register/);
  });

  test("rejects a password shorter than 6 characters and stays on /register", async ({ page }) => {
    // Matching short passwords keep the submit button enabled; the client
    // length<6 check fires on submit.
    await fillRegistrationForm(page, `short-${Date.now()}@example.com`, {
      password: "123",
    });

    await expect(page.getByText(/at least 6 characters/i).first()).toBeVisible();
    await expect(page).toHaveURL(/\/en\/register/);
  });

  test("rejects a duplicate email and stays on /register", async ({ page }) => {
    await fillRegistrationForm(page, "admin@dashboard.com");

    await expect(page.getByText(/already in use|already exists|failed/i).first()).toBeVisible();
    await expect(page).toHaveURL(/\/en\/register/);
  });
});
