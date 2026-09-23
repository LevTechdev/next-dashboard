import { test, expect } from "@playwright/test";
import { loginAs, FETCH_GATED } from "./helpers";

/**
 * Team page — per-member contribution grids.
 *
 * Reuses the profile activity heatmap as a compact per-member grid column
 * (visible only at xl+, where the extra table column has room):
 *
 *   1. At xl viewport every member row renders a grid with the full
 *      trailing-12-week cell count (12 cols × 7 rows).
 *   2. Below xl the column is hidden (contribution grids are a
 *      wide-screen feature; the narrow table keeps its density).
 *   3. The member activity API responds per-member for admins.
 */

test.describe("Team member activity grids", () => {
  test("renders per-member grids at xl viewport", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await loginAs(page);
    await page.goto("/en/settings/team");

    const grid = page.locator('[data-testid^="member-grid-"]').first();
    await expect(grid).toBeVisible(FETCH_GATED);

    // Grid = week columns of 7 cells, covering ≥ 12 trailing weeks
    // (12 full weeks + the current partial week = 12-14 columns).
    const columns = grid.locator("> div");
    const columnCount = await columns.count();
    expect(columnCount).toBeGreaterThanOrEqual(12);
    expect(columnCount).toBeLessThanOrEqual(14);

    // Each week column is exactly 7 days.
    for (let i = 0; i < columnCount; i++) {
      await expect(columns.nth(i).locator("span")).toHaveCount(7);
    }
  });

  test("hides the grid column below xl", async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 800 });
    await loginAs(page);
    await page.goto("/en/settings/team");

    // Wait for member rows to render (the first table body row appears).
    await expect(page.locator("table tbody tr").first()).toBeVisible(FETCH_GATED);
    // Column is hidden, so grids either don't mount or aren't visible.
    const count = await page.locator('[data-testid^="member-grid-"]:visible').count();
    expect(count).toBe(0);
  });

  test("member activity API responds per-member for admin", async ({ request }) => {
    const token = await loginAsViaApi(request);
    const team = await request.get("/api/team", {
      headers: { cookie: `token=${token}` },
    });
    expect(team.ok()).toBeTruthy();
    const members = (await team.json()) as Array<{ id: string }>;
    expect(members.length).toBeGreaterThan(0);

    const activity = await request.get(`/api/profile/activity?userId=${members[0].id}`, {
      headers: { cookie: `token=${token}` },
    });
    expect(activity.ok()).toBeTruthy();
    const payload = (await activity.json()) as {
      days: Record<string, number>;
      total: number;
    };
    expect(Array.isArray(payload.days)).toBe(false);
  });
});

async function loginAsViaApi(request: any): Promise<string> {
  const { SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD } = await import("./helpers");
  const res = await request.post("/api/auth/login", {
    data: { email: SEED_ADMIN_EMAIL, password: SEED_ADMIN_PASSWORD },
  });
  const setCookie = res.headers()["set-cookie"] ?? "";
  const match = setCookie.match(/token=([^;]+)/);
  return match ? match[1] : "";
}
