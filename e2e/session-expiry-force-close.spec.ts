/**
 * Revoked refresh token → forced logout to the login form (E2E).
 *
 * Proves the terminal-session-loss contract end to end:
 *   1. A signed-in dashboard whose refresh-token family is revoked
 *      server-side (the "revoke all sessions" / theft-detection path) is
 *      force-closed onto the login form when the next API call 401s and the
 *      rotation comes back terminal (code SESSION_EXPIRED via
 *      src/lib/refresh-tokens.ts → /api/auth/refresh → src/lib/client-refresh.ts).
 *   2. The login form shows the persistent session-expired notice
 *      (?reason=expired → role="alert" banner, data-testid="session-expired-notice")
 *      — not just the fast-vanishing toast.
 *   3. The tab NEVER adopts another account in place: even with a second
 *      account's fresh cookies injected after revocation, the dead tab does
 *      not render the other user's workspace — it re-closes onto the login
 *      form (the identity-drift guard in src/hooks/use-auth.tsx treats a
 *      /api/auth/me identity change as a hard reset to login, not adoption).
 *
 * Revocation is done with direct DB writes (Prisma) on the shared local
 * mirror — the same pattern as e2e/security-chain-tamper.spec.ts — and is
 * scoped to the session rows created by THIS spec's logins so parallel
 * workers on other specs are unaffected.
 */
import { createHash } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD, TEST_PASSWORD } from "./helpers";

const prisma = new PrismaClient();

/** Refresh-token families minted by this spec (cleanup is scoped to these). */
const familyIds: string[] = [];

async function revokeFamilyInDb(familyId: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { familyId },
    data: { revokedAt: new Date() },
  });
  // The Session row carries the ACCESS-token hash; revoking it makes every
  // API call 401 immediately (requireAuth → isTokenRevoked), no 15-minute
  // JWT expiry wait needed.
  await prisma.session.updateMany({
    where: { familyId },
    data: { revokedAt: new Date() },
  });
}

/** Read the current refresh-token family id from the browser's cookie jar. */
async function currentFamilyId(page: Page): Promise<string> {
  const raw = (await page.context().cookies()).find((c) => c.name === "refresh_token")?.value;
  expect(raw, "refresh_token cookie must exist after login").toBeTruthy();
  // Mirror src/lib/auth.ts hashToken: sha256 of the raw token.
  const hash = createHash("sha256").update(raw!).digest("hex");
  const row = await prisma.refreshToken.findUnique({
    where: { tokenHash: hash },
    select: { familyId: true },
  });
  expect(row, "refresh token row must exist for the browser's cookie").toBeTruthy();
  familyIds.push(row!.familyId);
  return row!.familyId;
}

/**
 * Which account does the dashboard render? The header user-menu trigger
 * carries the avatar-brand span, and its accessible name includes the user's
 * name — it identifies the rendered identity without any app changes.
 */
async function headerIdentity(page: Page): Promise<string> {
  const trigger = page
    .locator('header button[aria-haspopup="menu"]')
    .filter({ has: page.locator("span.avatar-brand") });
  await expect(trigger).toBeVisible({ timeout: 45_000 });
  return (await trigger.innerText()).trim();
}

/** Fill + submit the login form, waiting for hydration on a cold dev server. */
async function loginViaForm(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/en/login");
  await page.waitForLoadState("networkidle");
  // Scoped to the sign-in form: the login page can briefly hold two email
  // inputs while a view transition animates out (see signInEmailField).
  const emailInput = page.locator('form:visible:has(input[type="password"]) input[type="email"]');
  await expect(emailInput).toBeVisible({ timeout: 45_000 });
  const submit = page.getByRole("button", { name: /log in/i }).first();
  await expect
    .poll(
      async () => {
        await emailInput.fill(email);
        await page.locator('input[type="password"]').fill(password);
        return submit.isEnabled();
      },
      { timeout: 20_000, message: "login form never hydrated" },
    )
    .toBe(true);
  await submit.click();
  await expect(page).toHaveURL(/\/en\/dashboard/, { timeout: 45_000 });
}

test.describe("revoked refresh token force-close", () => {
  test.afterEach(async () => {
    // Surgical cleanup: only rows minted by THIS spec. Family revocation has
    // already happened; just drop the rows so re-runs stay deterministic.
    if (familyIds.length) {
      await prisma.refreshToken.deleteMany({ where: { familyId: { in: familyIds } } });
      await prisma.session.deleteMany({ where: { familyId: { in: familyIds } } });
      familyIds.length = 0;
    }
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test("revoking the family force-closes the dashboard onto the login form with the expired-session notice", async ({
    page,
  }) => {
    await loginViaForm(page, SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD);

    // Capture the family this login minted, then revoke it server-side.
    const familyId = await currentFamilyId(page);
    await revokeFamilyInDb(familyId);

    // Any dashboard API call now 401s → the fetch wrapper rotates → terminal
    // SESSION_EXPIRED → forceLoginRedirect("expired"). Trigger it with a real
    // dashboard navigation.
    await page.goto("/en/profile");
    await expect(page).toHaveURL(/\/en\/login\?reason=expired/, { timeout: 45_000 });

    // The persistent notice, not just the transient toast.
    const notice = page.getByTestId("session-expired-notice");
    await expect(notice).toBeVisible();
    await expect(notice).toContainText(/session expired/i);
    await expect(notice).toHaveAttribute("role", "alert");

    // The cookies were cleared by the refresh route (clearAuthCookies).
    const leftover = await page.context().cookies();
    expect(leftover.find((c) => c.name === "token")?.value ?? "").toBe("");
    expect(leftover.find((c) => c.name === "refresh_token")?.value ?? "").toBe("");

    // The form is actually usable again — signing in lands on the dashboard.
    // Reuse the polled helper instead of raw fill+click: the page just
    // force-redirected here, and filling before React attaches silently
    // drops the input (button stays disabled — the exact failure this
    // helper's hydration poll exists to absorb).
    await loginViaForm(page, SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD);
  });

  test("a dead tab never adopts another account that signs in afterwards", async ({
    page,
    request,
  }) => {
    await loginViaForm(page, SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD);
    const adminIdentity = await headerIdentity(page);
    expect(adminIdentity.length, "header must identify the signed-in user").toBeGreaterThan(0);

    // Revoke admin's family server-side.
    const familyId = await currentFamilyId(page);
    await revokeFamilyInDb(familyId);

    // Register a second account in the test's ISOLATED APIRequestContext
    // (the `request` fixture does not share cookies with the browser context)
    // so the fresh session lands in a jar we control — not yet in the dead
    // tab's jar.
    const res = await request.post("/api/auth/register", {
      data: {
        name: "Adopt Guard User",
        email: `adopt-guard-${Date.now()}@example.com`,
        password: TEST_PASSWORD,
      },
    });
    expect(res.ok(), "second-account registration should succeed").toBeTruthy();
    const secondCookies = (await request.storageState()).cookies;

    // Inject the second account's session INTO the dead tab, then poke it —
    // exactly the "cookie jar changed under the tab" scenario the drift
    // guard exists for. The next /api/auth/me returns the OTHER account.
    await page.context().addCookies(
      secondCookies.map((c) => ({
        name: c.name,
        value: c.value,
        domain: c.domain,
        path: c.path,
        httpOnly: c.httpOnly,
        secure: c.secure,
        sameSite: c.sameSite,
      })),
    );
    await page.evaluate(() => {
      window.dispatchEvent(new Event("focus"));
    });

    // Identity drift → hard reset to login with ?reason=session-changed.
    // (If a background poller hits the revoked family first, the tab still
    // force-closes — with ?reason=expired. Either way: login form, never the
    // other account's workspace.)
    await expect(page).toHaveURL(/\/en\/login\?reason=(session-changed|expired)/, {
      timeout: 45_000,
    });
    const notice = page.getByTestId("session-expired-notice");
    await expect(notice).toBeVisible();
    // The admin identity must be gone from the page.
    await expect(page.getByText(adminIdentity)).toHaveCount(0);
  });
});
