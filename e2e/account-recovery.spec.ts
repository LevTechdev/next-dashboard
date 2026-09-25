import { test, expect, type Page } from "@playwright/test";
import { generateSync } from "otplib";
import {
  observeLoginResponse,
  registerFreshUser,
  TEST_PASSWORD,
  waitForLoginThrottleWindow,
} from "./helpers";

/**
 * Account recovery E2E — the last resort.
 * Seed the DB first: `npm run db:seed`.
 *
 * The scenario: the user enabled 2FA, then lost the phone (authenticator) AND
 * every backup recovery code. Before this flow existed the account was simply
 * unreachable — the backup codes only worked if the user had kept them.
 *
 *   1. Register a fresh user and enable TOTP.
 *   2. Sign-in attempt → chooser → "Lost your authenticator and your recovery
 *      codes?" → request the emailed recovery link (password required).
 *   3. Follow the link: 2FA is turned OFF, other sessions are revoked, and the
 *      user lands signed in on the Security Center.
 *   4. The recovered account signs in with the password alone — no second
 *      factor — which is the actual proof that access was restored.
 *
 * The emailed link is surfaced inline because the E2E server runs with the
 * mailer blanked (same dev contract as forgot-password).
 */

let email = "";
let totpSecret = "";

/** Generate a TOTP code with ~10s of validity left in the current window. */
async function freshCode(secret: string) {
  const elapsed = Math.floor(Date.now() / 1000) % 30;
  if (elapsed > 20) {
    await new Promise((r) => setTimeout(r, (30 - elapsed) * 1000 + 1000));
  }
  return generateSync({ secret });
}

/** Password step → the verification-method chooser (throttle-aware). */
async function submitPasswordAndReachChooser(page: Page) {
  await page.goto("/en/login");
  await expect(page.getByRole("textbox", { name: "Your email" })).toBeVisible();
  await page.locator('form:visible:has(input[type="password"]) input[type="email"]').fill(email);
  await page.getByPlaceholder("Enter password").fill(TEST_PASSWORD);

  await waitForLoginThrottleWindow();
  const post = observeLoginResponse(
    page
      .waitForResponse((res) => res.url().includes("/api/auth/login"), { timeout: 60_000 })
      .catch(() => null),
  );
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  const res = await post;
  if (res && res.status() === 429) {
    await waitForLoginThrottleWindow();
    await page.getByRole("button", { name: "Log in", exact: true }).click();
  }
  await expect(page.getByRole("heading", { name: "Choose how to verify" })).toBeVisible();
}

test.describe("Account recovery (authenticator AND recovery codes lost)", () => {
  test.describe.configure({ mode: "serial" });

  test("enables 2FA, requests a recovery link, and completes it", async ({ page }, testInfo) => {
    testInfo.setTimeout(240_000); // A mid-test 429 backoff can sleep ~2 min.
    email = `recovery-${Date.now()}@example.com`;

    // 1. Fresh user with 2FA on — otherwise there is nothing to recover.
    await registerFreshUser(page, { email, name: "Recovery Test User" });
    await page.goto("/en/security");
    await expect(page.getByRole("heading", { name: "Security Center" })).toBeVisible();
    await expect(page.getByText("Not enabled").first()).toBeVisible();
    // The recovery-readiness panel renders its own "Set up 2FA" CTA — scope
    // to the TOTP card or strict mode sees two buttons.
    await page.locator("#totp-card").getByRole("button", { name: "Set up 2FA" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Set up two-factor authentication")).toBeVisible();
    const secretText =
      (await dialog.locator("code span.sr-only").textContent()) ??
      ((await dialog.locator("code").textContent()) ?? "").replace(/\s/g, "").slice(-32);
    totpSecret = secretText.replace(/\s/g, "");
    expect(totpSecret.length).toBeGreaterThanOrEqual(16);
    await dialog.getByPlaceholder("000000").fill(await freshCode(totpSecret));
    await dialog.getByRole("button", { name: "Verify", exact: true }).click();
    await expect(
      page.getByLabel("Notifications alt+T").getByText("Two-factor authentication enabled"),
    ).toBeVisible();

    // 2. Locked out: reach the last resort from the chooser.
    await submitPasswordAndReachChooser(page);
    await page.getByRole("button", { name: /Lost your authenticator/ }).click();
    await expect(
      page.getByRole("heading", { name: "Recover access to your account" }),
    ).toBeVisible();
    // The warning states the security cost up front: 2FA is switched OFF.
    await expect(page.getByText(/turns two-factor authentication OFF/i)).toBeVisible();

    await page.getByRole("button", { name: /Email me a recovery link/ }).click();
    await expect(page.getByRole("heading", { name: "Check your inbox" })).toBeVisible();

    // Dev contract (no mailer configured): the link is rendered inline.
    const devLink = page.locator('a[href*="/api/auth/account-recovery/confirm?token="]').first();
    await expect(devLink).toBeVisible();
    const recoveryUrl = (await devLink.getAttribute("href")) ?? "";
    expect(recoveryUrl).toContain("/confirm?token=");

    // 3. Completing it signs the user in and lands on the Security Center.
    //    The URL check stays loose on purpose: the page strips `?recovered=1`
    //    as it shows the toast, so asserting the exact query would race it.
    await page.goto(recoveryUrl);
    await expect(page).toHaveURL(/\/en\/security/, { timeout: 30_000 });
    await expect(
      page.getByLabel("Notifications alt+T").getByText("Two-factor authentication was turned off"),
    ).toBeVisible();

    // 2FA really is off, not merely toasted about.
    await expect(page.getByRole("main").getByText("Not enabled").first()).toBeVisible();

    // The audit trail renders the recovery under its localized label — this is
    // the same dynamic `evt_*` lookup that once shipped a raw MISSING_MESSAGE.
    await expect(
      page.getByRole("main").getByText("Account recovery link requested").first(),
    ).toBeVisible();

    // 4. The token is single-use: following the same link again is refused and
    //    the login form explains why (it strips the query too).
    await page.goto(recoveryUrl);
    await expect(page).toHaveURL(/\/en\/login/, { timeout: 30_000 });
    await expect(
      page
        .getByLabel("Notifications alt+T")
        .getByText("That recovery link is not valid or was already used. Request a new one."),
    ).toBeVisible();
  });

  test("the recovered account signs in with the password alone", async ({ page }) => {
    // The whole point: the second factor is gone, so the password is now the
    // only step. (A fresh context starts signed out.)
    await page.goto("/en/login");
    await expect(page.getByRole("textbox", { name: "Your email" })).toBeVisible();
    await page.locator('form:visible:has(input[type="password"]) input[type="email"]').fill(email);
    await page.getByPlaceholder("Enter password").fill(TEST_PASSWORD);
    await waitForLoginThrottleWindow();
    const post = observeLoginResponse(
      page
        .waitForResponse((res) => res.url().includes("/api/auth/login"), { timeout: 60_000 })
        .catch(() => null),
    );
    await page.getByRole("button", { name: "Log in", exact: true }).click();
    const res = await post;
    if (res && res.status() === 429) {
      await waitForLoginThrottleWindow();
      await page.getByRole("button", { name: "Log in", exact: true }).click();
    }

    await expect(page).toHaveURL(/\/en\/dashboard/, { timeout: 20_000 });
    await expect(page.getByRole("heading", { name: "Choose how to verify" })).not.toBeVisible();
  });
});
