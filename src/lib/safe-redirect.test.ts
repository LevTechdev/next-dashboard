import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "./safe-redirect";

const FALLBACK = "/en/dashboard";

describe("safeRedirectPath()", () => {
  it("keeps a same-origin relative path, query and hash", () => {
    expect(safeRedirectPath("/en/settings/team?tab=permissions#members", FALLBACK)).toBe(
      "/en/settings/team?tab=permissions#members",
    );
  });

  it("uses the fallback for missing or empty input", () => {
    expect(safeRedirectPath(null, FALLBACK)).toBe(FALLBACK);
    expect(safeRedirectPath(undefined, FALLBACK)).toBe(FALLBACK);
    expect(safeRedirectPath("", FALLBACK)).toBe(FALLBACK);
  });

  it.each([
    ["an absolute URL", "https://evil.example/phish"],
    ["a protocol-relative URL", "//evil.example/phish"],
    ["a backslash-relative URL", "/\\evil.example/phish"],
    ["an encoded protocol-relative URL", "/%2F%2Fevil.example/phish"],
    ["a double-encoded protocol-relative URL", "/%252F%252Fevil.example/phish"],
    ["an encoded backslash", "/%5Cevil.example/phish"],
    ["a double-encoded backslash", "/%255Cevil.example/phish"],
    ["a non-root-relative path", "en/dashboard"],
    ["a javascript URL", "javascript:alert(1)"],
  ])("rejects %s", (_label, value) => {
    expect(safeRedirectPath(value, FALLBACK)).toBe(FALLBACK);
  });

  it("refuses an unsafe fallback as well", () => {
    expect(safeRedirectPath(null, "//evil.example")).toBe("/");
  });
});
