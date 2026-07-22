import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    include: ["**/__tests__/**/*.test.{ts,tsx}"],
    exclude: ["**/node_modules/**", "**/my-app/**"],
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
      exclude: ["**/*.test.ts", "**/*.test.tsx", "**/node_modules/**", "**/my-app/**", "**/__tests__/**"],
      thresholds: {
        statements: 43,
        branches: 35,
        functions: 38,
        lines: 44,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
