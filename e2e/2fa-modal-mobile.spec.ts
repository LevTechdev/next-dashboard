import { test, expect } from "@playwright/test";
import { generateSync } from "otplib";
import { fillRegistrationForm, logoutViaHeader, TEST_PASSWORD } from "./helpers";

/**
 * 2FA prompt at a 375px viewport (light mode).
 *
 * Pins the responsive/auth-palette contract of the login TOTP step:
 *   0. Signup completes through the CURRENT register UI: the email-OTP step
 *      (dev-mode code + explicit "Verify & Continue" click) lands on the
 *      dashboard.
 *   1. The 2FA prompt is NOT a modal anymore — after "Log in" with a
 *      2FA-enabled account the login card swaps inline to the segmented
 *      six-digit TOTP input. The prompt must stay fully inside the 375px
 *      viewport and inside the auth card.
 *   2. The active (first) digit cell carries the app's light-mode primary
 *      border + 1px ring (the lime HSL default; indigo is reserved for dark
 *      mode) — the visible "focus ring" of the segmented input.
 *
 * Needs a real 2FA-enabled account, so it registers a fresh user (completing
 * the email-OTP step via the explicit submit) and enables 2FA from the
 * Security Center first (same flow as two-factor-auth.spec.ts; the seed
 * admin's 2FA state is never touched).
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

test.describe("2FA prompt at a 375px viewport", () => {
  test.use({ viewport: { width: 375, height: 812 }, colorScheme: "light" });

  test("TOTP prompt fits the viewport with a primary ring on the active digit cell", async ({
    page,
  }) => {
    // ── Set up: fresh user + 2FA enabled ────────────────────────────────
    email = `m2fa-${Date.now()}@example.com`;

    // ── Contract 0: register completes via the current email-OTP step ───
    // The register page shows the dev-mode code and requires an explicit
    // submit ("Verify & Continue", t("verifyContinue")) — there is no
    // auto-submit on the 6th digit in the current UI.
    await page.goto("/en/register");
    await page.waitForLoadState("networkidle");
    await fillRegistrationForm(page, email, { name: "Mobile 2FA User" });

    await expect(page.getByRole("heading", { name: "Verify your email" })).toBeVisible();
    const code = (await page.getByTestId("dev-otp").textContent())?.trim() ?? "";
    expect(code).toMatch(/^\d{6}$/);
    await page.getByPlaceholder("000000").fill(code);
    await page.getByRole("button", { name: "Verify & Continue", exact: true }).click();
    // 20s budget: the verify API route cold-compiles on first hit in a fresh
    // run, so the submit response can take longer than the 10s default.
    await expect(page).toHaveURL(/\/en\/dashboard/, { timeout: 20_000 });

    await page.goto("/en/security");
    // Wait for client-side data + hydration before clicking (a click while
    // the page is still hydrating is silently dropped).
    await expect(page.getByText("Not enabled").first()).toBeVisible();
    await page.getByRole("button", { name: "Set up 2FA" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Setup authenticator app")).toBeVisible();
    // The <code> block shows the secret grouped in 4s and repeats it raw in an
    // sr-only span; read the sr-only copy so the grouping never leaks in.
    const secretText =
      (await dialog.locator("code span.sr-only").textContent()) ??
      // Fallback: drop the grouping from the visible copy and keep the raw
      // 32-char duplicate (the sr-only span repeats the same secret).
      ((await dialog.locator("code").textContent()) ?? "").replace(/\s/g, "").slice(-32);
    totpSecret = secretText.replace(/\s/g, "");
    expect(totpSecret.length).toBeGreaterThanOrEqual(16);

    await dialog.getByPlaceholder("000000").fill(await freshCode(totpSecret));
    await dialog.getByRole("button", { name: "Verify", exact: true }).click();
    // The copy appears twice: the success toast AND the card's new active
    // title — either one proves the enable landed.
    await expect(page.getByText("Two-factor authentication enabled").first()).toBeVisible();
    // Let the success toast auto-dismiss: at 375px it sits over the header's
    // user-menu trigger (sonner toasts are pointer-interactive) and would
    // swallow the logout click below.
    await expect(page.locator("[data-sonner-toast]")).toHaveCount(0, { timeout: 10_000 });

    // ── Log out, then sign back in → the card swaps to the TOTP prompt ──
    await logoutViaHeader(page);
    await page.locator('input[type="email"]').fill(email);
    await page.getByPlaceholder("Enter password").fill(TEST_PASSWORD);
    await page.getByRole("button", { name: "Log in", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Two-Factor Auth" })).toBeVisible();

    // ── Contract 1: the prompt is inside the auth card and the viewport ─
    // The TOTP step is the login card's left column, not a separate modal:
    // the segmented digit row must sit entirely inside the 375px viewport
    // with no horizontal overflow (and the card itself must not overflow).
    const authCard = page.locator("div.max-w-\\[1000px\\]");
    const cardBox = await authCard.boundingBox();
    expect(cardBox, "auth card should have layout").not.toBeNull();
    expect(cardBox!.x, "card left edge inside viewport").toBeGreaterThanOrEqual(0);
    expect(cardBox!.x + cardBox!.width, "card right edge inside viewport").toBeLessThanOrEqual(
      375 + 1,
    );

    // The segmented row is the flex wrapper around the 6 digit cells (the
    // invisible overlay input lives inside it too).
    const row = page.locator("div.relative.flex.justify-between.gap-2");
    const digitCells = row.locator("div.aspect-square");
    await expect(digitCells).toHaveCount(6);
    const rowBox = await row.boundingBox();
    expect(rowBox, "TOTP row should have layout").not.toBeNull();
    expect(rowBox!.x, "TOTP row left edge inside viewport").toBeGreaterThanOrEqual(0);
    expect(rowBox!.x + rowBox!.width, "TOTP row right edge inside viewport").toBeLessThanOrEqual(
      375 + 1,
    );

    // ── Contract 2: primary (lime in light mode) ring on the active cell ─
    // With an empty code the FIRST cell is the active one
    // (totpCode.length === 0), styled border-primary + ring-1 ring-primary —
    // the visible focus ring of the segmented input. Light mode's default
    // primary is lime HSL(73 100% 44%) → rgb(176, 224, 0); indigo is only
    // for dark mode. No transition is involved (the classes swap instantly),
    // so a plain computed-style read is deterministic.
    const firstCell = digitCells.first();
    const cs = await firstCell.evaluate((el) => {
      const style = getComputedStyle(el);
      return { borderColor: style.borderColor, boxShadow: style.boxShadow };
    });
    expect(cs.borderColor, "active cell border should be the light-mode primary (lime)").toBe(
      "rgb(176, 224, 0)",
    );
    expect(cs.boxShadow, "active cell ring should be the light-mode primary (lime)").toContain(
      "176, 224, 0",
    );
    // The remaining cells stay on the neutral zinc border — proving the ring
    // is the ACTIVE-cell treatment, not a blanket style.
    const secondCell = digitCells.nth(1);
    const cs2 = await secondCell.evaluate((el) => getComputedStyle(el).borderColor);
    expect(cs2, "inactive cell border stays neutral zinc").not.toBe("rgb(176, 224, 0)");
  });
});
