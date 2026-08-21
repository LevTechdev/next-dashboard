/**
 * Pure helpers for the SSO / Enterprise settings page
 * (src/components/sso/sso-settings.tsx). Kept free of React/next-intl so the
 * validation rules and SP metadata URL construction are unit-testable.
 */

export interface SsoFormInput {
  name: string;
  entryPoint: string;
  idpCert: string;
  spIssuer: string;
  emailDomain: string;
}

/** i18n key returned when validation fails (resolved via the `sso` namespace). */
export type SsoValidationKey =
  | "nameRequired"
  | "entryPointRequired"
  | "invalidUrl"
  | "invalidEmailDomain"
  | "certRequiredOnSetup";

/** True when the value parses as an absolute http(s) URL. */
export function isValidHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/** True when the value looks like a domain (e.g. acme.com, sub.acme.co.uk). */
export function isValidEmailDomain(value: string): boolean {
  return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i.test(value.trim());
}

/**
 * Validate the SAML connection form. Returns an i18n key on failure, null when
 * valid. The IdP certificate is only required on first setup — updates may
 * omit it (the API preserves the stored certificate).
 */
export function validateSsoForm(input: SsoFormInput, isEdit: boolean): SsoValidationKey | null {
  if (!input.name.trim()) return "nameRequired";
  if (!input.entryPoint.trim()) return "entryPointRequired";
  if (!isValidHttpUrl(input.entryPoint.trim())) return "invalidUrl";
  if (input.emailDomain.trim() && !isValidEmailDomain(input.emailDomain)) return "invalidEmailDomain";
  if (!isEdit && !input.idpCert.trim()) return "certRequiredOnSetup";
  return null;
}

/** Absolute metadata URL the IdP imports; empty when there is no tenant slug. */
export function buildMetadataUrl(origin: string, tenantSlug: string | null | undefined): string {
  return tenantSlug ? `${origin}/api/auth/saml/metadata?tenant=${encodeURIComponent(tenantSlug)}` : "";
}

/** Absolute Assertion Consumer Service URL the IdP posts SAMLResponses to. */
export function buildAcsUrl(origin: string): string {
  return `${origin}/api/auth/saml/acs`;
}

/** The SP entity id shown to the IdP (connection issuer, else the default). */
export function resolveEntityId(spIssuer: string | null | undefined): string {
  return spIssuer || "next-dashboard";
}

/** SP-initiated test-login URL; null when the connection has no tenant slug. */
export function buildTestLoginUrl(tenantSlug: string | null | undefined): string | null {
  return tenantSlug ? `/api/auth/saml/login?tenant=${encodeURIComponent(tenantSlug)}` : null;
}

/** Lowercased email domain, or null when blank. */
export function normalizeEmailDomain(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed.toLowerCase() : null;
}
