import { test, expect, type Page } from "@playwright/test";
import { loginAs, SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD, signInEmailField } from "./helpers";

async function submitSeedLogin(page: Page, password: string = SEED_ADMIN_PASSWORD): Promise<void> {
  const email = signInEmailField(page);
  const passwordInput = page.getByPlaceholder("Enter password");
  const submit = page.getByRole("button", { name: "Log in", exact: true });

  // Fills before hydration are silently dropped; retry until React actually
  // accepts both values and enables the submit button.
  await expect
    .poll(
      async () => {
        await email.fill(SEED_ADMIN_EMAIL);
        await passwordInput.fill(password);
        return submit.isEnabled();
      },
      { timeout: 30_000, message: "login form never hydrated" },
    )
    .toBe(true);
  await submit.click();
}

/**
 * Login E2E (pw3).
 * Seed the DB first: `npm run db:seed`.
 * Seed admin creds: SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD (./helpers).
 *
 * The login form (src/app/[locale]/(auth)/login/page.tsx):
 * - email    <input type="email" placeholder="Your email">   (t("emailPlaceholder"))
 * - password <input placeholder="Enter password">            (t("passwordPlaceholder"))
 * - submit   <button>Log in</button> (t("login"), disabled until both fields are filled)
 * - feedback via sonner toasts; success navigates to /en/dashboard.
 */
test.describe("Login", () => {
  test("logs in with valid seed credentials and lands on the dashboard", async ({ page }) => {
    // Delegates to the shared loginAs helper (fills the form, waits for the
    // enabled Sign In button, and waits for the dashboard). loginAs navigates
    // itself, so this test has no goto in a beforeEach.
    await loginAs(page);
  });

  test("ignores an external post-login redirect", async ({ page }) => {
    await page.goto("/en/login?redirect=https%3A%2F%2Fevil.example%2Fphish");
    const appOrigin = new URL(page.url()).origin;

    await submitSeedLogin(page);

    // A raw redirect value used to reach router.push, so a crafted login link
    // could hand the freshly authenticated user to another origin.
    await expect(page).toHaveURL(/\/en\/dashboard$/, { timeout: 45_000 });
    expect(new URL(page.url()).origin).toBe(appOrigin);
  });

  test("preserves a safe internal post-login redirect", async ({ page }) => {
    await page.goto("/en/login?redirect=%2Fen%2Fsettings%2Fteam");
    const appOrigin = new URL(page.url()).origin;

    await submitSeedLogin(page);

    // The guard must reject hostile destinations without breaking the
    // middleware's legitimate protected-route round trip.
    await expect(page).toHaveURL(/\/en\/settings\/team$/, { timeout: 45_000 });
    expect(new URL(page.url()).origin).toBe(appOrigin);
  });

  test("shows an error and stays on /login for invalid credentials", async ({ page }) => {
    await page.goto("/en/login");
    await submitSeedLogin(page, "wrong-password");

    // Feedback is surfaced via a sonner toast, not an inline element.
    await expect(page.getByText(/invalid|failed|incorrect/i).first()).toBeVisible();
    await expect(page).toHaveURL(/\/en\/login/);
  });
});
