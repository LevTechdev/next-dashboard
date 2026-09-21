import { test, expect, type Page } from "@playwright/test";
import { generateSync } from "otplib";
import {
  fillRegistrationForm,
  logoutViaHeader,
  observeLoginResponse,
  TEST_PASSWORD,
  waitForLoginThrottleWindow,
} from "./helpers";

/**
 * Passkey as a first-class second factor (pw6).
 * Seed the DB first: `npm run db:seed`.
 *
 * The verification-method chooser offers three ways to finish a 2FA sign-in.
 * This spec proves the passkey branch end-to-end for a user who has BOTH
 * authenticator-app and passkey registered: password → chooser → passkey
 * assertion → session, then (still in the same test) password → chooser →
 * authenticator app → TOTP → session, so neither branch can regress silently.
 *
 * WebAuthn is driven by Chromium's CDP virtual authenticator — no hardware,
 * no OS prompt. The second test deliberately configures an authenticator that
 * CANNOT perform user verification (`hasUserVerification: false`, a bare
 * roaming key), so both ceremonies report UV=0. That is the shape that used to
 * fail: the options step asks for `userVerification: "preferred"` while
 * @simplewebauthn/server's `requireUserVerification` DEFAULTS to `true`, so the
 * server threw and the client only ever saw "Passkey verification failed".
 * Both verify routes now pass `requireUserVerification: false` to match the
 * options, and that test fails if either one drifts back.
 *
 * (A `hasUserVerification: true, isUserVerified: false` authenticator cannot
 * be used for this: Chrome rejects a create() ceremony on it with
 * NotAllowedError before the request ever reaches the server.)
 */

/**
 * Generate a TOTP code with ~10s of validity left. Generating right at a
 * window boundary is flaky under load: the code can expire between generation
 * and server-side verification.
 */
async function freshCode(secret: string) {
  const elapsed = Math.floor(Date.now() / 1000) % 30;
  if (elapsed > 20) {
    await new Promise((r) => setTimeout(r, (30 - elapsed) * 1000 + 1000));
  }
  return generateSync({ secret });
}

/**
 * How much the virtual authenticator can prove. "uv" is a platform
 * authenticator (Touch ID / Windows Hello) that verifies the user; "no-uv" is
 * a bare roaming key that reports UV=0 on every ceremony.
 */
type AuthenticatorKind = "uv" | "no-uv";

/**
 * Attach a virtual authenticator to this page's CDP session. It stays
 * attached across navigations on the same `page`, which is what lets one
 * test register a passkey in the Security Center and then use it on /login.
 */
async function addVirtualAuthenticator(page: Page, kind: AuthenticatorKind): Promise<string> {
  const client = await page.context().newCDPSession(page);
  await client.send("WebAuthn.enable");
  const { authenticatorId } = (await client.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      protocol: "ctap2",
      transport: "internal",
      hasResidentKey: true,
      hasUserVerification: kind === "uv",
      isUserVerified: kind === "uv",
      automaticPresenceSimulation: true,
    },
  })) as { authenticatorId: string };
  return authenticatorId;
}

/**
 * Register an unverified user and land on the dashboard.
 *
 * Same contract as the shared `registerFreshUser`, but with headroom: the
 * register route hashes the password with argon2 (memory-hard by design) and
 * runs an HIBP breach check, and under this suite's load a single POST has
 * been measured at 29s — past the suite-wide 20s expect timeout the shared
 * helper waits with. The form fill itself is still the shared one, so the
 * selector contract stays in one place.
 */
async function registerUser(page: Page, email: string): Promise<void> {
  await page.goto("/en/register");
  // networkidle = hydration + initial client fetches are done, so fills land
  // on the hydrated form (fills during hydration are silently dropped).
  await page.waitForLoadState("networkidle");
  await fillRegistrationForm(page, email, { name: "Passkey Test User" });
  // The OTP step appearing is the signal that the signup succeeded. Scoped to
  // the heading role: getByText would also match the route announcer.
  await expect(page.getByRole("heading", { name: "Verify your email" })).toBeVisible({
    timeout: 60_000,
  });
  // Leave the account unverified: the register API already set the session
  // cookie, so navigating to the dashboard preserves the unverified state.
  await page.goto("/en/dashboard");
  await expect(page).toHaveURL(/\/en\/dashboard/);
}

/** Security Center → enable TOTP, returning the shared secret. */
async function enableTotp(page: Page): Promise<string> {
  await expect(page.getByText("Not enabled").first()).toBeVisible();
  await page.getByRole("button", { name: "Set up 2FA" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Set up two-factor authentication")).toBeVisible();

  // The <code> block repeats the secret in an sr-only span, so read that copy
  // and never the grouped visible one.
  const secret =
    ((await dialog.locator("code span.sr-only").textContent()) ?? "").replace(/\s/g, "") ||
    ((await dialog.locator("code").textContent()) ?? "").replace(/\s/g, "").slice(-32);
  expect(secret.length).toBeGreaterThanOrEqual(16);

  await dialog.getByPlaceholder("000000").fill(await freshCode(secret));
  await dialog.getByRole("button", { name: "Verify", exact: true }).click();
  await expect(
    page.getByRole("main").getByText("Two-factor authentication is active"),
  ).toBeVisible();
  return secret;
}

/** Security Center → register a passkey through the virtual authenticator. */
async function registerPasskey(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Add a passkey" }).click();
  // Success flips the button to the registered state; a rejected ceremony
  // leaves it as "Add a passkey" plus an error toast.
  await expect(page.getByRole("button", { name: "Passkey Registered" })).toBeVisible({
    timeout: 30_000,
  });
}

/**
 * Create a 2FA + passkey account and sign out, ready for a chooser sign-in.
 * The virtual authenticator is attached BEFORE any navigation so the same
 * credential is available for registration and for the later login.
 */
async function provisionPasskeyUser(
  page: Page,
  kind: AuthenticatorKind,
): Promise<{ email: string; totpSecret: string; authenticatorId: string }> {
  const email = `passkey-${kind}-${Date.now()}@example.com`;
  const authenticatorId = await addVirtualAuthenticator(page, kind);

  await registerUser(page, email);

  await page.goto("/en/security");
  await expect(page.getByRole("heading", { name: "Security Center" })).toBeVisible();
  const totpSecret = await enableTotp(page);
  await registerPasskey(page);
  await logoutViaHeader(page);

  return { email, totpSecret, authenticatorId };
}

/**
 * Email + password → the chooser. The login POST is observed so a 429 lands in
 * the shared throttle backoff and is retried once instead of failing the test.
 */
async function passwordToChooser(page: Page, email: string): Promise<void> {
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

test.describe("Passkey second factor", () => {
  test("offers both second factors and signs in with each", async ({ page }) => {
    test.setTimeout(300_000);
    const { email, totpSecret } = await provisionPasskeyUser(page, "uv");

    await passwordToChooser(page, email);

    // All three methods are offered; the passkey card is present only because
    // the account actually has one registered.
    await expect(page.getByRole("button", { name: /Use authenticator app/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Email me a code/ })).toBeVisible();
    const passkeyCard = page.getByRole("button", { name: /Use a passkey/ });
    await expect(passkeyCard).toBeVisible();

    // Branch A — passkey. The virtual authenticator answers the assertion, the
    // login route consumes the second-factor marker and issues the session.
    await passkeyCard.click();
    await expect(page).toHaveURL(/\/en\/dashboard/, { timeout: 30_000 });

    // Branch B — the SAME account still signs in with the authenticator app,
    // proving the chooser routes both second factors for one user.
    await logoutViaHeader(page);
    await passwordToChooser(page, email);
    await page.getByRole("button", { name: /Use authenticator app/ }).click();
    await expect(page.getByRole("heading", { name: "Two-Factor Auth", exact: true })).toBeVisible();
    // The segmented input auto-submits on the 6th digit; clicking the button
    // would race an already-disabled control.
    await page.locator('input[inputmode="numeric"]').fill(await freshCode(totpSecret));
    await expect(page).toHaveURL(/\/en\/dashboard/, { timeout: 20_000 });
  });

  test("accepts an authenticator that cannot perform user verification", async ({ page }) => {
    test.setTimeout(300_000);
    // A UV-incapable authenticator is exactly the shape that the default
    // requireUserVerification:true rejected — on registration AND on the
    // assertion. Both ceremonies must now succeed.
    const { email, authenticatorId } = await provisionPasskeyUser(page, "no-uv");
    expect(authenticatorId).toBeTruthy();

    await passwordToChooser(page, email);
    await page.getByRole("button", { name: /Use a passkey/ }).click();
    await expect(page).toHaveURL(/\/en\/dashboard/, { timeout: 30_000 });
  });
});
