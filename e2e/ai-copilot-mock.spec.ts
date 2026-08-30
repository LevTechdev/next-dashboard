import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

/**
 * Copilot E2E: opens the panel, sends a message, and asserts the reply path.
 *
 * The route serves either the canned dev-mode mock or a real AI provider
 * (see shouldUseMockReply in src/lib/ai/chat-locale.ts):
 * - CI forces AI_MOCK=1 (see e2e-reusable.yml) -> the canned "dev-mode mock
 *   reply" plus the header "dev mode" badge are asserted deterministically.
 * - Local dev with a GEMINI/OPENAI key configured -> a real provider reply is
 *   asserted (non-empty assistant message, no badge).
 * AI_MOCK=1 always wins server-side, so the mock assertions only run when the
 * suite forces them; otherwise this spec doubles as a real-provider smoke
 * test of the Gemini/OpenAI streaming path.
 */
test("copilot replies and flags the dev-mode badge when the mock is active", async ({ page }) => {
  // The real-provider branch may wait out a Gemini free-tier rate-limit
  // window (up to ~85s) or a slow tool round-trip (~30s+) before resending —
  // well beyond the 30s default.
  test.setTimeout(420_000);
  await loginAs(page);

  // Open the copilot panel.
  const fab = page.getByRole("button", { name: "Open AI Copilot" });
  await fab.click();
  const panel = page.getByTestId("ai-copilot-panel");
  await expect(panel).toBeVisible();

  // No reply yet — no badge.
  const badge = panel.getByTestId("ai-dev-mode-badge");
  await expect(badge).not.toBeVisible();

  // Ask something.
  const input = panel.getByRole("textbox");
  await input.fill("What is my revenue?");
  await input.press("Enter");

  if (process.env.AI_MOCK === "1") {
    // The canned mock reply renders instantly…
    await expect(panel.getByText(/dev-mode mock reply/)).toBeVisible();
    // …and the header badge flags the conversation as dev mode.
    await expect(badge).toBeVisible();
  } else {
    // Real provider (local dev with a Gemini/OpenAI key): a non-empty reply
    // streams into the last assistant bubble (the loading placeholder shows
    // "..." until the first chunk), and the conversation is NOT dev mode.
    //
    // The free-tier Gemini quota (20 req/min) can 429 the first attempt, and
    // the current flash alias occasionally 503s under "high demand"; the route
    // surfaces both as non-answer bubbles. When one is detected, wait out the
    // window and resend, so the assertions below always run against a genuine
    // provider round-trip.
    const lastBubble = panel.locator(".whitespace-pre-wrap").last();
    const chip = panel.getByTestId("ai-tool-chip-getDashboardStats");
    let stuck = true;

    for (let attempt = 0; attempt < 3 && stuck; attempt++) {
      // The current flash models are "thinking" models: the full tool
      // round-trip (functionCall round + final-text round) can take ~30s, so
      // give the reply generous time to stream.
      await expect
        .poll(async () => (await lastBubble.textContent())?.trim() ?? "", {
          timeout: 90_000,
          message: "copilot never produced a reply",
        })
        .not.toMatch(/^(\.\.\.|)$/);

      const text = (await lastBubble.textContent()) ?? "";
      const rateLimited = /rate-limited/i.test(text);
      const errored = /error occurred/i.test(text);
      if (!rateLimited && !errored) {
        stuck = false;
        break;
      }

      if (rateLimited) {
        // Read the suggested window ("Try again in about 33 seconds") from
        // the amber banner, then wait it out. The free-tier limit is a ROLLING
        // per-minute window, so a fresh attempt right after the reported
        // countdown just re-arms it — wait a generous fixed cooldown (at least
        // 80s) with zero requests before resending.
        const retryText = await panel
          .getByText(/Try again in about/i)
          .textContent()
          .catch(() => null);
        const retryAfter = Number(retryText?.match(/about (\d+) seconds/i)?.[1] ?? 40);
        await page.waitForTimeout((Math.max(retryAfter, 80) + 5) * 1000);
      } else {
        // Generic provider failure (e.g. a residual "high demand" 503 the
        // route's own retry couldn't ride out): back off briefly and resend.
        await page.waitForTimeout(10_000);
      }
      await expect(input).toBeEnabled();
      await input.fill("What is my revenue?");
      await input.press("Enter");
    }

    expect(
      stuck,
      "Gemini stayed rate-limited/errored across retries — free-tier quota or provider availability",
    ).toBe(false);
    await expect(badge).not.toBeVisible();

    // The revenue question triggers a real Gemini tool call
    // (getDashboardStats), which renders an inline tool chip above the
    // assistant bubble and persists in the conversation history. The chip is
    // emitted BEFORE the final answer streams, so once the reply is non-empty
    // the chip must already be present — poll anyway for a flake-free read.
    await expect
      .poll(async () => await chip.isVisible(), {
        timeout: 30_000,
        message: "tool chip never appeared after the Gemini tool call",
      })
      .toBe(true);
  }
});
