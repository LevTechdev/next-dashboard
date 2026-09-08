import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

test.describe("Settings Ergonomics & Payment Webhook Simulator E2E", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page);
  });

  test("settings page renders white-labeling with theme presets and sync option", async ({
    page,
  }) => {
    await page.goto("/en/settings");
    await page.waitForLoadState("domcontentloaded");

    // White-Labeling card header
    await expect(page.getByText("White-Labeling & Brand Customization")).toBeVisible();
    await expect(page.getByText("Custom Domain Routing")).toBeVisible();

    // Verify theme presets exist
    await expect(page.getByRole("button", { name: "Indigo Core" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Emerald Growth" })).toBeVisible();

    // Verify Sync with Dashboard Theme button
    await expect(page.getByRole("button", { name: "Sync with Dashboard Theme" })).toBeVisible();
  });

  test("api key and webhook action buttons meet comfortable touch target sizes", async ({
    page,
  }) => {
    await page.goto("/en/settings");
    await page.waitForLoadState("domcontentloaded");

    // Verify 'Create API Key' and 'Add Webhook' buttons
    const createKeyBtn = page.getByRole("button", { name: "Create API Key" }).first();
    await expect(createKeyBtn).toBeVisible();
    const createKeyBox = await createKeyBtn.boundingBox();
    expect(createKeyBox?.height).toBeGreaterThanOrEqual(32);

    const addWebhookBtn = page.getByRole("button", { name: "Add Webhook" }).first();
    await expect(addWebhookBtn).toBeVisible();
    const addWebhookBox = await addWebhookBtn.boundingBox();
    expect(addWebhookBox?.height).toBeGreaterThanOrEqual(32);

    // Verify row action buttons meet touch target sizes (>= 32px height and width)
    const copyPrefixBtn = page.getByRole("button", { name: "Copy prefix" }).first();
    if (await copyPrefixBtn.isVisible()) {
      const copyBox = await copyPrefixBtn.boundingBox();
      expect(copyBox?.height).toBeGreaterThanOrEqual(32);
      expect(copyBox?.width).toBeGreaterThanOrEqual(32);
    }
  });

  test("opens payment gateway webhook simulator and executes signed simulation", async ({
    page,
  }) => {
    await page.goto("/en/settings");
    await page.waitForLoadState("domcontentloaded");

    // Click 'Simulate Gateway Webhook' button in Webhooks card
    const simBtn = page.getByRole("button", { name: /Simulate Gateway Webhook/i }).first();
    await expect(simBtn).toBeVisible();
    await simBtn.click();

    // Verify simulator dialog opens
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByText("Payment Gateway Webhook Simulator")).toBeVisible();

    // Verify trigger button inside simulator dialog
    const dispatchBtn = page.getByRole("button", { name: /Simulate & Dispatch Webhook/i });
    await expect(dispatchBtn).toBeVisible();

    // Execute simulation
    await dispatchBtn.click();

    // Verify live inspector shows delivered & signed badges
    await expect(page.getByText("Dispatched & Verified")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("HMAC-SHA256 Signature Match")).toBeVisible();
    await expect(page.getByText("X-Webhook-Signature:")).toBeVisible();
  });
});
