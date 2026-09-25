import { describe, expect, it, vi, afterEach } from "vitest";
import {
  LOGIN_THROTTLE_DEFAULT,
  loginThrottleLimit,
  requestThrottleLimitOverride,
} from "./rate-limit";

/**
 * The login budget is 10 attempts / 120s per IP in production. The E2E suite
 * raises it because every auth spec signs in from the same IP — at the
 * production budget the specs fight over one sliding window and fail at random.
 *
 * The safety property that makes the override acceptable is asserted here: it
 * is IGNORED in production, so a stray env var on a live deployment cannot
 * weaken the limiter.
 */
describe("loginThrottleLimit", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is the production budget by default", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("E2E_LOGIN_THROTTLE_LIMIT", "");
    expect(LOGIN_THROTTLE_DEFAULT).toBe(10);
    expect(loginThrottleLimit()).toBe(LOGIN_THROTTLE_DEFAULT);
  });

  it("honours a raised budget outside production (E2E)", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("E2E_LOGIN_THROTTLE_LIMIT", "500");
    expect(loginThrottleLimit()).toBe(500);
  });

  it("IGNORES the override in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("E2E_LOGIN_THROTTLE_LIMIT", "500");
    expect(loginThrottleLimit()).toBe(LOGIN_THROTTLE_DEFAULT);
  });

  it("falls back on garbage instead of disabling the limit", () => {
    vi.stubEnv("NODE_ENV", "test");
    for (const value of ["banana", "0", "-5", "Infinity"]) {
      vi.stubEnv("E2E_LOGIN_THROTTLE_LIMIT", value);
      expect(loginThrottleLimit()).toBe(LOGIN_THROTTLE_DEFAULT);
    }
  });
});

/**
 * requestThrottleLimitOverride — the per-request header the Security Center
 * burst specs use to pin their own window to the production budget, so their
 * "fill the window → expect 429 → read `used of limit`" contract holds even
 * when the suite-wide E2E budget is raised to 500.
 *
 * Same safety property as the env override, asserted here: production ignores
 * it, and a malformed value falls back to the caller's real limit rather than
 * switching throttling off.
 */
describe("requestThrottleLimitOverride", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  const withHeader = (value: string) =>
    new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "x-e2e-throttle-limit": value },
    });

  it("returns null when the header is absent", () => {
    vi.stubEnv("NODE_ENV", "test");
    expect(requestThrottleLimitOverride(new Request("http://localhost/api/auth/login"))).toBeNull();
  });

  it("honours a positive integer outside production", () => {
    vi.stubEnv("NODE_ENV", "test");
    expect(requestThrottleLimitOverride(withHeader("10"))).toBe(10);
  });

  it("IGNORES the header in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(requestThrottleLimitOverride(withHeader("10"))).toBeNull();
  });

  it("falls back on garbage instead of disabling the limit", () => {
    vi.stubEnv("NODE_ENV", "test");
    for (const value of ["banana", "0", "-5", ""]) {
      expect(requestThrottleLimitOverride(withHeader(value))).toBeNull();
    }
  });
});
