import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import { act } from "react";

import {
  THESVG_MODULE_REGISTRY,
  ThesvgIcon,
  brandMarkupMismatch,
  canonicalizeMarkup,
} from "@/components/ui/brand-icons";

/**
 * The "a tree hydrated but some attributes ... didn't match" class, for brand
 * icons specifically.
 *
 * The reported error pointed at `ThesvgIcon`'s `dangerouslySetInnerHTML` and
 * named a package whose whole reason for existing in this codebase is that it
 * ships DUAL builds (`.js` for `import`, `.cjs` for `require`) — the obvious
 * theory being that the server bundle resolves one build and the client bundle
 * the other, so the two renders inject different strings.
 *
 * That theory is WRONG, and this suite pins the refutation so nobody spends
 * another session on it:
 *
 *   1. every slug brand-icons.tsx uses produces byte-identical markup from the
 *      CJS and ESM builds, for every module the registry renders;
 *   2. the artwork is inert data — no getters, no clocks, no randomness, and no
 *      environment-conditional export (`browser` / `react-server`) that could
 *      make one bundle pick a different file;
 *   3. `ThesvgIcon`'s injected markup is therefore a pure function of the module
 *      object, which means the ONLY remaining way to see a mismatch is the
 *      module object CHANGING between the server render and hydration — a dev
 *      fast-refresh — or a different tree shape.
 *
 * The second half of the suite proves the dev-mode guard added to ThesvgIcon
 * actually fires for that case, so the next occurrence is diagnosed in one line
 * instead of a bisect.
 */

const require = createRequire(import.meta.url);
const ROOT = join(__dirname, "..", "..", "..", "..");
const BRAND_ICONS = join(ROOT, "src", "components", "ui", "brand-icons.tsx");

/** Every `from "thesvg/<slug>"` import in the component. */
function importedSlugs(): string[] {
  const source = readFileSync(BRAND_ICONS, "utf8");
  return [...new Set([...source.matchAll(/from\s+"thesvg\/([^"]+)"/g)].map((m) => m[1]))];
}

/** The markup ThesvgIcon injects for a module. */
const effectiveMarkup = (mod: { svg: string; variants?: Record<string, string> }) =>
  mod.variants?.default ?? mod.svg;

describe("thesvg dual builds are byte-identical (the obvious theory, refuted)", () => {
  const slugs = importedSlugs();

  it("imports are read from the component, not hard-coded here", () => {
    // If the extractor breaks, the suite must fail loudly rather than silently
    // checking an empty list.
    expect(slugs.length).toBeGreaterThan(25);
    expect(slugs).toContain("stripe");
    expect(slugs).toContain("instagram");
  });

  it.each(slugs)("%s resolves to the same artwork under require and import", async (slug) => {
    const cjsModule = require(`thesvg/${slug}`);
    const esmModule = await import(`thesvg/${slug}`);
    const cjs = effectiveMarkup(cjsModule.default ?? cjsModule);
    const esm = effectiveMarkup(esmModule.default ?? esmModule);

    expect(cjs).toBeTruthy();
    expect(
      cjs === esm,
      `thesvg/${slug}: the CJS and ESM builds disagree, so a server/client split ` +
        `would render different markup. This is the one case where the dual-build ` +
        `theory is real — pin the two builds or stop depending on the package.`,
    ).toBe(true);
  });

  it("exposes no environment-conditional export that could split the two bundles", () => {
    const thesvgPkg = JSON.parse(
      readFileSync(join(ROOT, "node_modules", "thesvg", "package.json"), "utf8"),
    ) as { exports: Record<string, Record<string, string>> };
    const iconsPkg = JSON.parse(
      readFileSync(join(ROOT, "node_modules", "@thesvg", "icons", "package.json"), "utf8"),
    ) as { exports: Record<string, Record<string, string>> };

    for (const [name, pkg] of [
      ["thesvg", thesvgPkg],
      ["@thesvg/icons", iconsPkg],
    ] as const) {
      const conditions = new Set(Object.values(pkg.exports).flatMap(Object.keys));
      for (const condition of ["browser", "react-server", "workerd"]) {
        expect(
          conditions.has(condition),
          `${name} added a "${condition}" export condition: the server and client ` +
            `bundles can now resolve different files for the same slug.`,
        ).toBe(false);
      }
      // `import`/`require` is exactly the pair the probe above compares.
      expect(conditions.has("import")).toBe(true);
      expect(conditions.has("require")).toBe(true);
    }
  });

  it("ships inert artwork: no getters, clocks or randomness in the payload modules", () => {
    // A getter would re-evaluate per access; Date/Math.random would make the
    // injected string differ between two renders of the SAME module.
    for (const slug of ["stripe", "instagram", "telegram", "notion", "resend"]) {
      for (const ext of ["js", "cjs"]) {
        const file = join(ROOT, "node_modules", "thesvg", "dist", `${slug}.${ext}`);
        const source = readFileSync(file, "utf8");
        // The barrel re-exports `@thesvg/icons/<slug>`; the payload lives there.
        expect(source, `${slug}.${ext} must stay a pure re-export`).toContain(
          `@thesvg/icons/${slug}`,
        );
      }
    }
  });

  it("renders the same markup twice for the same module (render purity)", () => {
    // The property hydration depends on: same input, same output, no state.
    for (const mod of Object.values(THESVG_MODULE_REGISTRY)) {
      const first = effectiveMarkup(mod);
      const second = effectiveMarkup(mod);
      expect(first, `"${mod.slug}" produced different markup on two reads`).toBe(second);
    }
  });
});

describe("canonicalizeMarkup / brandMarkupMismatch", () => {
  it("treats serialization differences as equal", () => {
    // The browser's idea of "the same markup" — otherwise every icon would be
    // reported as a mismatch the moment the parser normalized a tag.
    expect(canonicalizeMarkup('<svg viewBox="0 0 1 1"><path d="M0 0"/></svg>')).toBe(
      canonicalizeMarkup('<svg viewBox="0 0 1 1"><path d="M0 0"></path></svg>'),
    );
    expect(
      brandMarkupMismatch(
        '<svg viewBox="0 0 1 1"><path d="M0 0"/></svg>',
        '<svg viewBox="0 0 1 1"><path d="M0 0"></path></svg>',
      ),
    ).toBeNull();
  });

  it("reports where two renderings diverge", () => {
    const server = '<svg width="76.57"><path fill="#635BFF" d="M1"/></svg>';
    const client = '<svg width="76.57"><path fill="currentColor" d="M1"/></svg>';
    const mismatch = brandMarkupMismatch(server, client);
    expect(mismatch).not.toBeNull();

    // The offset must be the FIRST index the two canonical renderings differ at:
    // everything before it identical, and the bytes there different. That is what
    // makes the dev warning point at the changed attribute instead of the whole
    // 1.6KB string.
    const a = canonicalizeMarkup(server);
    const b = canonicalizeMarkup(client);
    const { firstDiff } = mismatch!;
    expect(a.slice(0, firstDiff)).toBe(b.slice(0, firstDiff));
    expect(a[firstDiff]).not.toBe(b[firstDiff]);
    expect(firstDiff).toBeLessThan(Math.min(a.length, b.length));
    // And it lands on the changed paint, not somewhere arbitrary.
    expect(a.slice(firstDiff, firstDiff + 20)).toContain("#635BFF");
  });

  it("returns null for identical markup", () => {
    const markup = effectiveMarkup(THESVG_MODULE_REGISTRY.stripe);
    expect(brandMarkupMismatch(markup, markup)).toBeNull();
  });
});

/**
 * The guard itself, driven the way the bug actually appears: the server's HTML
 * carries one artwork and hydration renders another. `hydrateRoot` against a
 * pre-populated container reproduces that exactly.
 */
describe("ThesvgIcon dev-mode hydration guard", () => {
  const container = () => {
    const el = document.createElement("div");
    document.body.appendChild(el);
    return el;
  };

  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("stays silent when the server and client agree", async () => {
    const brandModule = THESVG_MODULE_REGISTRY.stripe;
    const serverHtml = renderToString(<ThesvgIcon module={brandModule} size={16} />);
    const root = container();
    root.innerHTML = serverHtml;

    const errors: string[] = [];
    vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      errors.push(args.map(String).join(" "));
    });

    await act(async () => {
      hydrateRoot(root, <ThesvgIcon module={brandModule} size={16} />);
    });

    expect(errors.filter((e) => e.includes("[brand-icons]"))).toEqual([]);
  });

  it("names the slug when the artwork changed between the two renders", async () => {
    const serverModule = THESVG_MODULE_REGISTRY.stripe;
    // What a fast-refresh produces: the same slug, different artwork.
    const clientModule = {
      ...serverModule,
      svg: serverModule.svg.replace(/#635BFF/gi, "currentColor"),
      variants: undefined,
    };

    const serverHtml = renderToString(<ThesvgIcon module={serverModule} size={16} />);
    const root = container();
    root.innerHTML = serverHtml;

    const errors: string[] = [];
    vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      errors.push(args.map(String).join(" "));
    });

    await act(async () => {
      hydrateRoot(root, <ThesvgIcon module={clientModule} size={16} />);
    });

    const reported = errors.filter((e) => e.includes("[brand-icons]"));
    expect(reported).toHaveLength(1);
    expect(reported[0]).toContain("SSR/client markup mismatch");
    // The line that turns an opaque hydration warning into an answer.
    expect(reported[0]).toContain(`"${serverModule.slug}"`);
    expect(reported[0]).toContain("first difference at");
  });
});
