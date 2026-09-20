import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import {
  AUTH_CHALLENGE_COOKIE,
  getRpID,
  getExpectedOrigin,
  readChallengeCookie,
} from "@/lib/webauthn";
import { signToken, type AuthUser } from "@/lib/auth";
import { createSession } from "@/lib/sessions";
import { newFamilyId, createRefreshToken } from "@/lib/refresh-tokens";
import { setAuthCookies } from "@/lib/auth-cookies";
import { logSecurityEvent } from "@/lib/security-events";
import {
  issueSecondFactorMarker,
  markerCookieOptions,
  PASSKEY_2FA_COOKIE,
} from "@/lib/passkey-second-factor";

export const dynamic = "force-dynamic";

/**
 * POST: finish passkey login — verify the assertion and either issue a
 * session (passwordless first factor, the default) or, in `second_factor`
 * mode, hand back a short-lived marker the login route consumes as the second
 * factor (the password step already happened in the browser).
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const secondFactorMode = body.mode === "second_factor";
  const expectedChallenge = readChallengeCookie(req, AUTH_CHALLENGE_COOKIE);
  if (!expectedChallenge) {
    return NextResponse.json({ error: "Challenge expired. Try again." }, { status: 400 });
  }

  const credential = body.credential as { id?: string } | undefined;
  if (!credential?.id) {
    return NextResponse.json({ error: "Invalid credential" }, { status: 400 });
  }

  const stored = await prisma.webAuthnCredential.findUnique({
    where: { credentialId: credential.id },
  });
  if (!stored) return NextResponse.json({ error: "Unknown passkey" }, { status: 401 });

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response: credential as never,
      expectedChallenge,
      expectedOrigin: getExpectedOrigin(req),
      expectedRPID: getRpID(req),
      credential: {
        id: stored.credentialId,
        publicKey: new Uint8Array(stored.publicKey),
        counter: stored.counter,
        transports: stored.transports ? (stored.transports.split(",") as never) : undefined,
      },
    });
  } catch {
    return NextResponse.json({ error: "Passkey verification failed" }, { status: 401 });
  }

  if (!verification.verified) {
    return NextResponse.json({ error: "Passkey verification failed" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { id: stored.userId } });
  if (!user || !user.isActive) {
    return NextResponse.json({ error: "Account unavailable" }, { status: 403 });
  }

  // Advance the signature counter (clone/replay defense) + mark used.
  await prisma.webAuthnCredential.update({
    where: { id: stored.id },
    data: { counter: verification.authenticationInfo.newCounter, lastUsedAt: new Date() },
  });

  // ── Second-factor mode: no session here. ──
  // The login route still holds the verified-password context; hand back a
  // short-lived signed marker it can verify and consume server-side.
  if (secondFactorMode) {
    const marker = await issueSecondFactorMarker(user.id);
    const res = NextResponse.json({ secondFactorVerified: true });
    res.cookies.set(PASSKEY_2FA_COOKIE, marker, markerCookieOptions());
    res.cookies.set(AUTH_CHALLENGE_COOKIE, "", { path: "/", maxAge: 0 });
    return res;
  }

  // Issue a session exactly like password login (Phase 2 rotation).
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
  await logSecurityEvent({ userId: user.id, type: "PASSKEY_LOGIN", req, tenantId: user.tenantId });

  const { password: _pw, totpSecret: _ts, ...safeUser } = user;
  void _pw;
  void _ts;

  const res = NextResponse.json({ user: safeUser, message: "Login successful" });
  setAuthCookies(res, token, refreshToken);
  res.cookies.set(AUTH_CHALLENGE_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
