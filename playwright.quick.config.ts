import { defineConfig, devices } from "@playwright/test";

const port = process.env.E2E_PORT ?? "3010";
const baseURL = `http://localhost:${port}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  timeout: 60_000,
  expect: { timeout: 20_000 },
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  // The isolation job is self-contained: CI has no pre-running server, while a
  // developer running this config locally gets their existing server reused.
  webServer: {
    command: `node node_modules/next/dist/bin/next dev -p ${port}`,
    url: `${baseURL}/en/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
