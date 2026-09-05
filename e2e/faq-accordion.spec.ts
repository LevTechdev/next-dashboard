import { test, expect, type Locator } from "@playwright/test";

/**
 * FAQ accordion collapse lifecycle E2E (AnimatedDisclosure keepMounted mode).
 *
 * The marketing FAQ (FaqAccordion on /en/pricing) renders every answer through
 * AnimatedDisclosure with `keepMounted`: the body is ALWAYS in the DOM (SSR/SEO
 * contract) and expand/collapse is a CSS grid-template-rows tween (0fr ↔ 1fr)
 * that clips the answer to zero height when closed. So unlike the default
 * (AnimatePresence exit-unmount) mode, "exit" here means the collapse tween:
 * the answer must stay mounted through it, and end clipped-but-still-attached.
 * A real browser is required because the tween is pure CSS layout animation —
 * jsdom cannot run it.
 *
 * Sequencing note: each leg waits for the PREVIOUS transitionend before
 * clicking again. Collapsing mid-expand reverses the running transition —
 * Chromium then fires transitioncancel without a fresh start/end pair, which
 * is indistinguishable from a broken tween. Anchoring on the real
 * grid-template-rows transitionend (which never fires for a snap) is the
 * deterministic observable; frame-based height sampling is NOT reliable under
 * headless load (frames can land >300ms apart, so a whole 300ms tween can
 * complete between two frames).
 */

const FAQ_Q1 = "Can I upgrade or downgrade my plan at any time?";
const FAQ_A1 = /Yes, you can change your plan at any time/;

const wrapperHeight = (wrapper: Locator) =>
  wrapper.evaluate((el) => el.getBoundingClientRect().height);

/**
 * Resolves when the element fires transitionend for the given property, with
 * a bounded wait (a snap fires NO transitionend, so a missing tween times out
 * here instead of hanging to the test timeout).
 */
function transitionEnd(wrapper: Locator, property: string, timeoutMs = 5_000): Promise<void> {
  const ended = wrapper.evaluate(
    (el, prop) =>
      new Promise<void>((resolve) => {
        const handler = (e: Event) => {
          if ((e as TransitionEvent).propertyName === prop) {
            el.removeEventListener("transitionend", handler);
            resolve();
          }
        };
        el.addEventListener("transitionend", handler);
      }),
    property,
  );
  return Promise.race([
    ended,
    new Promise<void>((_, reject) =>
      setTimeout(() => reject(new Error(`transitionend("${property}") never fired`)), timeoutMs),
    ),
  ]);
}

test.describe("FAQ accordion collapse (keepMounted)", () => {
  test("keeps the answer mounted through the collapse tween and clipped-but-attached after", async ({
    page,
  }) => {
    // Keep the CSS grid-template-rows tween enabled so transitionstart/end
    // fire (motion-reduce:transition-none would snap instead of animating),
    // regardless of the host OS/browser reduced-motion preference.
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto("/en/pricing");
    await page.waitForLoadState("networkidle");

    const question = page.getByRole("button", { name: FAQ_Q1 });
    await question.scrollIntoViewIfNeeded();

    // Locate the animated region through the trigger's aria-controls wiring.
    const controlsId = await question.getAttribute("aria-controls");
    expect(controlsId).toBeTruthy();
    const wrapper = page.locator(`[id="${controlsId}"]`);
    const answer = page.getByText(FAQ_A1);

    // ── Collapsed by default: answer mounted (keepMounted SSR contract)
    //    but clipped to zero height ──────────────────────────────────────
    await expect(answer).toBeAttached();
    await expect(wrapper).toHaveClass(/grid-rows-\[0fr\]/);
    await expect.poll(() => wrapperHeight(wrapper)).toBeLessThan(2);
    await expect(question).toHaveAttribute("aria-expanded", "false");

    // ── Open: the 0fr → 1fr tween expands the answer to its full height ─
    const expandEnded = transitionEnd(wrapper, "grid-template-rows");
    await question.click();
    await expect(question).toHaveAttribute("aria-expanded", "true");
    await expandEnded; // tween fully done before the collapse leg
    await expect(wrapper).toHaveClass(/grid-rows-\[1fr\]/);
    await expect.poll(() => wrapperHeight(wrapper), { timeout: 3_000 }).toBeGreaterThan(20);

    // ── Collapse: anchored on the real grid-template-rows transitionend ──
    const collapseEnded = transitionEnd(wrapper, "grid-template-rows");
    await question.click();
    await expect(question).toHaveAttribute("aria-expanded", "false");
    await collapseEnded;

    // Exit finished: the answer is STILL in the DOM (keepMounted never
    // unmounts; exit-unmount is the non-keepMounted mode) but clipped.
    await expect(answer).toBeAttached();
    await expect.poll(() => wrapperHeight(wrapper), { timeout: 3_000 }).toBeLessThan(2);
    await expect(wrapper).toHaveClass(/grid-rows-\[0fr\]/);
    await expect(answer).toBeAttached();
  });
});
