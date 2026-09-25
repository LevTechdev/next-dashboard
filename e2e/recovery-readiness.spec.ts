import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { generateSync } from "otplib";
import {
  acknowledgeRecoveryGuardIfShown,
  observeLoginResponse,
  registerFreshUser,
  TEST_PASSWORD,
  waitForLoginThrottleWindow,
} from "./helpers";

/**
 * Recovery readiness (E2E).
 *
 * The panel claims to answer "if I lost this phone right now, could I still get
 * in?". A claim like that is only worth having if it tracks reality, so this
 * spec walks one real account up the ladder and checks the verdict after each
 * genuine change — including that it never announces safety before the data
 * has arrived.
 *
 * No API is stubbed: the panel reads the same endpoints the rest of the
 * Security Center does.
 */

let email = "";
let totpSecret = "";

/**
 * Direct DB access, used for exactly one thing: planting yesterday's verdict.
 * History is a day-per-row series, so a cross-day decline cannot be produced by
 * clicking quickly — it has to be seeded. (The same-day drop IS produced by
 * clicking, and is asserted before this is used.)
 */
const prisma = new PrismaClient();

/**
 * A code from a time step this spec has not spent yet.
 *
 * Two constraints, in order: never straddle a step boundary mid-flight (the
 * old check), and never reuse a step already used by an earlier sign-in — the
 * RFC 6238 replay guard rightly refuses a spent code, and three serial tests
 * that sign in back-to-back with a 30-second TOTP step would trip it.
 */
let lastStep = -1;
async function freshCode(secret: string) {
  const stepOf = () => Math.floor(Date.now() / 30_000);
  const secondsIntoStep = (Date.now() / 1000) % 30;

  if (secondsIntoStep > 20 || stepOf() === lastStep) {
    const waitMs = (30 - secondsIntoStep) * 1000 + 1200;
    await new Promise((r) => setTimeout(r, waitMs));
  }

  lastStep = stepOf();
  return generateSync({ secret });
}

/**
 * Sign back in on a fresh browser context (Playwright gives every test its
 * own) using the authenticator the first test enrolled, so the second test
 * can look at the same account. Inherits the suite's throttle backoff: a 429
 * from the shared per-IP window would otherwise bounce us back to /en/login.
 */
async function signIn(page: Page) {
  await page.goto("/en/login");
  await expect(page.getByRole("textbox", { name: "Your email" })).toBeVisible();
  await page.locator('form:visible:has(input[type="password"]) input[type="email"]').fill(email);
  await page.getByPlaceholder("Enter password").fill(TEST_PASSWORD);

  await waitForLoginThrottleWindow();
  const posted = observeLoginResponse(
    page
      .waitForResponse((res) => res.url().includes("/api/auth/login"), { timeout: 60_000 })
      .catch(() => null),
  );
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  const first = await posted;
  if (first && first.status() === 429) {
    await waitForLoginThrottleWindow();
    await page.getByRole("button", { name: "Log in", exact: true }).click();
  }

  await expect(page.getByRole("heading", { name: "Choose how to verify" })).toBeVisible();
  await page.getByRole("button", { name: /Use authenticator app/ }).click();
  await expect(page.getByRole("heading", { name: "Two-Factor Auth", exact: true })).toBeVisible();
  await page.locator('input[inputmode="numeric"]').fill(await freshCode(totpSecret));
  await expect(page).toHaveURL(/\/en\/dashboard/, { timeout: 20_000 });
}

/** The raw series, read through the API so the graph can be checked against it. */
async function readHistory(page: Page): Promise<{
  snapshots: Array<{ day: string; level: string }>;
  trend: string;
}> {
  return page.evaluate(async () => {
    const res = await fetch("/api/auth/recovery-history?days=30");
    return (await res.json()) as {
      snapshots: Array<{ day: string; level: string }>;
      trend: string;
    };
  });
}

/** The panel, on the Security Center. */
async function openReadiness(page: Page) {
  await page.goto("/en/security");
  const card = page.getByTestId("recovery-readiness-card");
  await expect(card).toBeVisible();
  return card;
}

test.describe("Recovery readiness", () => {
  test.describe.configure({ mode: "serial" });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test("names the missing path first, then tracks each real fix", async ({ page }) => {
    test.setTimeout(240_000);
    email = `readiness-${Date.now()}@example.com`;
    await registerFreshUser(page, { email, name: "Readiness User" });

    // ── 1. Fresh account: no second factor at all. Recovery is moot, and the
    //      panel must say that rather than inventing a recovery gap. ──
    let card = await openReadiness(page);
    await expect(card.getByTestId("recovery-level")).toHaveText("Not protected");
    await expect(card.getByTestId("recovery-next-action")).toHaveText("Set up 2FA");

    // ── 2. Enable 2FA with nothing behind it: the genuinely dangerous state,
    //      and the one the panel exists to surface. `registerFreshUser`
    //      deliberately leaves the email unverified (the unverified contract
    //      other specs rely on), so at this point there is no route back at
    //      all — including no inbox to receive a recovery link. ──
    await card.getByTestId("recovery-next-action").click();
    const setupDialog = page.getByRole("dialog");
    await expect(setupDialog.getByText("Set up two-factor authentication")).toBeVisible();
    totpSecret = (
      (await setupDialog.locator("code span.sr-only").textContent()) ??
      ((await setupDialog.locator("code").textContent()) ?? "").replace(/\s/g, "").slice(-32)
    ).replace(/\s/g, "");
    await setupDialog.getByPlaceholder("000000").fill(await freshCode(totpSecret));
    await setupDialog.getByRole("button", { name: "Verify", exact: true }).click();
    await expect(
      page.getByRole("main").getByText("Two-factor authentication is active"),
    ).toBeVisible();

    card = page.getByTestId("recovery-readiness-card");
    // The click landed the user on the 2FA card, and the verdict is the one
    // that actually matters: protected against thieves, exposed to a lost
    // phone. Every path is missing, including the inbox.
    await expect(card.getByTestId("recovery-level")).toHaveText("Locked out");
    for (const path of ["spareAuthenticator", "recoveryCodes", "passkey", "email"]) {
      await expect(card.getByTestId(`recovery-path-${path}`)).toHaveAttribute(
        "data-state",
        "missing",
      );
    }
    // ...and the ONE thing to fix is the only one that can be done from inside
    // that state: a verified inbox, which is also what the last-resort
    // account recovery needs to reach them.
    await expect(card.getByTestId("recovery-next-action")).toHaveText("Verify email");
    await expect(card.getByTestId("recovery-next-detail")).toContainText(/only route back/i);

    // ── 3. The panel's action is not decoration: clicking it runs the fix in
    //      the card that owns it, and the verdict updates without a reload. ──
    await card.getByTestId("recovery-next-action").click();
    const devOtp = (await page.getByTestId("dev-otp").textContent())?.trim() ?? "";
    expect(devOtp).toMatch(/^\d{6}$/);
    // Auto-submits on the 6th digit — clicking "Verify Email" would race it.
    await page.getByPlaceholder("6-digit code").fill(devOtp);

    card = page.getByTestId("recovery-readiness-card");
    await expect(card.getByTestId("recovery-path-email")).toHaveAttribute(
      "data-state",
      "available",
    );
    // A way back exists now, but it is the downgrade route — still fragile.
    await expect(card.getByTestId("recovery-level")).toHaveText("Fragile");
    await expect(card.getByTestId("recovery-next-detail")).toContainText(
      /never turns two-factor authentication off/i,
    );

    // ── 4. Generate recovery codes: a second real route appears, and the
    //      count is shown rather than a bare state. ──
    const codesCard = page.locator("#backup-codes-card");
    await codesCard.getByRole("button", { name: /Generate codes/ }).click();
    await expect(page.getByTestId("backup-code").first()).toBeVisible();
    await codesCard.getByRole("button", { name: "Done" }).click();

    card = page.getByTestId("recovery-readiness-card");
    await expect(card.getByTestId("recovery-path-recoveryCodes")).toHaveAttribute(
      "data-state",
      "available",
    );
    await expect(card.getByTestId("recovery-path-recoveryCodes")).toContainText("left");
    // Still fragile: codes work, but they are the downgrade route.
    await expect(card.getByTestId("recovery-level")).toHaveText("Fragile");

    // ── 5. Enroll the spare: the account now survives a lost device with no
    //      downgrade at all, so the level flips and the nagging stops. ──
    await card.getByTestId("recovery-next-action").click();
    const spareDialog = page.getByRole("dialog");
    await expect(spareDialog.getByText("Add spare device")).toBeVisible();
    const spareSecret = ((await spareDialog.locator("code").textContent()) ?? "").replace(
      /\s/g,
      "",
    );
    expect(spareSecret.length).toBeGreaterThanOrEqual(16);
    expect(spareSecret).not.toBe(totpSecret);

    await spareDialog.getByLabel("Device name").fill("spare phone");
    await spareDialog.getByLabel("Verification code").fill(await freshCode(spareSecret));
    await spareDialog.getByRole("button", { name: "Verify", exact: true }).click();

    card = page.getByTestId("recovery-readiness-card");
    await expect(card.getByTestId("recovery-level")).toHaveText("Covered");
    await expect(card.getByTestId("recovery-path-spareAuthenticator")).toHaveAttribute(
      "data-state",
      "available",
    );
    await expect(card.getByTestId("recovery-summary")).toContainText(/signs you in normally/i);
    await expect(card.getByTestId("recovery-no-action")).toBeVisible();
    await expect(card.getByTestId("recovery-next-action")).toHaveCount(0);
  });

  test("keeps the series and alerts the day the ladder drops", async ({ page }) => {
    test.setTimeout(240_000);
    // Same account as the first test — Covered, with a spare and fresh codes.
    await signIn(page);

    // ── 1. Visiting the panel records today's verdict, and the series shows. ──
    const card = await openReadiness(page);
    const history = card.getByTestId("recovery-history");
    await expect(history).toBeVisible();
    const sparkline = card.getByTestId("recovery-sparkline");
    await expect(sparkline).toBeVisible();
    expect(Number(await sparkline.getAttribute("data-points"))).toBeGreaterThan(0);

    // The API is the source of the graph: today must be in it, once.
    const first = await readHistory(page);
    const today = new Date().toISOString().slice(0, 10);
    expect(first.snapshots.filter((s) => s.day === today)).toHaveLength(1);
    expect(first.snapshots[first.snapshots.length - 1].level).toBe("ready");

    // ── 2. Take the account down a rung for real: delete the spare. ──
    const spareCard = page.getByTestId("backup-authenticator-card");
    await spareCard.getByRole("button", { name: "Remove spare device" }).click();
    const confirm = page.getByRole("dialog");
    // If this removal would leave no recovery path, the guard demands an
    // acknowledgement before the confirm button enables.
    await acknowledgeRecoveryGuardIfShown(page);
    await confirm.getByRole("button", { name: "Remove spare device" }).click();

    const panel = page.getByTestId("recovery-readiness-card");
    // Codes and a verified inbox remain, so this is fragile — not locked out.
    await expect(panel.getByTestId("recovery-level")).toHaveText("Fragile", { timeout: 20_000 });

    // ── 3. The next visit observes the drop: the series gains a weaker point
    //      and the owner is told, on the day it happened. ──
    await page.reload();
    await expect(panel.getByTestId("recovery-level")).toHaveText("Fragile", { timeout: 20_000 });

    // ── 4. The owner is told, on the day it happened — the alert is written by
    //      the visit that observed the change, not by a nightly sweep later. ──
    await page.goto("/en/notifications");
    await expect(page.getByText("Account recovery got weaker").first()).toBeVisible({
      timeout: 20_000,
    });

    // One alert for one drop, however many times the panel is opened.
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    expect(user).not.toBeNull();
    const alerts = await prisma.notification.count({
      where: { userId: user!.id, title: "Account recovery got weaker" },
    });
    expect(alerts).toBe(1);

    // The day collapses to one row (a series, not an event log), and today's
    // row now records the truth: fragile.
    const after = await readHistory(page);
    expect(after.snapshots.at(-1)!.level).toBe("thin");
    expect(after.snapshots.filter((s) => s.day === today)).toHaveLength(1);

    // ── 5. Across days the series IS the graph. Plant yesterday as covered so
    //      the 30-day view has a real decline to show. ──
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    await prisma.recoveryReadinessSnapshot.upsert({
      where: { userId_day: { userId: user!.id, day: yesterday } },
      create: {
        userId: user!.id,
        day: yesterday,
        level: "ready",
        availableCount: 3,
        codesLow: false,
      },
      update: { level: "ready", availableCount: 3 },
    });

    await page.goto("/en/security");
    const daily = page.getByTestId("recovery-readiness-card");
    await expect(daily.getByTestId("recovery-history-trend")).toHaveText("Weaker than before", {
      timeout: 20_000,
    });
    await expect(daily.getByTestId("recovery-sparkline")).toHaveAttribute("data-points", "2");
    // The planted decline did not stack a second alert.
    expect(
      await prisma.notification.count({
        where: { userId: user!.id, title: "Account recovery got weaker" },
      }),
    ).toBe(1);
  });

  test("never announces safety before the data has arrived", async ({ page }) => {
    // Same account as the first test, signed in again on this test's context.
    await signIn(page);

    // Hold the endpoints open so the panel has to render its loading state,
    // then release them. The verdict may not claim anything meanwhile.
    for (const endpoint of ["**/api/auth/totp/backup", "**/api/auth/backup-codes"]) {
      await page.route(endpoint, async (route) => {
        await new Promise((r) => setTimeout(r, 900));
        await route.continue();
      });
    }

    await page.goto("/en/security");
    const card = page.getByTestId("recovery-readiness-card");
    await expect(card).toBeVisible();
    // The verdict must stay cause-neutral while it is unknown (the locale copy
    // is "Checking…"), and must not offer a fix it cannot yet justify.
    await expect(card.getByTestId("recovery-level")).toHaveText(/^Checking/);
    await expect(card.getByTestId("recovery-summary")).toContainText(/actually work/i);
    await expect(card.getByTestId("recovery-next-action")).toHaveCount(0);
    await expect(card.getByTestId("recovery-path-recoveryCodes")).toHaveAttribute(
      "data-state",
      "unknown",
    );

    // Once the data lands, the verdict is the real one. The account is fragile
    // here — the previous test enrolled a spare and then deleted it, leaving
    // recovery codes and a verified inbox as the only ways back in.
    await expect(card.getByTestId("recovery-level")).toHaveText("Fragile", {
      timeout: 20_000,
    });
  });
});
