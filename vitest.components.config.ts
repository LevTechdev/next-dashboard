import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    include: ["**/__tests__/**/*.test.{ts,tsx}"],
    exclude: ["**/node_modules/**", "**/my-app/**", "src/app/api/**"],
    setupFiles: ["./src/app/[locale]/(marketing)/__tests__/setup.ts"],
    css: false,
    server: {
      deps: {
        inline: ["next", "next-intl"],
      },
    },
    coverage: {
      provider: "v8",
      reportsDirectory: "./coverage/components",
      include: ["src/components/**", "src/app/[locale]/(dashboard)/**"],
      exclude: [
        "**/*.test.ts",
        "**/*.test.tsx",
        "**/node_modules/**",
        "**/my-app/**",
        "**/__tests__/**",
      ],
      thresholds: {
        statements: 30,
        branches: 25,
        functions: 25,
        lines: 30,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // Real package no-op entry (see vitest.config.ts comment).
      "server-only": path.resolve(__dirname, "./node_modules/server-only/empty.js"),
    },
  },
});
