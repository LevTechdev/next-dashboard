import { test, expect, type Page } from "@playwright/test";
import { registerFreshUser, loginAs } from "./helpers";

/**
 * Security Center E2E.
 * Seed the DB first: `npm run db:seed`.
 * Seed admin creds: admin@dashboard.com / admin123.
 *
 * The Security Center (src/app/[locale]/(dashboard)/security/page.tsx →
 * src/components/security/security-center.tsx) is only reachable when
 * authenticated; visiting it logged out redirects to /en/login.
 *
 * NOTE: these tests share the dev DB, so they must tolerate prior state:
 * admin may already have backup codes / security events from earlier runs.
 */
test.describe("Security Center", () => {
  test("redirects unauthenticated visitors to the login page", async ({ page }) => {
    await page.goto("/en/security");
    await expect(page).toHaveURL(/\/en\/login/);
  });

  test.describe("authenticated", () => {
    test.beforeEach(async ({ page }) => {
      await loginAs(page);
    });

    test("renders the score banner, stat tiles, and section cards", async ({ page }) => {
      await page.goto("/en/security");

      // Header
      await expect(page.getByRole("heading", { name: "Security Center" })).toBeVisible();
      await expect(
        page.getByText("Manage your sign-in methods, active sessions, and security activity."),
      ).toBeVisible();

      // Score banner
      await expect(page.getByText("Security score")).toBeVisible();
      await expect(page.getByText(/out of 100/)).toBeVisible();
      // The score message resolves after data loads; accept any of the 4 labels.
      await expect(
        page.getByText(/strongly protected|enable two-factor|stronger protection/i),
      ).toBeVisible();

      // Stat tiles (labels also appear as section-card titles later in the DOM).
      await expect(page.getByText("Two-Factor Auth").first()).toBeVisible();
      await expect(page.getByText("Passkeys").first()).toBeVisible();
      await expect(page.getByText("Active Sessions").first()).toBeVisible();
      await expect(page.getByText("Events · 7 days").first()).toBeVisible();

      // Section cards
      await expect(page.getByRole("heading", { name: "Two-Factor Authentication" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Passkeys" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Backup Recovery Codes" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Active Sessions" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Security Activity" })).toBeVisible();
    });

    test("marks the current browser session as this device", async ({ page }) => {
      await page.goto("/en/security");
      await expect(page.getByText("This device").first()).toBeVisible();
      // The current login session shows as active.
      await expect(page.getByText("active").first()).toBeVisible();
    });

    test("generates backup recovery codes", async ({ page }) => {
      await page.goto("/en/security");

      // Works whether admin already has codes ("Regenerate") or not ("Generate codes").
      await generateOrRegenerateCodes(page);

      // 10 codes are rendered, each formatted xxxx-xxxx (hex).
      const codeCells = page.locator("span", { hasText: /^[0-9a-f]{4}-[0-9a-f]{4}$/ });
      await expect(codeCells).toHaveCount(10);
    });

    test("shows the two-factor card in its unset state", async ({ page }) => {
      await page.goto("/en/security");
      // Seed-dependent: the seed admin starts with 2FA disabled (the 2FA spec
      // deliberately uses fresh users so admin state is never mutated).
      await expect(page.getByRole("button", { name: "Set up 2FA" })).toBeVisible();
      await expect(page.getByText("Not enabled")).toBeVisible();
      await expect(
        page.getByText("Add a second verification step with an authenticator app."),
      ).toBeVisible();
    });

    test("regenerating codes asks for confirmation when codes exist", async ({ page }) => {
      await page.goto("/en/security");

      // Ensure codes exist (regardless of prior state), then dismiss.
      await generateOrRegenerateCodes(page);
      await page.getByRole("button", { name: "Done" }).click();

      // Regenerate → a confirmation dialog must appear before new codes are shown.
      await page.getByRole("button", { name: "Regenerate", exact: true }).click();
      const dialog = page.getByRole("dialog");
      await expect(dialog.getByText("Regenerate backup codes?")).toBeVisible();
      // Confirm button uses the shared "Generate codes" label.
      await dialog.getByRole("button", { name: "Generate codes", exact: true }).click();
      await expect(page.getByText(/Save these codes now/i)).toBeVisible();
    });

    test("shows the email-verification card in its verified state", async ({ page }) => {
      await page.goto("/en/security");
      // Seed admin is created with emailVerified set, so the card shows the
      // verified state (not the send-verification action).
      await expect(page.getByRole("heading", { name: "Email Verification" })).toBeVisible();
      await expect(page.getByText("Email verified", { exact: true })).toBeVisible();
      await expect(page.getByText(/Verified on/i)).toBeVisible();
    });
  });

  test.describe("email verification flow (fresh user)", () => {
    // Uses a freshly-registered user so the seed admin's emailVerified state
    // is never mutated; the confirm link is token-based and works logged-out.
    test.describe.configure({ mode: "serial" });

    test("registers, sends a verification link, and confirms it", async ({ page }) => {
      await registerFreshUser(page);

      // Security Center shows the unverified card with a send action.
      // The unverified state also renders during SSR, so wait for a
      // post-hydration-only element (the MFA status chip resolves after the
      // client fetches) before clicking — clicks during hydration are dropped.
      await page.goto("/en/security");
      await expect(page.getByRole("heading", { name: "Security Center" })).toBeVisible();
      await expect(page.getByText("MFA not verified in 30 days")).toBeVisible();
      await expect(page.getByText("Email Not Verified")).toBeVisible();

      // Send → dev mode returns the verification link and renders it inline,
      // and a 60s resend cooldown disables the button with a countdown.
      await page.getByRole("button", { name: "Send Verification Email" }).click();
      await expect(page.getByRole("button", { name: /Resend in \d+s/ })).toBeDisabled();
      await expect(page.getByText(/You can request a new one in \d+s/)).toBeVisible();
      const link = page.locator("code");
      await expect(link).toContainText("/api/auth/verify-email/confirm?token=");
      const verificationUrl = (await link.textContent())?.trim() ?? "";
      expect(verificationUrl).toContain("http");

      // Open the confirm link in the same browser → back to Security Center
      // with a success toast and the verified state.
      await page.goto(verificationUrl);
      await expect(page).toHaveURL(/\/en\/security\?verified=true/);
      await expect(page.getByText("Email verified successfully!")).toBeVisible();
      // The activity-feed event label is "Email confirmed", so the card's
      // "Email verified" status is unambiguous.
      await expect(page.getByText("Email verified", { exact: true })).toBeVisible();
      await expect(page.getByText(/Verified on/i)).toBeVisible();
    });

    test("rejects an invalid or expired verification token", async ({ page }) => {
      // Log in a fresh user first (contexts are isolated per test).
      await registerFreshUser(page);

      // No matching user/token → redirected with ?verified=invalid and an
      // error toast is shown by the Security Center.
      await page.goto("/en/security");
      await expect(page.getByRole("heading", { name: "Security Center" })).toBeVisible();
      await page.goto("/api/auth/verify-email/confirm?token=deadbeefdeadbeef&locale=en");
      await expect(page).toHaveURL(/\/en\/security\?verified=invalid/);
      await expect(page.getByText(/invalid or has expired/i)).toBeVisible();
    });

    test("verifies the email with the 6-digit OTP from the Security Center", async ({ page }) => {
      await registerFreshUser(page);

      await page.goto("/en/security");
      await expect(page.getByRole("heading", { name: "Security Center" })).toBeVisible();
      // The unverified alert banner links to the verification card.
      await expect(page.getByText("Your email is not verified")).toBeVisible();
      await expect(page.getByText("Email Not Verified")).toBeVisible();

      // Send → dev mode surfaces the 6-digit code inline.
      await page.getByRole("button", { name: "Send Verification Email" }).click();
      const code = (await page.getByTestId("dev-otp").textContent())?.trim() ?? "";
      expect(code).toMatch(/^\d{6}$/);

      // Enter the code — the OTP input auto-submits the moment the 6th
      // digit lands, so no click on "Verify Email" is needed (a click would
      // race the in-flight request while the button shows its disabled
      // "Verifying…" state).
      await page.getByPlaceholder("6-digit code").fill(code);

      await expect(page.getByText("Email verified", { exact: true })).toBeVisible();
      await expect(page.getByText(/Verified on/i)).toBeVisible();
      // The alert banner disappears once verification completes.
      await expect(page.getByText("Your email is not verified")).not.toBeVisible();
    });
  });
});

/**
 * Click the backup-codes button and make sure a fresh set is on screen.
 * Handles both states: "Generate codes" (no codes yet) and "Regenerate"
 * (codes exist → an "are you sure?" dialog appears and must be accepted).
 * Also tolerates the brief loading window where the button label hasn't
 * settled yet (backupRemaining is null → shows "Generate codes").
 */
async function generateOrRegenerateCodes(page: Page) {
  // Wait for client-side data to load before clicking: the "N unused code(s)
  // remaining" text only renders after hydration + fetch, and clicking before
  // hydration completes silently drops the click (no POST fires).
  await expect(page.getByText(/unused code/)).toBeVisible();

  const regen = page.getByRole("button", { name: "Regenerate", exact: true });
  if (await regen.isVisible()) {
    // Codes already exist → an "are you sure?" dialog appears; accept it.
    await regen.click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Generate codes", exact: true }).click();
  } else {
    await page.getByRole("button", { name: "Generate codes", exact: true }).click();
  }
  await expect(page.getByText(/Save these codes now/i)).toBeVisible();
}
