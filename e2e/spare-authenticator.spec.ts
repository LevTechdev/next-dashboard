import { test, expect, type Page } from "@playwright/test";
import { generateSync } from "otplib";
import {
  observeLoginResponse,
  registerFreshUser,
  TEST_PASSWORD,
  waitForLoginThrottleWindow,
} from "./helpers";

/**
 * The spare authenticator (E2E).
 *
 * The failure this feature exists for: the phone holding the primary TOTP
 * secret is gone. Before it, the only ways back in were a backup recovery code
 * or an emailed account recovery that turns 2FA OFF — both worse than the
 * factor the user already has.
 *
 * This spec proves the real path end to end: enroll a SECOND authenticator with
 * a secret of its own, then sign in using a code generated from the SPARE
 * secret only, with the primary device deliberately never consulted.
 *
 * Serial: test 2 reuses the account and the spare secret captured in test 1.
 */

let email = "";
let primarySecret = "";
let spareSecret = "";

/**
 * A TOTP code with ~10s of validity left. Codes rotate every 30s, so a code
 * generated on a boundary can expire between generation and verification.
 * otplib is the same library the app verifies with (src/lib/totp.ts).
 */
async function freshCode(secret: string) {
  const elapsed = Math.floor(Date.now() / 1000) % 30;
  if (elapsed > 20) {
    await new Promise((r) => setTimeout(r, (30 - elapsed) * 1000 + 1000));
  }
  return generateSync({ secret });
}

/** Sign in with the SPARE device: chooser → authenticator app → spare code. */
async function loginWithSpare(page: Page) {
  await page.goto("/en/login");
  await expect(page.getByRole("textbox", { name: "Your email" })).toBeVisible();
  await page.locator('input[type="email"]').fill(email);
  await page.getByPlaceholder("Enter password").fill(TEST_PASSWORD);

  // Inherit the suite's throttle backoff: back-to-back spec runs share one
  // per-IP window, and a 429 here simply bounces back to /en/login.
  await waitForLoginThrottleWindow();
  const passwordPost = observeLoginResponse(
    page
      .waitForResponse((res) => res.url().includes("/api/auth/login"), { timeout: 60_000 })
      .catch(() => null),
  );
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  const first = await passwordPost;
  if (first && first.status() === 429) {
    await waitForLoginThrottleWindow();
    await page.getByRole("button", { name: "Log in", exact: true }).click();
  }

  await expect(page.getByRole("heading", { name: "Choose how to verify" })).toBeVisible();
  await page.getByRole("button", { name: /Use authenticator app/ }).click();
  await expect(page.getByRole("heading", { name: "Two-Factor Auth", exact: true })).toBeVisible();

  // The code comes from the SPARE secret. The primary one is never used here.
  await page.locator('input[inputmode="numeric"]').fill(await freshCode(spareSecret));
  await expect(page).toHaveURL(/\/en\/dashboard/, { timeout: 20_000 });
}

test.describe("Spare authenticator", () => {
  test.describe.configure({ mode: "serial" });

  test("enrolls a second authenticator on another device", async ({ page }) => {
    email = `spare-${Date.now()}@example.com`;
    await registerFreshUser(page, { email, name: "Spare Device User" });

    // ── Primary 2FA first: a spare only means something next to a factor. ──
    await page.goto("/en/security");
    await expect(page.getByRole("heading", { name: "Security Center" })).toBeVisible();
    await expect(page.getByText("Not enabled").first()).toBeVisible();

    await page.getByRole("button", { name: "Set up 2FA" }).click();
    const setupDialog = page.getByRole("dialog");
    await expect(setupDialog.getByText("Set up two-factor authentication")).toBeVisible();
    primarySecret = (
      (await setupDialog.locator("code span.sr-only").textContent()) ??
      ((await setupDialog.locator("code").textContent()) ?? "").replace(/\s/g, "").slice(-32)
    ).replace(/\s/g, "");
    expect(primarySecret.length).toBeGreaterThanOrEqual(16);

    await setupDialog.getByPlaceholder("000000").fill(await freshCode(primarySecret));
    await setupDialog.getByRole("button", { name: "Verify", exact: true }).click();
    await expect(
      page.getByRole("main").getByText("Two-factor authentication is active"),
    ).toBeVisible();

    // ── The spare. ──
    const spareCard = page.getByTestId("backup-authenticator-card");
    await expect(spareCard).toBeVisible();
    await spareCard.getByRole("button", { name: /Add spare device/ }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Add spare device")).toBeVisible();

    // The dialog shows a secret AND a QR for it. Read the secret so a code can
    // be generated independently of the primary authenticator.
    spareSecret = ((await dialog.locator("code").textContent()) ?? "").replace(/\s/g, "");
    expect(spareSecret.length).toBeGreaterThanOrEqual(16);
    // A spare that reused the primary secret would be no spare at all.
    expect(spareSecret).not.toBe(primarySecret);

    await dialog.getByLabel("Device name").fill("office iPad");
    await dialog.getByLabel("Verification code").fill(await freshCode(spareSecret));
    await dialog.getByRole("button", { name: "Verify", exact: true }).click();

    // Enrolled: the card names the device and stops offering enrollment.
    await expect(page.getByText("office iPad")).toBeVisible();
    await expect(spareCard.getByText(/not used for a sign-in yet/)).toBeVisible();
    await expect(spareCard.getByRole("button", { name: /Remove spare device/ })).toBeVisible();
  });

  test("signs in with the spare after the primary device is gone", async ({ page, context }) => {
    test.setTimeout(240_000); // A mid-test 429 backoff can sleep ~2 min.
    expect(spareSecret.length).toBeGreaterThanOrEqual(16);

    // "Lose" the primary device: drop every cookie and sign in again.
    await context.clearCookies();
    await loginWithSpare(page);

    // The sign-in is audited as a spare-device verification, not a plain TOTP.
    await page.goto("/en/security");
    const activity = page.getByRole("main").getByText("Security activity").first();
    await expect(activity).toBeVisible();
    await expect(page.getByRole("main").getByText("Multi-factor verified").first()).toBeVisible();

    // …and the spare records the use, which is what proves it saved someone.
    await expect(
      page.getByTestId("backup-authenticator-card").getByText(/Last used/),
    ).toBeVisible();
  });
});
