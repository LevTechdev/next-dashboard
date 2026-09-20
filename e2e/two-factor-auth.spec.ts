import { test, expect, type Page } from "@playwright/test";
import { generateSync } from "otplib";
import {
  observeLoginResponse,
  registerFreshUser,
  TEST_PASSWORD,
  waitForLoginThrottleWindow,
} from "./helpers";

/**
 * Two-Factor Authentication E2E (pw6).
 * Seed the DB first: `npm run db:seed`.
 *
 * Covers the full TOTP lifecycle against a freshly-registered user (so the
 * seed admin's 2FA state is never mutated):
 *   1. Register (via registerFreshUser — register OTP step clicks
 *      "Verify & Continue", see helpers.ts) → Security Center → "Set up 2FA"
 *      → capture the secret → enter a generated code → 2FA active.
 *   2. Next sign-in requires a TOTP code; an invalid code is rejected.
 *   3. Disable 2FA from the Security Center (password confirmation).
 *
 * TOTP codes rotate every 30s, so the code is generated immediately before
 * each submission. otplib is the same library the app uses (src/lib/totp.ts).
 */

// TEST_PASSWORD (shared from ./helpers) must not be in HIBP breach corpora,
// since the register API runs a breach check.
let email = "";
let totpSecret = "";

/**
 * Generate a TOTP code that still has ~10s of validity left in the current
 * 30s window. Generating right at a window boundary is flaky under load: the
 * code can expire between generation and server-side verification.
 */
async function freshCode(secret: string) {
  const elapsed = Math.floor(Date.now() / 1000) % 30;
  if (elapsed > 20) {
    await new Promise((r) => setTimeout(r, (30 - elapsed) * 1000 + 1000));
  }
  return generateSync({ secret });
}

/**
 * Fill the login TOTP prompt. The prompt is the segmented 6-cell input with
 * an invisible overlay input (no placeholder) that AUTO-SUBMITS on the 6th
 * digit — so we fill and let it fire. Clicking the "Verify & Login" button
 * would race the auto-submit and hit a button that is already disabled.
 */
async function fillLoginTotp(page: Page, code: string) {
  await page.locator('input[inputmode="numeric"]').fill(code);
}

/**
 * Sign in through the verification-method chooser → authenticator step →
 * TOTP code. Every 2FA sign-in now lands on the chooser first.
 */
async function loginWithTotp(page: Page) {
  await page.goto("/en/login");
  await page.waitForLoadState("networkidle");
  await page.locator('input[type="email"]').fill(email);
  await page.getByPlaceholder("Enter password").fill(TEST_PASSWORD);
  // Inherit the suite's login-throttle backoff: back-to-back runs can trip the
  // 10-attempts/120s limit, and a throttled submit simply bounces back to
  // /en/login instead of reaching the TOTP step.
  await waitForLoginThrottleWindow();
  // Observe the password POST so a 429 lands in the shared backoff and the
  // retry below inherits the window instead of burning more attempts.
  const passwordPost = observeLoginResponse(
    page
      .waitForResponse((res) => res.url().includes("/api/auth/login"), { timeout: 60_000 })
      .catch(() => null),
  );
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await passwordPost;

  // The chooser replaces the login card; pick the authenticator app.
  await expect(page.getByRole("heading", { name: "Choose how to verify" })).toBeVisible();
  await page.getByRole("button", { name: /Use authenticator app/ }).click();

  // 2FA prompt replaces the login card (h1 t("auth.twoFactorAuth")).
  await expect(page.getByRole("heading", { name: "Two-Factor Auth", exact: true })).toBeVisible();
  // Generate the code as late as possible (right before submit).
  await fillLoginTotp(page, await freshCode(totpSecret));
  await expect(page).toHaveURL(/\/en\/dashboard/, { timeout: 20_000 });
}

test.describe("Two-Factor Authentication", () => {
  // Tests 2–4 depend on the email/secret captured in test 1; if the first
  // test fails, skip the dependents rather than fail them with a cryptic
  // SecretMissingError.
  test.describe.configure({ mode: "serial" });

  test("registers a user and enables 2FA from the Security Center", async ({ page }) => {
    email = `2fa-${Date.now()}@example.com`;

    // 1. Fresh user → dashboard. The fixed email is shared across the serial
    //    tests below via the module-level `email` variable.
    await registerFreshUser(page, { email, name: "2FA Test User" });

    // 2. Open the Security Center.
    await page.goto("/en/security");
    await expect(page.getByRole("heading", { name: "Security Center" })).toBeVisible();
    // Wait for client-side data + hydration before interacting (clicking the
    // button while the page is still hydrating silently drops the click).
    await expect(page.getByText("Not enabled").first()).toBeVisible();

    // 3. Start 2FA setup: the dialog (t("security.setup2FATitle")) shows the QR
    //    code and the manual secret key.
    await page.getByRole("button", { name: "Set up 2FA" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Set up two-factor authentication")).toBeVisible();

    // 4. Capture the secret — the <code> block shows it grouped in 4s and
    //    repeats it raw in an sr-only span; read the sr-only copy so the
    //    grouping never leaks in — and generate a code from it.
    const secretText =
      (await dialog.locator("code span.sr-only").textContent()) ??
      // Fallback: the grouped visible copy ends with the raw 32-char
      // duplicate, so strip whitespace and keep the tail.
      ((await dialog.locator("code").textContent()) ?? "").replace(/\s/g, "").slice(-32);
    totpSecret = secretText.replace(/\s/g, "");
    expect(totpSecret.length).toBeGreaterThanOrEqual(16);

    await dialog.getByPlaceholder("000000").fill(await freshCode(totpSecret));
    await dialog.getByRole("button", { name: "Verify", exact: true }).click();

    // 5. Success toast + card now shows the active state. The toast reads
    //    t("security.twoFAEnabledToast") and the card t("security.twoFAActive")
    //    — scope each: the toast lives in the sonner region, the status in
    //    <main>.
    await expect(
      page.getByLabel("Notifications alt+T").getByText("Two-factor authentication enabled"),
    ).toBeVisible();
    await expect(
      page.getByRole("main").getByText("Two-factor authentication is active"),
    ).toBeVisible();
  });

  test("trusts a device for 30 days, skips the chooser next time, and revokes it", async ({
    page,
  }, testInfo) => {
    testInfo.setTimeout(240_000); // A mid-test 429 backoff can sleep ~2 min.
    // 1. Sign in via the chooser WITHOUT trust (serial tests above already
    //    did that once — this run re-establishes the flow, then a second
    //    sign-in WITH trust demonstrates the skip).
    await page.goto("/en/login");
    await page.waitForLoadState("networkidle");
    await page.locator('input[type="email"]').fill(email);
    await page.getByPlaceholder("Enter password").fill(TEST_PASSWORD);
    await waitForLoginThrottleWindow();
    const firstTrustPost = observeLoginResponse(
      page
        .waitForResponse((res) => res.url().includes("/api/auth/login"), { timeout: 60_000 })
        .catch(() => null),
    );
    await page.getByRole("button", { name: "Log in", exact: true }).click();
    const firstTrust = await firstTrustPost;
    if (firstTrust && firstTrust.status() === 429) {
      await waitForLoginThrottleWindow();
      await page.getByRole("button", { name: "Log in", exact: true }).click();
    }
    await expect(page.getByRole("heading", { name: "Choose how to verify" })).toBeVisible();
    // The trust checkbox is offered on the chooser.
    await expect(page.getByRole("checkbox")).toBeVisible();
    await page.getByRole("button", { name: /Use authenticator app/ }).click();
    await expect(page.getByRole("heading", { name: "Two-Factor Auth", exact: true })).toBeVisible();
    // ... and again on the TOTP step. Check it there.
    await page.getByRole("checkbox").check();
    await fillLoginTotp(page, await freshCode(totpSecret));
    await expect(page).toHaveURL(/\/en\/dashboard/, { timeout: 20_000 });

    // 2. Fresh sign-in on the SAME browser context: the trust cookie skips
    //    the second factor entirely — password → dashboard, no chooser.
    //    (goto + wait for the form, not networkidle: the authenticated app
    //    keeps background traffic alive so networkidle can never settle.)
    await page.goto("/en/login");
    await expect(page.getByRole("textbox", { name: "Your email" })).toBeVisible();
    await page.locator('input[type="email"]').fill(email);
    await page.getByPlaceholder("Enter password").fill(TEST_PASSWORD);
    await waitForLoginThrottleWindow();
    const trustedPost = observeLoginResponse(
      page
        .waitForResponse((res) => res.url().includes("/api/auth/login"), { timeout: 60_000 })
        .catch(() => null),
    );
    await page.getByRole("button", { name: "Log in", exact: true }).click();
    const trustedRes = await trustedPost;
    if (trustedRes && trustedRes.status() === 429) {
      await waitForLoginThrottleWindow();
      await page.getByRole("button", { name: "Log in", exact: true }).click();
    }
    await expect(page).toHaveURL(/\/en\/dashboard/, { timeout: 20_000 });
    await expect(page.getByRole("heading", { name: "Choose how to verify" })).not.toBeVisible();

    // 3. The device shows up in the Security Center's Trusted devices card.
    await page.goto("/en/security");
    await expect(page.getByRole("heading", { name: "Security Center" })).toBeVisible();
    const trustedCard = page.getByRole("main").getByText("Trusted devices").first();
    await expect(trustedCard).toBeVisible();

    // 4. Revoke it → the next sign-in needs a second factor again.
    await page
      .getByRole("main")
      .getByRole("button", { name: /Revoke trusted device: Windows · Chrome/ })
      .first()
      .click();
    await expect(page.getByText("Device revoked", { exact: false }).first()).toBeVisible();

    await page.goto("/en/login");
    await expect(page.getByRole("textbox", { name: "Your email" })).toBeVisible();
    await page.locator('input[type="email"]').fill(email);
    await page.getByPlaceholder("Enter password").fill(TEST_PASSWORD);
    await waitForLoginThrottleWindow();
    const reTrustPost = observeLoginResponse(
      page
        .waitForResponse((res) => res.url().includes("/api/auth/login"), { timeout: 60_000 })
        .catch(() => null),
    );
    await page.getByRole("button", { name: "Log in", exact: true }).click();
    const reTrustRes = await reTrustPost;
    if (reTrustRes && reTrustRes.status() === 429) {
      await waitForLoginThrottleWindow();
      await page.getByRole("button", { name: "Log in", exact: true }).click();
    }
    await expect(page.getByRole("heading", { name: "Choose how to verify" })).toBeVisible();
    // Leave the account in a clean state for the final disable test.
    await page.getByRole("button", { name: /Use authenticator app/ }).click();
    await expect(page.getByRole("heading", { name: "Two-Factor Auth", exact: true })).toBeVisible();
    await fillLoginTotp(page, await freshCode(totpSecret));
    await expect(page).toHaveURL(/\/en\/dashboard/, { timeout: 20_000 });
  });

  test("requires a TOTP code at sign-in and rejects an invalid code", async ({ page }) => {
    // 1. Logged-out sign-in with 2FA-enabled account → the verification-method
    //    chooser appears first (new UX: 2FA users pick app vs. email code).
    await page.goto("/en/login");
    await page.waitForLoadState("networkidle");
    await page.locator('input[type="email"]').fill(email);
    await page.getByPlaceholder("Enter password").fill(TEST_PASSWORD);
    await page.getByRole("button", { name: "Log in", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Choose how to verify" })).toBeVisible();

    // 2. Choose the authenticator app → the TOTP prompt appears.
    await page.getByRole("button", { name: /Use authenticator app/ }).click();
    await expect(page.getByRole("heading", { name: "Two-Factor Auth", exact: true })).toBeVisible();

    // 2. A wrong code auto-submits on the 6th digit, is rejected (toast —
    //    either the server's message or t("auth.invalidCode")), and we stay
    //    on the prompt.
    await fillLoginTotp(page, "000000");
    await expect(page.locator("[data-sonner-toast]").getByText(/invalid/i)).toBeVisible();
    await expect(
      page.getByText("Enter the 6-digit code from your authenticator app"),
    ).toBeVisible();

    // 3. A fresh, correct code completes sign-in.
    await fillLoginTotp(page, await freshCode(totpSecret));
    await expect(page).toHaveURL(/\/en\/dashboard/, { timeout: 20_000 });
  });

  test("signs in with an emailed code chosen from the verification-method chooser", async ({
    page,
  }, testInfo) => {
    testInfo.setTimeout(240_000); // The 429 backoff itself can sleep ~2 min.
    // 1. Sign-in with the 2FA account → chooser. The throttle backoff waits
    //    the shared window out (earlier tests' attempts count toward the
    //    same per-IP limit), and a still-open window is absorbed below.
    await page.goto("/en/login");
    await page.waitForLoadState("networkidle");
    await page.locator('input[type="email"]').fill(email);
    await page.getByPlaceholder("Enter password").fill(TEST_PASSWORD);
    await waitForLoginThrottleWindow();
    const passwordPost = observeLoginResponse(
      page
        .waitForResponse((res) => res.url().includes("/api/auth/login"), { timeout: 60_000 })
        .catch(() => null),
    );
    await page.getByRole("button", { name: "Log in", exact: true }).click();
    const first = await passwordPost;
    // Throttled → wait out the window and submit once more.
    if (first && first.status() === 429) {
      await waitForLoginThrottleWindow();
      await page.getByRole("button", { name: "Log in", exact: true }).click();
    }
    await expect(page.getByRole("heading", { name: "Choose how to verify" })).toBeVisible();

    // 2. Pick "Email me a code" → the challenge request fires (password was
    //    already verified server-side, so issuing the code is safe) and the
    //    entry step renders. The dev server has no mailer, so the code is
    //    surfaced inline in a "Development OTP" block (scope to the card —
    //    the toast echoes the same words).
    await page.getByRole("button", { name: /Email me a code/ }).click();
    await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
    // The raw code sits in a tabular paragraph right under the "Development
    // OTP" caption (the toast echoes the caption, so match the caption's
    // sibling, not any getByText hit).
    const devCode =
      (await page
        .getByRole("paragraph")
        .filter({ hasText: /^\d{6}$/ })
        .textContent()) ?? "";
    expect(devCode).toMatch(/^\d{6}$/);

    // 3. Enter the emailed code → the chooser grants the same session as the
    //    TOTP path. The verify POST is another attempt against the same
    //    per-IP window as every earlier test in this serial run, so a 429
    //    here is throttle pressure, not a rejected code: wait out the
    //    Retry-After window (the rejected attempt drains the CodeSlots row)
    //    and re-enter the code once.
    const otpPost = observeLoginResponse(
      page
        .waitForResponse((res) => res.url().includes("/api/auth/login"), { timeout: 60_000 })
        .catch(() => null),
    );
    await page.locator('input[inputmode="numeric"]').fill(devCode);
    const otpRes = await otpPost;
    if (otpRes && otpRes.status() === 429) {
      await waitForLoginThrottleWindow();
      const otpRetry = observeLoginResponse(
        page
          .waitForResponse((res) => res.url().includes("/api/auth/login"), { timeout: 60_000 })
          .catch(() => null),
      );
      await page.locator('input[inputmode="numeric"]').fill(devCode);
      await otpRetry;
    }
    await expect(page).toHaveURL(/\/en\/dashboard/, { timeout: 20_000 });
  });

  test("disables 2FA from the Security Center with password confirmation", async ({ page }) => {
    // Sign in (requires TOTP) to reach the Security Center — the helper walks
    // the chooser → authenticator step → code.
    await loginWithTotp(page);

    await page.goto("/en/security");
    await expect(page.getByRole("heading", { name: "Security Center" })).toBeVisible();
    // Wait for the active state to render (client-side data + hydration done).
    await expect(page.getByText("Two-factor authentication is active")).toBeVisible();
    await page.getByRole("button", { name: "Disable 2FA" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Disable two-factor authentication?")).toBeVisible();
    await dialog.getByPlaceholder("Enter your current password").fill(TEST_PASSWORD);
    await dialog.getByRole("button", { name: "Disable 2FA" }).click();

    await expect(page.getByText("Two-factor authentication disabled")).toBeVisible();
    // Card reverts to the setup state.
    await expect(page.getByRole("button", { name: "Set up 2FA" })).toBeVisible();
  });

  test("signs in without a TOTP prompt after 2FA is disabled", async ({ page }) => {
    await page.goto("/en/login");
    await page.waitForLoadState("networkidle");
    await page.locator('input[type="email"]').fill(email);
    await page.getByPlaceholder("Enter password").fill(TEST_PASSWORD);
    await page.getByRole("button", { name: "Log in", exact: true }).click();

    // No 2FA screen — straight to the dashboard.
    await expect(page).toHaveURL(/\/en\/dashboard/, { timeout: 20_000 });
  });
});
