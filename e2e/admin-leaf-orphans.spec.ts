import { test, expect } from "@playwright/test";
import { loginAs, FETCH_GATED } from "./helpers";

/**
 * Admin leaf-orphans health card — the ops signal that makes the leaf sync's
 * unsyncable rows a first-class admin-panel verdict instead of a Settings-page
 * afterthought.
 *
 * The card's verdict depends on machine-local state the suite cannot seed:
 * the orphan report lives in the gitignored leaf-sync watermark file, and the
 * acknowledged-orphan ledger is gitignored operator state (both written by
 * scripts/sync-supabase-leaves.mjs / scripts/ack-leaf-orphans.mjs). A fresh
 * CI runner has neither → the projected report is empty → "Clean". A long-
 * lived dev machine has orphans (every signup mints them) and maybe acks →
 * "Needs reconciliation" or "Acknowledged".
 *
 * So this spec pins COHERENCE rather than a specific verdict: the badge, the
 * data-state, and the body must tell the same story, and the guarded API must
 * agree with the card. It deliberately never clicks "Run sync" — that trigger
 * runs the real sync job, which a configured environment must not have a test
 * fire.
 */
test.describe("Admin leaf-orphans health", () => {
  test("renders a coherent verdict that matches the guarded API", async ({ page }) => {
    await loginAs(page);
    await page.goto("/en/admin");
    await page.waitForURL("**/en/admin**");

    const card = page.getByTestId("leaf-orphans-card");
    await expect(card).toBeVisible(FETCH_GATED);

    // The badge hydrated from GET /api/admin/leaf-orphans — one of the three
    // real verdicts, never a placeholder.
    const badge = page.getByTestId("leaf-orphans-badge");
    await expect(badge).toHaveText(/^(Clean|Acknowledged|Needs reconciliation)$/, FETCH_GATED);
    const state = await card.getAttribute("data-state");
    expect(state).toMatch(/^(ok|warn|bad)$/);

    // Badge ↔ data-state coherence: each badge text maps to exactly one state.
    const badgeText = ((await badge.textContent()) ?? "").trim();
    const expectedState = {
      Clean: "ok",
      Acknowledged: "warn",
      "Needs reconciliation": "bad",
    }[badgeText];
    expect(expectedState, `badge "${badgeText}" maps to a state`).toBeDefined();
    expect(state, "badge ⇔ data-state coherence").toBe(expectedState);

    if (state === "ok") {
      // Clean world (fresh CI runner: no watermark file, no ledger): the
      // explicit all-clear, and no count line.
      await expect(card).toContainText(/mirror is complete/i);
      await expect(card.getByTestId("leaf-orphans-total")).toHaveCount(0);
    } else {
      // Report world: the total line with real numbers, per-table counts,
      // and — unless every sampled ref has been acknowledged — at least one
      // sample fingerprint an operator can act on.
      const total = card.getByTestId("leaf-orphans-total");
      await expect(total).toBeVisible();
      await expect(total).toHaveText(/^\d+ unsyncable rows across \d+ tables$/);
      await expect(card.getByText(/^\w+: \d+$/).first()).toBeVisible();
      if (state === "bad") {
        await expect(card.locator("p.font-mono").first()).toBeVisible();
      }
      // The reconciliation ritual is named so the verdict is actionable.
      await expect(card).toContainText(/ack-leaf-orphans/);
    }

    // The card must agree with its own guarded endpoint (admin-only; the seed
    // admin session in this context is authorized by construction).
    const health = await page.request.get("/api/admin/leaf-orphans", { timeout: 45_000 });
    expect(health.ok(), "the guarded leaf-orphans API answers for the admin").toBeTruthy();
    const report = (await health.json()) as { state: string; total: number };
    expect(report.state).toMatch(/^(ok|warn|bad)$/);
    expect(report.state, "API verdict matches the rendered card").toBe(state);
    if (state !== "ok") {
      expect(report.total, "API total is non-zero in a report world").toBeGreaterThan(0);
    }

    // The triggers render armed; the spec never fires "Run sync" (it runs the
    // real sync job — a side effect a test must not cause).
    await expect(page.getByTestId("leaf-orphans-run")).toBeEnabled();
  });
});
