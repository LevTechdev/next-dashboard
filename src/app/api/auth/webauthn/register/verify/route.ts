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

  const body = await req.json().catch(() => ({}));
  const { credential, deviceName } = body as { credential?: unknown; deviceName?: string };
  // Fail loudly on a malformed body instead of handing `undefined` to
  // verifyRegistrationResponse, where the resulting TypeError was caught and
  // reported as a generic "Passkey verification failed".
  if (!credential) {
    return NextResponse.json({ error: "Missing credential" }, { status: 400 });
  }

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: credential as never,
      expectedChallenge,
      expectedOrigin: getExpectedOrigin(req),
      expectedRPID: getRpID(req),
      // Matches `userVerification: "preferred"` in the options step. Without
      // this, @simplewebauthn/server's default (`requireUserVerification:
      // true`) rejects any authenticator that reports UV=0 — the registration
      // fails on the server even though the browser ceremony succeeded.
      requireUserVerification: false,
    });
  } catch (err) {
    // Surface the real cause in the server log; the client keeps the friendly
    // message.
    console.error("[webauthn] attestation verification failed:", err);
    return NextResponse.json({ error: "Passkey verification failed" }, { status: 400 });
  }

  if (!verification.verified || !verification.registrationInfo) {
    return NextResponse.json({ error: "Passkey could not be verified" }, { status: 400 });
  }

  const { credential: cred } = verification.registrationInfo;

  // Re-registering the SAME authenticator (the keychain already holds a
  // credential for this RP) surfaces as a unique-constraint violation. Answer
  // with a 409 the card can explain instead of an opaque 500.
  const duplicate = await prisma.webAuthnCredential.findUnique({
    where: { credentialId: cred.id },
    select: { id: true },
  });
  if (duplicate) {
    return NextResponse.json(
      { error: "This passkey is already registered", code: "PASSKEY_DUPLICATE" },
      { status: 409 },
    );
  }

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

  await logSecurityEvent({
    userId: session.user.id,
    type: "PASSKEY_ADDED",
    req,
    tenantId: session.user.tenantId,
  });

  const res = NextResponse.json({ success: true });
  res.cookies.set(REG_CHALLENGE_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
