import { test, expect } from "@playwright/test";
import { generateSync } from "otplib";
import { fillRegistrationForm, logoutViaHeader, TEST_PASSWORD } from "./helpers";

/**
 * 2FA modal on a 375px viewport (light mode).
 *
 * Pins the responsive/auth-palette contract of the login TOTP prompt:
 *   0. The register email-OTP step auto-submits on the 6th digit — the
 *      dashboard loads without any click on "Verify Email" (375px).
 *   1. The card stays inside the viewport.
 *   2. It measures 320px wide on mobile (max-w-xs; max-w-sm on sm+, max-w-md
 *      on md+) — smaller than the 384px mobile width it had before.
 *   3. The auto-focused OTP input shows the lime focus ring + border in light
 *      mode (the app's lime light-mode base color, with indigo reserved for
 *      dark mode).
 *
 * Needs a real 2FA-enabled account, so it registers a fresh user (completing
 * the email-OTP step via auto-submit) and enables 2FA from the Security
 * Center first (same flow as two-factor-auth.spec.ts; the seed admin's 2FA
 * state is never touched).
 */

// TEST_PASSWORD (shared from ./helpers) must not be in HIBP breach corpora,
// since the register API runs a breach check.
let email = "";
let totpSecret = "";

/** Generate a TOTP code with ~10s of validity left (see two-factor-auth.spec.ts). */
async function freshCode(secret: string) {
  const elapsed = Math.floor(Date.now() / 1000) % 30;
  if (elapsed > 20) {
    await new Promise((r) => setTimeout(r, (30 - elapsed) * 1000 + 1000));
  }
  return generateSync({ secret });
}

test.describe("2FA modal at a 375px viewport", () => {
  test.use({ viewport: { width: 375, height: 812 }, colorScheme: "light" });

  test("card stays in viewport at 320px with a lime focus ring on the OTP input", async ({
    page,
  }) => {
    // ── Set up: fresh user + 2FA enabled ────────────────────────────────
    email = `m2fa-${Date.now()}@example.com`;

    // ── Contract 0: register email-OTP auto-submits on the 6th digit ────
    // Complete the signup identity-verification step the way real users do:
    // filling the 6th digit fires verification immediately. The "Verify Email"
    // button must never be clicked — it stays enabled while the fill alone
    // drives the request and lands on the dashboard.
    await page.goto("/en/register");
    await page.waitForLoadState("networkidle");
    await fillRegistrationForm(page, email, { name: "Mobile 2FA User" });

    await expect(page.getByText("Verify your email")).toBeVisible();
    const code = (await page.getByTestId("dev-otp").textContent())?.trim() ?? "";
    expect(code).toMatch(/^\d{6}$/);
    const verifyButton = page.getByRole("button", { name: "Verify Email" });
    // Pin the "no click" contract: arm a counter on the Verify button, then
    // prove the fill alone navigated with zero clicks reaching it. (The
    // button stays disabled until the code has 6 digits — a click couldn't
    // have driven this flow before the fill — but the counter makes the
    // contract explicit rather than relying on that implementation detail.)
    await expect(verifyButton).toBeVisible();
    await verifyButton.evaluate((el) => {
      el.addEventListener("click", () => {
        const w = window as unknown as { __verifyEmailClicks?: number };
        w.__verifyEmailClicks = (w.__verifyEmailClicks ?? 0) + 1;
      });
    });
    await page.getByPlaceholder("6-digit code").fill(code);
    // 20s budget: the verify API route cold-compiles on first hit in a fresh
    // run, so the auto-submit response can take longer than the 10s default.
    await expect(page).toHaveURL(/\/en\/dashboard/, { timeout: 20_000 });
    expect(
      await page.evaluate(() => {
        const w = window as unknown as { __verifyEmailClicks?: number };
        return w.__verifyEmailClicks ?? 0;
      }),
      "dashboard must be reached by the fill alone — no click on Verify Email",
    ).toBe(0);

    await page.goto("/en/security");
    // Wait for client-side data + hydration before clicking (a click while
    // the page is still hydrating is silently dropped).
    await expect(page.getByText("Not enabled").first()).toBeVisible();
    await page.getByRole("button", { name: "Set up 2FA" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Set up two-factor authentication")).toBeVisible();
    const secretText = (await dialog.locator("code").textContent()) ?? "";
    totpSecret = secretText.replace(/\s/g, "");
    expect(totpSecret.length).toBeGreaterThanOrEqual(16);

    await dialog.getByPlaceholder("000000").fill(await freshCode(totpSecret));
    await dialog.getByRole("button", { name: "Enable 2FA" }).click();
    await expect(page.getByText("Two-factor authentication is active")).toBeVisible();

    // ── Log out, then sign back in → the TOTP prompt replaces the card ──
    await logoutViaHeader(page);
    await page.getByPlaceholder("admin@dashboard.com").fill(email);
    await page.getByPlaceholder("Enter your password").fill(TEST_PASSWORD);
    await page.getByRole("button", { name: "Sign In", exact: true }).click();
    await expect(page.getByText("Two-Factor Authentication")).toBeVisible();

    // ── Contract 1: the modal card is 320px and inside the viewport ─────
    // The TOTP view wrapper carries max-w-xs (320px at mobile; sm:max-w-sm,
    // md:max-w-md above), and it is the only max-w-xs element on the prompt.
    const card = page.locator("div.max-w-xs", {
      has: page.getByPlaceholder("000000"),
    });
    const box = await card.boundingBox();
    expect(box, "TOTP card should have layout").not.toBeNull();
    expect(Math.abs(box!.width - 320), "TOTP card should be 320px on mobile").toBeLessThanOrEqual(
      2,
    );
    expect(box!.x, "card left edge inside viewport").toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width, "card right edge inside viewport").toBeLessThanOrEqual(375 + 1);

    // ── Contract 2: lime focus ring + border in light mode ──────────────
    const input = page.getByPlaceholder("000000");
    // The input is autoFocus, but focus explicitly so the assertion is not
    // racing the modal's mount effect.
    await input.focus();
    // The Input's transition-colors animates the border from zinc to lime on
    // focus, so poll the computed style until the transition settles instead
    // of sampling mid-flight (the color would be a blend, not lime-500).
    // lime-500 = rgb(132, 204, 22); the Input base ring (indigo) is overridden
    // by the page's focus:ring-lime-500/30 via twMerge.
    let styles: { borderColor: string; boxShadow: string } | null = null;
    const deadline = Date.now() + 5_000;
    while (Date.now() < deadline) {
      const cs = await input.evaluate((el) => {
        const style = getComputedStyle(el);
        return { borderColor: style.borderColor, boxShadow: style.boxShadow };
      });
      if (cs.borderColor === "rgb(132, 204, 22)" && cs.boxShadow.includes("132, 204, 22")) {
        styles = cs;
        break;
      }
      await page.waitForTimeout(100);
    }
    expect(styles, "OTP input never reached the lime focus state").not.toBeNull();
    expect(styles!.borderColor, "focus border should be lime-500").toBe("rgb(132, 204, 22)");
    expect(styles!.boxShadow, "focus ring should be lime (rgba(132, 204, 22, …))").toContain(
      "132, 204, 22",
    );
  });
});
