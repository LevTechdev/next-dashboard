/**
 * Double-submit CSRF token — unit tests.
 *
 * The middleware now enforces BOTH layers on unsafe-method /api requests:
 *  1. Double-submit: a CSRF cookie must be present and echoed in the
 *     X-CSRF-Token header (cookie + header values must match).
 *  2. Same-origin: requests carrying Origin/Referer must match the host.
 *
 * Headerless server-to-server callers (cron, curl) are still rejected unless
 * they present a valid token pair — the token endpoint is session-scoped, so
 * anonymous API consumers are unaffected (they use API keys on /api/v1).
 */

import { describe, it, expect } from "vitest";
import {
  isUnsafeMethod,
  assertCsrfDoubleSubmit,
  generateCsrfToken,
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
  CSRF_EXEMPT_PATHS,
} from "@/lib/csrf";

function req(
  method: string,
  url = "https://app.test/api/orders",
  headers: Record<string, string> = {},
): Request {
  return new Request(url, { method, headers });
}

describe("CSRF double-submit", () => {
  it("classifies unsafe methods", () => {
    expect(isUnsafeMethod("POST")).toBe(true);
    expect(isUnsafeMethod("PUT")).toBe(true);
    expect(isUnsafeMethod("PATCH")).toBe(true);
    expect(isUnsafeMethod("DELETE")).toBe(true);
    expect(isUnsafeMethod("GET")).toBe(false);
    expect(isUnsafeMethod("HEAD")).toBe(false);
  });

  it("passes safe methods without a token", () => {
    const res = assertCsrfDoubleSubmit(req("GET"));
    expect(res.ok).toBe(true);
  });

  it("rejects unsafe methods missing the cookie", () => {
    const res = assertCsrfDoubleSubmit(
      req("POST", "https://app.test/api/orders", { "x-csrf-token": "abc" }),
      { cookieToken: null },
    );
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("missing-cookie");
  });

  it("rejects unsafe methods missing the header", () => {
    const res = assertCsrfDoubleSubmit(req("POST"), { cookieToken: "abc" });
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("missing-header");
  });

  it("rejects mismatched cookie/header pairs", () => {
    const res = assertCsrfDoubleSubmit(
      req("POST", "https://app.test/api/orders", { [CSRF_HEADER_NAME]: "evil" }),
      { cookieToken: "abc" },
    );
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("mismatch");
  });

  it("accepts matching cookie/header pairs", () => {
    const res = assertCsrfDoubleSubmit(
      req("POST", "https://app.test/api/orders", { [CSRF_HEADER_NAME]: "tok-123" }),
      { cookieToken: "tok-123" },
    );
    expect(res.ok).toBe(true);
  });

  it("exempts the SAML ACS endpoint (cross-site IdP form POST)", () => {
    expect(CSRF_EXEMPT_PATHS).toContain("/api/auth/saml/acs");
  });

  it("generates high-entropy URL-safe tokens", () => {
    const a = generateCsrfToken();
    const b = generateCsrfToken();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]{32,}$/);
  });

  it("exports stable cookie/header names", () => {
    expect(CSRF_COOKIE_NAME).toBe("csrf_token");
    expect(CSRF_HEADER_NAME).toBe("x-csrf-token");
  });
});
