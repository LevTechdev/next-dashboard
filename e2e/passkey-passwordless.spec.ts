import { test, expect, type Page } from "@playwright/test";
import { fillRegistrationForm, logoutViaHeader, waitForLoginThrottleWindow } from "./helpers";

/**
 * Passwordless passkey sign-in (pw7).
 * Seed the DB first: `npm run db:seed`.
 *
 * The fingerprint button on /login runs the WebAuthn ceremony WITHOUT an
 * email: the options step omits `allowCredentials`, so the authenticator
 * offers its discoverable (resident) credentials and the user picks one.
 * The verify endpoint resolves the account from the asserted credential and
 * issues the session — no password step anywhere.
 *
 * WebAuthn is driven by Chromium's CDP virtual authenticator (same harness
 * as passkey-second-factor.spec.ts, which proves the SECOND-FACTOR branch).
 * Here the credential is registered with `residentKey: "preferred"` on an
 * authenticator with `hasResidentKey: true`, so the allowCredentials-less
 * ceremony can actually discover it — a non-resident credential would not
 * be offered, which is exactly the behavior under test.
 */

/** Attach a virtual resident-key authenticator to the page's CDP session. */
async function addVirtualAuthenticator(page: Page): Promise<string> {
  const client = await page.context().newCDPSession(page);
  await client.send("WebAuthn.enable");
  const { authenticatorId } = (await client.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      protocol: "ctap2",
      transport: "internal",
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  })) as { authenticatorId: string };
  return authenticatorId;
}

/**
 * Register an unverified user and land on the dashboard (same contract as
 * passkey-second-factor.spec.ts: the register POST can take ~29s under load,
 * so the OTP-heading wait carries extra headroom).
 */
async function registerUser(page: Page, email: string): Promise<void> {
  await page.goto("/en/register");
  await page.waitForLoadState("networkidle");
  await fillRegistrationForm(page, email, { name: "Passwordless User" });
  await expect(page.getByRole("heading", { name: "Verify your email" })).toBeVisible({
    timeout: 60_000,
  });
  await page.goto("/en/dashboard");
  await expect(page).toHaveURL(/\/en\/dashboard/);
}

/** Security Center → register a passkey through the virtual authenticator. */
async function registerPasskey(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Add a passkey" }).click();
  await expect(page.getByRole("button", { name: "Passkey Registered" })).toBeVisible({
    timeout: 30_000,
  });
}

test.describe("Passwordless passkey sign-in", () => {
  test("signs in with no email and no password", async ({ page }) => {
    test.setTimeout(300_000);
    const email = `passkeyless-${Date.now()}@example.com`;
    await addVirtualAuthenticator(page);

    await registerUser(page, email);
    await page.goto("/en/security");
    await expect(page.getByRole("heading", { name: "Security Center" })).toBeVisible();
    await registerPasskey(page);
    await logoutViaHeader(page);

    // The button must be present BEFORE any email is typed — that is the
    // whole point of discoverable credentials.
    await page.goto("/en/login");
    const fingerprint = page.getByRole("button", { name: "Sign in with a passkey" });
    await expect(fingerprint).toBeVisible();
    await expect(
      page.locator('form:visible:has(input[type="password"]) input[type="email"]'),
    ).toHaveValue("");

    await waitForLoginThrottleWindow();
    await fingerprint.click();

    await expect(page).toHaveURL(/\/en\/dashboard/, { timeout: 30_000 });
  });

  test("stays on the login page when no credential answers", async ({ page }) => {
    test.setTimeout(120_000);
    // No virtual authenticator attached: PublicKeyCredential exists (so the
    // button renders) but the ceremony cannot complete. The user must land
    // back on the form with an error toast, never a broken half-login.
    await page.goto("/en/login");
    const fingerprint = page.getByRole("button", { name: "Sign in with a passkey" });
    await expect(fingerprint).toBeVisible();

    await waitForLoginThrottleWindow();
    await fingerprint.click();

    await expect(page).toHaveURL(/\/en\/login/, { timeout: 30_000 });
    await expect(
      page.locator('form:visible:has(input[type="password"]) input[type="email"]'),
    ).toBeVisible();
    await expect(page.locator("[data-sonner-toast]").first()).toBeVisible({ timeout: 10_000 });
  });
});
