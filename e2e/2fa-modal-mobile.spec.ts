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
 *   2. The CodeSlots row renders six slots, the empty code leaves the FIRST
 *      slot active (data-active + visible caret), and the slot fill uses the
 *      app's light-mode primary (the lime HSL default; indigo is reserved
 *      for dark mode) — the visible accent of the code input.
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
    await expect(dialog.getByText("Set up two-factor authentication")).toBeVisible();
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

    // The CodeSlots row is the flex wrapper around the six animated slots
    // (the visually hidden numeric input lives inside it too).
    const row = page.locator(".code-slots__row");
    const digitCells = row.locator(".code-slots__slot");
    await expect(digitCells).toHaveCount(6);
    const rowBox = await row.boundingBox();
    expect(rowBox, "TOTP row should have layout").not.toBeNull();
    expect(rowBox!.x, "TOTP row left edge inside viewport").toBeGreaterThanOrEqual(0);
    expect(rowBox!.x + rowBox!.width, "TOTP row right edge inside viewport").toBeLessThanOrEqual(
      375 + 1,
    );

    // ── Contract 2: the empty code leaves the FIRST slot active ──
    // CodeSlots marks the caret slot with `data-active` and shows the gliding
    // caret over it; every other slot stays unmarked. That is the segmented
    // input's visible "focus" treatment now that the slots are filled shapes
    // rather than outlined boxes.
    const firstCell = digitCells.first();
    await expect(firstCell).toHaveAttribute("data-active", "");
    await expect(digitCells.nth(1)).not.toHaveAttribute("data-active", "");
    await expect(row.locator(".code-slots__caret[data-show]")).toHaveCount(1);

    // The slot fill is the accent (light mode's lime primary — HSL(73 100%
    // 44%) → rgb(176, 224, 0); indigo is reserved for dark mode), so entering
    // a digit paints that slot in the app's primary colour.
    const fillColor = await firstCell
      .locator(".code-slots__fill")
      .evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(fillColor, "slot fill should be the light-mode primary (lime)").toBe("rgb(176, 224, 0)");
  });
});
