import { describe, it, expect } from "vitest";
import { VERIFY_EMAIL_REDIRECT_PAGES, sanitizeVerifyEmailRedirect } from "./email-verification";

describe("sanitizeVerifyEmailRedirect", () => {
  it("accepts the whitelisted pages", () => {
    expect(VERIFY_EMAIL_REDIRECT_PAGES).toEqual(["profile", "security"]);
    expect(sanitizeVerifyEmailRedirect("profile")).toBe("profile");
    expect(sanitizeVerifyEmailRedirect("security")).toBe("security");
  });

  it("falls back to the Security Center for unknown values", () => {
    expect(sanitizeVerifyEmailRedirect("admin")).toBe("security");
    expect(sanitizeVerifyEmailRedirect("https://evil.example")).toBe("security");
    expect(sanitizeVerifyEmailRedirect("profile/../../")).toBe("security");
    expect(sanitizeVerifyEmailRedirect("")).toBe("security");
    expect(sanitizeVerifyEmailRedirect("PROFILE")).toBe("security");
  });

  it("falls back to the Security Center for missing/null values", () => {
    expect(sanitizeVerifyEmailRedirect(null)).toBe("security");
    expect(sanitizeVerifyEmailRedirect(undefined)).toBe("security");
  });
});
