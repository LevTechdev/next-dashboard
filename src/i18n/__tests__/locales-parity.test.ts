import { describe, it, expect } from "vitest";
import en from "../locales/en.json";
import id from "../locales/id.json";
import ja from "../locales/ja.json";
import zh from "../locales/zh.json";

/**
 * Guards i18n parity across all 4 supported locales: every namespace and every
 * key present in the English source must exist in every other locale, and vice
 * versa. Catches incomplete merges (like the hardcoded-string sweep) before
 * they reach production.
 */
const LOCALES: Record<string, Record<string, unknown>> = {
  en: en as unknown as Record<string, unknown>,
  id: id as unknown as Record<string, unknown>,
  ja: ja as unknown as Record<string, unknown>,
  zh: zh as unknown as Record<string, unknown>,
};

function collectPaths(obj: Record<string, unknown>, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      return collectPaths(value as Record<string, unknown>, path);
    }
    return [path];
  });
}

const pathsByLocale: Record<string, Set<string>> = Object.fromEntries(
  Object.entries(LOCALES).map(([locale, messages]) => [locale, new Set(collectPaths(messages))]),
);

describe("locale parity", () => {
  it("all locales expose the exact same namespace/key tree as en", () => {
    const enPaths = pathsByLocale.en;
    for (const [locale, paths] of Object.entries(pathsByLocale)) {
      if (locale === "en") continue;
      const missing = [...enPaths].filter((p) => !paths.has(p));
      const extra = [...paths].filter((p) => !enPaths.has(p));
      expect(
        missing,
        `${locale} is missing keys that exist in en: ${missing.slice(0, 10).join(", ")}`,
      ).toEqual([]);
      expect(
        extra,
        `${locale} has extra keys not in en: ${extra.slice(0, 10).join(", ")}`,
      ).toEqual([]);
    }
  });

  it("every locale contains the security score keys used by SecurityCenter", () => {
    for (const [locale, messages] of Object.entries(LOCALES)) {
      const security = messages.security as Record<string, unknown> | undefined;
      expect(security?.scoreLabel, `${locale}.security.scoreLabel`).toBeTruthy();
      expect(security?.scoreGreat, `${locale}.security.scoreGreat`).toBeTruthy();
      expect(security?.mfaVerifiedRecent, `${locale}.security.mfaVerifiedRecent`).toBeTruthy();
      expect(
        security?.mfaNotVerifiedRecent,
        `${locale}.security.mfaNotVerifiedRecent`,
      ).toBeTruthy();
      expect(security?.lastPasskeyWarning, `${locale}.security.lastPasskeyWarning`).toBeTruthy();
    }
  });
});
