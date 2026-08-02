import "server-only";
import { SAML } from "@node-saml/node-saml";
import { prisma } from "@/lib/db";

const SP_ISSUER_DEFAULT = process.env.SAML_SP_ISSUER || "next-dashboard";

/** The app's public origin, used to build absolute SAML SP URLs. */
export function getOrigin(req: Request): string {
  const origin = req.headers.get("origin");
  if (origin) return origin;
  const host = req.headers.get("host") || "localhost:3010";
  const proto = (req.headers.get("x-forwarded-proto") || "http").split(",")[0];
  return `${proto}://${host}`;
}

/** Assertion Consumer Service URL the IdP posts the SAMLResponse back to. */
export function acsUrl(req: Request): string {
  return `${getOrigin(req)}/api/auth/saml/acs`;
}

export interface SamlConnection {
  entryPoint: string;
  idpCert: string;
  spIssuer: string;
}

/**
 * Construct a node-saml SP instance for a tenant's IdP connection.
 * Security posture: require signed assertions, email nameID, small clock skew.
 */
export function buildSaml(conn: SamlConnection, req: Request): SAML {
  return new SAML({
    entryPoint: conn.entryPoint,
    issuer: conn.spIssuer || SP_ISSUER_DEFAULT,
    idpCert: conn.idpCert,
    callbackUrl: acsUrl(req),
    wantAssertionsSigned: true,
    wantAuthnResponseSigned: false, // assertion signature is the enforced requirement
    identifierFormat: "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress",
    acceptedClockSkewMs: 5000,
    audience: conn.spIssuer || SP_ISSUER_DEFAULT,
  });
}

/** Resolve an enabled SSO connection from an email's domain (IdP discovery). */
export async function resolveConnectionByEmail(email: string) {
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return null;
  return prisma.ssoConnection.findFirst({ where: { emailDomain: domain, enabled: true } });
}

/** Resolve an enabled SSO connection by tenant slug. */
export async function resolveConnectionByTenantSlug(slug: string) {
  const tenant = await prisma.tenant.findUnique({ where: { slug } });
  if (!tenant) return null;
  return prisma.ssoConnection.findFirst({ where: { tenantId: tenant.id, enabled: true } });
}

/** Extract a best-effort email + display name from a validated SAML profile. */
export function profileToIdentity(profile: {
  nameID?: string;
  email?: string;
  attributes?: Record<string, unknown>;
}): { email: string | null; name: string | null } {
  const attrs = profile.attributes || {};
  const attr = (keys: string[]): string | null => {
    for (const k of keys) {
      const v = attrs[k];
      if (typeof v === "string" && v) return v;
      if (Array.isArray(v) && typeof v[0] === "string") return v[0];
    }
    return null;
  };
  const email =
    profile.email ||
    attr([
      "email",
      "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress",
      "urn:oid:0.9.2342.19200300.100.1.3",
    ]) ||
    (profile.nameID && profile.nameID.includes("@") ? profile.nameID : null);
  const name =
    attr([
      "displayName",
      "name",
      "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name",
      "urn:oid:2.16.840.1.113730.3.1.241",
    ]) || (email ? email.split("@")[0] : null);
  return { email: email ? email.toLowerCase() : null, name };
}
