import { describe, it, expect } from "vitest";
import { THESVG_MODULE_REGISTRY } from "@/components/ui/brand-icons";

/**
 * Brand-icon integrity — the xlink:href class of bug.
 *
 * ThesvgIcon namespaces every internal `id="…"` when injecting brand SVGs,
 * and must rewrite EVERY reference form that points at those ids:
 *
 *   1. `url(#a)`          — fill/stroke/clip/mask references
 *   2. `xlink:href="#a"`  — gradient chain links (Instagram's radialGradients)
 *   3. `href="#a"`        — SVG2 plain-href references
 *
 * A missed form breaks the gradient chain: the artwork loses its colored
 * backdrop and only a hard-coded white glyph survives — invisible on light
 * surfaces (this is exactly how the Instagram icon "disappeared" in light
 * mode, and later how YouTube/Notion's white glyphs would have shipped).
 *
 * The suite audits THESVG_MODULE_REGISTRY — the EFFECTIVE markup ThesvgIcon
 * actually renders (after the mono/currentColor wrappers) — so a regression
 * in brand-icons.tsx itself is caught, not just in upstream package data.
 */

type ThesvgBrandModule = {
  slug: string;
  title?: string;
  svg: string;
  variants?: Record<string, string>;
};

const MODULES: ThesvgBrandModule[] = Object.values(THESVG_MODULE_REGISTRY);

/** Exact namespacing logic from ThesvgIcon (keep in sync — see audit test). */
function namespaceLikeThesvgIcon(rawMarkup: string, instanceId: string): string {
  return rawMarkup
    .replace(/id="([^"]+)"/g, `id="${instanceId}-$1"`)
    .replace(/url\(#([^)]+)\)/g, `url(#${instanceId}-$1)`)
    .replace(/xlink:href="#([^"]+)"/g, `xlink:href="#${instanceId}-$1"`);
}

/** The markup ThesvgIcon would actually inject for a module. */
function effectiveMarkup(m: ThesvgBrandModule): string {
  return m.variants?.default ?? m.svg;
}

/** Collect every `#fragment` reference from all three reference forms. */
function collectRefs(markup: string): string[] {
  const refs: string[] = [];
  for (const re of [/url\(#([^)]+)\)/g, /xlink:href="#([^"]+)"/g, /\shref="#([^"]+)"/g]) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(markup)) !== null) refs.push(m[1]);
  }
  return refs;
}

/** Collect every id defined by the markup. */
function collectIds(markup: string): string[] {
  const ids: string[] = [];
  const re = /\sid="([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(markup)) !== null) ids.push(m[1]);
  return ids;
}

describe("thesvg brand modules — internal reference integrity", () => {
  it("registry is populated (brand-icons.tsx exports its module set)", () => {
    expect(MODULES.length).toBeGreaterThanOrEqual(20);
  });

  for (const mod of MODULES) {
    it(`"${mod.slug}" resolves every internal reference after namespacing`, () => {
      const raw = effectiveMarkup(mod);
      const namespaced = namespaceLikeThesvgIcon(raw, `thesvg-${mod.slug}-test`);

      const definedIds = new Set(collectIds(namespaced));
      const dangling = collectRefs(namespaced).filter((r) => !definedIds.has(r));

      expect(
        dangling,
        `"${mod.slug}" references ids that no longer exist after namespacing: ${dangling.join(", ")}`,
      ).toEqual([]);
    });

    it(`"${mod.slug}" defines no duplicate internal ids`, () => {
      const ids = collectIds(effectiveMarkup(mod));
      const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
      expect(
        dupes,
        `"${mod.slug}" defines duplicate internal ids: ${[...new Set(dupes)].join(", ")}`,
      ).toEqual([]);
    });
  }

  it("light-mode visibility: no shipped module renders a white-only glyph with no colored backdrop", () => {
    // Regression for Instagram/YouTube/Notion: a module whose artwork is ONLY
    // fill="#fff" (no gradient, no colored paint) is invisible on white
    // surfaces. brand-icons.tsx must wrap such modules with mono/currentColor
    // derivatives — which this registry reflects.
    const invisibleOnLight = MODULES.filter((mod) => {
      const raw = effectiveMarkup(mod);
      const hasWhiteFill = /fill="#fff"/i.test(raw) || /fill="white"/i.test(raw);
      const hasPaint = /url\(#|stop-color|#[0-9a-f]{3,8}/i.test(
        raw.replace(/fill="#fff"|fill="white"/gi, ""),
      );
      return hasWhiteFill && !hasPaint;
    });
    expect(
      invisibleOnLight.map((m) => m.slug),
      "white-only glyphs with no colored backdrop are invisible in light mode",
    ).toEqual([]);
  });
});

/**
 * Brand-on-brand tiles. The homepage's gateway card renders each provider in a
 * tile painted with its own brand colour. An artwork that hard-codes the SAME
 * hex (Stripe's wordmark is #635BFF on a #635BFF tile) is invisible — it reads
 * as "the icon failed to load". Such tiles must render a currentColor
 * derivative through ThesvgIcon's `aria-label`-labelled span.
 */
describe("brand-coloured tiles render an adaptive glyph", () => {
  it("ships a currentColor Stripe derivative (stripe-mono)", () => {
    const mono = THESVG_MODULE_REGISTRY["stripe-mono"];
    expect(mono, "the stripe-mono derivative must stay registered").toBeTruthy();

    const raw = effectiveMarkup(mono);
    expect(
      /#635BFF/i.test(raw),
      "a hard-coded brand hex cannot follow the container colour of a same-coloured tile",
    ).toBe(false);
    expect(raw).toContain('fill="currentColor"');
  });

  it("keeps the official self-coloured Stripe wordmark for neutral surfaces", () => {
    const official = THESVG_MODULE_REGISTRY.stripe;
    expect(effectiveMarkup(official)).toMatch(/#635BFF/i);
  });
});

describe("ThesvgIcon namespacing audit (static)", () => {
  it("rewrites url(#…) and xlink:href reference forms", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const src = fs.readFileSync(path.resolve(__dirname, "..", "brand-icons.tsx"), "utf8");
    // If someone deletes the xlink:href rewrite (the Instagram fix), this fails.
    expect(src).toContain(".replace(/url\\(#([^)]+)\\)/g");
    expect(src).toContain('xlink:href="#${instanceId}-$1"');
    expect(src).toContain("Instagram's artwork chains gradients through xlink:href");
  });
});
