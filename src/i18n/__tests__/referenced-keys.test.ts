import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Source → locale guard: every key a component asks for must exist in the
 * locale files.
 *
 * Why this exists next to locales-parity.test.ts and namespace-keys.test.ts:
 *
 *  - locales-parity.test.ts compares the four locales to EACH OTHER. A key
 *    missing from all four passes it happily — which is exactly how the careers
 *    page shipped rendering the literal string `careersPage.r1Title` (the page
 *    used ids r1…r4, every locale stored role1…role4, so there was nothing to
 *    disagree about).
 *  - namespace-keys.test.ts walks components/ and the dashboard only, needs a
 *    string-literal namespace, and only looks at plain `t("key")` calls.
 *    Marketing pages, the auth pages, root-namespace hooks and the
 *    `t.rich/t.raw/t.has` family were uncovered.
 *
 * This suite closes both gaps: it walks EVERY source file under src/app,
 * src/components and src/hooks, resolves each translation binding to the
 * namespace it was created with (including no-namespace root bindings and
 * translators passed in as props), and fails listing `file:line` for any
 * referenced key that no locale defines.
 *
 * Deliberate limits: template-literal keys belong to dynamic-keys.test.ts;
 * keys built from variables are skipped; a translator received as a prop whose
 * call site cannot be resolved is skipped rather than guessed.
 */

const ROOT = join(__dirname, "..", "..", "..");
const SRC_DIRS = [
  join(ROOT, "src", "app"),
  join(ROOT, "src", "components"),
  join(ROOT, "src", "hooks"),
];
const LOCALES = ["en", "id", "ja", "zh"] as const;
type Locale = (typeof LOCALES)[number];

type Bundle = Record<string, unknown>;

const bundles = Object.fromEntries(
  LOCALES.map((locale) => [
    locale,
    JSON.parse(
      readFileSync(join(ROOT, "src", "i18n", "locales", `${locale}.json`), "utf-8"),
    ) as Bundle,
  ]),
) as Record<Locale, Bundle>;

/**
 * `t("group" + label)`-style CONCATENATED keys. The dynamic-keys tripwire only
 * sees template literals (`t(\`groups.${}\`)`), so a concatenation is invisible
 * to it — these are registered here with the concrete keys each prefix can
 * produce, and the keys are asserted in all four locales below.
 */
const CONCATENATED_KEYS: Array<{ namespace: string; prefix: string; keys: string[] }> = [
  {
    // integrations/page.tsx: getGroupLabel builds `group` + the webhook group
    // label ("Orders", "Customers", "Products", "Payments").
    namespace: "integrations",
    prefix: "group",
    keys: ["groupOrders", "groupCustomers", "groupProducts", "groupPayments"],
  },
];

/** Translation entry points whose first argument is a key. */
const KEY_BEARING_MEMBERS = ["rich", "markup", "raw", "has"] as const;

export interface Offender {
  line: number;
  detail: string;
}

function walk(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (entry === "node_modules" || entry === "__tests__" || entry === ".next") continue;
      walk(full, out);
    } else if (
      /\.tsx?$/.test(entry) &&
      !/\.(test|spec)\.tsx?$/.test(entry) &&
      !entry.endsWith(".d.ts")
    ) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Source with comments blanked out, keeping every offset (and therefore every
 * line number) intact. Without this, prose ABOUT a removed binding — e.g. a
 * comment saying the page once used getTranslations("marketing.pricing") — is
 * scanned as if it were live code.
 */
export function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, " "))
    .replace(
      /(^|[^:"'`\w])\/\/[^\n]*/gm,
      (comment, prefix: string) => prefix + " ".repeat(comment.length - prefix.length),
    );
}

/**
 * Resolve `namespace.key` in a bundle. Intermediate objects are traversed, so
 * dotted namespaces ("settings.scheduler") and dotted keys ("bento.rt1") both
 * work; a namespace of "" resolves the key from the bundle root.
 */
export function lookup(bundle: Bundle, namespace: string, key: string): unknown {
  let node: unknown = bundle;
  const segments = [...(namespace ? namespace.split(".") : []), ...key.split(".")];
  for (const segment of segments) {
    if (node == null || typeof node !== "object") return undefined;
    node = (node as Bundle)[segment];
  }
  return node;
}

/** A translator's possible namespaces, plus whether they could be resolved. */
interface Translator {
  namespaces: Set<string>;
  resolved: boolean;
}

function collectTranslators(source: string): {
  translators: Map<string, Translator>;
  namespaceLiterals: Set<string>;
} {
  const namespaceLiterals = new Set(
    [
      ...source.matchAll(/(?:useTranslations|getTranslations)\(\s*["'`]([A-Za-z0-9_.-]+)["'`]/g),
    ].map((match) => match[1]),
  );

  const translators = new Map<string, Translator>();
  const add = (alias: string, namespace: string) => {
    const current = translators.get(alias);
    if (current) current.namespaces.add(namespace);
    else translators.set(alias, { namespaces: new Set([namespace]), resolved: true });
  };

  // const tsite = useTranslations("site")   → alias bound to "site"
  // const t = await getTranslations()       → root binding (keys are full paths)
  const bindings = new Map<string, string>();
  for (const match of source.matchAll(
    /(?:const|let|var)\s+(\w+)\s*=\s*(?:await\s+)?(?:useTranslations|getTranslations)\(\s*(?:["'`]([A-Za-z0-9_.-]+)["'`])?\s*\)/g,
  )) {
    bindings.set(match[1], match[2] ?? "");
  }
  for (const [alias, namespace] of bindings) add(alias, namespace);

  // Components that RECEIVE a translator as a prop (`t: ReturnType<typeof
  // useTranslations>`). The prop's namespace is whatever the parent passes, so
  // it is read from the call sites: `<DemoCard t={tCommon} />` → "common".
  const propAliases = new Set(
    [
      ...source.matchAll(
        /(\w+)\s*:\s*(?:ReturnType<typeof\s+useTranslations>|\s*\(\s*key:\s*string[^)]*\)\s*=>\s*string)/g,
      ),
    ].map((match) => match[1]),
  );
  for (const alias of propAliases) {
    const passedNamespaces = [...source.matchAll(new RegExp(`\\b${alias}=\\{(\\w+)\\}`, "g"))]
      .map((match) => match[1])
      .filter((identifier) => bindings.has(identifier))
      .map((identifier) => bindings.get(identifier)!);

    if (passedNamespaces.length === 0) {
      // Unknown namespace — skip instead of reporting a false positive.
      translators.set(alias, { namespaces: new Set(), resolved: false });
      continue;
    }
    for (const namespace of passedNamespaces) add(alias, namespace);
  }

  return { translators, namespaceLiterals };
}

/** Audit one file's source; empty array means every referenced key resolves. */
export function auditSource(source: string): Offender[] {
  const code = stripComments(source);
  const { translators, namespaceLiterals } = collectTranslators(code);
  const offenders: Offender[] = [];
  const lineOf = (index: number) => source.slice(0, index).split("\n").length;

  for (const namespace of namespaceLiterals) {
    for (const locale of LOCALES) {
      if (lookup(bundles[locale], "", namespace) === undefined) {
        offenders.push({
          line: 0,
          detail: `useTranslations("${namespace}") — namespace missing from ${locale}.json`,
        });
      }
    }
  }

  for (const [alias, translator] of translators) {
    if (!translator.resolved) continue;
    const namespaces = [...translator.namespaces];

    // The literal must be the WHOLE first argument: `t("group" + label)` is a
    // concatenation (covered by CONCATENATED_KEYS), not a key.
    const callPattern = new RegExp(
      `\\b${alias}(?:\\.(?:${KEY_BEARING_MEMBERS.join("|")}))?\\(\\s*["'\`]([A-Za-z0-9_.-]+)["'\`]\\s*[,)]`,
      "g",
    );

    for (const match of code.matchAll(callPattern)) {
      const key = match[1];
      const isRaw = /\.raw\(/.test(match[0]);
      const line = lineOf(match.index);

      for (const locale of LOCALES) {
        // With several candidate namespaces (a file-level binding AND a prop of
        // the same name) the key is fine if ANY of them defines it.
        const defined = namespaces.some((namespace) => {
          const value = lookup(bundles[locale], namespace, key);
          return isRaw ? value !== undefined : typeof value === "string";
        });
        if (defined) continue;
        const targets = namespaces.map((ns) => (ns ? `${ns}.${key}` : key)).join(" | ");
        offenders.push({
          line,
          detail: `${alias}("${key}") → "${targets}" is not defined in ${locale}.json`,
        });
      }
    }
  }

  return offenders;
}

const SOURCE_FILES = SRC_DIRS.flatMap((dir) => walk(dir));

describe("every referenced translation key exists in every locale", () => {
  it("collected a reasonable corpus (sanity)", () => {
    expect(SOURCE_FILES.length).toBeGreaterThan(200);
  });

  it("finds translation bindings to audit (sanity)", () => {
    const withBindings = SOURCE_FILES.filter((file) =>
      /(?:useTranslations|getTranslations)\s*\(/.test(readFileSync(file, "utf-8")),
    );
    expect(withBindings.length).toBeGreaterThan(50);
  });

  for (const file of SOURCE_FILES) {
    const rel = file.slice(ROOT.length + 1);
    const source = readFileSync(file, "utf-8");
    if (!source.includes("useTranslations(") && !source.includes("getTranslations(")) continue;

    const offenders = auditSource(source);
    if (offenders.length === 0) continue;

    it(`${rel}: every referenced key resolves in all locales`, () => {
      const unique = [...new Set(offenders.map((o) => `line ${o.line}: ${o.detail}`))];
      expect(unique, `${rel}\n  ${unique.join("\n  ")}`).toEqual([]);
    });
  }
});

describe("guard sensitivity (the detector itself)", () => {
  it("flags a key no locale defines", () => {
    const offenders = auditSource(
      [
        'import { useTranslations } from "next-intl";',
        'const t = useTranslations("common");',
        't("noLocaleDefinesThis");',
      ].join("\n"),
    );
    expect(offenders).toHaveLength(LOCALES.length);
    expect(offenders[0].line).toBe(3);
    expect(offenders[0].detail).toContain("common.noLocaleDefinesThis");
  });

  it("flags an unknown namespace", () => {
    const offenders = auditSource('const t = await getTranslations("marketing.pricing");');
    expect(offenders.map((o) => o.detail)).toEqual(
      LOCALES.map(
        (locale) => `useTranslations("marketing.pricing") — namespace missing from ${locale}.json`,
      ),
    );
  });

  it("accepts a key held by the namespace a prop-supplied translator points at", () => {
    // Mirrors the ui/alert-dialog demo: the file binds `t` to its own namespace
    // but hands `tCommon` to the child that calls t("cancel").
    const offenders = auditSource(
      [
        'const t = useTranslations("soraGalleryPage");',
        'const tCommon = useTranslations("common");',
        "function DemoCard({ t }: { t: ReturnType<typeof useTranslations> }) {",
        '  return t("cancel");',
        "}",
        "<DemoCard t={tCommon} />",
      ].join("\n"),
    );
    expect(offenders).toEqual([]);
  });

  it("does not mistake a string concatenation for a literal key", () => {
    const offenders = auditSource(
      ['const t = useTranslations("integrations");', 'return t("group" + label);'].join("\n"),
    );
    expect(offenders).toEqual([]);
  });

  it("ignores keys that only appear inside comments", () => {
    const offenders = auditSource(
      [
        'const t = useTranslations("common");',
        '// Was getTranslations("marketing.pricing") before it was localized.',
        '/* t("alsoNotAKey") */',
      ].join("\n"),
    );
    expect(offenders).toEqual([]);
  });

  it("resolves t.rich and t.raw keys too", () => {
    const offenders = auditSource(
      [
        'const t = useTranslations("common");',
        't.rich("richMissingKey", {});',
        't.raw("rawMissingKey");',
      ].join("\n"),
    );
    // 2 calls × 4 locales.
    expect(offenders).toHaveLength(2 * LOCALES.length);
  });
});

describe("concatenated translation keys", () => {
  it("every registered concatenated key exists in all locales", () => {
    const missing: string[] = [];
    for (const { namespace, prefix, keys } of CONCATENATED_KEYS) {
      for (const key of keys) {
        for (const locale of LOCALES) {
          if (typeof lookup(bundles[locale], namespace, key) !== "string") {
            missing.push(
              `${namespace}.${key} missing from ${locale}.json (built as "${prefix}" + …)`,
            );
          }
        }
      }
    }
    expect(missing, missing.join("\n")).toEqual([]);
  });

  it('has no unregistered t("prefix" + …) concatenation in source', () => {
    const registered = new Set(
      CONCATENATED_KEYS.map((entry) => `${entry.namespace}|${entry.prefix}`),
    );
    const unresolved: string[] = [];
    const concatenation = /\b(\w+)\(\s*["']([A-Za-z0-9_.-]+)["']\s*\+/g;

    for (const file of SOURCE_FILES) {
      const rel = file.slice(ROOT.length + 1);
      const source = readFileSync(file, "utf-8");
      if (!source.includes("useTranslations(") && !source.includes("getTranslations(")) continue;
      const code = stripComments(source);
      const { translators } = collectTranslators(code);

      for (const match of code.matchAll(concatenation)) {
        const translator = translators.get(match[1]);
        if (!translator?.resolved || translator.namespaces.size !== 1) continue;
        const [namespace] = [...translator.namespaces];
        if (registered.has(`${namespace}|${match[2]}`)) continue;
        const line = source.slice(0, match.index).split("\n").length;
        unresolved.push(`${rel}:${line} → t("${match[2]}" + …) in namespace "${namespace}"`);
      }
    }

    expect(
      unresolved,
      `Register each concatenated key prefix in src/i18n/__tests__/referenced-keys.test.ts ` +
        `(CONCATENATED_KEYS) with every key it can produce:\n${unresolved.join("\n")}`,
    ).toEqual([]);
  });
});
