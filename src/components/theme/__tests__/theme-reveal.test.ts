import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  THEME_REVEAL_ATTRIBUTE,
  runThemeReveal,
  themeRevealOriginFromEvent,
} from "@/hooks/use-theme-reveal";

/**
 * The reveal is a DOM contract, not a paint: <html> carries the variant plus
 * four geometry custom properties for exactly as long as the transition runs.
 * jsdom cannot render the wipe, so these tests pin the parts that can regress
 * silently in the browser — the attribute lifecycle, the geometry handed to
 * globals.css, the fallbacks, and the stale-cleanup race.
 */

const ROOT = document.documentElement;
const GEOMETRY_VARS = [
  "--theme-reveal-x",
  "--theme-reveal-y",
  "--theme-reveal-rect",
  "--theme-reveal-polygon",
];

/** Resolvers for the `finished` promise of each started transition. */
let settle: Array<() => void>;
let startViewTransition: ReturnType<typeof vi.fn>;

function installStartViewTransition() {
  startViewTransition = vi.fn((callback: () => void | Promise<void>) => {
    // The real API runs the callback and resolves `finished` when the wipe
    // ends; only the callback shape matters for these assertions.
    const done = callback();
    void done;
    return {
      finished: new Promise<void>((resolve) => settle.push(resolve)),
      ready: Promise.resolve(),
      updateCallbackDone: Promise.resolve(),
      skipTransition: vi.fn(),
    };
  });
  Object.defineProperty(document, "startViewTransition", {
    configurable: true,
    writable: true,
    value: startViewTransition,
  });
}

function setReducedMotion(reduced: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: reduced && query.includes("prefers-reduced-motion"),
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

const flushFinished = async () => {
  const resolvers = [...settle];
  settle = [];
  resolvers.forEach((resolve) => resolve());
  await Promise.resolve();
  await Promise.resolve();
};

beforeEach(() => {
  settle = [];
  setReducedMotion(false);
  installStartViewTransition();
  window.localStorage.clear();
  ROOT.removeAttribute(THEME_REVEAL_ATTRIBUTE);
  GEOMETRY_VARS.forEach((property) => ROOT.style.removeProperty(property));
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("runThemeReveal", () => {
  it("applies the theme inside the transition and tags <html> with the variant", () => {
    const apply = vi.fn();

    runThemeReveal(apply, { origin: { x: 100, y: 50 }, variant: "polygon" });

    expect(apply).toHaveBeenCalledTimes(1);
    expect(startViewTransition).toHaveBeenCalledTimes(1);
    expect(ROOT.getAttribute(THEME_REVEAL_ATTRIBUTE)).toBe("polygon");
  });

  it("hands the origin to CSS as percentages plus a matching 5-point polygon", () => {
    runThemeReveal(vi.fn(), { origin: { x: 100, y: 50 }, variant: "circle" });

    const width = ROOT.clientWidth || window.innerWidth;
    const height = ROOT.clientHeight || window.innerHeight;
    const x = ROOT.style.getPropertyValue("--theme-reveal-x");
    const y = ROOT.style.getPropertyValue("--theme-reveal-y");

    expect(parseFloat(x)).toBeCloseTo((100 / width) * 100, 1);
    expect(parseFloat(y)).toBeCloseTo((50 / height) * 100, 1);

    // inset(top right bottom left) — the shutter variant's start shape.
    const rect = ROOT.style.getPropertyValue("--theme-reveal-rect").split(" ");
    expect(rect).toHaveLength(4);
    expect(parseFloat(rect[0])).toBeCloseTo((50 / height) * 100, 1);

    // The polygon keyframe interpolates to a 5-point rect, so the start shape
    // must have exactly five points or the animation falls back to discrete.
    expect(ROOT.style.getPropertyValue("--theme-reveal-polygon").split(",")).toHaveLength(5);
  });

  it("defaults to the saved preference (circle) when no variant is given", () => {
    runThemeReveal(vi.fn(), { origin: "center" });
    expect(ROOT.getAttribute(THEME_REVEAL_ATTRIBUTE)).toBe("circle");
  });

  it("clears the attribute and every geometry variable once the wipe finishes", async () => {
    runThemeReveal(vi.fn(), { origin: "center", variant: "rectangle" });
    expect(ROOT.getAttribute(THEME_REVEAL_ATTRIBUTE)).toBe("rectangle");

    await flushFinished();

    expect(ROOT.hasAttribute(THEME_REVEAL_ATTRIBUTE)).toBe(false);
    for (const property of GEOMETRY_VARS) {
      expect(ROOT.style.getPropertyValue(property)).toBe("");
    }
  });

  it("does not let a superseded transition clean up the newer one", async () => {
    runThemeReveal(vi.fn(), { origin: "center", variant: "circle" });
    const stale = settle[0];

    runThemeReveal(vi.fn(), { origin: "center", variant: "polygon" });

    // The aborted transition's `finished` rejects/resolves after the new one
    // started; its cleanup must not strip the live attribute.
    stale();
    await Promise.resolve();
    await Promise.resolve();

    expect(ROOT.getAttribute(THEME_REVEAL_ATTRIBUTE)).toBe("polygon");
  });

  it("skips the transition and still switches when the user prefers reduced motion", () => {
    setReducedMotion(true);
    const apply = vi.fn();

    runThemeReveal(apply, { origin: "center", variant: "circle" });

    expect(apply).toHaveBeenCalledTimes(1);
    expect(startViewTransition).not.toHaveBeenCalled();
    expect(ROOT.hasAttribute(THEME_REVEAL_ATTRIBUTE)).toBe(false);
  });

  it("falls back to a plain switch without the View Transitions API", () => {
    Object.defineProperty(document, "startViewTransition", {
      configurable: true,
      writable: true,
      value: undefined,
    });
    const apply = vi.fn();

    runThemeReveal(apply, { origin: "center", variant: "circle" });

    expect(apply).toHaveBeenCalledTimes(1);
    expect(ROOT.hasAttribute(THEME_REVEAL_ATTRIBUTE)).toBe(false);
  });

  it("honours the explicit none variant without animating", () => {
    const apply = vi.fn();
    runThemeReveal(apply, { origin: "center", variant: "none" });

    expect(apply).toHaveBeenCalledTimes(1);
    expect(startViewTransition).not.toHaveBeenCalled();
  });
});

describe("themeRevealOriginFromEvent", () => {
  // A real element: the helper resolves keyboard activation through the
  // target's bounding box, which only exists on an Element.
  const button = document.createElement("button");
  button.getBoundingClientRect = () => ({ left: 10, top: 20, width: 30, height: 40 }) as DOMRect;

  it("uses the pointer for mouse and touch activation", () => {
    expect(
      themeRevealOriginFromEvent({ clientX: 400, clientY: 120, detail: 1, currentTarget: button }),
    ).toEqual({ x: 400, y: 120 });
  });

  it("falls back to the control itself for keyboard activation (detail 0, no pointer)", () => {
    // The element is resolved to coordinates later, once the reveal starts.
    expect(
      themeRevealOriginFromEvent({ clientX: 0, clientY: 0, detail: 0, currentTarget: button }),
    ).toBe(button);
  });

  it("grows from an element origin's centre", () => {
    runThemeReveal(vi.fn(), { origin: button, variant: "circle" });

    const width = ROOT.clientWidth || window.innerWidth;
    const height = ROOT.clientHeight || window.innerHeight;
    expect(parseFloat(ROOT.style.getPropertyValue("--theme-reveal-x"))).toBeCloseTo(
      (25 / width) * 100,
      1,
    );
    expect(parseFloat(ROOT.style.getPropertyValue("--theme-reveal-y"))).toBeCloseTo(
      (40 / height) * 100,
      1,
    );
  });

  it("falls back to the viewport centre when there is no element", () => {
    expect(
      themeRevealOriginFromEvent({ clientX: 0, clientY: 0, detail: 0, currentTarget: null }),
    ).toBe("center");
  });
});
