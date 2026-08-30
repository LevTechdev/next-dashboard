import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

/**
 * Copilot E2E: stubs the chat route with a 429 and asserts the full
 * rate-limit recovery flow — the amber banner appears, the live countdown
 * ticks down, the "why is this happening?" note expands (and its toggle is
 * dismissed for the session), and the hook re-sends the failed question
 * automatically once the retry window elapses, capping at the retry limit and
 * flipping to the manual "try again now" button.
 *
 * The route is stubbed via page.route, so no real AI provider is ever
 * contacted (AI_MOCK=1 in CI is irrelevant here) — the spec is deterministic
 * and fast: each episode uses a 4s retry window.
 */
test("rate-limit banner ticks down, expands the why-note, and auto-retries", async ({ page }) => {
  test.setTimeout(90_000);
  await loginAs(page);

  // Stub the chat route: every request answers 429 with a short window, and
  // record the questions the client sends (the auto-retry re-sends the SAME
  // question, so the second request's content must match the first).
  const sentQuestions: string[] = [];
  let requests = 0;
  await page.route("**/api/ai/chat", async (route) => {
    requests += 1;
    const body = (route.request().postDataJSON?.() ?? {}) as {
      messages?: { role: string; content: string }[];
    };
    const last = body.messages?.[body.messages.length - 1];
    if (last?.role === "user") sentQuestions.push(last.content);
    await route.fulfill({
      status: 429,
      contentType: "application/json",
      body: JSON.stringify({ error: "rate_limited", retryAfter: 4 }),
    });
  });

  // Open the copilot panel.
  await page.getByRole("button", { name: "Open AI Copilot" }).click();
  const panel = page.getByTestId("ai-copilot-panel");
  await expect(panel).toBeVisible();

  // Ask something.
  const input = panel.getByRole("textbox");
  await input.fill("What is my revenue?");
  await input.press("Enter");

  // The amber banner appears with the friendly fallback — not a generic error.
  await expect(
    panel.getByText("The AI service is temporarily rate-limited (free-tier quota reached)."),
  ).toBeVisible();

  // The countdown starts at the provider's window and ticks down live.
  const countdown = panel.getByTestId("ai-retry-countdown");
  await expect(countdown).toBeVisible();
  await expect(countdown).toHaveText(/Retrying automatically in \d+s/);
  const initial = (await countdown.textContent())?.trim();
  await expect
    .poll(async () => (await countdown.textContent())?.trim(), {
      timeout: 10_000,
      message: "rate-limit countdown never ticked",
    })
    .not.toBe(initial);

  // The why-note expands to explain the free-tier quota; the toggle is
  // dismissed for the rest of the session after that first expand.
  const why = panel.getByRole("button", { name: "Why is this happening?" });
  await why.click();
  const note = panel.getByTestId("ai-rate-limit-why");
  await expect(note).toBeVisible();
  await expect(note).toHaveText(/free tier/i);
  await expect(why).not.toBeVisible();

  // Once the 4s window elapses, the hook re-sends the SAME question
  // automatically — the stub sees a second request with identical content.
  await expect
    .poll(() => sentQuestions.filter((q) => q === "What is my revenue?").length, {
      timeout: 15_000,
      message: "the failed question was never re-sent automatically",
    })
    .toBeGreaterThanOrEqual(2);
  expect(requests).toBeGreaterThanOrEqual(2);

  // Auto-retries are capped (2 per episode): after the final 429 the banner
  // flips to the manual "try again now" button instead of looping forever.
  await expect(panel.getByTestId("ai-retry-ready")).toBeVisible({ timeout: 20_000 });
});
