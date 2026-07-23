import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    pool: "vmThreads",
    include: ["src/app/api/__tests__/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/my-app/**"],
    server: {
      deps: {
        inline: ["next", "next-intl"],
      },
    },
    coverage: {
      provider: "v8",
      reportsDirectory: "./coverage/api",
      include: ["src/app/api/**"],
      exclude: ["**/*.test.ts", "**/node_modules/**", "**/my-app/**"],
      thresholds: {
        statements: 55,
        branches: 50,
        functions: 55,
        lines: 55,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
