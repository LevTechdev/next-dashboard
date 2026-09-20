import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Namespace-aware i18n guard — kills the wrong-namespace bug class.
 *
 * Twice this session, a component called t("key") through a namespace that
 * never contained the key (security.copySecret living only under profile),
 * and next-intl silently rendered the raw key with a console-only
 * MISSING_MESSAGE error. Runtime parity tests can't catch this: the key
 * EXISTS, just in the wrong namespace. This guard statically walks every
 * component source and asserts each t("key") call resolves inside the
 * namespace(s) that component actually binds with useTranslations("ns").
 *
 * Scope: the same dashboard surfaces the tooltip guard covers, plus server
 * components binding namespaces through `await getTranslations("ns")`. Known
 * limitations (documented, acceptable): template-literal keys are covered by
 * dynamic-keys.test.ts; conditional ternary namespaces default to the first
 * branch; keys built from variables are skipped.
 */

const ROOT = join(__dirname, "..", "..", "..");
const SRC_DIRS = [
  join(ROOT, "src", "components"),
  join(ROOT, "src", "app", "[locale]", "(dashboard)"),
];
const LOCALES = ["en", "id", "ja", "zh"] as const;

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...walk(p));
    else if (/\.(tsx|ts)$/.test(p) && !/\.test\.tsx?$/.test(p) && !/\.stories\.tsx?$/.test(p))
      out.push(p);
  }
  return out;
}

type Bundle = Record<string, unknown>;
const bundles = Object.fromEntries(
  LOCALES.map((l) => [
    l,
    JSON.parse(readFileSync(join(ROOT, "src", "i18n", "locales", `${l}.json`), "utf-8")) as Bundle,
  ]),
) as Record<(typeof LOCALES)[number], Bundle>;

function hasKey(bundle: Bundle, ns: string, key: string): boolean {
  // The namespace itself may be dotted ("settings.scheduler") — traverse it
  // segment-wise, then walk the key the same way.
  let node: unknown = bundle;
  for (const seg of [...ns.split("."), ...key.split(".")]) {
    if (node == null || typeof node !== "object") return false;
    node = (node as Bundle)[seg];
  }
  return typeof node === "string";
}

describe("namespace-aware t() key resolution", () => {
  const files = SRC_DIRS.flatMap((d) => walk(d));

  it("collected a reasonable corpus (sanity)", () => {
    expect(files.length).toBeGreaterThan(50);
  });

  for (const file of files) {
    const rel = file.slice(ROOT.length + 1);
    const src = readFileSync(file, "utf-8");
    if (!src.includes("useTranslations(") && !src.includes("getTranslations(")) continue;

    // Namespaces this file binds: the useTranslations("ns") hook and the
    // server-side `await getTranslations("ns")` — same key/namespace rules.
    const nsMatches = [
      ...src.matchAll(/(?:useTranslations|getTranslations)\(\s*["'`]([A-Za-z0-9_.-]+)["'`]\s*\)/g),
    ].map((m) => m[1]);
    if (nsMatches.length === 0) continue;
    const namespaces = [...new Set(nsMatches)];

    // Static t("key") / t('key') calls on the default `t` identifier only —
    // aliased hooks (tcommon, tprofile...) are checked only when the file
    // binds exactly one namespace per alias, which the regex below resolves.
    const aliasNs = new Map<string, string>();
    for (const m of src.matchAll(
      /(?:const|var|let)\s+(\w+)\s*=\s*(?:useTranslations|getTranslations)\(\s*["'`]([A-Za-z0-9_.-]+)["'`]\s*\)/g,
    )) {
      aliasNs.set(m[1], m[2]);
    }
    // A bare `t` binding: first alias named exactly `t`, else skip dynamic use.
    const offenders: string[] = [];

    for (const [alias, ns] of aliasNs) {
      for (const m of src.matchAll(
        new RegExp(`\\b${alias}\\(\\s*["'\`]([A-Za-z0-9_.]+)["'\`]\\s*[,)]`, "g"),
      )) {
        const key = m[1];
        if (!hasKey(bundles.en, ns, key)) {
          offenders.push(`${alias}("${key}") missing from ${ns} (en)`);
          continue;
        }
        for (const l of LOCALES) {
          if (!hasKey(bundles[l], ns, key))
            offenders.push(`${alias}("${key}") missing from ${ns} (${l})`);
        }
      }
    }

    it(`${rel}: every aliased t() key resolves in its namespace`, () => {
      expect(offenders, `${rel}\n  ${offenders.join("\n  ")}`).toEqual([]);
    });
  }
});
