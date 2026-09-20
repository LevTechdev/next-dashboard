import { test, expect } from "@playwright/test";
import { loginAs, FETCH_GATED } from "./helpers";

/**
 * Team management — sorting controls + merged ADMIN/SUPER_ADMIN role matrix.
 *
 * The sort control (Name / Date modified / Type / Author + asc/desc) must
 * reorder the members table client-side, and the Permissions tab must show
 * the unified role set (no SUPER_ADMIN column — it was merged into ADMIN).
 */

test.describe("Team page — sorting controls", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page);
    await page.goto("/en/settings/team");
    await expect(page.getByRole("heading", { name: /team management/i })).toBeVisible(FETCH_GATED);
    // The members tab renders the search box once the roster fetch resolves.
    await expect(page.getByPlaceholder(/search/i)).toBeVisible(FETCH_GATED);
  });

  test("renders the sort field dropdown and direction toggle", async ({ page }) => {
    const sortSelect = page.getByRole("combobox");
    await expect(sortSelect).toBeVisible();
    await expect(sortSelect).toContainText(/name/i);

    // Direction toggle sits next to the dropdown and starts ascending.
    const dirButton = page.getByRole("button", { name: /ascending|descending/i });
    await expect(dirButton).toBeVisible();
  });

  test("sorts by name ascending then descending", async ({ page }) => {
    const table = page.getByRole("table");
    const firstCell = table.locator("tbody tr").first().locator("td").first();

    // Deterministic baseline: the control defaults to Name + ascending
    // (the button title names the CURRENT direction). Re-pick Name from the
    // dropdown so the test does not depend on default-state assumptions.
    await page.getByRole("combobox").click();
    await page.getByRole("option", { name: /^Name$/ }).click();

    // Rows carry an avatar-fallback initials chip plus the name — the
    // initials use text-xs (excluded) while the name uses font-medium.
    const ascNames = await table.locator("tbody tr td:first-child p.font-medium").allTextContents();
    expect(ascNames.length).toBeGreaterThan(1);
    const sortedAsc = [...ascNames].sort((a, b) => a.trim().localeCompare(b.trim()));
    expect(ascNames.map((n) => n.trim())).toEqual(sortedAsc.map((n) => n.trim()));

    // Flip to descending — the toggle shows the current direction, so the
    // ascending-labeled button is the one that flips it.
    await page.getByRole("button", { name: /ascending/i }).click();
    await expect(page.getByRole("button", { name: /descending/i })).toBeVisible();
    const descNames = await table
      .locator("tbody tr td:first-child p.font-medium")
      .allTextContents();
    const sortedDesc = [...ascNames].sort((a, b) => b.trim().localeCompare(a.trim()));
    expect(descNames.map((n) => n.trim())).toEqual(sortedDesc.map((n) => n.trim()));
    await expect(firstCell).toBeVisible();
  });

  test("sorts by type (role hierarchy)", async ({ page }) => {
    const table = page.getByRole("table");

    await page.getByRole("combobox").click();
    await page.getByRole("option", { name: /^Type$/ }).click();
    // Ascending = role rank: ADMIN before MANAGER before STAFF.
    const roles = await table.locator("tbody tr td:nth-child(2)").allTextContents();
    const rank = (r: string) =>
      ({ ADMIN: 0, MANAGER: 1, STAFF: 2, AUDITOR: 3, CLIENT: 4, CLIENT_ENTERPRISE: 5 })[r.trim()] ??
      99;
    const ranks = roles.map((r) => rank(r));
    expect([...ranks].sort((a, b) => a - b)).toEqual(ranks);
  });
});

test.describe("Team page — merged role matrix", () => {
  test("permissions matrix shows the unified role set without SUPER_ADMIN", async ({ page }) => {
    await loginAs(page);
    await page.goto("/en/settings/team");
    await expect(page.getByRole("heading", { name: /team management/i })).toBeVisible(FETCH_GATED);

    await page.getByRole("tab", { name: /permissions/i }).click();
    const matrix = page.getByRole("table").filter({
      has: page.getByRole("cell", { name: "Dashboard" }),
    });
    await expect(matrix).toBeVisible(FETCH_GATED);

    const headers = await matrix.locator("thead th").allTextContents();
    expect(headers).toContain("ADMIN");
    expect(headers).not.toContain("SUPER_ADMIN");

    // Legacy rows: the merged ADMIN covers what SUPER_ADMIN used to.
    const adminCol = headers.indexOf("ADMIN");
    const billingRow = matrix.locator("tbody tr").filter({
      has: page.getByRole("cell", { name: "Billing" }),
    });
    await expect(billingRow.locator("td").nth(adminCol).locator("svg")).toBeVisible();
  });
});
