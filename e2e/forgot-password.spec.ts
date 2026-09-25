import { test, expect, type Page, type Locator } from "@playwright/test";
import { registerFreshUser, loginAs, TEST_PASSWORD } from "./helpers";

/**
 * Forgot-password E2E (pw3).
 * Seed the DB first: `npm run db:seed`.
 *
 * Flow under test (src/app/[locale]/(auth)/forgot-password + reset-password):
 * - /en/forgot-password: email form → POST /api/auth/forgot-password. In dev
 *   (no mailer configured) the response includes the reset URL, which the
 *   sent view renders as an inline <a href> link.
 * - /en/reset-password?token=…: new password + confirm → POST
 *   /api/auth/reset-password → success toast + redirect to /en/login.
 *
 * The reset token is single-use (cleared on success), so every test requests
 * its own link. The resend cooldown lives in localStorage, and Playwright
 * gives each test a fresh context, so it never leaks between tests.
 *
 * Hydration note: do NOT use waitForLoadState("networkidle") after any
 * navigation that happens while authenticated — the root RealtimeProvider
 * keeps an EventSource("/api/realtime") SSE stream open for signed-in users,
 * which networkidle treats as an in-flight request that never completes. Wait
 * for hydration via element actionability instead (fillInput + enabled-button
 * waits). The forgot-password form is NOT Suspense-gated (unlike login /
 * reset-password), so fills there can land mid-hydration and be reset — the
 * fillInput helper re-fills until the value sticks.
 */
const NEW_PASSWORD = "R3s3t!Passw0rd";

/**
 * Fill a controlled input, re-filling until the value sticks. React hydration
 * can reset an input filled mid-hydration (the SSR value wins), so a single
 * fill() is not enough on non-Suspense-gated forms.
 */
async function fillInput(page: Page, locator: Locator, value: string): Promise<void> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    await locator.fill(value);
    await page.waitForTimeout(250);
    if ((await locator.inputValue()) === value) return;
  }
  throw new Error(`Could not fill "${value}" — form never hydrated`);
}

/**
 * Submit the forgot-password form for `email` and return the dev-mode reset
 * URL rendered on the sent view. Pass `options.expectLink: false` for accounts
 * that must NOT receive a link (the API never leaks whether an email exists).
 */
async function requestResetLink(
  page: Page,
  email: string,
  options: { expectLink?: boolean } = {},
): Promise<string | null> {
  await page.goto("/en/forgot-password");
  await fillInput(page, page.getByPlaceholder("you@example.com"), email);

  const submit = page.getByRole("button", { name: "Send Reset Link", exact: true });
  await expect(submit).toBeEnabled();

  // Wait for the POST to resolve BEFORE asserting the sent view. The route is
  // compiled on-demand, so its first hit in a cold CI container can exceed the
  // 10s expect timeout (observed as an intermittent flake); waitForResponse
  // rides the longer test timeout, and the UI only swaps to the sent view once
  // the response lands.
  const responsePromise = page.waitForResponse(
    (r) => r.request().method() === "POST" && r.url().includes("/api/auth/forgot-password"),
  );
  await submit.click();
  const response = await responsePromise;
  expect(response.ok()).toBeTruthy();

  // The sent view shows the title twice (CardTitle + inline check box), so
  // scope to the first match. The reset link anchor is the real signal.
  await expect(page.getByText("Reset link sent").first()).toBeVisible();
  const resetLink = page.locator("a[href*='/reset-password']");
  if (options.expectLink === false) {
    await expect(resetLink).toHaveCount(0);
    return null;
  }
  await expect(resetLink).toBeVisible();
  const href = await resetLink.getAttribute("href");
  expect(href).toBeTruthy();
  return href;
}

test.describe("Forgot Password", () => {
  test("full flow: request link → reset password → old password fails → new password logs in", async ({
    page,
  }) => {
    // Headroom for cold CI containers: register + reset + two logins across
    // on-demand-compiled routes.
    // Fresh account (logged in after registration; the auth pages are public,
    // so the leftover session cookie doesn't interfere with the reset steps).
    const email = await registerFreshUser(page);

    // 1. Request the reset link.
    const resetUrl = await requestResetLink(page, email);
    expect(resetUrl).toMatch(/\/en\/reset-password\?token=/);

    // 2. Open the reset link and choose a new password. The reset form is
    //    Suspense-gated (useSearchParams), so plain fills are safe here.
    await page.goto(resetUrl as string);
    await expect(page.getByRole("heading", { name: "Reset Password" })).toBeVisible();

    const passwordInputs = page.locator('input[type="password"]');
    await passwordInputs.first().fill(NEW_PASSWORD);
    await passwordInputs.nth(1).fill(NEW_PASSWORD);

    const resetButton = page.getByRole("button", { name: "Reset Password", exact: true });
    await expect(resetButton).toBeEnabled();
    await resetButton.click();

    // Success toast + redirect to the login page. (The toast reads exactly
    // "Password reset successfully" — the old "Please sign in." suffix was
    // dropped when the toast copy was localized.)
    await expect(page.getByText("Password reset successfully", { exact: false })).toBeVisible();
    await expect(page).toHaveURL(/\/en\/login/);

    // 3. The registration session is still valid — clear cookies so the
    //    logins below are real credential checks against the new password.
    await page.context().clearCookies();

    // 4. The OLD password must now be rejected.
    await page.goto("/en/login");
    // Both fields scoped to the visible sign-in form: AnimatePresence keeps
    // the outgoing view mounted for a beat (and a long-lived dev server can
    // keep a stale form copy around), so an unscoped placeholder lookup hits
    // two elements — see signInEmailField() in e2e/helpers.ts.
    const loginForm = page.locator('form:visible:has(input[type="password"])');
    await loginForm.locator('input[type="email"]').fill(email);
    await loginForm.locator('input[type="password"]').fill(TEST_PASSWORD);
    await page.getByRole("button", { name: "Log in", exact: true }).click();
    await expect(page.getByText(/invalid|failed|incorrect/i).first()).toBeVisible();
    await expect(page).toHaveURL(/\/en\/login/);

    // 5. The NEW password logs in and lands on the dashboard.
    await loginAs(page, email, NEW_PASSWORD);
  });

  test("rejects a bogus token when submitting the reset form", async ({ page }) => {
    await page.goto("/en/reset-password?token=not-a-real-token");
    await expect(page.getByRole("heading", { name: "Reset Password" })).toBeVisible();

    const passwordInputs = page.locator('input[type="password"]');
    await passwordInputs.first().fill(NEW_PASSWORD);
    await passwordInputs.nth(1).fill(NEW_PASSWORD);
    await page.getByRole("button", { name: "Reset Password", exact: true }).click();

    // The API's error message is surfaced as a toast; the form stays put.
    await expect(page.getByText("Invalid or expired token")).toBeVisible();
    await expect(page).toHaveURL(/\/en\/reset-password/);
  });

  test("shows an error on /reset-password without a token", async ({ page }) => {
    await page.goto("/en/reset-password");

    // No token → inline error state + a link back to forgot-password. (The
    // localized copy says "reset token", not "reset link"; the back-link reads
    // "Forgot your password?", not the old "Forgot Password?" heading copy.)
    await expect(page.getByText("Invalid or expired reset token")).toBeVisible();
    await expect(page.getByRole("link", { name: "Forgot your password?" })).toBeVisible();
  });

  test("returns the generic sent view for an unknown email without exposing a reset link", async ({
    page,
  }) => {
    const resetUrl = await requestResetLink(page, `nobody-${Date.now()}@example.com`, {
      expectLink: false,
    });
    // No account exists → no dev link is rendered (no account enumeration).
    expect(resetUrl).toBeNull();
  });
});
