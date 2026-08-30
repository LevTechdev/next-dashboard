import crypto from "crypto";

/**
 * Pure, testable email-OTP helpers for the identity-verification flow.
 *
 * The OTP itself is only ever stored as a SHA-256 hash (like the password
 * reset token), so a DB leak can't be replayed as a valid code. Verification
 * uses a timing-safe comparison and a per-user attempt cap to slow brute
 * force, and the code expires after OTP_TTL_MS.
 */

export const OTP_LENGTH = 6;
export const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
export const MAX_OTP_ATTEMPTS = 5;

/** Generate a cryptographically-random `OTP_LENGTH`-digit code (no leading-zero bias). */
export function generateOtp(length: number = OTP_LENGTH): string {
  let out = "";
  while (out.length < length) {
    // randomInt(0,10) is uniform; retry loop not needed since 10 divides 2^32 evenly-ish,
    // but to stay strict we build from several random ints per 32-bit draw.
    out += crypto.randomInt(0, 10).toString();
  }
  return out;
}

/** Deterministic SHA-256 hex digest of a code — what we persist on the user. */
export function hashOtp(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}

/**
 * Timing-safe check of a user-supplied code against a stored hash.
 * Never throws; a malformed code simply fails to match.
 */
export function verifyOtp(code: string, storedHash: string): boolean {
  if (!code || typeof code !== "string") return false;
  const candidate = hashOtp(code.trim());
  const a = Buffer.from(candidate);
  const b = Buffer.from(storedHash);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Whether a stored expiry timestamp has already passed. */
export function isOtpExpired(expiresAt: Date | null | undefined): boolean {
  return !expiresAt || expiresAt.getTime() <= Date.now();
}

/**
 * Build the persisted OTP payload for the current moment. The raw `code` is
 * returned alongside the stored `hash` so callers can email it (and expose it
 * as a dev-mode fallback); only the hash should ever be persisted.
 */
export function createOtpPayload(ttlMs: number = OTP_TTL_MS): {
  code: string;
  hash: string;
  expiresAt: Date;
} {
  const code = generateOtp();
  return { code, hash: hashOtp(code), expiresAt: new Date(Date.now() + ttlMs) };
}
