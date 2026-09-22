import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { AUTH_CHALLENGE_COOKIE, getRpID, challengeCookieOptions } from "@/lib/webauthn";

export const dynamic = "force-dynamic";

/**
 * POST: begin passkey login. With an email, return options scoped to that
 * account's registered credentials. Without one (or with `discoverable:
 * true`), omit `allowCredentials` so the browser offers **discoverable
 * credentials** — the authenticator picks the passkey, no email step. The
 * verify route already resolves the user from the asserted credential, so
 * the ceremony shape is otherwise identical.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const email = (body.email as string)?.trim().toLowerCase() || undefined;
  const discoverable = body.discoverable === true || !email;

  if (!discoverable) {
    return scopedOptions(email as string, req);
  }

  const options = await generateAuthenticationOptions({
    rpID: getRpID(req),
    userVerification: "preferred",
    // No allowCredentials ⇒ resident/discoverable credentials: the
    // authenticator shows every passkey it holds for this RP and the user
    // picks one. Chrome requires an allowCredentials-less ceremony to ask
    // for UV, so "preferred" is the strongest ask that still degrades.
  });

  const res = NextResponse.json(options);
  res.cookies.set(AUTH_CHALLENGE_COOKIE, options.challenge, challengeCookieOptions());
  return res;
}

/** Email-scoped options: only that user's registered credentials may answer. */
async function scopedOptions(email: string, req: Request) {
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
