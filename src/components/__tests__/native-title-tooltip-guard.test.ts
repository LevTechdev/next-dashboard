import { readFileSync } from "node:fs";
import { Linter } from "eslint";
import { describe, expect, it } from "vitest";

/**
 * Pins the native-title-tooltip ESLint rule into eslint.config.mjs.
 *
 * The rule itself lives in the flat config as two `no-restricted-syntax`
 * selectors (string-literal titles and translated/conditional titles on JSX
 * attributes). This test exists so the rule cannot be silently deleted: it
 * asserts the config still carries it, scoped to the dashboard pages and
 * components at error severity — and that the shipped selectors actually
 * catch every shape the vitest-era guard used to flag (literal, translated,
 * conditional) while letting data-value hovers and content props through.
 */

/** Pull the tooltip-rule config block back out of the flat config file. */
function readRuleFromConfig(): void {
  const source = readFileSync("eslint.config.mjs", "utf-8");
  if (!source.includes("Native `title` tooltips are banned on dashboard surfaces")) {
    throw new Error("eslint.config.mjs no longer carries the native-title-tooltip rule");
  }
  const scoped =
    source.includes(
      `files: ["src/app/[locale]/(dashboard)/**/*.tsx", "src/components/**/*.tsx"]`,
    ) && source.includes(`"src/components/ui/**"`);
  const literal = source.includes(
    "JSXOpeningElement[name.name=/^([a-z]|(?!EmptyState$|Metadata$|NavSection$|Table$)[A-Z])/] > JSXAttribute[name.name='title'][value.type='Literal']",
  );
  const translated = source.includes(
    "JSXOpeningElement[name.name=/^([a-z]|(?!EmptyState$|Metadata$|NavSection$|Table$)[A-Z])/] > JSXAttribute[name.name='title']:has(JSXExpressionContainer CallExpression > Identifier[name=/^t[A-Za-z]*$/])",
  );
  if (!scoped || !literal || !translated) {
    throw new Error("tooltip rule selectors missing or scope changed in eslint.config.mjs");
  }
}

/** Run the two shipped selectors against a JSX snippet. */
function lintJsx(code: string): number {
  const literal =
    "JSXOpeningElement[name.name=/^([a-z]|(?!EmptyState$|Metadata$|NavSection$|Table$)[A-Z])/] > JSXAttribute[name.name='title'][value.type='Literal']";
  const translated =
    "JSXOpeningElement[name.name=/^([a-z]|(?!EmptyState$|Metadata$|NavSection$|Table$)[A-Z])/] > JSXAttribute[name.name='title']:has(JSXExpressionContainer CallExpression > Identifier[name=/^t[A-Za-z]*$/])";
  // eslintrc mode: the flat-config Linter ignores inline rule configs.
  const linter = new Linter({ configType: "eslintrc" });
  const messages = linter.verify(
    code,
    {
      parserOptions: { ecmaVersion: "latest", sourceType: "module", ecmaFeatures: { jsx: true } },
      rules: { "no-restricted-syntax": ["error", { selector: literal }, { selector: translated }] },
    },
    "probe.tsx",
  );
  return messages.filter((m) => m.ruleId).length;
}

describe("native title tooltip eslint rule", () => {
  it("is configured in eslint.config.mjs at error severity with the audited scope", () => {
    expect(() => readRuleFromConfig()).not.toThrow();
  });

  it("selectors match every banned shape and allow data hovers", () => {
    // Banned shapes — the three the vitest guard used to count.
    expect(lintJsx('const a = <button title="Download Invoice">x</button>;')).toBe(1);
    expect(lintJsx('const a = <button title={t("viewDetails")}>x</button>;')).toBe(1);
    expect(lintJsx('const a = <button title={active ? t("pause") : t("resume")}>x</button>;')).toBe(
      1,
    );
    expect(lintJsx('const a = <button title={tcommon("copy")}>x</button>;')).toBe(1);

    // Allowed — dynamic data hovers and content-level props.
    expect(lintJsx("const a = <button title={formatMoney(o.grandTotal)}>x</button>;")).toBe(0);
    expect(lintJsx("const a = <button title={run.ok ? undefined : run.error}>x</button>;")).toBe(0);
    expect(lintJsx('const a = <EmptyState title={t("noOrders")} />;')).toBe(0);
  });
});
