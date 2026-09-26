import { test, expect, type Locator } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { loginAs, registerFreshUser, FETCH_GATED } from "./helpers";

/**
 * Profile page security surface — the expanded half of SecuritySettings.
 *
 * d3703e2 composed TrustedDevicesCard + RecoveryReadinessCard into the profile
 * page's security section (they used to exist only in the Security Center), so
 * the profile now carries the full account-security surface: sessions, trusted
 * devices, passkeys, backup codes, recovery readiness, activity. These tests
 * pin the three cards whose data arrives through the shared useSecurityData()
 * hook — each must render REAL rows from its guarded API (no stuck skeletons,
 * no placeholder text) on /en/profile:
 *
 *   - SessionsCard: the login this spec just performed IS a session row, so
 *     "This device" must appear with a hydrated badge count.
 *   - TrustedDevicesCard: the card must resolve to one of its two real states
 *     (grant rows with expiry metadata, or the explicit empty state) — never
 *     neither.
 *   - RecoveryReadinessCard: the readiness verdict must have RESOLVED past
 *     "unknown" (data-level is unknown only while the fetches are in flight)
 *     and all four recovery paths must carry a concrete state.
 *
 * The second test is the end-to-end spot-check of the no-mailer OTP trace
 * (a2dc945): a real signup issues its email OTP through issueEmailOtp, which —
 * with the transport configured to "none" in the e2e environment — must leave
 * a TERMINAL FAILED EmailOutbox row (maxAttempts 1, never retried, codes never
 * stored) instead of pretending a message was sent. The row must surface both
 * in GET /api/admin/mail-health and in the admin panel's recent-failures list,
 * so the operator who opens the panel when "users say they get no email" sees
 * the truth: the message was never attempted.
 *
 * The suite shares one dev DB, so assertions tolerate prior state (the admin
 * may hold trusted devices or backup codes from earlier runs) but never
 * require it.
 */
const prisma = new PrismaClient();

/** The two states TrustedDevicesCard can legitimately render. */
async function expectTrustedDevicesInARealState(card: Locator) {
  // Either grant rows (with the bulk-revoke CTA that only renders alongside
  // them) or the explicit "no trusted devices" empty paragraph — one of the
  // two, hydrated, never a missing/placeholder render.
  await expect(card.getByText(/Revoke all devices|No trusted devices\./)).toBeVisible(FETCH_GATED);
}

test.describe("Profile security surface", () => {
  test.describe("seed admin — cards render real account data", () => {
    test.beforeEach(async ({ page }) => {
      await loginAs(page);
      await page.goto("/en/profile");
    });

    test("sessions card lists the live session with a hydrated count", async ({ page }) => {
      const sessionsCard = page
        .locator("div.dashboard-card")
        .filter({ has: page.getByRole("heading", { name: "Active Sessions" }) });
      await expect(sessionsCard).toBeVisible();

      // The badge in the card title renders only once the sessions fetch has
      // resolved with >= 1 row — the proof the card is past its empty
      // initial state. (Badge renders a div, the only div child of the h3.)
      const badge = sessionsCard.getByRole("heading", { name: "Active Sessions" }).locator("div");
      await expect(badge).toHaveText(/^\d+$/, FETCH_GATED);
      expect(Number(await badge.textContent())).toBeGreaterThan(0);

      // This very browser context holds the current session, so the row must
      // exist and carry the "This device" marker — a real row, not the
      // common.noData placeholder.
      await expect(sessionsCard.getByText("This device")).toBeVisible(FETCH_GATED);
      await expect(sessionsCard).not.toContainText(/no data/i);

      // Every session row renders its device profile ("Browser · Device") —
      // the hydrated form of the row, distinct from a skeleton.
      await expect(
        sessionsCard
          .getByText(/·/)
          .filter({ hasText: /Unknown|Windows|Mac|Linux|Chrome|Firefox|Edge|WebKit/ })
          .first(),
      ).toBeVisible(FETCH_GATED);
    });

    test("trusted devices card resolves to a real state on the profile", async ({ page }) => {
      const trustedCard = page
        .locator("div.dashboard-card")
        .filter({ has: page.getByRole("heading", { name: "Trusted devices" }) });
      await expect(trustedCard).toBeVisible();

      await expectTrustedDevicesInARealState(trustedCard);
    });

    test("recovery readiness resolves past unknown with all four paths stated", async ({
      page,
    }) => {
      const card = page.getByTestId("recovery-readiness-card");
      await expect(card).toBeVisible();

      // data-level stays "unknown" only while the shared fetches are in
      // flight; a resolved verdict is one of the four concrete levels. The
      // seed admin has 2FA off, so "unprotected" is the expected verdict —
      // but the assertion accepts any resolved level so the test measures
      // the RESOLUTION, not the shared DB's 2FA state.
      await expect(card).toHaveAttribute("data-level", /^(unprotected|locked-out|thin|ready)$/, {
        timeout: 45_000,
      });
      // The summary line and the level chip render localized prose — real
      // text, never empty.
      await expect(card.getByTestId("recovery-summary")).not.toHaveText("");
      await expect(card.getByTestId("recovery-level")).not.toHaveText("");

      // All four recovery paths are stated with a concrete state each —
      // the ladder the panel scores (spare authenticator, codes, passkey,
      // verified email).
      for (const path of ["spareAuthenticator", "recoveryCodes", "passkey", "email"]) {
        await expect(card.getByTestId(`recovery-path-${path}`)).toHaveAttribute(
          "data-state",
          /^(available|missing|unknown)$/,
        );
      }

      // The verified-email path of the seed admin is concretely available
      // (the seed sets emailVerified) — a real fact reaching the panel.
      await expect(card.getByTestId("recovery-path-email")).toHaveAttribute(
        "data-state",
        "available",
      );

      // The 30-day readiness history block renders with its trend chip —
      // loading, empty, and sparkline states all carry the label.
      const history = card.getByTestId("recovery-history");
      await expect(history).toBeVisible();
      await expect(history).toContainText(/30/);
    });
  });

  test.describe("no-mailer OTP trace — signup leaves a terminal FAILED outbox row", () => {
    test("fresh signup surfaces in admin mail health as never-attempted", async ({ page }) => {
      test.slow();

      // 1. A real signup: the register flow issues the verification OTP
      //    through issueEmailOtp, which with transport "none" must record a
      //    terminal FAILED row via recordNoMailerDelivery. The helper leaves
      //    the fresh user's session in this context.
      const email = await registerFreshUser(page, { emailPrefix: "no-mailer-trace" });

      // 2. Switch to the seed admin (contexts carry cookies across tests, so
      //    clear before minting the admin session).
      await page.context().clearCookies();
      await loginAs(page);

      // 3. The guarded API reports the FAILED row with the no-mailer trace:
      //    terminal (maxAttempts 1 — never queued for retry), transport
      //    "none", and the reason an operator can act on.
      const health = await page.request.get("/api/admin/mail-health", { timeout: 45_000 });
      expect(health.ok(), "admin mail-health API answers for the seed admin").toBeTruthy();
      const report = (await health.json()) as {
        config: { transport: string };
        recentFailed: Array<{
          to: string;
          template: string;
          attempts: number;
          maxAttempts: number;
          transport: string;
          lastError: string;
        }>;
      };
      expect(report.config.transport, "e2e env runs with no mailer").toBe("none");

      const trace = report.recentFailed.find((r) => r.to === email);
      expect(trace, "the fresh signup's OTP row is in the recent failures").toBeTruthy();
      expect(trace!.template).toBe("verify_email");
      expect(trace!.transport).toBe("none");
      expect(trace!.attempts).toBe(1);
      expect(trace!.maxAttempts, "terminal row — the drain never retries it").toBe(1);
      expect(trace!.lastError).toMatch(/no mailer configured/i);
      // Codes are never stored — the row carries no OTP params (the API does
      // not even select them, which is the contract).

      // 4. The admin panel renders the same row for the human operator.
      await page.goto("/en/admin");
      const failures = page.getByTestId("mail-recent-failures");
      await expect(failures).toBeVisible(FETCH_GATED);
      await expect(failures).toContainText(email, FETCH_GATED);
      await expect(failures).toContainText(/no mailer configured/i);

      // The row is the work queue's truth: the one-click resend must be
      // armed for it (resend re-issues a fresh code at delivery time).
      await expect(failures.getByRole("button", { name: "Resend last failed" })).toBeEnabled();

      // 5. Cleanup: the trace row's job is done — remove it so repeated runs
      //    do not stack identical rows in the panel's 8-row window. The user
      //    account itself stays, matching the other signup specs.
      await prisma.emailOutbox.deleteMany({ where: { to: email } });
    });
  });
});
