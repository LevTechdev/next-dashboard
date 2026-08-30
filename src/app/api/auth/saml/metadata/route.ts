import { NextResponse } from "next/server";
import { buildSaml, resolveConnectionByTenantSlug } from "@/lib/saml";

export const dynamic = "force-dynamic";

/**
 * GET /api/auth/saml/metadata?tenant=<slug>
 * Returns SP metadata XML for the IdP administrator to configure the app as a
 * Service Provider (entity id + ACS URL).
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const tenant = url.searchParams.get("tenant");

  let spIssuer = process.env.SAML_SP_ISSUER || "next-dashboard";
  if (tenant) {
    const conn = await resolveConnectionByTenantSlug(tenant);
    if (conn) spIssuer = conn.spIssuer;
  }

  const saml = buildSaml(
    { entryPoint: "https://idp.your-domain.com/sso", idpCert: "placeholder", spIssuer },
    req,
  );
  const xml = saml.generateServiceProviderMetadata(null, null);
  return new NextResponse(xml, {
    headers: { "content-type": "application/xml; charset=utf-8" },
  });
}
