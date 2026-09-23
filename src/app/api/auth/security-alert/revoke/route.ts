import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logSecurityEvent } from "@/lib/security-events";
import { clearAuthCookies } from "@/lib/auth-cookies";
import { consumeSecurityAlertToken, revokeAfterSecurityAlert } from "@/lib/security-alert";

export const dynamic = "force-dynamic";

const LOCALES = new Set(["en", "id", "ja", "zh"]);

/**
 * POST /api/auth/security-alert/revoke  —  body: { token, locale? }
 *
 * The "This wasn't me" action behind the alert email sent when a recovery turns
 * two-factor authentication off.
 *
 * It secures the account in one step: every session, refresh-token family and
 * trusted device is revoked, and sign-in stays closed until the password is
 * replaced — because the person who completed the recovery used the account
 * password, so evicting their session is pointless while they can just sign in
 * again.
 *
 * POST ONLY, deliberately. The email links to a confirmation page which peeks
 * at the token read-only; claiming the single use happens here, on a button
 * press. When this was a GET, a mailbox scanner that fetched the URL consumed
 * the link before the recipient could, and the real owner was told their link
 * was "already used" while the account stayed unsecured.
 *
 * A link that is expired, already used, or bogus returns 400 with the reason —
 * the page turns that into copy instead of a dead end.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const token = typeof body?.token === "string" ? body.token : "";
  const requestedLocale = typeof body?.locale === "string" ? body.locale : "en";
  const locale = LOCALES.has(requestedLocale) ? requestedLocale : "en";

  const consumed = await consumeSecurityAlertToken(token);
  if (!consumed.ok) {
    return NextResponse.json({ error: consumed.error, secured: false }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: consumed.userId } });
  if (!user) {
    return NextResponse.json({ error: "INVALID", secured: false }, { status: 400 });
  }

  const { sessionsRevoked, resetToken } = await revokeAfterSecurityAlert(user.id);

  await logSecurityEvent({
    userId: user.id,
    type: "SECURITY_ALERT_REVERTED",
    req,
    tenantId: user.tenantId,
    metadata: { kind: consumed.kind, sessionsRevoked },
  });

  const response = NextResponse.json({
    secured: true,
    sessionsRevoked,
    // The page navigates here: the reset form is the only way back in, and the
    // flag makes it say so (`alert=reverted`).
    resetUrl: `/${locale}/reset-password?token=${resetToken}&alert=reverted`,
  });
  // The click is proof of the clicker's intent, not a sign-in — but any session
  // cookie this browser still carries refers to a session that was just
  // revoked, so clear it rather than leave a dead credential behind.
  clearAuthCookies(response);
  return response;
}
