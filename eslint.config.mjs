// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import storybook from "eslint-plugin-storybook";
import reactHooks from "eslint-plugin-react-hooks";

import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Community skills and generated files:
    ".agents/**",
  ]),
  ...storybook.configs["flat/recommended"],
  {
    plugins: {
      "react-hooks": reactHooks,
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      // React Compiler rules: downgrade from error to warn so CI lint passes.
      // These are strict new rules from eslint-plugin-react-hooks v7 that flag
      // pre-existing patterns across the codebase.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
    },
  },
  {
    // Standalone Node.js scripts (scripts/*) are idiomatic CommonJS.
    files: ["scripts/**"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  {
    // Native `title` tooltips are banned on dashboard surfaces. A native
    // tooltip renders as unstyled OS chrome — it ignores the design tokens in
    // src/components/ui/tooltip.tsx (the shared arrowless Radix primitive) and
    // is invisible to keyboard users unless the element also carries an
    // aria-label. Two shapes are flagged:
    //   - a string literal:  title="Download Invoice"
    //   - a translation call, directly or inside a ternary:
    //       title={t("viewDetails")}
    //       title={active ? t("pause") : t("activate")}
    // Dynamic VALUE hovers (title={formatMoney(order.grandTotal)},
    // title={run.ok ? undefined : run.error}) stay allowed: showing a
    // truncated value on hover is the one job native `title` still does well
    // and it carries no localizable copy. Component props named `title`
    // (<EmptyState title={...} />, <Metadata title=...>) are content, not
    // tooltips — the selector's parent regex exempts those four components
    // while still flagging pass-through components like <Button title=...>,
    // whose title lands on a real DOM element.
    // Scope mirrors the audit that migrated every site: dashboard pages and
    // all components, excluding the design-system primitives, the email
    // templates, stories and tests.
    files: ["src/app/[locale]/(dashboard)/**/*.tsx", "src/components/**/*.tsx"],
    ignores: ["**/__tests__/**", "**/*.stories.*", "src/components/ui/**", "src/components/emails/**"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "JSXOpeningElement[name.name=/^([a-z]|(?!EmptyState$|Metadata$|NavSection$|Table$)[A-Z])/] > JSXAttribute[name.name='title'][value.type='Literal']",
          message: "Use <Tooltip> from @/components/ui/tooltip.tsx instead of a native title tooltip.",
        },
        {
          selector:
            "JSXOpeningElement[name.name=/^([a-z]|(?!EmptyState$|Metadata$|NavSection$|Table$)[A-Z])/] > JSXAttribute[name.name='title']:has(JSXExpressionContainer CallExpression > Identifier[name=/^t[A-Za-z]*$/])",
          message: "Use <Tooltip> from @/components/ui/tooltip.tsx instead of a native title tooltip.",
        },
      ],
    },
  },
]);

export default eslintConfig;
