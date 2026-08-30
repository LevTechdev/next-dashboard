import { test, expect } from "@playwright/test";
import { loginAs, logoutViaHeader } from "./helpers";

/**
 * Logout + protected-route E2E (pw5).
 * Seed the DB first: `npm run db:seed`.
 * Seed admin creds: nextdashboards@gmail.com / admin123.
 *
 * The logout UI flow (open header user menu → Logout menuitem → confirm the
 * destructive dialog → land back on /login) lives in the shared
 * `logoutViaHeader` helper (e2e/helpers.ts). This spec exercises it against
 * the seed admin via `loginAs`.
 *
 * Protected route:
 * - There is NO client-side redirect guard (no middleware). Route
 *   protection is enforced at the API layer: /api/auth/me returns 401
 *   without a valid token cookie.
 */
test.describe("Logout", () => {
  test("logs out from the header menu and returns to /login", async ({ page }) => {
    await loginAs(page);
    await logoutViaHeader(page);
  });
});

test.describe("Protected route", () => {
  test("returns 401 from /api/auth/me without a session cookie", async ({ request }) => {
    const res = await request.get("/api/auth/me");
    expect(res.status()).toBe(401);
  });
});
