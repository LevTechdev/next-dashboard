import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

/**
 * Live menu walkthrough for every sidebar destination. Each route must:
 *   - answer with a document response (no hard 4xx/5xx),
 *   - render the dashboard shell without an error boundary or login redirect,
 *   - produce no uncaught page errors,
 *   - issue no 5xx API responses while loading.
 *
 * This is intentionally a navigation smoke test, not a per-widget assertion
 * suite: it proves the DB-backed pages render after the store migration and
 * that no menu entry is dead.
 */

const MENU_ROUTES = [
  "/dashboard",
  "/analytics",
  "/sales",
  "/orders",
  "/customers",
  "/products",
  "/inventory",
  "/marketing",
  "/affiliates",
  "/discounts",
  "/reports",
  "/audit-log",
  "/admin",
  "/system-health",
  "/roles",
  "/integrations",
  "/sso",
  "/api-docs",
  "/settings/team",
  "/billing",
  "/notifications",
  "/security",
  "/settings",
  "/profile",
] as const;

test("every dashboard menu renders from the database without errors", async ({ page }) => {
  test.setTimeout(600_000);

  const pageErrors: string[] = [];
  const serverErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(`${page.url()}: ${error.message}`));
  page.on("response", (response) => {
    if (response.url().includes("/api/") && response.status() >= 500) {
      serverErrors.push(`${response.status()} ${response.url()}`);
    }
  });

  await loginAs(page);

  const failures: string[] = [];
  for (const route of MENU_ROUTES) {
    const response = await page.goto(`/en${route}`, {
      waitUntil: "domcontentloaded",
      timeout: 90_000,
    });
    await page.waitForTimeout(1_200);

    if (!response || response.status() >= 400) {
      failures.push(`${route}: document status ${response?.status() ?? "none"}`);
      continue;
    }
    if (!page.url().includes(`/en${route}`)) {
      failures.push(`${route}: redirected to ${page.url()}`);
      continue;
    }

    const body = page.locator("body");
    const text = await body.innerText().catch(() => "");
    if (/application error|something went wrong|internal server error/i.test(text)) {
      failures.push(`${route}: error surface rendered`);
    }
    if (await page.locator("main").count()) {
      await expect(page.locator("main")).toBeVisible({ timeout: 30_000 });
    } else {
      failures.push(`${route}: no dashboard shell rendered`);
    }
  }

  expect(failures, failures.join("\n")).toEqual([]);
  expect(pageErrors, pageErrors.join("\n")).toEqual([]);
  expect(serverErrors, serverErrors.join("\n")).toEqual([]);
});
