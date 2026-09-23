import { test, expect, type Locator, type Page } from "@playwright/test";

import { loginAs, registerFreshUser } from "./helpers";

/**
 * Self-serve plan changes (E2E).
 *
 * The pricing page used to end at "Get started" for everybody. For a signed-in
 * workspace it now reads the subscription, labels each card with what the click
 * will actually do (Current plan / Upgrade / Downgrade / Switch to yearly), and
 * routes a real change through a dialog that shows the SERVER's proration
 * before anything is written.
 *
 * This spec proves that chain in a browser, and it proves it by applying real
 * changes: the money asserted here is arithmetic the API produced, not a fixture.
 *
 * Actors are chosen to keep the suite honest and isolated:
 *   · a FRESH registration (provisioned on Professional, monthly) so the plan
 *     changes never touch the seed admin that tier-gated specs depend on;
 *   · the shared seed admin for the cancel path, which writes nothing.
 */

/** Read a currency cell (`$39.50`, `−$14.50`) as a number. */
async function amount(locator: Locator): Promise<number> {
  const raw = (await locator.textContent()) ?? "";
  // U+2212 is what the dialog uses for the credit sign; Intl uses ASCII "-".
  const normalized = raw.replace(/\u2212/g, "-").replace(/[^\d.-]/g, "");
  const value = Number.parseFloat(normalized);
  expect(Number.isFinite(value), `could not parse an amount from ${JSON.stringify(raw)}`).toBe(
    true,
  );
  return value;
}

type PriceRow = { name: string; price: number; yearlyPrice: number | null };

/** The public plan catalogue — the rates the proration is computed from. */
async function catalogue(page: Page): Promise<PriceRow[]> {
  return page.evaluate(async () => {
    const res = await fetch("/api/billing/plans");
    return res.ok ? await res.json() : [];
  });
}

async function openDialogFor(page: Page, planKey: "starter" | "professional" | "enterprise") {
  await page.getByTestId(`plan-cta-${planKey}`).click();
  const dialog = page.getByTestId("plan-change-dialog");
  await expect(dialog).toBeVisible();
  // The preview is fetched by the dialog on open; the line items appear only
  // once the server has answered, so waiting on them is the hydration barrier.
  await expect(page.getByTestId("plan-change-lines")).toBeVisible();
  return dialog;
}

test.describe("Self-serve plan changes", () => {
  test("an upgrade is prorated, confirmed, and immediately reflected on the cards", async ({
    page,
  }) => {
    await registerFreshUser(page);

    await page.goto("/en/pricing");

    // Hydration barrier, and a stronger one than `networkidle`: an AUTHENTICATED
    // page keeps polling in the background, so the network never goes idle here.
    // Waiting for the subscription-driven card state proves both that React
    // hydrated and that the workspace fetch resolved — the two things a click
    // needs. A fresh workspace is provisioned on Professional (monthly), so that
    // card is spent and the tier above it is offered as an upgrade.
    await expect(page.getByTestId("plan-cta-professional")).toHaveAttribute(
      "data-cta-kind",
      "current",
    );
    await expect(page.getByTestId("plan-cta-professional")).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await expect(page.getByTestId("plan-cta-enterprise")).toHaveAttribute(
      "data-cta-kind",
      "change",
    );

    const dialog = await openDialogFor(page, "enterprise");

    // The dialog quotes a real proration: the unused half of the period is
    // credited at the old rate and charged at the new one, and what is due is
    // exactly the difference — the engine's own invariant, read off the screen.
    const credit = Math.abs(await amount(page.getByTestId("plan-change-credit")));
    const charge = await amount(page.getByTestId("plan-change-charge"));
    const due = await amount(page.getByTestId("plan-change-due"));

    expect(credit).toBeGreaterThan(0);
    expect(charge).toBeGreaterThan(credit);
    expect(due).toBeCloseTo(charge - credit, 1);

    // The figure is checked against the published rates rather than a magic
    // number: a workspace minutes into its period owes essentially the whole
    // monthly difference between the two tiers — no more (nothing is gifted),
    // and no less (nothing is billed twice).
    const plans = await catalogue(page);
    const pro = plans.find((p) => p.name === "Professional")!;
    const enterprise = plans.find((p) => p.name === "Enterprise")!;
    const tierDelta = enterprise.price - pro.price;
    expect(due).toBeGreaterThan(tierDelta * 0.9);
    expect(due).toBeLessThanOrEqual(tierDelta);

    // ── Confirm: the POST carries the explicit confirmation flag ──
    const posted = page.waitForRequest(
      (req) => req.url().includes("/api/billing/plan-change") && req.method() === "POST",
    );
    await page.getByTestId("plan-change-confirm").click();
    const body = JSON.parse((await posted).postData() ?? "{}");
    expect(body.confirm).toBe(true);
    expect(body.billingInterval).toBe("MONTHLY");
    expect(typeof body.planId).toBe("string");
    expect(body.planId.length).toBeGreaterThan(0);

    await expect(dialog).toBeHidden();

    // ── The cards reflect the change, not a stale render ──
    await expect(page.getByTestId("plan-cta-enterprise")).toHaveAttribute(
      "data-cta-kind",
      "current",
    );
    await expect(page.getByTestId("plan-cta-professional")).toHaveAttribute(
      "data-cta-kind",
      "change",
    );

    // ── …and the backend agrees, which is what the tenant actually runs on ──
    const sub = await page.evaluate(async () => {
      const res = await fetch("/api/billing/subscription");
      return res.ok ? (await res.json()).subscription : null;
    });
    expect(sub?.plan?.name).toBe("Enterprise");
    expect(sub?.billingInterval).toBe("MONTHLY");
  });

  test("switching the billing period is its own kind of change, priced both ways", async ({
    page,
  }) => {
    await registerFreshUser(page);

    await page.goto("/en/pricing");
    // See the note in the first test: an authenticated page never reaches
    // `networkidle`, so the hydrated, subscription-aware card is the barrier —
    // and it must land BEFORE the toggle, or the click is dropped mid-hydration.
    await expect(page.getByTestId("plan-cta-professional")).toHaveAttribute(
      "data-cta-kind",
      "current",
    );

    // Same tier, different interval: the card offers the period switch, not an
    // upgrade, because the tier did not move.
    await page.getByTestId("billing-interval-yearly").click();
    await expect(page.getByTestId("billing-interval-yearly")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.getByTestId("plan-cta-professional")).toHaveAttribute(
      "data-cta-kind",
      "change",
    );

    const dialog = await openDialogFor(page, "professional");

    // The edit is stated in the dialog: from monthly, to yearly.
    await expect(dialog).toContainText(/monthly/i);
    await expect(dialog).toContainText(/yearly/i);

    const credit = Math.abs(await amount(page.getByTestId("plan-change-credit")));
    const charge = await amount(page.getByTestId("plan-change-charge"));
    const due = await amount(page.getByTestId("plan-change-due"));

    expect(due).toBeCloseTo(charge - credit, 1);

    // Same-tier period switch: the charge is the yearly rate and the credit is
    // the monthly rate, for the same remaining span — so a workspace minutes in
    // owes the yearly-vs-monthly difference, which dwarfs any tier jump.
    const plans = await catalogue(page);
    const pro = plans.find((p) => p.name === "Professional")!;
    const enterprise = plans.find((p) => p.name === "Enterprise")!;
    const periodDelta = (pro.yearlyPrice ?? 0) - pro.price;
    expect(periodDelta).toBeGreaterThan(enterprise.price - pro.price);
    expect(due).toBeGreaterThan(periodDelta * 0.9);
    expect(due).toBeLessThanOrEqual(periodDelta);

    await page.getByTestId("plan-change-confirm").click();
    await expect(dialog).toBeHidden();

    await expect(page.getByTestId("plan-cta-professional")).toHaveAttribute(
      "data-cta-kind",
      "current",
    );

    const sub = await page.evaluate(async () => {
      const res = await fetch("/api/billing/subscription");
      return res.ok ? (await res.json()).subscription : null;
    });
    expect(sub?.billingInterval).toBe("YEARLY");
  });

  test("cancelling the dialog changes nothing at all", async ({ page }) => {
    // Seed admin (Starter, monthly) — nothing is written on this path, so the
    // shared account is safe to use here.
    await loginAs(page);

    let posts = 0;
    page.on("request", (req) => {
      if (req.url().includes("/api/billing/plan-change") && req.method() === "POST") posts++;
    });

    await page.goto("/en/pricing");

    // Same barrier as above: the seed admin sits on Starter (monthly), and this
    // attribute only appears once the client has read the subscription.

    await expect(page.getByTestId("plan-cta-starter")).toHaveAttribute("data-cta-kind", "current");

    const dialog = await openDialogFor(page, "enterprise");
    await dialog.getByRole("button", { name: /cancel/i }).click();
    await expect(dialog).toBeHidden();

    // A dialog that merely LOOKS like a confirmation would have posted by now.
    await page.waitForTimeout(400);
    expect(posts).toBe(0);

    // And the card is untouched — still an upgrade, still offered.
    await expect(page.getByTestId("plan-cta-enterprise")).toHaveAttribute(
      "data-cta-kind",
      "change",
    );
    const sub = await page.evaluate(async () => {
      const res = await fetch("/api/billing/subscription");
      return res.ok ? (await res.json()).subscription : null;
    });
    expect(sub?.plan?.name).toBe("Starter");
  });
});
