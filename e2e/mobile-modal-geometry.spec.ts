import { test, expect, type Page } from "@playwright/test";
import { loginAs } from "./helpers";

/**
 * Mobile modal geometry — the AI-copilot floating-sheet contract.
 *
 * DialogContent's mobile geometry was rebuilt (w-[calc(100%-2rem)] rounded-2xl
 * p-5, relaxing to sm:w-full sm:rounded-xl at ≥640px). These specs pin the
 * RENDERED result at a 375px phone viewport for the two highest-traffic
 * dialogs:
 *
 *   1. Order details (/orders → first row's View details)
 *   2. 2FA setup (/security → Set up 2FA — opened but never verified, so the
 *      seed admin's 2FA state is untouched; the dialog is cancelled after)
 *
 * For each dialog:
 *   - border-radius ≥ 16px (rounded-2xl — the sheet look, not the square
 *     edge-to-edge pre-fix layout)
 *   - ≥8px of viewport inset on BOTH sides (the "space" in "rounded + spaced")
 *   - the dialog box stays fully inside the viewport horizontally
 *   - the page gains no horizontal scroll while the dialog is open
 */

const VIEWPORT_W = 375;

interface SheetGeometry {
  radius: number;
  left: number;
  right: number;
  width: number;
  vw: number;
  pageOverflowX: boolean;
}

async function readDialogGeometry(page: Page, label: string): Promise<SheetGeometry> {
  const dialog = page.getByRole("dialog");
  await expect(dialog, `${label}: dialog renders`).toBeVisible({ timeout: 30_000 });

  // Wait for layout to settle (route can still be hydrating on a cold server)
  // before reading geometry, so a half-painted DOM can't produce zeros.
  await expect
    .poll(
      async () => {
        const box = await dialog.boundingBox();
        return !!box && box.width > 50 && box.height > 50;
      },
      { timeout: 15_000, message: `${label}: dialog never got real layout` },
    )
    .toBe(true);

  return dialog.evaluate((el) => {
    const cs = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    // Scrollbars shrink clientWidth; use the layout viewport for inset math.
    const vw = document.documentElement.clientWidth;
    return {
      radius: parseFloat(cs.borderTopLeftRadius) || 0,
      left: rect.left,
      right: rect.right,
      width: rect.width,
      vw,
      pageOverflowX:
        document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    };
  });
}

function expectFloatingSheetGeometry(g: SheetGeometry, label: string) {
  expect(g.radius, `${label}: corner radius ≥ 16px (rounded-2xl)`).toBeGreaterThanOrEqual(16);
  expect(g.left, `${label}: ≥8px inset from the left viewport edge`).toBeGreaterThanOrEqual(8);
  expect(
    g.vw - g.right,
    `${label}: ≥8px inset from the right viewport edge`,
  ).toBeGreaterThanOrEqual(8);
  expect(g.left, `${label}: left edge inside the viewport`).toBeGreaterThanOrEqual(0);
  expect(g.right, `${label}: right edge inside the viewport`).toBeLessThanOrEqual(g.vw + 0.5);
  expect(g.pageOverflowX, `${label}: page must not scroll horizontally while open`).toBe(false);
}

test.describe("Mobile modal geometry at 375px", () => {
  test.use({ viewport: { width: VIEWPORT_W, height: 812 } });

  test("order details dialog renders as an inset rounded sheet", async ({ page }) => {
    await loginAs(page);
    await page.goto("/en/orders");

    // Open the first order's details via its row action (the Eye button,
    // title="View Details"). The table only renders after the fetch resolves.
    // The row action swapped its `title` for a Tooltip + aria-label during the
    // tooltip migration, so address it by its accessible name.
    const viewButtons = page.locator('button[aria-label="View Details"]');
    await expect(viewButtons.first()).toBeVisible({ timeout: 45_000 });
    await viewButtons.first().click();

    const g = await readDialogGeometry(page, "order details");
    expectFloatingSheetGeometry(g, "order details");
    // Sanity: the sheet must be nearly full-width (calc(100%-2rem)) — an
    // accidental narrow dialog would also pass the inset checks.
    expect(g.width, "order details: sheet spans viewport minus 2rem").toBeGreaterThanOrEqual(
      g.vw - 48,
    );
  });

  test("2FA setup dialog renders as an inset rounded sheet", async ({ page }) => {
    await loginAs(page);
    await page.goto("/en/security");

    // The security cards render client-side after fetch.
    const setupBtn = page.getByRole("button", { name: "Set up 2FA" });
    await expect(setupBtn).toBeVisible({ timeout: 45_000 });
    await setupBtn.click();

    const g = await readDialogGeometry(page, "2FA setup");
    expectFloatingSheetGeometry(g, "2FA setup");

    // Never verify — cancel so the seed admin's 2FA state stays untouched.
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
});
