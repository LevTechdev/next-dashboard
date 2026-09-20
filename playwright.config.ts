import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E config for the Next.js dashboard.
 * - Dev server runs on port 3010 (see package.json "dev" script).
 * - Specs live in ./e2e.
 * - Preferred way to run: `npm run test:e2e:local` — targets a local Postgres
 *   mirror (provision once with `npm run db:provision:local`), blanks the
 *   mailer so the dev OTP/reset contract is visible, and sets AI_MOCK=1.
 *   Bare `npm run test:e2e` instead uses the DATABASE_URL from .env.local.
 *   See docs/e2e-run.md.
 * - Seeding + shared-DB prep happen ONCE in e2e/global-setup.ts before any
 *   worker starts, so specs must NOT re-seed/repair the shared DB in their
 *   own beforeAll (see global-setup.ts for why).
 * - 2 workers: the suite shares one Postgres DB and one dev server, so more
 *   parallelism would just multiply cold-route compiles and DB contention.
 *   fullyParallel stays false — several specs share module-level state across
 *   tests in a file (e.g. the 2FA spec's totpSecret/email) and need serial
 *   execution within the file.
 * - 60s per-test timeout: a cold route on the shared dev server can compile
 *   past the old 30s default on the first run after a .next rebuild (the
 *   dashboard-tabs-mobile cold-route flake), so the timeout buys headroom
 *   instead of a retry.
 */
// Port override: when the default 3010 listener is held by an unkillable
// process from another session (Access denied on taskkill), set E2E_PORT to
// run the suite against a fresh dev server on another port. The webServer
// command must stay in sync — it forwards the port to `next dev`.
const e2ePort = process.env.E2E_PORT ?? "3010";

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 2,
  reporter: [["list"], ["html", { open: "never" }]],
  timeout: 60_000,
  // 20s: under 2 workers, a cold auth POST on the shared dev server can take
  // ~14s (first login after a seed triggers an argon2 rehash upgrade, plus
  // concurrent advisory-lock waiters) — the old 10s default flaked on
  // loginAs's toHaveURL and the register flow's toBeVisible.
  expect: { timeout: 20_000 },
  use: {
    baseURL: `http://localhost:${e2ePort}`,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: process.env.E2E_PORT
      ? `npx next dev -p ${e2ePort}`
      : "npm run dev",
    url: `http://localhost:${e2ePort}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    // Extra env forwarded to the dev server: GOOGLE_TOKEN_URL / GOOGLE_USERINFO_URL
    // let the OAuth e2e spec point the callback route's outbound calls at a local
    // mock server (see e2e/google-oauth-provisioning.spec.ts).
    env: {
      ...(process.env.GOOGLE_TOKEN_URL ? { GOOGLE_TOKEN_URL: process.env.GOOGLE_TOKEN_URL } : {}),
      ...(process.env.GOOGLE_USERINFO_URL
        ? { GOOGLE_USERINFO_URL: process.env.GOOGLE_USERINFO_URL }
        : {}),
    },
  },
});
