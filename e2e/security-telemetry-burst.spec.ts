import { test, expect } from "@playwright/test";
import { loginAs, SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD, registerFreshUser } from "./helpers";

/**
 * Security Center telemetry — pressure signals under load.
 *
 * Two complementary proofs:
 *
 * 1. Seeded telemetry (prisma/seed.ts plants 4 RATE_LIMITED rows with
 *    blocked:true/false + 1 ACCOUNT_LOCKED attributed to the admin) makes the
 *    telemetry card render with the amber pressure badge and a non-zero
 *    throttle count — no login traffic needed.
 *
 * 2. A live burst: register a disposable user, then fire repeated failed
 *    logins against their email. The per-IP sliding-window limiter
 *    (limit 10 / 120s) starts returning 429s and each rejection is attributed
 *    to the TARGETED account, so that user's own Security Center shows the
 *    pressure badge.
 *
 * The burst spoofs a unique x-forwarded-for IP (the limiter's bucket key) so
 * it never consumes the shared window that ordinary test logins use — the
 * spec cannot wedge other specs' loginAs calls, and a fresh IP logs in
 * immediately afterwards without waiting out the 120s window.
 *
 * NOTE: these tests share the dev DB; both probes tolerate prior state.
 */

const BURST = 14; // > the 10-attempt window limit
const BURST_IP = `198.51.100.${(Date.now() % 200) + 20}`; // TEST-NET-2, unique per run

test.describe("Security telemetry", () => {
  test("seeded pressure rows light the badge with throttles", async ({ page }) => {
    await loginAs(page, SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD);
    await page.goto("/en/security");

    await expect(page.getByTestId("security-telemetry")).toBeVisible();

    // The badge only renders when there is signal (RATE_LIMITED in 24h or a
    // lockout within 7d) — the seed guarantees both.
    await expect(page.getByTestId("telemetry-pressure-badge")).toBeVisible();

    // Throttled attempts (24h window) — the seed plants 4.
    const throttlesText = await page.getByTestId("telemetry-rate-limited").textContent();
    expect(Number(throttlesText)).toBeGreaterThanOrEqual(1);
  });

  test("live login burst drives the pressure badge on the targeted account", async ({ page }) => {
    // Disposable account — the burst targets its email specifically.
    const targetEmail = await registerFreshUser(page);

    // Burst failed logins against the target from a dedicated spoofed IP.
    // Expect 401s (bad password) then 429s once that IP's window fills.
    const codes: number[] = [];
    for (let i = 0; i < BURST; i++) {
      const res = await page.request.post("/api/auth/login", {
        headers: { "x-forwarded-for": BURST_IP },
        data: { email: targetEmail, password: "wrong-password-1" },
      });
      codes.push(res.status());
    }
    expect(codes.filter((c) => c === 429).length).toBeGreaterThan(0);
    expect(codes.filter((c) => c === 401).length).toBeGreaterThan(0);

    // No re-login needed: registerFreshUser left the context signed in as
    // the target (the burst triggers the 5-failure account lockout, so a
    // fresh login would 423 for 15 minutes). The throttled rows were
    // attributed to the target regardless of which IP they came from, so its
    // own Security Center shows the pressure.
    await page.goto("/en/security");
    await expect(page.getByTestId("security-telemetry")).toBeVisible();
    await expect(page.getByTestId("telemetry-pressure-badge")).toBeVisible();
    const throttles = Number(await page.getByTestId("telemetry-rate-limited").textContent());
    expect(throttles).toBeGreaterThanOrEqual(1);
  });

  test("live throttle window attributes the burst IP and counts down", async ({ page }) => {
    const targetEmail = await registerFreshUser(page);

    // Same dedicated IP as the burst above: by now that bucket is saturated,
    // so every attempt below is a freshly-recorded 429 (blocked: true).
    for (let i = 0; i < 4; i++) {
      await page.request.post("/api/auth/login", {
        headers: { "x-forwarded-for": BURST_IP },
        data: { email: targetEmail, password: "wrong-password-2" },
      });
    }

    await page.goto("/en/security");
    const gauge = page.getByTestId("telemetry-throttle-window");
    await expect(gauge).toBeVisible();

    // The live gauge replays the server's window: used / limit, the busiest
    // IP, and the blocked state (the limiter rejected the burst).
    await expect(page.getByTestId("telemetry-throttle-count")).toContainText("of 10");
    await expect(gauge).toContainText(BURST_IP);
    const state = page.getByTestId("telemetry-throttle-state");
    await expect(state).toContainText(/Blocked/);

    // ...and it is genuinely live: the seconds remaining tick down on their own.
    const seconds = async () => {
      const text = (await state.textContent()) ?? "";
      return Number(/(\d+)s/.exec(text)?.[1] ?? "-1");
    };
    const before = await seconds();
    expect(before).toBeGreaterThan(0);
    await page.waitForTimeout(2500);
    expect(await seconds()).toBeLessThan(before);
  });
});
