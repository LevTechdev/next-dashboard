import { test, expect, type Page } from "@playwright/test";
import { createApiKey, FETCH_GATED, loginAs, waitForApiKeysTab } from "./helpers";

/**
 * Destructive-action confirm dialogs (ConfirmProvider → Sora AlertDialog).
 *
 * Every destructive flow in the dashboard routes its confirmation through the
 * shared ConfirmProvider, which renders the Sora AlertDialog with a tinted
 * media tile. The tile's icon communicates the KIND of destruction:
 *   - `lucide-trash2`       (icon: "trash")  — record deletions
 *   - `lucide-key-round`    (icon: "key")    — credential revocations
 *   - `lucide-alert-triangle` (default)      — generic warnings
 *
 * The lucide class IS the assertion hook: lucide-react stamps a stable
 * `lucide-{kebab-name}` class on every rendered SVG
 * (node_modules/lucide-react/dist/esm/createLucideIcon.js), so a regression
 * that swaps the glyph — or drops the media tile entirely — is caught.
 *
 * Safety model: these tests share the seeded dev DB (see e2e/global-setup.ts),
 * so "confirm actually deletes" is only exercised on resources CREATED by the
 * test itself (unique timestamped names): marketing campaign, discount, API
 * key, webhook endpoint. For seeded records (products bulk-selection, team
 * member) the dialog is only Escape-tested — Escape must close it WITHOUT
 * any destructive fetch firing (asserted via the unchanged row state, so no
 * network interception is needed).
 *
 * Escape resolution is the product contract under test: Base UI closes on
 * Escape → provider's onOpenChange(false) → settle(false) → the awaited
 * confirm() promise resolves false and the caller's early-return keeps the
 * record intact.
 */

test.describe("Destructive confirm dialogs — Sora media glyphs + Escape safety", () => {
  // Each test mints records through slow create-dialog flows on the remote DB
  // (and one argon2 login per worker); 60s is not enough headroom.
  test.setTimeout(120_000);

  test.beforeEach(async ({ page }) => {
    await loginAs(page);
  });

  /**
   * The open Sora confirm dialog. Base UI's AlertDialog Popup exposes the
   * ARIA role "alertdialog" (a shadcn Dialog is role="dialog") — asserting on
   * the stricter role guarantees only the ConfirmProvider surface matches,
   * never a per-page create/edit Dialog.
   */
  function confirmDialog(page: Page) {
    return page.getByRole("alertdialog");
  }

  /** The Sora media tile's icon class for the open confirm dialog. */
  async function confirmGlyphClass(page: Page): Promise<string> {
    const media = confirmDialog(page).locator('[data-slot="alert-dialog-media"] svg').first();
    await expect(media).toBeAttached();
    const cls = await media.getAttribute("class");
    expect(cls, "media icon must carry a lucide-* class").toContain("lucide-");
    return cls ?? "";
  }

  async function openConfirmAndWaitForCopy(page: Page, description: string): Promise<void> {
    await confirmDialog(page).getByText(description).waitFor();
    // The entrance animation is delayed 200ms (Sora 3D rise) — wait for the
    // motion settle so the glyph is mounted before it is read.
    await expect(confirmDialog(page).getByRole("button", { name: "Cancel" })).toBeVisible();
  }

  test("products bulk delete: trash tile, red tint, Escape keeps the selection intact", async ({
    page,
  }) => {
    await page.goto("/en/products");
    // Table hydration gate: the header select-all checkbox only renders once
    // the products fetch resolves and rows map over it.
    const rowCheckbox = page.locator("tbody input[type='checkbox']").first();
    await expect(rowCheckbox).toBeAttached(FETCH_GATED);

    await rowCheckbox.check();
    // exact:true — the confirm dialog's copy ("Delete 1 selected products?")
    // also contains the substring, and the Sora portal can stay mounted.
    await expect(page.getByText("1 selected", { exact: true })).toBeVisible();

    // The selection toolbar's destructive Delete button opens the shared
    // ConfirmProvider dialog.
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await openConfirmAndWaitForCopy(page, "Delete 1 selected products?");

    // Record deletion → trash glyph, destructive red tile.
    const cls = await confirmGlyphClass(page);
    expect(cls).toContain("lucide-trash2");
    const mediaTile = confirmDialog(page).locator('[data-slot="alert-dialog-media"]').first();
    await expect(mediaTile).toHaveClass(/bg-red-500\/10/);

    // Escape = dismiss. The row and the "1 selected" banner must survive —
    // proof the deletion fetch never fired.
    await page.keyboard.press("Escape");
    await expect(confirmDialog(page)).not.toBeVisible();
    await expect(page.getByText("1 selected", { exact: true })).toBeVisible();
    await expect(page.locator("tbody tr").first()).toBeVisible();
  });

  test("marketing campaign delete: trash tile, Escape preserves, Confirm deletes", async ({
    page,
  }) => {
    // Create a uniquely-named campaign so the Confirm click can never eat
    // seeded data or another worker's fixture.
    await page.goto("/en/marketing");
    const addBtn = page.getByRole("button", { name: "Add Campaign" }).first();
    await expect(addBtn).toBeVisible(FETCH_GATED);
    const campaignName = `e2e-campaign-${Date.now()}`;
    await addBtn.click();
    const createDialog = page.getByRole("dialog");
    await createDialog.getByPlaceholder("Campaign Name").fill(campaignName);
    await createDialog.getByRole("button", { name: "Add Campaign" }).click();
    // Close can outwait the default timeout when the remote DB browns out and
    // the POST stalls — give it the fetch-gated budget.
    await expect(createDialog).not.toBeVisible(FETCH_GATED);

    const row = page.locator("tbody tr").filter({ hasText: campaignName });
    await expect(row).toBeVisible(FETCH_GATED);

    // Open the confirm (row Delete button renders the trash glyph itself).
    await row.getByRole("button", { name: "Delete" }).click();
    await openConfirmAndWaitForCopy(page, "Delete this campaign?");
    expect(await confirmGlyphClass(page)).toContain("lucide-trash2");

    // Escape → campaign still listed.
    await page.keyboard.press("Escape");
    await expect(confirmDialog(page)).not.toBeVisible();
    await expect(row).toBeVisible(FETCH_GATED);

    // Confirm → row disappears (toast confirms the server accepted it).
    await row.getByRole("button", { name: "Delete" }).click();
    await openConfirmAndWaitForCopy(page, "Delete this campaign?");
    // The campaign call site passes confirmLabel: tcommon("delete").
    await confirmDialog(page).getByRole("button", { name: "Delete", exact: true }).click();
    await expect(confirmDialog(page)).not.toBeVisible();
    await expect(page.getByText("Campaign deleted")).toBeVisible();
    await expect(page.locator("tbody tr").filter({ hasText: campaignName })).toHaveCount(0);
  });

  test("discount delete: trash tile, Escape preserves, Confirm deletes", async ({ page }) => {
    await page.goto("/en/discounts");
    const addBtn = page.getByRole("button", { name: "Add Discount" }).first();
    await expect(addBtn).toBeVisible(FETCH_GATED);
    const code = `E2E${Date.now()}`;
    await addBtn.click();
    const createDialog = page.getByRole("dialog");
    await createDialog.getByPlaceholder("Code").fill(code);
    await createDialog.getByPlaceholder("Name").fill(`e2e-discount-${code}`);
    // value/minPurchase/maxUses coerce with parseFloat/parseInt; dates must be
    // real — the route passes `new Date(body.startsAt)` straight to Prisma.
    await createDialog.getByPlaceholder("Value").fill("25");
    await createDialog.locator("input[type='date']").first().fill("2026-10-01");
    await createDialog.locator("input[type='date']").nth(1).fill("2026-12-31");
    await createDialog.getByRole("button", { name: "Add Discount" }).click();
    await expect(createDialog).not.toBeVisible(FETCH_GATED);

    const row = page.locator("tbody tr").filter({ hasText: code });
    await expect(row).toBeVisible(FETCH_GATED);

    await row.getByRole("button", { name: "Delete" }).click();
    await openConfirmAndWaitForCopy(page, "Delete this discount?");
    expect(await confirmGlyphClass(page)).toContain("lucide-trash2");

    await page.keyboard.press("Escape");
    await expect(confirmDialog(page)).not.toBeVisible();
    await expect(row).toBeVisible(FETCH_GATED);

    await row.getByRole("button", { name: "Delete" }).click();
    await openConfirmAndWaitForCopy(page, "Delete this discount?");
    // The discount call site passes confirmLabel: tcommon("delete").
    await confirmDialog(page).getByRole("button", { name: "Delete", exact: true }).click();
    await expect(confirmDialog(page)).not.toBeVisible();
    await expect(page.getByText("Discount deleted")).toBeVisible();
    await expect(page.locator("tbody tr").filter({ hasText: code })).toHaveCount(0);
  });

  test("team member remove: trash tile, Escape keeps the member, no deletion", async ({ page }) => {
    // Seeded manager (prisma/seed.ts) — Escape-only on purpose; the member
    // must still be present for other specs.
    await page.goto("/en/settings/team");
    const memberRow = page.locator("tbody tr").filter({ hasText: "Sarah Johnson" }).first();
    await expect(memberRow).toBeVisible(FETCH_GATED);

    await memberRow.getByRole("button", { name: "Remove", exact: true }).click();
    await openConfirmAndWaitForCopy(page, "Remove this member?");
    expect(await confirmGlyphClass(page)).toContain("lucide-trash2");

    await page.keyboard.press("Escape");
    await expect(confirmDialog(page)).not.toBeVisible();
    // The member is untouched — nothing was sent to /api/team DELETE.
    await expect(
      page.locator("tbody tr").filter({ hasText: "Sarah Johnson" }).first(),
    ).toBeVisible();
  });

  test("API key delete: key tile (credential revocation), Escape preserves, Confirm deletes", async ({
    page,
  }) => {
    await page.goto("/en/integrations");
    await waitForApiKeysTab(page);

    const keyName = `e2e-key-${Date.now()}`;
    await createApiKey(page, keyName);
    const row = page
      .locator("main .dashboard-card")
      .filter({ has: page.getByRole("heading", { name: keyName, exact: true }) });
    await expect(row).toBeVisible(FETCH_GATED);

    await row.getByRole("button", { name: "Delete key" }).click();
    await openConfirmAndWaitForCopy(
      page,
      "Are you sure you want to delete this API key? This cannot be undone.",
    );
    // NOT the trash tile: key deletion is a credential revocation, so the
    // provider receives icon:"key" and must render the key glyph.
    expect(await confirmGlyphClass(page)).toContain("lucide-key-round");
    expect(await confirmGlyphClass(page)).not.toContain("lucide-trash2");

    await page.keyboard.press("Escape");
    await expect(confirmDialog(page)).not.toBeVisible();
    await expect(row).toBeVisible(FETCH_GATED);

    await row.getByRole("button", { name: "Delete key" }).click();
    await openConfirmAndWaitForCopy(
      page,
      "Are you sure you want to delete this API key? This cannot be undone.",
    );
    await confirmDialog(page).getByRole("button", { name: "Confirm", exact: true }).click();
    await expect(confirmDialog(page)).not.toBeVisible();
    await expect(page.getByRole("heading", { name: keyName, exact: true })).toHaveCount(
      0,
      FETCH_GATED,
    );
  });

  test("webhook endpoint delete: trash tile, Escape preserves, Confirm deletes", async ({
    page,
  }) => {
    await page.goto("/en/integrations");
    await waitForApiKeysTab(page);
    await page.getByRole("tab", { name: "Webhooks" }).click();
    // The Add Endpoint button renders only after the endpoints fetch resolves
    // (same load-gate convention as integrations.spec.ts); two matches exist
    // when the list is empty (toolbar + empty-state card), hence .first().
    await expect(
      page.getByRole("button", { name: "Add Endpoint", exact: true }).first(),
    ).toBeVisible(FETCH_GATED);

    const hookName = `e2e-webhook-${Date.now()}`;
    await page.getByRole("button", { name: "Add Endpoint", exact: true }).first().click();
    const createDialog = page.getByRole("dialog");
    await createDialog.getByPlaceholder("e.g., Slack Notifications").fill(hookName);
    await createDialog
      .getByPlaceholder("https://example.com/webhook")
      .fill("https://example.com/hook");
    await createDialog.getByRole("checkbox", { name: "Orders" }).check();
    await createDialog.getByRole("button", { name: "Create Webhook", exact: true }).click();
    await expect(createDialog).not.toBeVisible();

    const row = page
      .locator("main .dashboard-card")
      .filter({ has: page.getByRole("heading", { name: hookName, exact: true }) });
    await expect(row).toBeVisible(FETCH_GATED);

    await row.getByRole("button", { name: "Delete webhook" }).click();
    await openConfirmAndWaitForCopy(page, "Are you sure you want to delete this webhook endpoint?");
    expect(await confirmGlyphClass(page)).toContain("lucide-trash2");

    await page.keyboard.press("Escape");
    await expect(confirmDialog(page)).not.toBeVisible();
    await expect(row).toBeVisible(FETCH_GATED);

    await row.getByRole("button", { name: "Delete webhook" }).click();
    await openConfirmAndWaitForCopy(page, "Are you sure you want to delete this webhook endpoint?");
    await confirmDialog(page).getByRole("button", { name: "Confirm", exact: true }).click();
    await expect(confirmDialog(page)).not.toBeVisible();
    await expect(page.getByRole("heading", { name: hookName, exact: true })).toHaveCount(
      0,
      FETCH_GATED,
    );
  });
});

test.describe("[hidden] vs Tailwind display utilities — cascade regression guard", () => {
  /**
   * Base UI's Portal keeps its popup mounted after close (keepMounted) and
   * stamps the `hidden` attribute on it. Tailwind preflight's
   * `[hidden] { display: none }` rule loses the cascade to any display
   * utility (e.g. `grid`) at equal specificity that lands later in the
   * stylesheet — the closed dialog then stays layout-visible: invisible
   * content-wise but click-blocking and "visible" to Playwright. The
   * `@layer base` hardening rule in globals.css exists to win that fight;
   * this probe proves it still does.
   */
  test("hidden attribute forces display:none even with a grid utility class", async ({ page }) => {
    await page.goto("/en/login");

    await page.evaluate(() => {
      const probe = document.createElement("div");
      probe.id = "pw-hidden-probe";
      probe.setAttribute("hidden", "");
      probe.className = "grid place-items-center p-4";
      document.body.appendChild(probe);
    });

    const probe = page.locator("#pw-hidden-probe");
    // Playwright's visibility contract: hidden attribute (or zero box) is
    // never visible. This is exactly the check that flaked when the closed
    // Sora portal leaked through the cascade.
    await expect(probe).toBeHidden();

    const display = await probe.evaluate((el) => getComputedStyle(el).display);
    expect(display).toBe("none");
  });
});
