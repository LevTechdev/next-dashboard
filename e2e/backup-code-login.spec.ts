import { test, expect, type Page } from "@playwright/test";
import { generateSync } from "otplib";
import {
  observeLoginResponse,
  registerFreshUser,
  TEST_PASSWORD,
  waitForLoginThrottleWindow,
} from "./helpers";

/**
 * Backup-code recovery login E2E.
 * Seed the DB first: `npm run db:seed`.
 *
 * The failure this spec exists to prevent: a user enables 2FA, loses the
 * authenticator (phone wiped, app reinstalled, device gone) and is then locked
 * out of their own account forever. The server has always accepted `backupCode`
 * as the second factor — but nothing in the UI ever sent one, so the codes in
 * the Security Center were decorative. This drives the real recovery path:
 *
 *   1. Register a fresh user → enable TOTP 2FA → generate the 10 backup codes.
 *   2. Next sign-in, without any authenticator: password → method chooser →
 *      "Use a backup code" → one saved code → dashboard.
 *   3. Replay that same code: rejected (single-use), and a different code from
 *      the same set still works — so the rejection is the code being spent, not
 *      a broken recovery step.
 *
 * The account is deliberately fresh so the seed admin's 2FA state is untouched.
 */

// TEST_PASSWORD (shared from ./helpers) must not be in HIBP breach corpora,
// since the register API runs a breach check.
let email = "";
let totpSecret = "";
let backupCodes: string[] = [];

/**
 * Generate a TOTP code with ~10s of validity left in the current 30s window —
 * generating on a boundary lets the code expire between fill and verify.
 */
async function freshCode(secret: string) {
  const elapsed = Math.floor(Date.now() / 1000) % 30;
  if (elapsed > 20) {
    await new Promise((r) => setTimeout(r, (30 - elapsed) * 1000 + 1000));
  }
  return generateSync({ secret });
}

/**
 * Password step → the verification-method chooser.
 *
 * Every 2FA sign-in lands on the chooser first. The password POST counts toward
 * the per-IP 10-attempts/120s login throttle, so the shared backoff is awaited
 * before submitting and a 429 is absorbed with one retry after the window.
 */
async function submitPasswordAndReachChooser(page: Page) {
  await page.goto("/en/login");
  await expect(page.getByRole("textbox", { name: "Your email" })).toBeVisible();
  await page.locator('input[type="email"]').fill(email);
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

/** Chooser → the backup-code (recovery) step. */
async function openBackupCodeStep(page: Page) {
  await page.getByRole("button", { name: /Use a backup code/ }).click();
  await expect(page.getByRole("heading", { name: "Enter a backup code" })).toBeVisible();
}

/** Fill the recovery step and submit. */
async function submitBackupCode(page: Page, code: string) {
  await page.getByPlaceholder("xxxx-xxxx").fill(code);
  await page.getByRole("button", { name: /Verify & Login/ }).click();
}

test.describe("Backup-code recovery login", () => {
  // Tests 2–3 need the email, secret, and codes captured in test 1.
  test.describe.configure({ mode: "serial" });

  test("generates a backup-code set alongside enabling 2FA", async ({ page }) => {
    email = `backup-${Date.now()}@example.com`;

    // 1. Fresh user → dashboard (register → OTP view → dashboard).
    await registerFreshUser(page, { email, name: "Backup Code User" });

    // 2. 2FA must be on, otherwise the login route never asks for a second
    //    factor and the recovery path is unreachable.
    await page.goto("/en/security");
    await expect(page.getByRole("heading", { name: "Security Center" })).toBeVisible();
    await expect(page.getByText("Not enabled").first()).toBeVisible();
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

    // 3. Generate the recovery set. A fresh account has zero codes, so no
    //    regenerate confirmation is raised on this first pass.
    await expect(page.getByRole("main").getByText("Backup Recovery Codes").first()).toBeVisible();
    await page.getByRole("button", { name: "Generate codes" }).click();

    const codeEls = page.getByTestId("backup-code");
    await expect(codeEls).toHaveCount(10);
    backupCodes = (await codeEls.allTextContents()).map((c) => c.trim());
    // The displayed set is the real, usable material: xxxx-xxxx lowercase hex.
    for (const code of backupCodes) {
      expect(code).toMatch(/^[0-9a-f]{4}-[0-9a-f]{4}$/);
    }
  });

  test("signs in with a saved code when the authenticator is gone", async ({ page }) => {
    await submitPasswordAndReachChooser(page);
    // The recovery path is offered on the chooser, not buried elsewhere.
    await expect(page.getByRole("button", { name: /Use a backup code/ })).toBeVisible();

    await openBackupCodeStep(page);
    // A backup code is a full second factor, so "trust this device" applies.
    await expect(page.getByRole("checkbox")).toBeVisible();

    // Typed codes are grouped as xxxx-xxxx as they are entered.
    await page.getByPlaceholder("xxxx-xxxx").fill(backupCodes[0]);
    await expect(page.getByPlaceholder("xxxx-xxxx")).toHaveValue(backupCodes[0]);
    await page.getByRole("button", { name: /Verify & Login/ }).click();

    await expect(page).toHaveURL(/\/en\/dashboard/, { timeout: 20_000 });

    // The code is burned on use — the Security Center ledger reflects it.
    await page.goto("/en/security");
    await expect(page.getByRole("main").getByText("9 unused code(s) remaining")).toBeVisible();
  });

  test("rejects a replayed code but still accepts a fresh one", async ({ page }, testInfo) => {
    testInfo.setTimeout(240_000); // A mid-test 429 backoff can sleep ~2 min.

    await submitPasswordAndReachChooser(page);
    await openBackupCodeStep(page);

    // Replay: the code spent by the previous test must not work again.
    await submitBackupCode(page, backupCodes[0]);
    await expect(
      page
        .getByLabel("Notifications alt+T")
        .getByText("That backup code is wrong or has already been used."),
    ).toBeVisible();
    // A rejected code leaves the user on the recovery step, not locked out.
    await expect(page.getByRole("heading", { name: "Enter a backup code" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Choose how to verify" })).not.toBeVisible();

    // The recovery tool itself still works with an unused code.
    await submitBackupCode(page, backupCodes[1]);
    await expect(page).toHaveURL(/\/en\/dashboard/, { timeout: 20_000 });

    await page.goto("/en/security");
    await expect(page.getByRole("main").getByText("8 unused code(s) remaining")).toBeVisible();
  });
});
