import { test, expect, type Page } from "@playwright/test";
import { createApiKey, loginAs, waitForApiKeysTab } from "./helpers";

/**
 * Integrations developer portal E2E (src/app/[locale]/(dashboard)/integrations/page.tsx).
 * Seed the DB first: `npm run db:seed`. Seed admin creds: admin@dashboard.com / admin123.
 *
 * Covers the API Keys tab (create → reveal-once → revoke → reactivate → delete),
 * the Playground tab (whoami against a freshly created key), and the Webhooks tab
 * (create → secret → pause → edit → delete). No external services are touched —
 * webhook endpoints are never "test delivered", so this spec is hermetic.
 *
 * NOTE: these tests share the dev DB, so they must tolerate prior state — API
 * keys/webhooks from earlier runs may already exist (e.g. an ACTIVE key created
 * while manually testing). Every flow creates its own resource under a unique,
 * timestamped name and operates only on that row via heading-scoped locators.
 */
test.describe("Integrations developer portal", () => {
  test("redirects unauthenticated visitors to the login page", async ({ page }) => {
    await page.goto("/en/integrations");
    await expect(page).toHaveURL(/\/en\/login/);
  });

  test.describe("authenticated", () => {
    test.beforeEach(async ({ page }) => {
      await loginAs(page);
    });

    test("creates an API key, reveals it once, and lists it", async ({ page }) => {
      await page.goto("/en/integrations");
      await waitForApiKeysTab(page);

      const keyName = `e2e-key-${Date.now()}`;
      const rawKey = await createApiKey(page, keyName);

      // The raw key is shown exactly once, in the reveal banner.
      expect(rawKey).toMatch(/^dash_[0-9a-f]{64}$/);
      // exact: the success toast says "API key created successfully" (lowercase),
      // so without exact this locator is ambiguous in strict mode.
      await expect(page.getByText("API Key Created", { exact: true })).toBeVisible();

      // It shows up in the list with default read-only permissions + ACTIVE status.
      const row = apiKeyRow(page, keyName);
      await expect(row.getByText("ACTIVE", { exact: true })).toBeVisible();
      await expect(row.getByText("read", { exact: true })).toBeVisible();
      await expect(row.getByText(new RegExp(`^dash_${rawKey.slice(5, 13)}`))).toBeVisible();
    });

    test("revokes, reactivates, and deletes an API key with confirmation", async ({ page }) => {
      await page.goto("/en/integrations");
      await waitForApiKeysTab(page);

      const keyName = `e2e-key-${Date.now()}`;
      await createApiKey(page, keyName);
      const row = apiKeyRow(page, keyName);

      // Revoke → REVOKED badge.
      await row.getByTitle("Revoke key").click();
      await expect(row.getByText("REVOKED", { exact: true })).toBeVisible();

      // Reactivate → ACTIVE badge again.
      await row.getByTitle("Reactivate key").click();
      await expect(row.getByText("ACTIVE", { exact: true })).toBeVisible();

      // Delete requires confirmation, then the row disappears.
      await row.getByTitle("Delete key").click();
      const confirmDialog = page.getByRole("dialog");
      await expect(
        confirmDialog.getByText(
          "Are you sure you want to delete this API key? This cannot be undone.",
        ),
      ).toBeVisible();
      await confirmDialog.getByRole("button", { name: "Confirm", exact: true }).click();
      await expect(page.getByRole("heading", { name: keyName, exact: true })).toHaveCount(0);
    });

    test("hits /api/v1/whoami from the playground with a freshly created key", async ({ page }) => {
      await page.goto("/en/integrations");
      await waitForApiKeysTab(page);

      const keyName = `e2e-key-${Date.now()}`;
      const rawKey = await createApiKey(page, keyName);

      await page.getByRole("tab", { name: "Playground" }).click();
      await page.getByPlaceholder("dash_…").fill(rawKey);

      // Ride the response so the assertion outlives the cold-route compile.
      const responsePromise = page.waitForResponse(
        (r) => r.url().includes("/api/v1/whoami") && r.request().method() === "GET",
      );
      await page.getByRole("button", { name: "Send request", exact: true }).click();
      const response = await responsePromise;
      expect(response.status()).toBe(200);

      await expect(page.getByText("Status: 200")).toBeVisible();
      await expect(page.locator("pre").filter({ hasText: '"authenticated": true' })).toBeVisible();
      await expect(page.locator("pre").filter({ hasText: '"scopes": "read"' })).toBeVisible();
    });

    test("creates, pauses, edits, and deletes a webhook endpoint", async ({ page }) => {
      await page.goto("/en/integrations");
      // Wait for the API Keys tab to hydrate + finish its initial fetch BEFORE
      // switching tabs — a click during hydration is silently dropped.
      await waitForApiKeysTab(page);
      await page.getByRole("tab", { name: "Webhooks" }).click();
      // The Add Endpoint button only renders once the endpoints fetch resolves,
      // so waiting on it doubles as the data-load gate. There are two matches
      // when the list is empty (toolbar + empty-state card), hence .first().
      await expect(
        page.getByRole("button", { name: "Add Endpoint", exact: true }).first(),
      ).toBeVisible();

      const hookName = `e2e-webhook-${Date.now()}`;
      const createDialog = page.getByRole("dialog");
      await page.getByRole("button", { name: "Add Endpoint", exact: true }).first().click();
      await expect(createDialog.getByText("Add Webhook Endpoint")).toBeVisible();
      await createDialog.getByPlaceholder("e.g., Slack Notifications").fill(hookName);
      await createDialog
        .getByPlaceholder("https://example.com/webhook")
        .fill("https://example.com/hook");
      await createDialog.getByRole("checkbox", { name: "Orders" }).check();
      await createDialog.getByRole("button", { name: "Create Webhook", exact: true }).click();
      await expect(createDialog).not.toBeVisible();

      // Signing secret is revealed once; the endpoint lists as ACTIVE with the
      // subscribed event label.
      await expect(page.getByText("Webhook Signing Secret")).toBeVisible();
      const row = webhookRow(page, hookName);
      await expect(row.getByText("ACTIVE", { exact: true })).toBeVisible();
      await expect(row.getByText("Order Created")).toBeVisible();
      await expect(row.getByText("https://example.com/hook")).toBeVisible();

      // Pause → PAUSED badge; activate → ACTIVE.
      await row.getByTitle("Pause webhook").click();
      await expect(row.getByText("PAUSED", { exact: true })).toBeVisible();
      await row.getByTitle("Activate webhook").click();
      await expect(row.getByText("ACTIVE", { exact: true })).toBeVisible();

      // Edit → rename persists.
      const renamed = `${hookName}-renamed`;
      await row.getByTitle("Edit webhook").click();
      const editDialog = page.getByRole("dialog");
      await expect(editDialog.getByText("Edit Webhook")).toBeVisible();
      await editDialog.getByPlaceholder("e.g., Slack Notifications").fill(renamed);
      await editDialog.getByRole("button", { name: "Update Webhook", exact: true }).click();
      await expect(page.getByRole("heading", { name: renamed, exact: true })).toBeVisible();

      // Delete requires confirmation, then the row disappears.
      const renamedRow = webhookRow(page, renamed);
      await renamedRow.getByTitle("Delete webhook").click();
      const confirmDialog = page.getByRole("dialog");
      await expect(
        confirmDialog.getByText("Are you sure you want to delete this webhook endpoint?"),
      ).toBeVisible();
      await confirmDialog.getByRole("button", { name: "Confirm", exact: true }).click();
      await expect(page.getByRole("heading", { name: renamed, exact: true })).toHaveCount(0);
    });
  });
});

/** The API-key list card whose heading is exactly `name`. */
function apiKeyRow(page: Page, name: string) {
  return page
    .locator("main .dashboard-card")
    .filter({ has: page.getByRole("heading", { name, exact: true }) });
}

/** The webhook-endpoint list card whose heading is exactly `name`. */
function webhookRow(page: Page, name: string) {
  return page
    .locator("main .dashboard-card")
    .filter({ has: page.getByRole("heading", { name, exact: true }) });
}
