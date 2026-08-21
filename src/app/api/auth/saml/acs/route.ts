import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { buildSaml, profileToIdentity, getOrigin } from "@/lib/saml";
import { hashPassword, signToken, type AuthUser } from "@/lib/auth";
import { createSession } from "@/lib/sessions";
import { newFamilyId, createRefreshToken } from "@/lib/refresh-tokens";
import { setAuthCookies } from "@/lib/auth-cookies";
import { logSecurityEvent } from "@/lib/security-events";
import { randomBytes } from "crypto";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/saml/acs — Assertion Consumer Service.
 * The IdP posts a signed SAMLResponse here. We validate the signature against
 * the tenant's configured IdP certificate (selected via RelayState), extract
 * the identity, JIT-provision the user into that tenant, and issue a session.
 */
export async function POST(req: Request) {
  const form = await req.formData();
  const SAMLResponse = form.get("SAMLResponse")?.toString();
  const relayState = form.get("RelayState")?.toString();
  if (!SAMLResponse || !relayState) {
    return NextResponse.json({ error: "Invalid SAML response" }, { status: 400 });
  }

  // RelayState carries the connection id set at login. Validation binds to this
  // connection's IdP cert, so a mismatched RelayState simply fails signature checks.
  const conn = await prisma.ssoConnection.findUnique({ where: { id: relayState } });
  if (!conn || !conn.enabled) {
    return NextResponse.json({ error: "Unknown SSO connection" }, { status: 400 });
  }

  let profile;
  try {
    const saml = buildSaml(conn, req);
    const result = await saml.validatePostResponseAsync({ SAMLResponse });
    profile = result.profile;
  } catch (err) {
    console.error("SAML ACS validation error:", err);
    return NextResponse.json({ error: "SAML validation failed" }, { status: 401 });
  }
  if (!profile) return NextResponse.json({ error: "No SAML profile" }, { status: 401 });

  const { email, name } = profileToIdentity(profile);
  if (!email) {
    return NextResponse.json({ error: "SAML assertion missing email" }, { status: 400 });
  }

  // JIT provisioning within the connection's tenant.
  let user = await prisma.user.findUnique({ where: { email } });
  if (user && user.tenantId && user.tenantId !== conn.tenantId) {
    return NextResponse.json(
      { error: "Account belongs to a different workspace" },
      { status: 403 },
    );
  }
  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        name: name || email.split("@")[0],
        role: "STAFF",
        isActive: true,
        tenantId: conn.tenantId,
        password: await hashPassword(randomBytes(24).toString("hex")),
        passwordAlgo: "argon2id",
        emailVerified: new Date(),
      },
    });
  } else if (!user.isActive) {
    return NextResponse.json({ error: "Account is deactivated" }, { status: 403 });
  }

  const authUser: AuthUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    tenantId: user.tenantId,
  };
  const token = signToken(authUser);
  const familyId = newFamilyId();
  const sessionId = await createSession({ userId: user.id, token, req, familyId });
  const refreshToken = await createRefreshToken(user.id, familyId, sessionId);
  await logSecurityEvent({
    userId: user.id,
    type: "SAML_LOGIN",
    req,
    metadata: { connection: conn.name },
    tenantId: user.tenantId,
  });

  // 303 so the browser switches POST → GET on the dashboard.
  const res = NextResponse.redirect(`${getOrigin(req)}/en/dashboard`, 303);
  setAuthCookies(res, token, refreshToken);
  return res;
}
