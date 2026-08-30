import { defineConfig } from "vitest/config";
import path from "path";
import { fileURLToPath } from "node:url";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { playwright } from "@vitest/browser-playwright";
const dirname =
  typeof __dirname !== "undefined" ? __dirname : path.dirname(fileURLToPath(import.meta.url));

// More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // The real server-only package throws via its default export; its
      // `react-server` entry (empty.js) is the intended no-op for non-bundler
      // environments like Vitest. Next.js resolves the same entry internally.
      "server-only": path.resolve(__dirname, "./node_modules/server-only/empty.js"),
    },
  },
  test: {
    coverage: {
      provider: "v8",
      reportsDirectory: "./coverage/unit",
      include: ["src/lib/**"],
      exclude: ["**/*.test.ts", "**/*.test.tsx", "**/node_modules/**"],
      thresholds: {
        statements: 25,
        branches: 20,
        functions: 25,
        lines: 25,
      },
    },
    projects: [
      {
        extends: true,
        test: {
          globals: true,
          environment: "node",
          include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
          exclude: ["**/__tests__/**", "**/node_modules/**"],
          server: {
            deps: {
              inline: ["next", "next-intl"],
            },
          },
        },
      },
      {
        extends: true,
        plugins: [
          // The plugin will run tests for the stories defined in your Storybook config
          // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
          storybookTest({
            configDir: path.join(dirname, ".storybook"),
          }),
        ],
        test: {
          name: "storybook",
          browser: {
            enabled: true,
            headless: true,
            provider: playwright({}),
            instances: [
              {
                browser: "chromium",
              },
            ],
          },
        },
      },
    ],
  },
});
