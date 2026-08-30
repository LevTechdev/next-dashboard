import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api-guard";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { RP_NAME, REG_CHALLENGE_COOKIE, getRpID, challengeCookieOptions } from "@/lib/webauthn";

export const dynamic = "force-dynamic";

/** POST: begin passkey registration — return creation options + stash the challenge. */
export async function POST(req: Request) {
  const { session, response } = await requireAuth(req);
  if (response) return response;

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const existing = await prisma.webAuthnCredential.findMany({ where: { userId: user.id } });

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: getRpID(req),
    userName: user.email,
    userDisplayName: user.name,
    userID: new TextEncoder().encode(user.id),
    attestationType: "none",
    excludeCredentials: existing.map((c) => ({
      id: c.credentialId,
      transports: c.transports ? (c.transports.split(",") as never) : undefined,
    })),
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
    },
  });

  const res = NextResponse.json(options);
  res.cookies.set(REG_CHALLENGE_COOKIE, options.challenge, challengeCookieOptions());
  return res;
}
