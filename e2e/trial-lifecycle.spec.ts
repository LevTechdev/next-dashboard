import { test, expect } from "@playwright/test";
import { registerFreshUser } from "./helpers";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

/**
 * Full trial lifecycle — the 14-day PRO signup trial, end to end:
 *
 *   1. register → the Billing usage card shows the TRIAL chip
 *      ("Professional · N days") because /api/usage reports plan.trial
 *      while the TRIALING subscription is unexpired.
 *   2. seed the subscription lapsed (currentPeriodEnd in the past) —
 *      exactly what the nightly trial-sweep job would act on.
 *   3. reload → the chip is gone and the plan reads Starter: tier
 *      resolution ignores a lapsed TRIALING row, so the downgrade is
 *      visible without waiting for the sweep to run.
 *
 * Database access goes through the project's DATABASE_URL (local Postgres
 * mirror) via prisma CLI — Playwright's webServer guarantees it is up.
 */

const dbUrl = () => {
  // CI exports DATABASE_URL directly and has no .env files — prefer the
  // process environment, then fall back to the local dev files.
  const fromEnv = process.env.DATABASE_URL?.trim();
  if (fromEnv) return fromEnv.split("?")[0];
  for (const envFile of [".env.local", ".env"]) {
    try {
      const line = readFileSync(envFile, "utf-8")
        .split(/\r?\n/)
        .find((l: string) => l.startsWith("DATABASE_URL="));
      if (line) {
        // psql rejects Prisma-style params (?schema=public) — bare URL only.
        return line.slice("DATABASE_URL=".length).trim().split("?")[0];
      }
    } catch {
      // try next
    }
  }
  throw new Error("DATABASE_URL not found for trial-lifecycle spec");
};

function psql(sql: string): string {
  // Windows execSync + multi-line SQL: collapse whitespace so the arg is a
  // single shell word, and quote with double quotes (JSON.stringify escapes
  // embedded quotes safely for cmd/PowerShell).
  const oneLine = sql.replace(/\s+/g, " ").trim();
  return execSync(`psql "${dbUrl()}" -tAc "${oneLine.replace(/"/g, '\\"')}"`, {
    encoding: "utf-8",
  }).trim();
}

test.describe("Trial lifecycle", () => {
  test("register shows PRO trial chip, lapse downgrades to Starter", async ({ page }) => {
    const email = await registerFreshUser(page, {
      emailPrefix: "trial-lifecycle",
      name: "Trial Lifecycle",
    });

    // ── 1. Fresh signup → TRIALING Professional + trial chip ────────────
    const subJson = psql(
      `SELECT json_agg(row_to_json(s)) FROM (
         SELECT "planId", status, "currentPeriodEnd"
         FROM "Subscription" sub
         JOIN "User" u ON u.id = sub."userId"
         WHERE u.email = '${email}'
       ) s`,
    );
    const sub = JSON.parse(subJson)[0];
    expect(sub.status).toBe("TRIALING");

    const planName = psql(
      `SELECT p.name FROM "Plan" p
       WHERE p.id = (SELECT sub."planId" FROM "Subscription" sub
                     JOIN "User" u ON u.id = sub."userId"
                     WHERE u.email = '${email}')`,
    );
    expect(planName).toBe("Professional");

    await page.goto("/en/billing");
    const chip = page.getByTestId("usage-trial-chip");
    await expect(chip).toBeVisible({ timeout: 30_000 });
    // Chip text is localized but always carries the days count.
    await expect(chip).toContainText(/\d+/);
    // Plan line should show the trial plan (Professional), not Starter.
    await expect(page.getByTestId("usage-quota-card")).toContainText(/Professional/i);

    // ── 2. Lapse the trial (what the sweep job acts on) ──────────────────
    psql(
      `UPDATE "Subscription" SET "currentPeriodEnd" = now() - interval '1 day'
       WHERE "userId" = (SELECT id FROM "User" WHERE email = '${email}')`,
    );

    // ── 3. Reload → chip gone, plan reads Starter (tier fallback) ────────
    await page.goto("/en/billing");
    await expect(page.getByTestId("usage-quota-card")).toBeVisible({ timeout: 30_000 });
    await expect(chip).toHaveCount(0);
    await expect(page.getByTestId("usage-quota-card")).toContainText(/Starter/i);
    // PRO gates closed again: self-registered users are CLIENT, so instead
    // of the owner-facing upgrade CTA they get the read-only banner handing
    // them off to the workspace owner (assert the owner CTA is NOT shown).
    await expect(page.getByTestId("usage-upgrade-cta")).toHaveCount(0);
    await expect(page.getByTestId("usage-client-banner")).toBeVisible();
  });
});
