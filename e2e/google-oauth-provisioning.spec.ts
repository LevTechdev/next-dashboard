import { test, expect, type Page } from "@playwright/test";

/**
 * Google OAuth signup end-to-end — with the Starter-tier provisioning
 * contract from src/lib/provisioning.ts.
 *
 * Real Google accounts can't be used in CI, so Google's token + userinfo
 * endpoints are mocked by a local server (scripts/tmp-google-mock.mjs,
 * started by the runner on 127.0.0.1:4400) and the app is pointed at it via
 * the GOOGLE_TOKEN_URL / GOOGLE_USERINFO_URL env seams (read by the callback
 * route; unset in production they default to the real endpoints). The dev
 * server must be started with those env vars — see the runner invocation.
 *
 * The callback route then runs its REAL code path: CSRF state validation →
 * token exchange → profile → find-or-create user →
 * **ensureStarterSubscription** → session + JWT cookie → redirect to
 * /en/dashboard.
 *
 * Asserted outcomes are API-level: /api/auth/me reports the new Google
 * identity with tier.planName "Starter" — the exact guarantee that was
 * missing for social signups before provisioning was centralized.
 */

const OAUTH_STATE = `e2e-state-${process.env.MOCK_EMAIL ?? "state"}`;

async function driveCallback(page: Page): Promise<void> {
  // Seed the CSRF state cookie exactly like /api/auth/google does.
  await page.context().addCookies([
    {
      name: "google_oauth_state",
      value: OAUTH_STATE,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  const resp = await page.goto(`/api/auth/google/callback?code=e2e-auth-code&state=${OAUTH_STATE}`);
  expect(resp?.status()).toBeLessThan(400);
  await page.waitForURL(/\/en\/dashboard/, { timeout: 45_000 });
}

test.describe("Google OAuth signup + Starter provisioning", () => {
  test("creates the user, provisions Starter, and lands in the dashboard", async ({ page }) => {
    const email = process.env.MOCK_EMAIL;
    test.skip(
      !email,
      "MOCK_EMAIL not set — start scripts/tmp-google-mock.mjs and export MOCK_EMAIL",
    );
    await driveCallback(page);

    const me = await page.request.get("/api/auth/me");
    expect(me.ok()).toBeTruthy();
    const data = await me.json();
    expect(data.email).toBe(email);
    // Tier data resolved through the freshly provisioned Starter plan.
    expect(data.tier?.planName).toBe("Starter");
    expect(data.tier?.tier).toBe("REGULAR");
    expect(data.tier?.hasAnalytics).toBe(false);
    expect(data.tier?.supportLevel).toBe("email");
  });
});
