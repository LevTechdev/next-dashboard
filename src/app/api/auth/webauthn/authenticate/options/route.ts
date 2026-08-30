import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { AUTH_CHALLENGE_COOKIE, getRpID, challengeCookieOptions } from "@/lib/webauthn";

export const dynamic = "force-dynamic";

/**
 * POST: begin passkey login. Given an email, return authentication options
 * scoped to that user's registered credentials + stash the challenge.
 */
export async function POST(req: Request) {
  const body = await req.json();
  const email = (body.email as string)?.trim().toLowerCase();
  if (!email) return NextResponse.json({ error: "Email is required" }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { email } });
  const creds = user
    ? await prisma.webAuthnCredential.findMany({ where: { userId: user.id } })
    : [];

  if (creds.length === 0) {
    // Don't reveal whether the email exists; just report no passkeys.
    return NextResponse.json({ error: "No passkeys registered for this account" }, { status: 404 });
  }

  const options = await generateAuthenticationOptions({
    rpID: getRpID(req),
    allowCredentials: creds.map((c) => ({
      id: c.credentialId,
      transports: c.transports ? (c.transports.split(",") as never) : undefined,
    })),
    userVerification: "preferred",
  });

  const res = NextResponse.json(options);
  res.cookies.set(AUTH_CHALLENGE_COOKIE, options.challenge, challengeCookieOptions());
  return res;
}
