import { test, expect } from "@playwright/test";
import { fillRegistrationForm, completeSignupOtp } from "./helpers";

/**
 * Register E2E (pw4).
 * Seed the DB first: `npm run db:seed`.
 * Seeded email for the duplicate test: nextdashboards@gmail.com.
 *
 * The register form (src/app/[locale]/(auth)/register/page.tsx):
 * - name     <input placeholder="John Doe">                    (t("namePlaceholder"))
 * - email    <input type="email" placeholder="you@example.com"> (hard-coded)
 * - password <input type="password" placeholder="••••••••">
 * - confirm  <input type="password" placeholder="••••••••">
 * - submit   <button>Sign Up</button>                          (t("signUpButton"))
 *   NOTE: the button is only disabled while a request is in flight — field
 *   validation fires on submit and is surfaced as sonner toasts.
 * - a successful signup swaps the form for the email-OTP identity step with
 *   the heading t("verifyEmailTitle") — "Verify your email" — and a
 *   "Verify & Continue" submit button. Unlike the login TOTP prompt, the OTP
 *   input here does NOT auto-submit on the 6th digit; the button must be
 *   clicked (completeSignupOtp does this).
 *
 * Every new account is issued a 6-digit email OTP (identity verification).
 * In dev the raw code is rendered inline (`data-testid="dev-otp"`) so the
 * tests can complete the OTP step and reach the dashboard.
 *
 * The dev-mode OTP is only returned when NO mailer is configured (the
 * `isDevFallbackAllowed` gate in src/lib/email-verification.ts) — the same
 * contract the forgot-password reset-link tests rely on. When running the
 * suite with real SMTP/Resend keys in .env.local, run Playwright with
 * `RESEND_API_KEY= SMTP_HOST=` so the dev fallback is active.
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

    await expect(page.getByRole("heading", { name: "Verify your email" })).toBeVisible();
    // The OTP input carries no maxLength attribute (the page slices to 6 digits
    // in JS) and needs the explicit "Verify & Continue" click — no auto-submit.
    await page.getByPlaceholder("000000").fill("000000");
    await page.getByRole("button", { name: "Verify & Continue", exact: true }).click();

    await expect(page.getByText(/attempt\(s\) left/i)).toBeVisible();
    // Still on the OTP step — not logged into the dashboard.
    await expect(page).toHaveURL(/\/en\/register/);
  });

  test("rejects a password shorter than 6 characters and stays on /register", async ({ page }) => {
    // The submit button is enabled regardless of length (it's only disabled
    // while a request is in flight); the client length<6 check fires on submit
    // and is surfaced as a toast.
    await fillRegistrationForm(page, `short-${Date.now()}@example.com`, {
      password: "123",
    });

    await expect(page.getByText(/at least 6 characters/i).first()).toBeVisible();
    await expect(page).toHaveURL(/\/en\/register/);
  });

  test("rejects a duplicate email and stays on /register", async ({ page }) => {
    await fillRegistrationForm(page, "nextdashboards@gmail.com");

    await expect(page.getByText(/already in use|already exists|failed/i).first()).toBeVisible();
    await expect(page).toHaveURL(/\/en\/register/);
  });
});
