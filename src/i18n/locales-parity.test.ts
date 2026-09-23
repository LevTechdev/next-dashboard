import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Guards against i18n regressions like the `homePage`/`homepage` mismatch:
 * locales drifting apart (missing namespaces, stale key structures, or keys
 * present in one language but not another) silently render raw key paths to
 * users. The rules enforced here:
 *
 *  1. Every locale file exposes the exact same top-level namespaces.
 *  2. Every namespace has the exact same leaf key set in every locale.
 *  3. The `homepage` namespace exists in every locale and is at parity
 *     (called out separately so failures name the known failure mode).
 *
 * en.json is the source of truth for the key structure.
 */

const LOCALES = ["en", "id", "ja", "zh"] as const;
type Locale = (typeof LOCALES)[number];

function loadLocale(locale: Locale): Record<string, unknown> {
  const raw = readFileSync(
    join(process.cwd(), "src", "i18n", "locales", `${locale}.json`),
    "utf-8",
  );
  return JSON.parse(raw) as Record<string, unknown>;
}

/** Flatten a nested messages object into dotted leaf paths. */
function leafKeys(namespace: Record<string, unknown>, prefix = ""): string[] {
  const out: string[] = [];
  for (const [key, value] of Object.entries(namespace)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      out.push(...leafKeys(value as Record<string, unknown>, path));
    } else {
      out.push(path);
    }
  }
  return out.sort();
}

const messages = Object.fromEntries(LOCALES.map((l) => [l, loadLocale(l)])) as Record<
  Locale,
  Record<string, unknown>
>;
const en = messages.en;

describe("locale files", () => {
  it("parse and share identical top-level namespaces", () => {
    const enNamespaces = Object.keys(en).sort();
    for (const locale of LOCALES.slice(1)) {
      expect(Object.keys(messages[locale]).sort(), `${locale} namespaces`).toEqual(enNamespaces);
    }
  });

  it("every namespace has identical leaf key sets across locales", () => {
    for (const namespace of Object.keys(en)) {
      const enKeys = leafKeys(en[namespace] as Record<string, unknown>);
      for (const locale of LOCALES.slice(1)) {
        const localized = messages[locale][namespace] as Record<string, unknown> | undefined;
        expect(localized, `${locale} is missing the "${namespace}" namespace`).toBeDefined();
        expect(leafKeys(localized!), `${locale}.${namespace} leaf keys`).toEqual(enKeys);
      }
    }
  });

  it("keeps the homepage namespace at parity in every locale", () => {
    // Regression guard for the homePage/homepage mismatch: a differently-cased
    // or stale homepage namespace silently breaks the marketing home page.
    const enHomeKeys = leafKeys(en.homepage as Record<string, unknown>);
    expect(enHomeKeys.length, "homepage namespace should not be empty").toBeGreaterThan(0);
    for (const locale of LOCALES.slice(1)) {
      const home = messages[locale].homepage as Record<string, unknown> | undefined;
      expect(home, `${locale} is missing the "homepage" namespace`).toBeDefined();
      expect(leafKeys(home!), `${locale}.homepage leaf keys`).toEqual(enHomeKeys);
    }
  });
});
