import { describe, it, expect } from "vitest";
import {
  RP_NAME,
  REG_CHALLENGE_COOKIE,
  AUTH_CHALLENGE_COOKIE,
  CHALLENGE_TTL,
  getRpID,
  getExpectedOrigin,
  readChallengeCookie,
  challengeCookieOptions,
} from "./webauthn";

/**
 * webauthn.ts — relying-party plumbing for WebAuthn passkeys. These tests
 * pin rpID extraction (must be a registrable suffix of the origin host),
 * expected-origin resolution (proxy-aware), and challenge-cookie round-trip
 * (the registration/login ceremonies depend on it).
 */

const req = (headers: Record<string, string>): Request =>
  new Request("https://example.test/whatever", { headers });

describe("constants", () => {
  it("exposes the expected relying-party identity", () => {
    expect(RP_NAME).toBe("Dashboard");
    expect(REG_CHALLENGE_COOKIE).toBe("wa_reg_chal");
    expect(AUTH_CHALLENGE_COOKIE).toBe("wa_auth_chal");
    expect(CHALLENGE_TTL).toBe(300);
  });
});

describe("getRpID", () => {
  it("strips the port from a host header", () => {
    expect(getRpID(req({ host: "app.example.com:3000" }))).toBe("app.example.com");
  });

  it("passes a plain hostname through", () => {
    expect(getRpID(req({ host: "app.example.com" }))).toBe("app.example.com");
  });

  it("falls back to localhost when no host header is present", () => {
    expect(getRpID(new Request("https://example.test/"))).toBe("localhost");
  });
});

describe("getExpectedOrigin", () => {
  it("prefers the explicit Origin header", () => {
    expect(getExpectedOrigin(req({ host: "x.test", origin: "https://app.example.com" }))).toBe(
      "https://app.example.com",
    );
  });

  it("reconstructs origin from host and forwarded proto when Origin is absent", () => {
    expect(getExpectedOrigin(req({ host: "app.example.com", "x-forwarded-proto": "https" }))).toBe(
      "https://app.example.com",
    );
  });

  it("takes the first hop of a comma-separated forwarded proto chain", () => {
    expect(
      getExpectedOrigin(req({ host: "app.example.com", "x-forwarded-proto": "https,http" })),
    ).toBe("https://app.example.com");
  });

  it("defaults to http for a bare host (local dev)", () => {
    expect(getExpectedOrigin(req({ host: "localhost:3010" }))).toBe("http://localhost:3010");
  });
});

describe("readChallengeCookie", () => {
  it("round-trips a URL-encoded challenge value", () => {
    const raw = "abc123+/==";
    const encoded = encodeURIComponent(raw);
    const header = `other=1; ${REG_CHALLENGE_COOKIE}=${encoded}; session=xyz`;
    expect(readChallengeCookie(req({ cookie: header }), REG_CHALLENGE_COOKIE)).toBe(raw);
  });

  it("returns undefined for a missing cookie and a missing name", () => {
    expect(readChallengeCookie(req({ cookie: "a=b" }), AUTH_CHALLENGE_COOKIE)).toBeUndefined();
    expect(readChallengeCookie(req({}), REG_CHALLENGE_COOKIE)).toBeUndefined();
  });

  it("does not match a longer cookie name that merely starts with the target", () => {
    const header = `${REG_CHALLENGE_COOKIE}x=1`;
    expect(readChallengeCookie(req({ cookie: header }), REG_CHALLENGE_COOKIE)).toBeUndefined();
  });
});

describe("challengeCookieOptions", () => {
  it("is httpOnly, strict, path-scoped, and TTL-bounded", () => {
    const opts = challengeCookieOptions();
    expect(opts.httpOnly).toBe(true);
    expect(opts.sameSite).toBe("strict");
    expect(opts.maxAge).toBe(CHALLENGE_TTL);
    expect(opts.path).toBe("/");
    expect(typeof opts.secure).toBe("boolean");
  });
});
