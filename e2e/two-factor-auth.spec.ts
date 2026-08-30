import { test, expect, type Page } from "@playwright/test";
import { generateSync } from "otplib";
import { registerFreshUser, TEST_PASSWORD } from "./helpers";

/**
 * Two-Factor Authentication E2E (pw6).
 * Seed the DB first: `npm run db:seed`.
 *
 * Covers the full TOTP lifecycle against a freshly-registered user (so the
 * seed admin's 2FA state is never mutated):
 *   1. Register → Security Center → "Set up 2FA" → capture the secret →
 *      enter a generated code → 2FA active.
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

async function loginWithTotp(page: Page) {
  await page.goto("/en/login");
  await page.waitForLoadState("networkidle");
  await page.getByPlaceholder("nextdashboards@gmail.com").fill(email);
  await page.getByPlaceholder("Enter your password").fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();

  // 2FA prompt replaces the login card.
  await expect(page.getByText("Enter the 6-digit code from your authenticator app")).toBeVisible();
  // Generate the code as late as possible (right before submit).
  await page.getByPlaceholder("000000").fill(await freshCode(totpSecret));
  await page.getByRole("button", { name: /Verify & Login/i }).click();
  await expect(page).toHaveURL(/\/en\/dashboard/);
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

    // 3. Start 2FA setup: dialog shows QR + secret.
    await page.getByRole("button", { name: "Set up 2FA" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Set up two-factor authentication")).toBeVisible();
    await expect(dialog.locator("img[alt='TOTP QR Code']")).toBeVisible();

    // 4. Capture the secret (displayed grouped in 4s) and generate a code.
    const secretText = (await dialog.locator("code").textContent()) ?? "";
    totpSecret = secretText.replace(/\s/g, "");
    expect(totpSecret.length).toBeGreaterThanOrEqual(16);

    await dialog.getByPlaceholder("000000").fill(await freshCode(totpSecret));
    await dialog.getByRole("button", { name: "Enable 2FA" }).click();

    // 5. Success toast + card now shows the active state. The toast and the
    //    card status both read "Two-factor authentication enabled", so scope
    //    each: the toast lives in the sonner region, the status in <main>.
    await expect(
      page.getByLabel("Notifications alt+T").getByText("Two-factor authentication enabled"),
    ).toBeVisible();
    await expect(
      page.getByRole("main").getByText("Two-factor authentication enabled"),
    ).toBeVisible();
    await expect(page.getByText("Two-factor authentication is active")).toBeVisible();
  });

  test("requires a TOTP code at sign-in and rejects an invalid code", async ({ page }) => {
    // 1. Logged-out sign-in with 2FA-enabled account → TOTP prompt appears.
    await page.goto("/en/login");
    await page.waitForLoadState("networkidle");
    await page.getByPlaceholder("nextdashboards@gmail.com").fill(email);
    await page.getByPlaceholder("Enter your password").fill(TEST_PASSWORD);
    await page.getByRole("button", { name: "Sign In", exact: true }).click();
    await expect(page.getByText("Two-Factor Authentication")).toBeVisible();

    // 2. A wrong code is rejected and we stay on the prompt.
    await page.getByPlaceholder("000000").fill("000000");
    await page.getByRole("button", { name: /Verify & Login/i }).click();
    await expect(page.getByText(/invalid two-factor|invalid code/i)).toBeVisible();
    await expect(page.getByText("Enter the 6-digit code from your authenticator app")).toBeVisible();

    // 3. A fresh, correct code completes sign-in.
    const code = await freshCode(totpSecret);
    await page.getByPlaceholder("000000").fill(code);
    await page.getByRole("button", { name: /Verify & Login/i }).click();
    await expect(page).toHaveURL(/\/en\/dashboard/);
  });

  test("disables 2FA from the Security Center with password confirmation", async ({ page }) => {
    // Sign in (requires TOTP) to reach the Security Center.
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
    await page.getByPlaceholder("nextdashboards@gmail.com").fill(email);
    await page.getByPlaceholder("Enter your password").fill(TEST_PASSWORD);
    await page.getByRole("button", { name: "Sign In", exact: true }).click();

    // No 2FA screen — straight to the dashboard.
    await expect(page).toHaveURL(/\/en\/dashboard/);
  });
});
