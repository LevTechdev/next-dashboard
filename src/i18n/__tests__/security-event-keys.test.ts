import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Security-event → display-key guard.
 *
 * The Security Center activity feed renders each row as
 * `t(\`evt_${e.type}\`)` (src/components/security/activity-card.tsx). That is a
 * TEMPLATE-LITERAL key, so no source-scanning guard can see it:
 *
 *  - referenced-keys.test.ts only resolves plain `t("key")` calls,
 *  - dynamic-keys.test.ts asserts the template shape, not which concrete keys
 *    it can produce.
 *
 * So when `TRUSTED_DEVICE_REVOKED` was added to the SecurityEventType union
 * without its `security.evt_TRUSTED_DEVICE_REVOKED` entry, every locale agreed
 * with every other locale (parity passed), the key was referenced by nobody
 * statically — and the feed rendered the raw string
 * `MISSING_MESSAGE: Could not resolve security.evt_TRUSTED_DEVICE_REVOKED`
 * to users who revoked a trusted device.
 *
 * This suite turns the union in src/lib/security-events.ts into the checklist:
 * every member must have a display key in all four locales. Adding an event
 * type without its copy now fails the i18n suite instead of shipping.
 *
 * Reverse direction (an `evt_*` key with no union member) is deliberately NOT
 * asserted: seeded fixtures log made-up types (the tenant-isolation seed emits
 * ISOLATION_TENANT_A_EVENT / ISOLATION_TENANT_B_EVENT), which are legitimate
 * rows in a dev database.
 */

const ROOT = join(__dirname, "..", "..", "..");
const LOCALES = ["en", "id", "ja", "zh"] as const;

/** The union’s members, read from the declaration (the file is server-only). */
function securityEventTypes(): string[] {
  const source = readFileSync(join(ROOT, "src", "lib", "security-events.ts"), "utf-8");
  const start = source.indexOf("export type SecurityEventType");
  if (start === -1) throw new Error("SecurityEventType declaration not found");
  const end = source.indexOf(";", start);
  const body = source
    .slice(start, end)
    // Strip block + line comments so prose in them never reads as a member.
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
  return [...new Set([...body.matchAll(/"([A-Z][A-Z0-9_]+)"/g)].map((m) => m[1]))];
}

function securityBundle(locale: string): Record<string, unknown> {
  return (
    JSON.parse(readFileSync(join(ROOT, "src", "i18n", "locales", `${locale}.json`), "utf-8")) as {
      security: Record<string, unknown>;
    }
  ).security;
}

describe("security event display keys", () => {
  const types = securityEventTypes();
  const bundles = Object.fromEntries(LOCALES.map((l) => [l, securityBundle(l)]));

  it("extracts the event-type union", () => {
    // Guards the extractor itself: if the declaration is reformatted the spec
    // must fail loudly, not silently check an empty list.
    expect(types.length).toBeGreaterThan(20);
    expect(types).toContain("MFA_VERIFIED");
    expect(types).toContain("TRUSTED_DEVICE_REVOKED");
  });

  it.each(LOCALES)("%s defines evt_<TYPE> for every security event type", (locale) => {
    const security = bundles[locale];
    const missing = types.filter((type) => security[`evt_${type}`] === undefined);
    expect(
      missing,
      `${locale}.json has no display copy for: ${missing.join(", ")}. ` +
        "The activity feed renders t(`evt_<TYPE>`) — add the missing security.evt_* keys.",
    ).toEqual([]);
  });

  it.each(LOCALES)("%s event copy is non-empty and free of raw keys", (locale) => {
    const security = bundles[locale];
    const broken = types.filter((type) => {
      const value = security[`evt_${type}`];
      return typeof value !== "string" || value.trim().length === 0 || value.includes("evt_");
    });
    expect(broken).toEqual([]);
  });
});
