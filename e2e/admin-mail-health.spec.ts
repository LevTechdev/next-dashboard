import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { loginAs, FETCH_GATED } from "./helpers";

/**
 * Admin mail-delivery health — the panel a platform admin opens when "users
 * say they get no email".
 *
 * Covers the two halves of the MailHealthCard contract:
 *
 *  1. The report renders REAL state through GET /api/admin/mail-health: the
 *     resolved transport + from-address line, the five durable-outbox queue
 *     depths, and the recent-failures list (rows with reasons, or the explicit
 *     "queue is clean" empty state).
 *
 *  2. The one-click resend drives POST /api/admin/mail-health and surfaces the
 *     outcome ("Resent to …" / "failed again") instead of failing silently.
 *
 * The FAILED outbox row is seeded with Prisma — the suite's sanctioned way to
 * plant exact DB state (cf. security-alert-revoke). It mirrors what the drain
 * itself leaves behind (src/lib/email-outbox.ts marks a permanent failure as
 * FAILED with the transport + truncated reason): no mailer is configured in
 * the e2e environment, so that is exactly the state a real enqueue would end
 * in, deterministically.
 */
const prisma = new PrismaClient();

const FAILED_ROW = {
  to: "mail-health-e2e@example.com",
  template: "welcome",
  status: "FAILED",
  attempts: 5,
  maxAttempts: 5,
  transport: "none",
  lastError: "no mailer configured (e2e fixture)",
};

test.describe("Admin mail health", () => {
  test.beforeEach(async () => {
    // Only OUR row: a shared dev DB can hold real failed rows from other
    // suites, and the panel shows the 8 most recent — the fixture must be the
    // newest so its recipient is guaranteed to surface.
    await prisma.emailOutbox.deleteMany({ where: { to: FAILED_ROW.to } });
    await prisma.emailOutbox.create({ data: FAILED_ROW });
  });

  test.afterEach(async () => {
    await prisma.emailOutbox.deleteMany({ where: { to: FAILED_ROW.to } });
    await prisma.$disconnect();
  });

  test("renders transport sanity, queue depths, and the failures section", async ({ page }) => {
    // Arm the API spy BEFORE the first navigation: the panel's initial hydrate
    // is itself the proof that it read its own guarded endpoint (not a mock,
    // not a 403 page).
    const healthGets: string[] = [];
    await page.route("**/api/admin/mail-health", (route) => {
      if (route.request().method() === "GET") healthGets.push(route.request().url());
      return route.fallback();
    });

    await loginAs(page);
    await page.goto("/en/admin");
    await page.waitForURL("**/en/admin**");

    // The transport line hydrates from the report — real values, never stuck
    // on placeholders, with an ok/bad data-state for the at-a-glance sanity.
    const transport = page.getByTestId("mail-transport-line");
    await expect(transport).toBeVisible(FETCH_GATED);
    await expect(transport).toHaveAttribute("data-state", /ok|bad/);
    await expect(transport).toContainText("Transport");
    const transportValue = (await transport.textContent()) ?? "";
    expect(transportValue, "resolved transport is named").toMatch(/[a-z]/);

    // The five durable-outbox queue depths (pending/sending/sent/failed/stuck).
    const depths = page.getByTestId("mail-outbox-depths");
    await expect(depths).toBeVisible();
    await expect(depths.locator("> div")).toHaveCount(5);
    await expect(depths).toContainText(/Pending|Sent|Failed/);
    // Hydrated numbers, not the "—" placeholder.
    await expect(depths.locator("> div").first()).not.toHaveText(/—/);

    // Recent failures: with the fixture in place the section must show the
    // row — recipient and error reason, not the clean-queue empty state.
    const failures = page.getByTestId("mail-recent-failures");
    await expect(failures).toBeVisible();
    await expect(failures).toContainText(FAILED_ROW.to, FETCH_GATED);
    await expect(failures).toContainText(/no mailer configured/i);
    await expect(failures).toContainText("welcome");

    // The resend control is armed when a failure exists.
    await expect(failures.getByRole("button", { name: "Resend last failed" })).toBeEnabled();

    // The spy proves the panel hydrated from its guarded API.
    expect(healthGets.length, "the panel read GET /api/admin/mail-health").toBeGreaterThan(0);
  });

  test("one-click resend POSTs and reports the outcome", async ({ page }) => {
    // Signup-free, but argon2 login + the panel's remote-DB round-trips can
    // stack up past the 60s local default; triple the budget instead of
    // shaving the waits.
    test.slow();

    await loginAs(page);
    await page.goto("/en/admin");
    await page.waitForURL("**/en/admin**");

    // The fixture row surfaces with its error reason.
    const failures = page.getByTestId("mail-recent-failures");
    await expect(failures).toBeVisible(FETCH_GATED);
    await expect(failures).toContainText(FAILED_ROW.to, FETCH_GATED);

    // Arm the POST spy — the one-click resend must hit the guarded endpoint.
    const posts: string[] = [];
    await page.route("**/api/admin/mail-health", (route) => {
      if (route.request().method() === "POST") posts.push(route.request().url());
      return route.fallback();
    });

    await failures.getByRole("button", { name: "Resend last failed" }).click();

    await expect
      .poll(() => posts.length, { timeout: 30_000, message: "resend never POSTed" })
      .toBeGreaterThan(0);

    // The outcome is surfaced as a result line (sent / failed-again / none) —
    // with no mailer configured the resend is reported, never silent.
    await expect(
      failures.getByText(/Resent to|failed again|No failed email to resend/),
    ).toBeVisible(FETCH_GATED);
  });
});
