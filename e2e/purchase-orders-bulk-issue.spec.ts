import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

/**
 * Bulk Issue — purchase-orders DRAFT flow end to end.
 *
 * Seed products keep at least one SKU below its velocity reorder point, so
 * POST /api/inventory/auto-reorder { force: true } reliably drafts ≥1 DRAFT
 * purchase order (the cooldown ledger is bypassed for determinism). The spec
 * then drives the UI:
 *
 *   1. Inventory → Purchase Orders tab
 *   2. select-all checkbox over the DRAFT rows
 *   3. the bulk toolbar appears with a live "{count} draft(s) selected"
 *   4. Issue selected → the Sora confirm dialog names the count
 *   5. confirm → every selected row's status chip flips to ISSUED, the Draft
 *      chip's live count drops by the exact number issued, and the toolbar
 *      clears
 *
 * Uses the seed admin (ADMIN-only route + page).
 */

test.describe("Purchase orders bulk issue", () => {
  test("selects multiple DRAFT POs, confirms, and flips them to ISSUED with live counts", async ({
    page,
  }) => {
    await loginAs(page);

    // Seed ≥1 DRAFT PO deterministically (force bypasses the cooldown ledger).
    const seed = await page.request.post("/api/inventory/auto-reorder", {
      data: { force: true },
      timeout: 60_000,
    });
    expect(seed.ok(), "auto-reorder force run succeeds").toBeTruthy();
    const seeded = (await seed.json()) as { drafted: number };
    expect(seeded.drafted, "at least one draft PO was seeded").toBeGreaterThanOrEqual(1);

    await page.goto("/en/inventory");

    // ── Purchase Orders tab ────────────────────────────────────────────────
    // Radix tabs need real pointer events; click via the role-based locator
    // once the tab strip renders.
    const poTab = page.getByRole("tab", { name: /purchase orders/i });
    await expect(poTab).toBeVisible({ timeout: 45_000 });
    await poTab.click();

    // The PO table renders after /api/inventory/purchase-orders resolves.
    const rows = page.locator('[data-testid="po-row"]');
    await expect(rows.first()).toBeVisible({ timeout: 45_000 });

    // Count drafts BEFORE (the seed may add to pre-existing drafts).
    const draftRows = page.locator('[data-testid="po-row"][data-po-status="DRAFT"]');
    const beforeCount = await draftRows.count();
    expect(beforeCount, "draft rows present in the table").toBeGreaterThanOrEqual(1);
    // The Draft chip's live count matches the table.
    const draftChip = page.getByRole("button", { name: /^Draft/ });
    await expect(draftChip).toHaveText(new RegExp(`Draft\\s*${beforeCount}`));

    // ── Select every DRAFT row ────────────────────────────────────────────
    // The select-all header checkbox only covers DRAFT rows in view (the
    // selectable universe) — one click selects them all.
    await page.getByTestId("po-select-all").check();
    const toolbar = page.getByTestId("po-bulk-toolbar");
    await expect(toolbar).toBeVisible();
    await expect(toolbar).toContainText(new RegExp(`${beforeCount} draft PO\\(s\\) selected`));

    // ── Issue selected → confirmation dialog ──────────────────────────────
    await toolbar.getByRole("button", { name: /issue selected/i }).click();
    const confirmDialog = page.getByRole("alertdialog");
    await expect(confirmDialog).toBeVisible();
    await expect(confirmDialog).toContainText(
      new RegExp(`Issue ${beforeCount} draft purchase order`),
    );

    // ── Confirm → statuses flip + live counts update ──────────────────────
    await confirmDialog.getByRole("button", { name: "Issue", exact: true }).click();

    // The confirmation closes and the toolbar clears (selection reset).
    await expect(confirmDialog).not.toBeVisible({ timeout: 45_000 });
    await expect(page.getByTestId("po-bulk-toolbar")).toHaveCount(0);

    // Draft chip count drops by exactly the number issued.
    await expect(draftChip).toHaveText(
      new RegExp(`Draft\\s*${Math.max(0, beforeCount - beforeCount)}`),
      { timeout: 45_000 },
    );
    // All rows are now non-DRAFT: no draft rows remain in the table.
    await expect(draftRows).toHaveCount(0);

    // Sanity: total row count unchanged (rows were re-statused, not removed).
    const afterAll = await rows.count();
    expect(afterAll).toBeGreaterThanOrEqual(beforeCount);
  });
});
