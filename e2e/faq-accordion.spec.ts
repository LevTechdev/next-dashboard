import { test, expect, type Locator } from "@playwright/test";

/**
 * FAQ accordion collapse lifecycle E2E (AnimatedDisclosure keepMounted mode).
 *
 * The marketing FAQ (FaqAccordion on /en/pricing) renders every answer through
 * AnimatedDisclosure with `keepMounted`: the body is ALWAYS in the DOM (SSR/SEO
 * contract) and expand/collapse is a CSS grid-template-rows tween (0fr ↔ 1fr)
 * that clips the answer to zero height when closed. So unlike the default
 * (AnimatePresence exit-unmount) mode, "exit" here means the collapse tween:
 * the answer must stay mounted and mid-tween during it, and end
 * clipped-but-still-attached. A real browser is required because the tween is
 * pure CSS layout animation — jsdom cannot run it.
 */

const FAQ_Q1 = "Can I upgrade or downgrade my plan at any time?";
const FAQ_A1 = /Yes, you can change your plan at any time/;

/** Resolve when the wrapper fires the given CSS transition event. */
function transitionEvent(
  wrapper: Locator,
  event: "transitionstart" | "transitionend",
): Promise<void> {
  return wrapper.evaluate(
    (el, evt) =>
      new Promise<void>((resolve) => {
        const handler = () => {
          el.removeEventListener(evt, handler);
          resolve();
        };
        el.addEventListener(evt, handler);
      }),
    event,
  );
}

const wrapperHeight = (wrapper: Locator) =>
  wrapper.evaluate((el) => el.getBoundingClientRect().height);

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
    await question.click();
    await expect(question).toHaveAttribute("aria-expanded", "true");
    await expect(wrapper).toHaveClass(/grid-rows-\[1fr\]/);
    await expect.poll(() => wrapperHeight(wrapper), { timeout: 3_000 }).toBeGreaterThan(20);
    const openHeight = await wrapperHeight(wrapper);

    // ── Collapse: anchor on the exit tween itself ───────────────────────
    const exitStarted = transitionEvent(wrapper, "transitionstart");
    const exitEnded = transitionEvent(wrapper, "transitionend");
    await question.click();
    await expect(question).toHaveAttribute("aria-expanded", "false");
    await exitStarted;

    // Mid-exit: the answer is STILL MOUNTED and the region is mid-collapse —
    // not instantly removed, not yet fully clipped.
    await expect(answer).toBeAttached();
    await page.waitForTimeout(150); // ~half of the 300ms tween
    const midHeight = await wrapperHeight(wrapper);
    expect(midHeight).toBeGreaterThan(0);
    expect(midHeight).toBeLessThan(openHeight);
    await expect(answer).toBeAttached();

    // Exit finished: clipped to zero height — but still in the DOM.
    // (keepMounted never unmounts; exit-unmount is the non-keepMounted mode.)
    await exitEnded;
    await expect.poll(() => wrapperHeight(wrapper), { timeout: 3_000 }).toBeLessThan(2);
    await expect(wrapper).toHaveClass(/grid-rows-\[0fr\]/);
    await expect(answer).toBeAttached();
  });
});
