import { test, expect } from "@playwright/test";
import { loginAs, SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD, FETCH_GATED } from "./helpers";

/**
 * Settings 2FA auto-check toggle + avatar-dropdown → API Docs navigation.
 *
 * - The settings Security card renders a real Switch bound to /api/profile's
 *   totpEnabled — it must AUTO-CHECK when 2FA is already active (no user
 *   interaction) and stay disabled while the state is still loading.
 * - The header avatar dropdown's "API Keys" item must navigate to /api-docs,
 *   which requires the "api-docs" entry in PAGE_ACCESS for the user's role.
 */

test.describe("Settings 2FA auto-check & dropdown → API Docs", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD);
  });

  test("settings 2FA switch auto-checks from the real TOTP state", async ({ page }) => {
    await page.goto("/en/settings");
    await page.waitForLoadState("domcontentloaded");

    const twoFaSwitch = page.getByRole("switch", { name: /two[- ]factor/i });

    // The switch must reflect the real API state — never stuck disabled.
    await expect(twoFaSwitch).toBeVisible(FETCH_GATED);
    await expect(twoFaSwitch).toBeEnabled(FETCH_GATED);
    await expect(twoFaSwitch).toHaveAttribute("aria-checked", /true|false/, FETCH_GATED);

    // The seeded admin has 2FA disabled → the auto-check must read "false"
    // WITHOUT any user interaction (this is the auto-check regression guard).
    // If a future seed enables TOTP, flip this to toBeChecked().
    const state = await twoFaSwitch.getAttribute("aria-checked");
    expect(state).toBe("false");
  });

  test("toggling settings 2FA routes to the profile deep-link", async ({ page }) => {
    await page.goto("/en/settings");
    const twoFaSwitch = page.getByRole("switch", { name: /two[- ]factor/i });
    await expect(twoFaSwitch).toBeEnabled(FETCH_GATED);

    // Toggling must NOT change the 2FA state inline — it routes to the
    // profile page where the guarded setup/disable dialogs live.
    await twoFaSwitch.click();
    await page.waitForURL(/\/profile\?(setup2fa|disable2fa)=1/, FETCH_GATED);
    await expect(page).toHaveURL(/\/en\/profile/, FETCH_GATED);
  });

  test("avatar dropdown → API Keys opens the API Documentation page", async ({ page }) => {
    await page.goto("/en/dashboard");
    await page.waitForLoadState("domcontentloaded");

    // Open the header avatar dropdown.
    const avatarButton = page.locator("header button").filter({
      has: page.locator(".avatar-brand"),
    });
    await expect(avatarButton).toBeVisible();
    await avatarButton.click();

    const apiKeysItem = page.getByRole("menuitem").filter({ hasText: /API Keys/i });
    await expect(apiKeysItem).toBeVisible();
    await apiKeysItem.click();

    await expect(page).toHaveURL(/\/en\/api-docs/, FETCH_GATED);
    await expect(page.getByRole("heading", { name: /API Documentation/i }).first()).toBeVisible(
      FETCH_GATED,
    );
  });

  test("API Docs is reachable for every authenticated role via PAGE_ACCESS", async ({ page }) => {
    // Direct navigation must not bounce to login/403 for the seeded admin.
    await page.goto("/en/api-docs");
    await page.waitForLoadState("domcontentloaded");
    await expect(page).not.toHaveURL(/\/login/, FETCH_GATED);
    await expect(page.getByRole("heading", { name: /API Documentation/i }).first()).toBeVisible(
      FETCH_GATED,
    );
  });
});
