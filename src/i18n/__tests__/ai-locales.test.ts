import { describe, it, expect } from "vitest";
import en from "../locales/en.json";
import id from "../locales/id.json";
import ja from "../locales/ja.json";
import zh from "../locales/zh.json";

const LOCALES = { en, id, ja, zh } as const;

describe("ai namespace i18n parity", () => {
  it("defines the ai namespace in every locale", () => {
    for (const [name, messages] of Object.entries(LOCALES)) {
      expect(messages.ai, `${name} missing ai namespace`).toBeDefined();
    }
  });

  it("has identical ai keys across all locales", () => {
    const enKeys = Object.keys(en.ai).sort();
    for (const [name, messages] of Object.entries(LOCALES)) {
      expect(Object.keys(messages.ai).sort(), `${name} ai keys differ`).toEqual(enKeys);
    }
  });

  it("has non-empty, localized values for every key (nested namespaces included)", () => {
    // Flatten the ai namespace to dotted leaf paths ("tools.getDashboardStats")
    // so nested objects like the tool chips are validated too.
    const collectLeaves = (obj: Record<string, unknown>, prefix = ""): [string, string][] =>
      Object.entries(obj).flatMap(([key, value]) => {
        const path = prefix ? `${prefix}.${key}` : key;
        if (value !== null && typeof value === "object" && !Array.isArray(value)) {
          return collectLeaves(value as Record<string, unknown>, path);
        }
        return [[path, String(value)]];
      });

    const leaves: Record<string, Record<string, string>> = {};
    for (const [name, messages] of Object.entries(LOCALES)) {
      leaves[name] = Object.fromEntries(
        collectLeaves(messages.ai as unknown as Record<string, unknown>),
      );
    }

    for (const [key, english] of Object.entries(leaves.en)) {
      expect(english.trim().length, `en.ai.${key} is empty`).toBeGreaterThan(0);
      for (const [name, localeLeaves] of Object.entries(leaves)) {
        expect(localeLeaves[key], `${name}.ai.${key} is missing`).toBeDefined();
        expect(localeLeaves[key].trim().length, `${name}.ai.${key} is empty`).toBeGreaterThan(0);
      }
    }
  });

  it("localizes question labels and queries for non-English locales", () => {
    expect(ja.ai.q1Label).toBe("私の総収益は？");
    expect(id.ai.q5Label).toBe("Penjualan per saluran");
    expect(zh.ai.q2Label).toBe("畅销产品");
  });
});
