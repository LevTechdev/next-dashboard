import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E config for the Next.js dashboard.
 * - Dev server runs on port 3010 (see package.json "dev" script).
 * - Specs live in ./e2e.
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
    baseURL: "http://localhost:3010",
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
    command: "npm run dev",
    url: "http://localhost:3010",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
