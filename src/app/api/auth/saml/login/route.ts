import { NextResponse } from "next/server";
import { buildSaml, resolveConnectionByEmail, resolveConnectionByTenantSlug } from "@/lib/saml";

export const dynamic = "force-dynamic";

/**
 * GET /api/auth/saml/login?email=<addr> | ?tenant=<slug>
 * SP-initiated SSO: resolve the tenant's IdP, build an AuthnRequest, and
 * redirect the browser to the IdP. RelayState carries the connection id so the
 * ACS endpoint knows which IdP certificate to validate the response against.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const email = url.searchParams.get("email") || undefined;
  const tenant = url.searchParams.get("tenant") || undefined;

  const conn = email
    ? await resolveConnectionByEmail(email)
    : tenant
      ? await resolveConnectionByTenantSlug(tenant)
      : null;

  if (!conn) {
    return NextResponse.json({ error: "No SSO configured for this account" }, { status: 404 });
  }

  try {
    const saml = buildSaml(conn, req);
    const redirectUrl = await saml.getAuthorizeUrlAsync(conn.id, "", {});
    return NextResponse.redirect(redirectUrl);
  } catch (err) {
    console.error("SAML login init error:", err);
    return NextResponse.json({ error: "Failed to start SSO" }, { status: 500 });
  }
}
