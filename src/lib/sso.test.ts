import { describe, it, expect } from "vitest";
import {
  buildAcsUrl,
  buildMetadataUrl,
  buildTestLoginUrl,
  isValidEmailDomain,
  isValidHttpUrl,
  normalizeEmailDomain,
  resolveEntityId,
  validateSsoForm,
  type SsoFormInput,
} from "./sso";

const valid: SsoFormInput = {
  name: "Okta",
  entryPoint: "https://acme.okta.com/app/next-dashboard/sso/saml",
  idpCert: "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A",
  spIssuer: "next-dashboard",
  emailDomain: "acme.com",
};

describe("isValidHttpUrl", () => {
  it("accepts absolute http/https URLs", () => {
    expect(isValidHttpUrl("https://idp.example.com/sso")).toBe(true);
    expect(isValidHttpUrl("http://idp.internal/sso")).toBe(true);
  });

  it("rejects non-http schemes, garbage, and empty strings", () => {
    expect(isValidHttpUrl("ftp://idp.example.com")).toBe(false);
    expect(isValidHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isValidHttpUrl("not a url")).toBe(false);
    expect(isValidHttpUrl("")).toBe(false);
  });
});

describe("isValidEmailDomain", () => {
  it("accepts real-looking domains", () => {
    expect(isValidEmailDomain("acme.com")).toBe(true);
    expect(isValidEmailDomain("sub.acme.co.uk")).toBe(true);
    expect(isValidEmailDomain("Acme.COM")).toBe(true);
  });

  it("rejects bare labels, whitespace, and double dots", () => {
    expect(isValidEmailDomain("acme")).toBe(false);
    expect(isValidEmailDomain("a b.com")).toBe(false);
    expect(isValidEmailDomain("acme..com")).toBe(false);
    expect(isValidEmailDomain("")).toBe(false);
  });

  it("loosely accepts single-character TLDs (matches the component regex)", () => {
    expect(isValidEmailDomain("acme.c")).toBe(true);
  });
});

describe("validateSsoForm", () => {
  it("requires a provider name", () => {
    expect(validateSsoForm({ ...valid, name: "  " }, false)).toBe("nameRequired");
  });

  it("requires and validates the entry point URL", () => {
    expect(validateSsoForm({ ...valid, entryPoint: "" }, false)).toBe("entryPointRequired");
    expect(validateSsoForm({ ...valid, entryPoint: "acme.okta.com" }, false)).toBe("invalidUrl");
  });

  it("validates the optional email domain", () => {
    expect(validateSsoForm({ ...valid, emailDomain: "not-a-domain" }, false)).toBe(
      "invalidEmailDomain",
    );
  });

  it("requires the IdP certificate on first setup", () => {
    expect(validateSsoForm({ ...valid, idpCert: "" }, false)).toBe("certRequiredOnSetup");
  });

  it("accepts a valid first-setup form", () => {
    expect(validateSsoForm(valid, false)).toBeNull();
  });

  it("does not require the certificate on edits (API preserves the stored one)", () => {
    expect(validateSsoForm({ ...valid, idpCert: "" }, true)).toBeNull();
  });
});

describe("SP metadata URL builders", () => {
  it("builds the tenant-scoped metadata URL", () => {
    expect(buildMetadataUrl("https://app.example.com", "acme")).toBe(
      "https://app.example.com/api/auth/saml/metadata?tenant=acme",
    );
  });

  it("URL-encodes the tenant slug and returns empty without one", () => {
    expect(buildMetadataUrl("https://app.example.com", "ac me")).toBe(
      "https://app.example.com/api/auth/saml/metadata?tenant=ac%20me",
    );
    expect(buildMetadataUrl("https://app.example.com", null)).toBe("");
    expect(buildMetadataUrl("https://app.example.com", undefined)).toBe("");
  });

  it("builds the ACS URL", () => {
    expect(buildAcsUrl("https://app.example.com")).toBe(
      "https://app.example.com/api/auth/saml/acs",
    );
  });

  it("falls back to the default entity id", () => {
    expect(resolveEntityId("my-issuer")).toBe("my-issuer");
    expect(resolveEntityId("")).toBe("next-dashboard");
    expect(resolveEntityId(undefined)).toBe("next-dashboard");
  });

  it("builds the test-login URL only when a tenant slug exists", () => {
    expect(buildTestLoginUrl("acme")).toBe("/api/auth/saml/login?tenant=acme");
    expect(buildTestLoginUrl(null)).toBeNull();
  });
});

describe("normalizeEmailDomain", () => {
  it("trims and lowercases, returning null when blank", () => {
    expect(normalizeEmailDomain("  Acme.COM ")).toBe("acme.com");
    expect(normalizeEmailDomain("   ")).toBeNull();
  });
});
