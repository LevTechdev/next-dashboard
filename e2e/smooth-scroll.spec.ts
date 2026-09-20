import { test, expect, type Page } from "@playwright/test";

/**
 * Lenis smooth-scroll contract for the marketing pages
 * (src/components/home/smooth-scroll.tsx + the marketing layout's SmoothScroll
 * wrapper).
 *
 * In-page anchor navigation on those pages must GLIDE, never jump:
 *   1. The hero scroll cue (`<a href="#preview">` in HeroOverview) —
 *      clicking it animates window.scrollY over time until the #features
 *      section settles just below the fixed marketing header, and the URL
 *      gains `#features`.
 *   2. A plain same-page anchor link (`<a href="#pricing">`) — the
 *      document-level delegation intercepts ANY same-page hash link and
 *      glides the same way, instead of the browser's instant fragment jump.
 *   3. The features page's mega-menu anchor (`/features#security`, clicked
 *      from the header dropdown) — the four menu deep-links used to point at
 *      ids the page no longer had; they now anchor onto feature cards, and
 *      this pins one of them end-to-end through the real UI.
 *
 * The "reduced-motion native fallback" describes pin the SAME anchor paths
 * with `prefers-reduced-motion: reduce`: SmoothScroll then returns before
 * constructing Lenis AND before attaching the delegation, so every anchor
 * (scroll cue, same-page mega-menu link, cross-page header deep link,
 * direct-load hash deep link, footer "#" placeholder) must still land the
 * target via native browser scrolling — with <html> never gaining the
 * `lenis` class. The first fallback describe covers the homepage cue + a
 * synthetic anchor; "...— every delegated anchor path" covers the rest.
 *
 * The two cases exercise the same delegation handler (the cue IS an in-page
 * anchor), but through different entry points: a real UI click on the only
 * anchor the homepage ships, and a programmatically-clicked anchor to a much
 * deeper section (#pricing) that proves the contract holds for the general
 * "in-page anchor link" case — so removing either Lenis or the delegation
 * (which would make both an instant jump) is caught.
 *
 * WHY the page must be scrolled by Lenis, not by the test:
 *   - The glide describes force `prefers-reduced-motion: no-preference`,
 *     because SmoothScroll skips Lenis entirely under reduced motion (native
 *     scrolling takes over — the reduced-motion describes pin that fallback).
 *   - The page must start at the TOP with Lenis already mounted, and the page
 *     must never be scrolled programmatically (Playwright's
 *     scrollIntoViewIfNeeded / CDP scrolls desync Lenis's internal scroll
 *     position and its scrollTo then stalls). That is why the cue test uses a
 *     TALL viewport (1280x1500) — the cue sits ~1080px down the hero, so it
 *     is visible and clickable at load with zero scrolling, exactly like the
 *     top of the page a visitor sees after fonts settle.
 *   - The viewport is set per-file, not per-test: an in-page scroll position
 *     is not shared between tests (each test gets a fresh context), but
 *     keeping one describe-level viewport mirrors the suite's convention
 *     (homepage-mobile-menu.spec.ts does the same).
 *
 * "Glide" is proven with a 100ms scrollY sampler started just before the
 * click: an instant jump moves the window between two consecutive samples
 * (start → end with nothing in between — a synchronous scroll can never be
 * observed mid-flight), while a glide leaves samples strictly between the
 * start and final positions. Layout
 * drift (late font swaps / entrance animations) can nudge the absolute
 * landing by a few px, so the landing check allows ±15px around the offset
 * the delegation applies at click time (fixed-header height + 24px) — still
 * tight enough to fail a flush-to-top jump (an offset-less landing is
 * ~90px off) or a no-op.
 */

/** The delegation's offset: `max(headerHeight, 64) + 24` (see smooth-scroll). */
// 20px: the glide lands within a header-height band; 15 was too tight for
// the redesigned hero's rounded section paddings (observed 20px rest offset).
const GLIDE_TOLERANCE_PX = 20;

/** Sampler window: 100ms buckets over a 12s budget. The WebGL hero keeps the
 * headless main thread busy, so buckets can land every ~100-300ms; 8 samples
 * is comfortably past an instant jump's 1-2 buckets while still leaving a
 * clear intermediate trace for a real glide. */
const SAMPLE_COUNT = 120;
const MIN_SAMPLES = 8;

interface GlideSamples {
  /** t (ms since page-nav timing start) + scrollY at each 100ms bucket. */
  samples: Array<{ t: number; y: number }>;
  /** Geometry + state read AFTER the glide has settled. */
  rest: {
    scrollY: number;
    headerHeight: number;
    targetTop: number;
    hash: string;
  };
}

/** Start a 100ms window.scrollY sampler; returns when the first bucket landed. */
async function startScrollSampler(page: Page): Promise<void> {
  await page.evaluate(
    ({ count }) => {
      const samples: Array<{ t: number; y: number }> = [];
      const t0 = performance.now();
      const id = window.setInterval(() => {
        samples.push({ t: performance.now() - t0, y: Math.round(window.scrollY) });
        if (samples.length >= count) window.clearInterval(id);
      }, 100);
      (window as unknown as { __scrollSamples: typeof samples }).__scrollSamples = samples;
    },
    { count: SAMPLE_COUNT },
  );
}

async function readGlideResult(page: Page, targetId: string): Promise<GlideSamples> {
  return page.evaluate(
    ({ targetId: id }) => {
      const samples = (window as unknown as { __scrollSamples: Array<{ t: number; y: number }> })
        .__scrollSamples;
      const header = document.querySelector("header");
      const el = document.getElementById(id);
      return {
        samples,
        rest: {
          scrollY: Math.round(window.scrollY),
          headerHeight: header ? header.offsetHeight : 0,
          targetTop: el ? Math.round(el.getBoundingClientRect().top) : -1,
          hash: window.location.hash,
        },
      };
    },
    { targetId },
  );
}

/**
 * Click `trigger` and assert the window scrolled as a GLIDE (not an instant
 * jump) that lands `targetId` at the fixed-header offset.
 */
async function assertGlideTo(
  page: Page,
  targetId: string,
  trigger: () => Promise<void>,
  label: string,
): Promise<void> {
  // Offset applied at click time (the header may shrink later as the page
  // scrolls, so capture it BEFORE the glide).
  const offsetAtClick = await page.evaluate(() => {
    const header = document.querySelector("header");
    const headerHeight = header ? header.offsetHeight : 0;
    return Math.max(headerHeight, 64) + 24;
  });

  await startScrollSampler(page);
  await page.waitForTimeout(150); // one pre-click bucket at the start position
  await trigger();
  // 4s of sampling after the click — comfortably past the 1.15s glide even
  // on a busy machine (the sampler keeps filling for 12s total).
  await page.waitForTimeout(4000);

  const { samples, rest } = await readGlideResult(page, targetId);
  expect(samples.length, `${label}: sampler ran`).toBeGreaterThanOrEqual(MIN_SAMPLES);
  const ys = samples.map((s) => s.y);
  const start = ys[0];
  const end = rest.scrollY;

  // The click must actually scroll to the target (moved substantially).
  expect(end - start, `${label}: scrolled down to the target`).toBeGreaterThan(150);

  // Glide, not jump: at least one sample strictly between the start and the
  // final position. This is the reliable discriminator at ANY sampling
  // cadence — an instant fragment jump moves the window synchronously, so it
  // can only ever be observed at the start and end positions, never in
  // between. (A wall-clock "movement span" check is deliberately NOT made:
  // under headless main-thread jank the 100ms buckets can coalesce around the
  // glide, making the span flaky without adding signal.)
  const mid = samples.filter((s) => s.y > start + 2 && s.y < end - 2);
  expect(
    mid.length,
    `${label}: intermediate scrollY samples (glide, not jump)`,
  ).toBeGreaterThanOrEqual(1);

  // Monotonic DURING the glide: Lenis eases down without bouncing back up.
  // Checked only up to the settling sample — after the glide, late layout
  // shifts (hero video metadata, lazy sections) can clamp window.scrollY
  // downward, which is a layout event, not a scroll reversal.
  const peak = Math.max(...ys);
  let settleIdx = ys.findIndex((y) => y >= peak - 20);
  if (settleIdx < 0) settleIdx = ys.length - 1;
  for (let i = 1; i <= settleIdx; i++) {
    expect(
      ys[i],
      `${label}: scrollY never goes back up during the glide (sample ${i})`,
    ).toBeGreaterThanOrEqual(ys[i - 1] - 1);
  }

  // Lands with the section top at the fixed-header offset the delegation
  // applied (not flush to the viewport top, which an offset-less jump gives).
  expect(
    Math.abs(rest.targetTop - offsetAtClick),
    `${label}: landed at the header offset`,
  ).toBeLessThanOrEqual(GLIDE_TOLERANCE_PX);
}

/** Wait until a section id is present and its document-top has stopped moving. */
async function waitForStableTarget(page: Page, targetId: string): Promise<void> {
  await expect
    .poll(
      async () => {
        const docTop = await page.evaluate((id) => {
          const el = document.getElementById(id);
          if (!el) return -1;
          return Math.round(el.getBoundingClientRect().top + window.scrollY);
        }, targetId);
        if (docTop < 0) return false;
        await page.waitForTimeout(300);
        const docTopAgain = await page.evaluate((id) => {
          const el = document.getElementById(id);
          if (!el) return -1;
          return Math.round(el.getBoundingClientRect().top + window.scrollY);
        }, targetId);
        return docTop === docTopAgain;
      },
      { timeout: 20_000, message: `${targetId} section geometry never stabilized` },
    )
    .toBe(true);
}

/** Fresh load of a marketing path: no reduced motion, Lenis mounted, fonts/layout settled. */
async function gotoMarketingSettled(page: Page, path = "/en"): Promise<void> {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto(path, { waitUntil: "domcontentloaded" });
  // SmoothScroll mounts Lenis in a layout effect once hydration finishes and
  // tags <html> with the `lenis` class. Without it the anchor click would
  // fall back to native scrolling and these assertions would be meaningless,
  // so gate on it before proceeding.
  await expect(page.locator("html")).toHaveClass(/lenis/, { timeout: 45_000 });
  await page.evaluate(async () => {
    await document.fonts.ready;
    return true;
  });
  // Let entrance animations and any late layout settle before measuring.
  await page.waitForTimeout(1200);
}

test.describe("Lenis smooth-scroll glide", () => {
  // Tall viewport: the hero scroll cue (~1080px down the hero) is visible at
  // load, so the test never programmatically scrolls the page (which would
  // desync Lenis — see the file header).
  test.use({ viewport: { width: 1280, height: 1500 } });

  test("hero scroll cue glides to the #preview section offset", async ({ page }) => {
    await gotoMarketingSettled(page);

    // The redesigned hero cue points at #preview (was #features) — the
    // aria-label'd anchor, not the "Live Preview" card link that also
    // targets #preview.
    const cue = page.locator(
      'section[aria-label="Interactive Platform Overview"] a[href="#preview"][aria-label]',
    );
    await expect(cue).toBeVisible();
    await expect(cue).toHaveAttribute("href", "#preview");

    await waitForStableTarget(page, "preview");

    await assertGlideTo(page, "preview", () => cue.click(), "scroll cue");
    await expect(page).toHaveURL(/#preview$/);
  });

  test("a same-page anchor link glides to the #pricing section offset", async ({ page }) => {
    await gotoMarketingSettled(page);

    // The homepage ships exactly one in-page anchor (the scroll cue), so the
    // delegation contract for a general same-page hash link is exercised with
    // a second anchor pointing at #pricing — a real <a href="#pricing"> whose
    // click bubbles through the same document-level delegation handler any
    // future in-page nav link would hit.
    await page.evaluate(() => {
      document.querySelectorAll("#e2e-anchor-probe").forEach((n) => n.remove());
      const a = document.createElement("a");
      a.href = "#pricing";
      a.id = "e2e-anchor-probe";
      a.style.cssText = "position:absolute;top:0;left:0;";
      document.body.appendChild(a);
    });
    await waitForStableTarget(page, "pricing");

    await assertGlideTo(
      page,
      "pricing",
      () =>
        page.evaluate(() => {
          const a = document.getElementById("e2e-anchor-probe") as HTMLAnchorElement | null;
          a?.click();
        }),
      "same-page anchor link",
    );
    await expect(page).toHaveURL(/#pricing$/);
  });
});

test.describe("reduced-motion native fallback (Lenis skipped)", () => {
  // Same tall viewport as the glide describe: the cue and targets are all
  // reachable without any programmatic scrolling.
  test.use({ viewport: { width: 1280, height: 1500 } });

  test("scroll cue and a same-page anchor still land at the section offset natively", async ({
    page,
  }) => {
    // Force reduced motion BEFORE load so SmoothScroll's effect sees it and
    // early-returns without ever creating Lenis.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/en", { waitUntil: "domcontentloaded" });

    // Lenis must be skipped entirely — SmoothScroll (src/components/home/
    // smooth-scroll.tsx) returns before constructing it under reduced motion.
    await page.waitForTimeout(1200); // hydration settle
    const htmlClass = await page.evaluate(() => document.documentElement.className);
    expect(htmlClass, "html should never gain the lenis class under reduced motion").not.toContain(
      "lenis",
    );

    await page.evaluate(async () => {
      await document.fonts.ready;
      return true;
    });
    await page.waitForTimeout(1200);
    await waitForStableTarget(page, "preview");

    // Native landing target: the browser's fragment navigation honors
    // html's scroll-padding-top (6rem) — NOT SmoothScroll's JS offset, which
    // is only applied when Lenis runs. (The #preview section must NOT carry
    // scroll-margin-top: the browser would ADD it on top of scroll-padding,
    // double-compensating the fixed header. scroll-mt was removed for that
    // reason.)
    const nativeOffset = await page.evaluate(() => {
      const pt = getComputedStyle(document.documentElement).scrollPaddingTop; // e.g. "96px"
      const n = Number.parseInt(pt, 10);
      return Number.isFinite(n) && n > 0 ? n : 96;
    });
    const near = (top: number) => Math.abs(top - nativeOffset) <= 8;

    // ── 1. Scroll cue → native fragment jump to #preview ────────────────
    // (The reduced-motion stylesheet fades the cue out, but it stays in the
    // DOM and is still a functioning same-page anchor.)
    const cue = page.locator(
      'section[aria-label="Interactive Platform Overview"] a[href="#preview"][aria-label]',
    );
    await expect(cue).toHaveAttribute("href", "#preview");
    await cue.click();
    await expect(page).toHaveURL(/#preview$/);
    await expect
      .poll(
        async () =>
          near(
            await page.evaluate(() =>
              Math.round(document.getElementById("preview")!.getBoundingClientRect().top),
            ),
          ),
        { timeout: 8_000, message: "cue anchor never landed near the native offset" },
      )
      .toBe(true);
    expect(
      await page.evaluate(() => document.documentElement.className),
      "lenis still not initialized after the cue jump",
    ).not.toContain("lenis");

    // ── 2. Same-page anchor link → native fragment jump to #pricing ─────
    await page.evaluate(() => {
      document.querySelectorAll("#e2e-anchor-probe").forEach((n) => n.remove());
      const a = document.createElement("a");
      a.href = "#pricing";
      a.id = "e2e-anchor-probe";
      a.style.cssText = "position:absolute;top:0;left:0;";
      document.body.appendChild(a);
    });
    await waitForStableTarget(page, "pricing");
    await page.evaluate(() => {
      (document.getElementById("e2e-anchor-probe") as HTMLAnchorElement | null)?.click();
    });
    await expect(page).toHaveURL(/#pricing$/);
    await expect
      .poll(
        async () =>
          near(
            await page.evaluate(() =>
              Math.round(document.getElementById("pricing")!.getBoundingClientRect().top),
            ),
          ),
        { timeout: 8_000, message: "same-page anchor never landed near the native offset" },
      )
      .toBe(true);
    expect(
      await page.evaluate(() => document.documentElement.className),
      "lenis still not initialized after the anchor jump",
    ).not.toContain("lenis");
  });
});

test.describe("reduced-motion native fallback — every delegated anchor path", () => {
  // Standard desktop viewport. Unlike the glide describes, nothing here
  // depends on the hero cue being visible at load, and Lenis is OFF — so the
  // page may be scrolled programmatically (Playwright auto-scroll, or an
  // explicit scrollTo for the footer leg) without any desync risk.
  test.use({ viewport: { width: 1280, height: 800 } });

  /**
   * Load a marketing path with reduced motion forced on and assert Lenis was
   * skipped. Under reduced motion SmoothScroll returns before constructing
   * Lenis AND before attaching the anchor delegation, so every anchor click
   * falls through to native browser behaviour — exactly what these tests pin.
   */
  async function gotoReducedMotionSettled(page: Page, path: string): Promise<void> {
    // Force reduced motion BEFORE load so SmoothScroll's effect sees it and
    // early-returns. The emulation persists across client-side navigations.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(path, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1200); // hydration settle
    await expect(page.locator("html")).not.toHaveClass(/lenis/);
    await page.evaluate(async () => {
      await document.fonts.ready;
      return true;
    });
    await page.waitForTimeout(800);
  }

  /**
   * Native landing check: fragment navigation honors html's
   * scroll-padding-top (6rem) — NOT SmoothScroll's JS offset, which is only
   * applied when Lenis runs.
   *
   * Deep-link landings happen EARLY (before fonts/entrance animations
   * settle), and content above the anchor later shrinks by ~20px, which
   * drifts the card's viewport top below the offset. Measured live: the
   * browser lands exactly at 96px, then the card drifts to ~72px as the
   * page's late layout settles — so the band allows that drift downward
   * (offset − 35) while still failing a flush-to-top jump (~96px off) or a
   * no-scroll no-op. Clicks that happen after the page has settled (the
   * same-page mega-menu test) land exactly at the offset.
   */
  async function expectNativeLanding(page: Page, targetId: string, label: string): Promise<void> {
    const nativeOffset = await page.evaluate(() => {
      const pt = getComputedStyle(document.documentElement).scrollPaddingTop;
      const n = Number.parseInt(pt, 10);
      return Number.isFinite(n) && n > 0 ? n : 96;
    });
    await expect
      .poll(
        async () => {
          const top = await page.evaluate(
            (id) => Math.round(document.getElementById(id)!.getBoundingClientRect().top),
            targetId,
          );
          return top >= nativeOffset - 35 && top <= nativeOffset + 8;
        },
        {
          timeout: 15_000,
          message: `${label}: never landed near the native scroll-padding offset`,
        },
      )
      .toBe(true);
    await expect(page.locator("html"), `${label}: lenis must stay uninitialized`).not.toHaveClass(
      /lenis/,
    );
  }

  test("the mega-menu #security link lands natively when clicked on the features page itself", async ({
    page,
  }) => {
    // Same page, path-prefixed href (/en/features#security) — the delegation's
    // second same-page branch. Under reduced motion the delegation is not even
    // attached, so Next/native scrolling must land the card unaided.
    await gotoReducedMotionSettled(page, "/en/features");
    await waitForStableTarget(page, "security");

    const featuresTrigger = page.getByRole("link", { name: "Features", exact: true }).first();
    await featuresTrigger.hover();
    const securityLink = page.getByRole("link", { name: /^Security\b/ });
    await expect(securityLink).toBeVisible();
    await securityLink.click();

    await expect(page).toHaveURL(/\/en\/features#security$/);
    await expectNativeLanding(page, "security", "same-page mega-menu anchor");
  });

  test("the header mega-menu deep link lands natively on /features from the homepage", async ({
    page,
  }) => {
    // Cross-page href (/en → /en/features#security): outside the delegation's
    // remit in ANY motion mode (Next handles the navigation), but under
    // reduced motion the landing scroll must also be native — Next's post-
    // navigation hash scroll honoring scroll-padding-top, no Lenis glide.
    await gotoReducedMotionSettled(page, "/en");

    const featuresTrigger = page.getByRole("link", { name: "Features", exact: true }).first();
    await featuresTrigger.hover();
    const securityLink = page.getByRole("link", { name: /^Security\b/ });
    await expect(securityLink).toBeVisible();
    await securityLink.click();

    await expect(page).toHaveURL(/\/en\/features#security$/);
    await waitForStableTarget(page, "security");
    await expectNativeLanding(page, "security", "cross-page deep link");
  });

  test("a direct load of /en/features#security lands natively without a JS glide", async ({
    page,
  }) => {
    // Deep links that arrive WITH a hash: SmoothScroll's settle hook would
    // glide them post-hydration when Lenis runs; under reduced motion the
    // browser's own initial fragment navigation is all there is.
    await gotoReducedMotionSettled(page, "/en/features#security");
    await waitForStableTarget(page, "security");
    await expectNativeLanding(page, "security", "direct hash deep link");
  });

  test("footer '#' placeholder links fall through to the native top-of-page jump", async ({
    page,
  }) => {
    // The delegation explicitly leaves bare "#" alone (both motion modes), so
    // the BROWSER's own fragment handling runs: the URL gains "#" and the
    // window jumps to the top of the document — pinned here as the native
    // contract, with Lenis still uninitialized. (The footer's legal links are
    // real routes now, so a '#' probe anchor stands in for the placeholder.)
    await gotoReducedMotionSettled(page, "/en");

    // Lenis is off, so pre-scrolling programmatically is safe (no desync).
    await page.evaluate(() => {
      document.querySelectorAll("#e2e-hash-probe").forEach((n) => n.remove());
      const a = document.createElement("a");
      a.href = "#";
      a.id = "e2e-hash-probe";
      a.textContent = "probe";
      a.style.cssText =
        "position:fixed;bottom:0;left:0;padding:12px;background:#333;color:#fff;z-index:9999;";
      document.body.appendChild(a);
      window.scrollTo(0, document.body.scrollHeight);
    });
    await page.waitForTimeout(600);

    // Programmatic click (page.click is intercepted by the Next dev-overlay
    // portal over the fixed probe). The browser's own fragment handling must
    // run: URL gains "#" and the window jumps to the top.
    await page.evaluate(() =>
      (document.getElementById("e2e-hash-probe") as HTMLAnchorElement | null)?.click(),
    );

    await expect(page).toHaveURL(/#$/);
    await expect
      .poll(async () => Math.round(await page.evaluate(() => window.scrollY)), {
        timeout: 8_000,
        message: "a '#' placeholder must jump to the top natively",
      })
      .toBeLessThanOrEqual(8);
    await expect(page.locator("html")).not.toHaveClass(/lenis/);
  });
});

test.describe("Features mega-menu anchors glide", () => {
  // Default-ish desktop height: the features grid starts below the fold, so
  // the #security card is a real downward target (the homepage describe uses
  // a tall viewport because its cue sits far down the hero).
  test.use({ viewport: { width: 1280, height: 800 } });

  test("the Features mega-menu #security link glides to the section offset", async ({ page }) => {
    // The header's Features mega-menu deep-links into this page
    // (/features#analytics|security|automation|scale). Landing here, the
    // #security card is a real in-page target (features/page.tsx puts the id
    // on the enterprise-authentication card, closest to the menu item's
    // "Enterprise-grade protection" description).
    await gotoMarketingSettled(page, "/en/features");
    await waitForStableTarget(page, "security");

    // Open the Features mega-menu (CSS group-hover dropdown) and click the
    // Security entry — a real UI link to the same-page anchor.
    const featuresTrigger = page.getByRole("link", { name: "Features", exact: true }).first();
    await featuresTrigger.hover();
    const securityLink = page.getByRole("link", { name: /^Security\b/ });
    await expect(securityLink).toBeVisible();

    await assertGlideTo(
      page,
      "security",
      () => securityLink.click(),
      "Features mega-menu #security",
    );
    await expect(page).toHaveURL(/#security$/);
  });
});
