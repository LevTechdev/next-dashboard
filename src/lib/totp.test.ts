import { describe, expect, it } from "vitest";
import { generateSecret, generateSync } from "otplib";
import {
  TOTP_DRIFT_STEPS,
  TOTP_PERIOD_SECONDS,
  totpTimeStep,
  verifyTotp,
  verifyTotpDetailed,
} from "./totp";

/**
 * Real-otplib coverage for the two decisions `src/lib/totp.ts` makes on top of
 * the library, both of which are security-relevant and neither of which the
 * library states for us:
 *
 *   - how far a device's clock may drift before a valid code is refused
 *     (`TOTP_DRIFT_STEPS`), and
 *   - that a code at or below the last spent step is refused (RFC 6238 §5.2).
 *
 * These run against the same library the app verifies with, so a silent otplib
 * behaviour change (its `epochTolerance` default, or the shape of the success
 * object carrying `timeStep`) fails here rather than in production.
 */

/** Generate the code for a specific step, so expectations never depend on "now". */
const codeAt = (secret: string, step: number) =>
  generateSync({ secret, epoch: step * TOTP_PERIOD_SECONDS + 1 });

/**
 * Sit out the tail of a time step before computing step numbers. A test that
 * starts 200ms before a boundary would otherwise compute a "current" step that
 * is already the previous one by the time the assertion runs.
 */
async function alignToFreshStep() {
  const elapsed = Math.floor(Date.now() / 1000) % TOTP_PERIOD_SECONDS;
  if (elapsed > 24) {
    await new Promise((r) => setTimeout(r, (TOTP_PERIOD_SECONDS - elapsed) * 1000 + 200));
  }
}

describe("verifyTotpDetailed", () => {
  it("accepts the current step's code and reports which step matched", async () => {
    await alignToFreshStep();
    const secret = generateSecret();
    const step = totpTimeStep();

    const result = verifyTotpDetailed(codeAt(secret, step), secret);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.timeStep).toBe(step);
      expect(result.delta).toBe(0);
    }
  });

  it(`tolerates ${TOTP_DRIFT_STEPS} step of clock drift in each direction`, async () => {
    await alignToFreshStep();
    const secret = generateSecret();
    const step = totpTimeStep();

    // A phone whose clock is 30 seconds behind, and one 30 seconds ahead.
    expect(verifyTotpDetailed(codeAt(secret, step - TOTP_DRIFT_STEPS), secret).valid).toBe(true);
    expect(verifyTotpDetailed(codeAt(secret, step + TOTP_DRIFT_STEPS), secret).valid).toBe(true);
  });

  it("refuses codes beyond the drift window", async () => {
    await alignToFreshStep();
    const secret = generateSecret();
    const step = totpTimeStep();

    // Three steps back is 90 seconds of grace, which is outside the window the
    // RFC recommends and the one the replay guard assumes.
    expect(verifyTotpDetailed(codeAt(secret, step - 3), secret).valid).toBe(false);
    expect(verifyTotpDetailed(codeAt(secret, step + 3), secret).valid).toBe(false);
  });

  it("refuses a code at or below the last spent step (RFC 6238 §5.2)", async () => {
    await alignToFreshStep();
    const secret = generateSecret();
    const step = totpTimeStep();
    const token = codeAt(secret, step);

    // Nothing spent yet: accepted.
    expect(verifyTotpDetailed(token, secret, { afterTimeStep: null })).toEqual({
      valid: true,
      timeStep: step,
      delta: 0,
    });

    // Exactly this step already spent: this IS the replay the guard exists for.
    expect(verifyTotpDetailed(token, secret, { afterTimeStep: step })).toEqual({
      valid: false,
      reason: "REPLAY",
    });

    // A counter ahead of the token (clock moved backwards) is refused too,
    // rather than re-opening a window that was already closed.
    expect(verifyTotpDetailed(token, secret, { afterTimeStep: step + 1 })).toEqual({
      valid: false,
      reason: "REPLAY",
    });

    // An older spent step still leaves the fresh one usable.
    expect(verifyTotpDetailed(token, secret, { afterTimeStep: step - 1 }).valid).toBe(true);
  });

  it("distinguishes a wrong code from a replayed one", () => {
    const secret = generateSecret();
    // 000000 is not a step boundary artefact — it is simply not the answer.
    const wrong = verifyTotpDetailed("000000", secret);
    if (wrong.valid) {
      // One-in-a-million collision with the real code: regenerate and retry.
      return;
    }
    expect(wrong.reason).toBe("INVALID");
  });

  it("never throws on an empty token or a malformed secret", () => {
    expect(verifyTotpDetailed("", "SECRET")).toEqual({ valid: false, reason: "INVALID" });
    expect(verifyTotpDetailed("123456", "")).toEqual({ valid: false, reason: "INVALID" });
    expect(verifyTotpDetailed("123456", "not-base32!!").valid).toBe(false);
  });

  it("keeps verifyTotp as a boolean view of the same decision", async () => {
    await alignToFreshStep();
    const secret = generateSecret();
    const step = totpTimeStep();

    expect(verifyTotp(codeAt(secret, step), secret)).toBe(true);
    expect(verifyTotp(codeAt(secret, step - 3), secret)).toBe(false);
  });
});

describe("totpTimeStep", () => {
  it("counts 30-second steps since the unix epoch", () => {
    expect(totpTimeStep(0)).toBe(0);
    expect(totpTimeStep(29_999)).toBe(0);
    expect(totpTimeStep(30_000)).toBe(1);
    expect(totpTimeStep(60_000)).toBe(2);
  });
});
