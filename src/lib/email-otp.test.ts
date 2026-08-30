import crypto from "crypto";
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  generateOtp,
  hashOtp,
  verifyOtp,
  isOtpExpired,
  createOtpPayload,
  OTP_LENGTH,
  OTP_TTL_MS,
  MAX_OTP_ATTEMPTS,
} from "./email-otp";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("generateOtp", () => {
  it("produces a code of the requested length with only digits", () => {
    const code = generateOtp();
    expect(code).toMatch(/^\d{6}$/);
    expect(code).toHaveLength(OTP_LENGTH);
  });

  it("supports a custom length", () => {
    expect(generateOtp(4)).toMatch(/^\d{4}$/);
  });

  it("does not repeat the same value across many draws (statistically)", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) seen.add(generateOtp());
    expect(seen.size).toBeGreaterThan(150);
  });

  it("is cryptographically random (crypto.randomInt is used)", () => {
    // node's randomInt is overloaded (incl. the callback form returning void),
    // so force the implementation's return type to never — assignable to any.
    const spy = vi.spyOn(crypto, "randomInt").mockImplementation(() => 7 as never);
    expect(generateOtp()).toBe("777777");
    spy.mockRestore();
  });
});

describe("hashOtp / verifyOtp", () => {
  it("hashes deterministically (same input → same digest)", () => {
    expect(hashOtp("123456")).toBe(hashOtp("123456"));
    expect(hashOtp("123456")).not.toBe("123456");
    expect(hashOtp("123456")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("verifies a correct code (trimmed, timing-safe)", () => {
    expect(verifyOtp("123456", hashOtp("123456"))).toBe(true);
    expect(verifyOtp(" 123456 ", hashOtp("123456"))).toBe(true);
  });

  it("rejects a wrong code or malformed input without throwing", () => {
    const hash = hashOtp("123456");
    expect(verifyOtp("654321", hash)).toBe(false);
    expect(verifyOtp("", hash)).toBe(false);
    expect(verifyOtp(null as unknown as string, hash)).toBe(false);
    expect(verifyOtp("123456", "not-a-hash")).toBe(false);
    expect(verifyOtp("123456", hashOtp("123456") + "extra")).toBe(false);
  });
});

describe("isOtpExpired", () => {
  it("treats a past expiry as expired", () => {
    expect(isOtpExpired(new Date(Date.now() - 1000))).toBe(true);
  });

  it("treats a future expiry as valid", () => {
    expect(isOtpExpired(new Date(Date.now() + 60_000))).toBe(false);
  });

  it("treats missing expiry as expired (defensive)", () => {
    expect(isOtpExpired(null)).toBe(true);
    expect(isOtpExpired(undefined)).toBe(true);
  });
});

describe("createOtpPayload", () => {
  it("returns a code, its hash, and an expiry ~10 minutes out", () => {
    const { code, hash, expiresAt } = createOtpPayload();
    expect(code).toMatch(/^\d{6}$/);
    expect(hash).toBe(hashOtp(code));
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    // Measure against now AFTER the call: the expiry is TTL ahead, minus the
    // few ms the call itself took (never more than a second in practice).
    const ttl = expiresAt.getTime() - Date.now();
    expect(ttl).toBeGreaterThanOrEqual(OTP_TTL_MS - 1000);
    expect(ttl).toBeLessThanOrEqual(OTP_TTL_MS);
  });

  it("respects a custom TTL", () => {
    const { expiresAt } = createOtpPayload(60_000);
    expect(expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(60_000);
  });
});

describe("constants", () => {
  it("exposes sane defaults for the flow", () => {
    expect(OTP_LENGTH).toBe(6);
    expect(MAX_OTP_ATTEMPTS).toBeGreaterThan(2);
  });
});
