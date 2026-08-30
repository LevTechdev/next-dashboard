import { test, expect, type Page } from "@playwright/test";
import { loginAs } from "./helpers";

/**
 * SSO / Enterprise settings E2E (src/components/sso/sso-settings.tsx).
 * Seed the DB first: `npm run db:seed`. Seed admin creds: nextdashboards@gmail.com / admin123.
 *
 * The SSO page is only reachable when authenticated; visiting it logged out
 * redirects to /en/login.
 *
 * NOTE: these tests share the dev DB, so they must tolerate prior state — the
 * admin's tenant may already have an SSO connection from an earlier run. The
 * helpers below normalize to the expected starting state before each flow.
 */
test.describe("SSO / Enterprise settings", () => {
  test("redirects unauthenticated visitors to the login page", async ({ page }) => {
    await page.goto("/en/sso");
    await expect(page).toHaveURL(/\/en\/login/);
  });

  test.describe("authenticated", () => {
    test.beforeEach(async ({ page }) => {
      await loginAs(page);
    });

    test("creates an SSO connection from the empty state", async ({ page }) => {
      await ensureEmptySso(page);

      await page.getByRole("button", { name: "Configure SSO", exact: true }).click();
      const dialog = page.getByRole("dialog");
      await expect(dialog.getByText("Configure SAML SSO")).toBeVisible();

      await dialog.getByPlaceholder("e.g. Okta").fill("Okta");
      await dialog
        .getByPlaceholder("https://idp.example.com/sso")
        .fill("https://acme.okta.com/app/next-dashboard/sso/saml");
      await dialog.getByPlaceholder(/BEGIN CERTIFICATE/).fill(
        "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA",
      );
      await dialog.getByRole("button", { name: "Save connection", exact: true }).click();

      // Dialog closes and the connection renders.
      await expect(dialog).not.toBeVisible();
      await expect(page.getByText("Enabled").first()).toBeVisible();
      await expect(page.getByText("Certificate configured").first()).toBeVisible();

      // The SP metadata card is tenant-scoped (admin operates on the default
      // workspace when their session carries no tenant claim).
      await expect(page.getByText(/metadata\?tenant=default/)).toBeVisible();
      await expect(page.getByText(/\/api\/auth\/saml\/acs/)).toBeVisible();
    });

    test("disables and re-enables SSO", async ({ page }) => {
      await ensureConfiguredSso(page);

      await page.getByRole("button", { name: "Disable SSO", exact: true }).click();
      await expect(page.getByText("Disabled").first()).toBeVisible();

      await page.getByRole("button", { name: "Enable SSO", exact: true }).click();
      await expect(page.getByText("Enabled").first()).toBeVisible();
    });

    test("removes the connection after confirmation", async ({ page }) => {
      await ensureConfiguredSso(page);

      await page.getByRole("button", { name: "Remove connection", exact: true }).click();
      const dialog = page.getByRole("dialog");
      await expect(dialog.getByText("Remove SSO connection?")).toBeVisible();
      await dialog.getByRole("button", { name: "Confirm", exact: true }).click();

      await expect(page.getByText("No SSO connection")).toBeVisible();
    });
  });
});

/** Wait for client-side data to load (hydration + GET) before interacting. */
async function waitForSsoState(page: Page) {
  await expect(
    page.getByText(/No SSO connection|Enabled/).first(),
  ).toBeVisible();
}

/** Guarantee the page shows the empty state, deleting any prior connection. */
async function ensureEmptySso(page: Page) {
  await page.goto("/en/sso");
  await waitForSsoState(page);
  const empty = page.getByText("No SSO connection");
  if (!(await empty.isVisible())) {
    await page.getByRole("button", { name: "Remove connection", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Confirm", exact: true }).click();
    await expect(empty).toBeVisible();
  }
}

/** Guarantee a connection is configured, creating one if needed. */
async function ensureConfiguredSso(page: Page) {
  await page.goto("/en/sso");
  await waitForSsoState(page);
  if (!(await page.getByText("Enabled").first().isVisible())) {
    await page.getByRole("button", { name: "Configure SSO", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Configure SAML SSO")).toBeVisible();
    await dialog.getByPlaceholder("e.g. Okta").fill("Okta");
    await dialog
      .getByPlaceholder("https://idp.example.com/sso")
      .fill("https://acme.okta.com/app/next-dashboard/sso/saml");
    await dialog.getByPlaceholder(/BEGIN CERTIFICATE/).fill(
      "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA",
    );
    await dialog.getByRole("button", { name: "Save connection", exact: true }).click();
    await expect(page.getByText("Enabled").first()).toBeVisible();
  }
}
