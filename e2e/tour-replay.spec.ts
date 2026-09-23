import { test, expect } from "@playwright/test";
import { loginAs, FETCH_GATED } from "./helpers";

/**
 * Settings → Language card: "Replay tour" restart button.
 *
 * The button (data-testid="restart-tour") dispatches the shared
 * `dashboard:restart-tour` event with the currently selected language; the
 * OnboardingTour listens for it, clears the completion marker, and reruns
 * the tour in that language. This spec pins the Settings-side contract:
 * the button exists, is clickable, and the replay intent is dispatched
 * (asserted via an in-page event listener) — the tour overlay itself is
 * webdriver-gated by design (see onboarding-tour.tsx), so the full
 * auto-start/completion flow lives in onboarding-tour.spec.ts.
 */
test.describe("Onboarding tour replay", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page);
    // Listen for the replay event before any navigation so the dispatch
    // fired by the button click is captured.
    await page.goto("/en/settings");
  });

  test("settings exposes a replay-tour button that dispatches the restart event", async ({
    page,
  }) => {
    // Install a capture hook, then click the Settings button.
    await page.evaluate(() => {
      (window as unknown as { __tourReplays?: unknown[] }).__tourReplays = [];
      window.addEventListener("dashboard:restart-tour", (e) => {
        (window as unknown as { __tourReplays?: unknown[] }).__tourReplays!.push(
          (e as CustomEvent).detail,
        );
      });
    });

    const btn = page.getByTestId("restart-tour");
    await expect(btn).toBeVisible(FETCH_GATED);
    await expect(btn).toContainText("Replay tour");
    await btn.click();

    // Success toast confirms the intent; the event carried the UI locale.
    await expect(page.getByText("Starting the tour — head to the Dashboard.")).toBeVisible();
    const replays = await page.evaluate(
      () => (window as unknown as { __tourReplays?: Array<{ locale?: string }> }).__tourReplays,
    );
    expect(replays).toHaveLength(1);
    expect(replays?.[0]?.locale).toBe("en");
  });

  test("replay button reflects a language switch in the dispatched locale", async ({ page }) => {
    await page.evaluate(() => {
      (window as unknown as { __tourReplays?: unknown[] }).__tourReplays = [];
      window.addEventListener("dashboard:restart-tour", (e) => {
        (window as unknown as { __tourReplays?: unknown[] }).__tourReplays!.push(
          (e as CustomEvent).detail,
        );
      });
    });

    // Switch the settings language to Japanese, then replay — the event must
    // carry "ja" so the tour renders its copy in Japanese.
    await page.getByRole("button", { name: /日本語/ }).click();
    await expect(page.getByTestId("restart-tour")).toBeVisible(FETCH_GATED);
    await page.getByTestId("restart-tour").click();

    const replays = await page.evaluate(
      () => (window as unknown as { __tourReplays?: Array<{ locale?: string }> }).__tourReplays,
    );
    expect(replays).toHaveLength(1);
    expect(replays?.[0]?.locale).toBe("ja");
  });
});
