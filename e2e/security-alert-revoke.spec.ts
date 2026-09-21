import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { createHash, randomBytes } from "node:crypto";
import { registerFreshUser, TEST_PASSWORD } from "./helpers";

/**
 * The "this wasn't me" alert, end to end (E2E).
 *
 * When a recovery turns two-factor authentication off, the owner gets an email
 * whose link must be safe to *receive*: mail providers, corporate scanners and
 * chat previewers all fetch links in transit. So the mail points at a
 * confirmation page that only peeks at the token, and the single use is claimed
 * when the recipient presses the button.
 *
 * This spec proves that in a real browser:
 *   1. fetching the link (and fetching it repeatedly) does NOT spend it,
 *   2. pressing the button secures the account and lands on the reset form,
 *   3. the old password is refused, and a new one gets the owner back in.
 *
 * The token row is inserted directly because the mail is not sent in a hermetic
 * run (the runner blanks the mailer) — the email itself, including the exact
 * URL it carries, is asserted in the API tests instead.
 */

const prisma = new PrismaClient();

let email = "";
let token = "";
const NEW_PASSWORD = "Sp4re-Device!2026";

test.describe("Security-alert revoke", () => {
  test.describe.configure({ mode: "serial" });

  test.afterAll(async () => {
    if (token) {
      await prisma.securityAlertToken.deleteMany({
        where: { tokenHash: createHash("sha256").update(token).digest("hex") },
      });
    }
    await prisma.$disconnect();
  });

  test("registers the account the alert belongs to", async ({ page, context }) => {
    email = `alert-${Date.now()}@example.com`;
    await registerFreshUser(page, { email, name: "Alert Owner" });
    await context.clearCookies();
  });

  test("a scanner fetching the link cannot spend it; the owner's click can", async ({
    page,
    request,
    context,
  }) => {
    test.setTimeout(180_000);

    // Mint the link the way the recovery flow does (the mail is not sent in a
    // hermetic run, so the row is inserted directly). Only the hash is stored,
    // exactly as the app does it.
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new Error("expected the registered user to exist");
    token = randomBytes(32).toString("hex");
    await prisma.securityAlertToken.create({
      data: {
        userId: user.id,
        tokenHash: createHash("sha256").update(token).digest("hex"),
        kind: "RECOVERY_2FA_DISABLED",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    const link = `/en/security-alert?token=${token}`;
    await context.clearCookies();

    // ── 1. Prefetch simulation: fetch the link several times, as a scanner
    //      (and a link previewer) would, and confirm the page still works. ──
    for (let i = 0; i < 3; i++) {
      const res = await request.get(link);
      expect(res.status(), `prefetch ${i + 1}`).toBe(200);
    }

    // The link is still live after all that fetching.
    const peek = await request.get(`/api/auth/security-alert?token=${token}`);
    expect(await peek.json()).toMatchObject({ valid: true });

    // ── 2. The owner opens the same page: the confirmation state, not an
    //      action that already happened. ──
    await page.goto(link);
    const card = page.getByTestId("security-alert-card");
    await expect(card.getByText("Secure this account?")).toBeVisible();
    await expect(card).toContainText(/signs out every device using it/i);
    // Nothing has happened to the account yet.
    const before = await prisma.user.findUnique({ where: { email } });
    expect(before?.passwordResetRequired).toBe(false);

    // Reloading is still harmless — proof the GET never claimed anything.
    await page.reload();
    await expect(card.getByText("Secure this account?")).toBeVisible();

    // ── 3. Press it. ──
    await page.getByTestId("security-alert-confirm").click();
    await expect(page).toHaveURL(/\/en\/reset-password\?token=.*alert=reverted/, {
      timeout: 20_000,
    });
    await expect(page.getByTestId("alert-secured-notice")).toBeVisible();
    await expect(page.getByTestId("alert-secured-notice")).toContainText(
      "Your account was secured",
    );

    // The account is locked to a reset now.
    const after = await prisma.user.findUnique({ where: { email } });
    expect(after?.passwordResetRequired).toBe(true);
    const liveSessions = await prisma.session.count({
      where: { userId: after!.id, revokedAt: null },
    });
    expect(liveSessions).toBe(0);

    // ── 4. The old password is refused, and the new one gets the owner in. ──
    const refused = await request.post("/api/auth/login", {
      data: { email, password: TEST_PASSWORD },
    });
    expect(refused.status()).toBe(403);

    await page.getByLabel("New password").fill(NEW_PASSWORD);
    await page.getByLabel("Confirm password").fill(NEW_PASSWORD);
    await page.getByRole("button", { name: "Reset Password" }).click();
    await expect(page).toHaveURL(/\/en\/login/, { timeout: 20_000 });

    const accepted = await request.post("/api/auth/login", {
      data: { email, password: NEW_PASSWORD },
    });
    expect(accepted.status()).toBe(200);
  });

  test("the spent link explains itself instead of a dead button", async ({ request }) => {
    const peek = await request.get(`/api/auth/security-alert?token=${token}`);
    expect(await peek.json()).toMatchObject({ valid: false, state: "USED" });

    const retry = await request.post("/api/auth/security-alert/revoke", {
      data: { token, locale: "en" },
    });
    expect(retry.status()).toBe(400);
    expect(await retry.json()).toMatchObject({ error: "USED" });
  });
});
