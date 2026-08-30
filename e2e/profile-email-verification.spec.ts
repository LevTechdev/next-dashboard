import { test, expect } from "@playwright/test";
import { registerFreshUser } from "./helpers";

/**
 * Profile-page email verification E2E.
 * Seed the DB first: `npm run db:seed`.
 *
 * The profile page (src/app/[locale]/(dashboard)/profile/page.tsx) shows an
 * Email Verification card: unverified accounts get an amber alert + a
 * "Send Verification Email" button; in dev the API returns the confirm link
 * inline (rendered in a <code> element) and a 60s resend cooldown starts
 * (shared localStorage key with the Security Center card).
 *
 * The confirm route (src/app/api/auth/verify-email/confirm) validates the
 * one-hour token and redirects back to the page that requested the send — the
 * profile forwards from=profile, so it lands on /en/profile?verified=true
 * where a success toast is shown and the verified badge, "Verified on"
 * timestamp, and green "Email Verified" card render.
 *
 * The ?verified=true query-param handler is also covered directly: navigating
 * to the profile with the param shows the success toast, strips the param from
 * the URL, and re-fetches the profile so the status reflects server truth
 * (verified after a server-side OTP verification, still unverified otherwise).
 *
 * NOTE: fresh users are registered per test (serial) so the seed admin's
 * emailVerified state is never mutated.
 */
test.describe("Profile email verification", () => {
  test.describe.configure({ mode: "serial" });

  test("sends a verification link from the profile, confirms it, and shows the verified status", async ({
    page,
  }) => {
    await registerFreshUser(page);

    // ── Profile starts unverified ─────────────────────────────────────────
    await page.goto("/en/profile");
    await expect(page.getByRole("heading", { name: "My Profile" })).toBeVisible();
    await expect(page.getByText("Email Not Verified")).toBeVisible();
    await expect(page.getByText("Unverified").first()).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Send Verification Email" }),
    ).toBeEnabled();

    // ── Send → dev link inline + 60s cooldown ─────────────────────────────
    await page.getByRole("button", { name: "Send Verification Email" }).click();
    await expect(page.getByRole("button", { name: /Resend in \d+s/ })).toBeDisabled();
    await expect(
      page.getByText(/A verification email was sent\. You can request a new one in \d+s/),
    ).toBeVisible();

    const link = page.locator("code");
    await expect(link).toContainText("/api/auth/verify-email/confirm?token=");
    const verificationUrl = (await link.textContent())?.trim() ?? "";
    expect(verificationUrl).toContain("http");

    // ── Confirm link → redirected back to the profile with a success toast ─
    await page.goto(verificationUrl);
    // The profile page strips ?verified=true via history.replaceState right
    // after showing the toast, so only assert the profile path here; the toast
    // and verified UI below prove the success outcome.
    await expect(page).toHaveURL(/\/en\/profile/);
    await expect(page.getByText("Email verified successfully!")).toBeVisible();

    // ── The profile now shows the verified badge, timestamp, green card ───
    // exact: true — "Unverified" is a substring match of "Verified" otherwise.
    await expect(page.getByText("Verified", { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/Verified on/i).first()).toBeVisible();
    await expect(page.getByText("Email Verified", { exact: true })).toBeVisible();
    await expect(page.getByText("Email Not Verified")).not.toBeVisible();
  });

  test("rejects an invalid or expired verification token", async ({ page }) => {
    await registerFreshUser(page);

    await page.goto("/en/profile");
    await expect(page.getByText("Email Not Verified")).toBeVisible();

    // Bad token with from=profile → redirected back to the profile with the
    // ?verified=invalid query and an error toast.
    await page.goto(
      "/api/auth/verify-email/confirm?token=deadbeefdeadbeef&locale=en&from=profile",
    );
    // Same URL-stripping caveat as the success test: assert the profile path
    // and rely on the error toast below to prove the invalid outcome.
    await expect(page).toHaveURL(/\/en\/profile/);
    await expect(page.getByText(/invalid or has expired/i)).toBeVisible();

    // The profile still shows the unverified state (no green "Verified" badge;
    // "Unverified" is a substring match of "Verified", hence exact: true).
    await expect(page.getByText("Email Not Verified")).toBeVisible();
    await expect(page.getByText("Verified", { exact: true }).first()).not.toBeVisible();
  });

  test("shows the success toast and refreshes the verified status on direct ?verified=true navigation", async ({
    page,
  }) => {
    await registerFreshUser(page);

    // Verify the email server-side first (dev mode returns the 6-digit OTP in
    // the send response) so the profile re-fetch triggered by the ?verified=true
    // handler has a verified status to surface. page.request shares the
    // browser-context session cookie, so these are authenticated calls.
    await page.goto("/en/profile");
    await expect(page.getByText("Email Not Verified")).toBeVisible();

    const send = await page.request.post("/api/auth/verify-email/send", {
      data: { locale: "en", from: "profile" },
    });
    expect(send.ok()).toBeTruthy();
    const otp = ((await send.json()) as { devOtp?: string }).devOtp ?? "";
    expect(otp).toMatch(/^\d{6}$/);

    const verify = await page.request.post("/api/auth/verify-email/otp", {
      data: { code: otp },
    });
    expect(verify.ok()).toBeTruthy();

    // Direct navigation with ?verified=true → the handler shows the success
    // toast, strips the query param, and re-fetches the profile (now verified).
    await page.goto("/en/profile?verified=true");
    await expect(page.getByText("Email verified successfully!")).toBeVisible();
    // The handler strips the param via history.replaceState — assert the final
    // clean URL (toHaveURL retries until the strip settles).
    await expect(page).toHaveURL(/\/en\/profile$/);

    // Refreshed status reflects the server truth: verified badge, "Verified
    // on" timestamp, and the green "Email Verified" card. exact: true avoids
    // the "Unverified" substring match.
    await expect(page.getByText("Verified", { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/Verified on/i).first()).toBeVisible();
    await expect(page.getByText("Email Verified", { exact: true })).toBeVisible();
    await expect(page.getByText("Email Not Verified")).not.toBeVisible();
  });

  test("does not fake verification from the query param alone", async ({ page }) => {
    await registerFreshUser(page);

    // Unverified user lands directly on /en/profile?verified=true. The handler
    // still shows the success toast and strips the param, but the status comes
    // from the server re-fetch — the param alone must NOT turn the badge green.
    await page.goto("/en/profile?verified=true");
    await expect(page.getByText("Email verified successfully!")).toBeVisible();
    await expect(page).toHaveURL(/\/en\/profile$/);

    await expect(page.getByText("Email Not Verified")).toBeVisible();
    await expect(page.getByText("Verified", { exact: true }).first()).not.toBeVisible();
    await expect(page.getByText("Email Verified", { exact: true })).not.toBeVisible();
  });
});

