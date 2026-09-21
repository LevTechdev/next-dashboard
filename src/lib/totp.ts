import "server-only";
import * as otplib from "otplib";

/**
 * TOTP wrapper that insulates the app from otplib API drift. The installed
 * otplib exposes an async/new surface (`verifySync`, `generate`, `generateSecret`)
 * while older code used a sync instance API. We access the new functional API
 * through a locally-typed view so verification is a stable synchronous boolean.
 *
 * The detailed variant below exists for RFC 6238 §5.2 replay protection: to
 * refuse a code that has already been spent, a verifier must know *which* time
 * step a token matched, not merely that it did.
 */
interface OtplibVerifyOk {
  valid: true;
  delta: number;
  epoch: number;
  timeStep: number;
}
interface OtplibVerifyBad {
  valid: false;
}
interface OtplibNew {
  verifySync?: (o: {
    token: string;
    secret: string;
    epochTolerance?: number;
  }) => OtplibVerifyOk | OtplibVerifyBad;
  generateSync?: (o: { secret: string }) => string;
  generateSecret?: () => string | Promise<string>;
}
const lib = otplib as unknown as OtplibNew;

/** TOTP period, in seconds. Authenticator apps default to 30. */
export const TOTP_PERIOD_SECONDS = 30;

/**
 * Clock-drift tolerance, in steps, either side of "now".
 *
 * Zero tolerance — only the current step — sounds strict, but it means a phone
 * whose clock has drifted by 30 seconds can never sign in, and the user has no
 * way to diagnose it. One step either way is what RFC 6238 §5.2 recommends and
 * what authenticator apps are built to expect.
 *
 * Widening the window is only safe *together* with the replay guard: on its own
 * it would leave a code usable for up to 90 seconds instead of 30.
 */
export const TOTP_DRIFT_STEPS = 1;

export type TotpFailureReason = "INVALID" | "REPLAY";

export type TotpVerifyResult =
  { valid: true; timeStep: number; delta: number } | { valid: false; reason: TotpFailureReason };

export interface TotpVerifyOptions {
  /**
   * Highest time step already spent on this secret. A token whose step is at or
   * below it is a replay and is refused (RFC 6238 §5.2). Null/undefined means
   * nothing has been spent on this secret yet.
   */
  afterTimeStep?: number | null;
  /** Drift tolerance in steps; defaults to TOTP_DRIFT_STEPS. */
  toleranceSteps?: number;
}

/**
 * Verify a TOTP token and report *which* step it matched, so the caller can
 * enforce single use. Distinguishes "wrong code" from "already used" because
 * the two deserve different messages: one means try again, the other means wait
 * for the next code.
 */
export function verifyTotpDetailed(
  token: string,
  secret: string,
  opts: TotpVerifyOptions = {},
): TotpVerifyResult {
  if (!token || !secret) return { valid: false, reason: "INVALID" };
  const clean = token.replace(/\s/g, "");
  const steps = opts.toleranceSteps ?? TOTP_DRIFT_STEPS;
  let result: OtplibVerifyOk | OtplibVerifyBad;
  try {
    if (typeof lib.verifySync !== "function") return { valid: false, reason: "INVALID" };
    result = lib.verifySync({
      token: clean,
      secret,
      ...(steps > 0 ? { epochTolerance: steps * TOTP_PERIOD_SECONDS } : {}),
    });
  } catch {
    return { valid: false, reason: "INVALID" };
  }
  if (!result.valid) return { valid: false, reason: "INVALID" };

  // Same comparison otplib performs for `afterTimeStep`, done here so the
  // caller gets a reason rather than an indistinguishable false.
  const spent = opts.afterTimeStep;
  if (typeof spent === "number" && result.timeStep <= spent) {
    return { valid: false, reason: "REPLAY" };
  }
  return { valid: true, timeStep: result.timeStep, delta: result.delta };
}

/** Verify a TOTP token against a base32 secret. Synchronous boolean. */
export function verifyTotp(token: string, secret: string): boolean {
  return verifyTotpDetailed(token, secret).valid;
}

/** The time step a moment falls in (RFC 6238: floor(unixSeconds / period)). */
export function totpTimeStep(epochMs: number = Date.now()): number {
  return Math.floor(epochMs / 1000 / TOTP_PERIOD_SECONDS);
}

/** Generate a new base32 TOTP secret. */
export async function generateTotpSecret(): Promise<string> {
  if (typeof lib.generateSecret === "function") {
    return await lib.generateSecret();
  }
  // Fallback: 20 random bytes → base32 (RFC 4648, no padding).
  const { randomBytes } = await import("crypto");
  const bytes = randomBytes(20);
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const b of bytes) bits += b.toString(2).padStart(8, "0");
  let out = "";
  for (let i = 0; i + 5 <= bits.length; i += 5) out += alphabet[parseInt(bits.slice(i, i + 5), 2)];
  return out;
}

/**
 * Build a standard otpauth:// key URI for authenticator apps / QR codes.
 * (Constructed by hand to avoid otplib's drifting toURI helper.)
 */
export function totpKeyUri(params: { email: string; secret: string; issuer?: string }): string {
  const issuer = params.issuer || "Dashboard";
  const label = encodeURIComponent(`${issuer}:${params.email}`);
  const q = new URLSearchParams({
    secret: params.secret,
    issuer,
    algorithm: "SHA1",
    digits: "6",
    period: String(TOTP_PERIOD_SECONDS),
  });
  return `otpauth://totp/${label}?${q.toString()}`;
}
