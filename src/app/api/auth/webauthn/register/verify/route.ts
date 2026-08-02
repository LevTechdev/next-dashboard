import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api-guard";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import {
  REG_CHALLENGE_COOKIE,
  getRpID,
  getExpectedOrigin,
  readChallengeCookie,
} from "@/lib/webauthn";
import { logSecurityEvent } from "@/lib/security-events";

export const dynamic = "force-dynamic";

/** POST: finish passkey registration — verify the attestation and store the credential. */
export async function POST(req: Request) {
  const { session, response } = await requireAuth(req);
  if (response) return response;

  const expectedChallenge = readChallengeCookie(req, REG_CHALLENGE_COOKIE);
  if (!expectedChallenge) {
    return NextResponse.json({ error: "Challenge expired. Try again." }, { status: 400 });
  }

  const body = await req.json();
  const { credential, deviceName } = body as { credential: unknown; deviceName?: string };

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: credential as never,
      expectedChallenge,
      expectedOrigin: getExpectedOrigin(req),
      expectedRPID: getRpID(req),
    });
  } catch {
    return NextResponse.json({ error: "Passkey verification failed" }, { status: 400 });
  }

  if (!verification.verified || !verification.registrationInfo) {
    return NextResponse.json({ error: "Passkey could not be verified" }, { status: 400 });
  }

  const { credential: cred } = verification.registrationInfo;

  await prisma.webAuthnCredential.create({
    data: {
      userId: session.user.id,
      credentialId: cred.id,
      publicKey: Buffer.from(cred.publicKey),
      counter: cred.counter,
      transports: cred.transports ? cred.transports.join(",") : null,
      deviceName: deviceName?.slice(0, 60) || "Passkey",
    },
  });

  await logSecurityEvent({ userId: session.user.id, type: "PASSKEY_ADDED", req });

  const res = NextResponse.json({ success: true });
  res.cookies.set(REG_CHALLENGE_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
