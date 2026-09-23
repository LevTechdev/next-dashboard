import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { signToken, type AuthUser } from "@/lib/auth";
import { createSession } from "@/lib/sessions";
import { newFamilyId, createRefreshToken } from "@/lib/refresh-tokens";
import { setAuthCookies } from "@/lib/auth-cookies";
import { logSecurityEvent } from "@/lib/security-events";
import { revokeAllTrustedDevices } from "@/lib/trusted-devices";
import { consumeAccountRecoveryToken, resetSecondFactorAndSessions } from "@/lib/account-recovery";
import { sendSecurityAlertEmail } from "@/lib/email";
import { issueSecurityAlertToken } from "@/lib/security-alert";

export const dynamic = "force-dynamic";

const LOCALES = new Set(["en", "id", "ja", "zh"]);

/** Where a failed recovery sends the user, with a reason the login page reads. */
function failUrl(req: Request, locale: string, reason: string): URL {
  return new URL(`/${locale}/login?recovery=${reason}`, req.url);
}

/**
 * Email the owner that a recovery just turned their second factor off, and hand
 * them a single-use revoke link. Never throws: the recovery has already
 * happened, so a mailer problem must not turn a completed recovery into an
 * error page.
 */
async function sendTwoFactorDisabledAlert(opts: {
  req: Request;
  userId: string;
  to: string;
  name: string | null;
  locale: string;
}): Promise<void> {
  try {
    const { token } = await issueSecurityAlertToken(opts.userId, "RECOVERY_2FA_DISABLED");
    const origin = opts.req.headers.get("origin") || `http://localhost:${process.env.PORT || 3010}`;
    // The CONFIRMATION PAGE, not the revoke endpoint. Pointing the mail at the
    // action itself meant any mailbox scanner that fetched the URL spent the
    // single-use token, so the real owner's click was rejected as "already
    // used" while their account stayed unsecured. The page only peeks; the
    // claim happens when the button is pressed (POST .../revoke).
    const revokeUrl = `${origin}/${opts.locale}/security-alert?token=${token}`;

    const { sent } = await sendSecurityAlertEmail({
      to: opts.to,
      revokeUrl,
      name: opts.name ?? undefined,
      locale: opts.locale,
      happenedAt: new Date().toISOString(),
    });
    if (!sent) {
      // No mailer configured — log the link so development can still exercise
      // the one-click revoke end to end.
      console.log(`[security-alert] 2FA disabled by recovery for ${opts.to}: ${revokeUrl}`);
    }

    await logSecurityEvent({
      userId: opts.userId,
      type: "SECURITY_ALERT_SENT",
      req: opts.req,
      metadata: { kind: "RECOVERY_2FA_DISABLED", sent },
    });
  } catch (err) {
    console.error("[security-alert] failed to send 2FA-disabled alert:", err);
  }
}

/**
 * GET /api/auth/account-recovery/confirm?token=…&locale=…
 *
 * Completes the last-resort recovery: verifies the emailed token, then
 *
 *   - disables TOTP and wipes the remaining backup codes (the whole point),
 *   - revokes every session, refresh-token family, and trusted device — the
 *     account is being recovered, so nothing that was already signed in, and no
 *     "skip 2FA on this device" grant, may survive,
 *   - records ACCOUNT_RECOVERY_COMPLETED and TOTP_DISABLED in the audit chain,
 *   - signs the user in and drops them on the Security Center, where the
 *     disabled-2FA notice and the "set up 2FA" action live.
 *
 * The token is single-use and claimed atomically (see account-recovery.ts), so
 * a second click or a mail scanner following the link cannot disable the second
 * factor twice or mint a second session.
 */
export async function GET(req: Request) {
  const requestUrl = new URL(req.url);
  const token = requestUrl.searchParams.get("token") ?? "";
  const requestedLocale = requestUrl.searchParams.get("locale") ?? "en";
  const locale = LOCALES.has(requestedLocale) ? requestedLocale : "en";

  const consumed = await consumeAccountRecoveryToken(token);
  if (!consumed.ok) {
    const reason = consumed.error === "EXPIRED" ? "expired" : "invalid";
    return NextResponse.redirect(failUrl(req, locale, reason));
  }

  const user = await prisma.user.findUnique({ where: { id: consumed.userId } });
  if (!user || !user.isActive) {
    return NextResponse.redirect(failUrl(req, locale, "invalid"));
  }

  const hadTotp = user.totpEnabled;
  await resetSecondFactorAndSessions(user.id);
  await revokeAllTrustedDevices(user.id);

  await logSecurityEvent({
    userId: user.id,
    type: "ACCOUNT_RECOVERY_COMPLETED",
    req,
    tenantId: user.tenantId,
    metadata: { hadTotpEnabled: hadTotp },
  });
  if (hadTotp) {
    await logSecurityEvent({
      userId: user.id,
      type: "TOTP_DISABLED",
      req,
      tenantId: user.tenantId,
      metadata: { via: "account_recovery" },
    });

    // Alert the owner the moment 2FA is disabled, with a one-click way to undo
    // it. Turning two-factor off is the single change an attacker makes to KEEP
    // access, so if this recovery was not the owner's own doing, this mail is
    // their only chance to catch it — and the revoke link is the only action
    // that actually evicts the person who did it. Best-effort: a mail failure
    // must never block the recovery that is already complete.
    await sendTwoFactorDisabledAlert({
      req,
      userId: user.id,
      to: user.email,
      name: user.name,
      locale,
    });
  }

  // Sign in with the (single-use) token as the proof of identity — the user
  // just proved both the password AND control of the recovery inbox.
  const authUser: AuthUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    tenantId: user.tenantId,
  };
  const accessToken = signToken(authUser);
  const familyId = newFamilyId();
  const sessionId = await createSession({ userId: user.id, token: accessToken, req, familyId });
  const refreshToken = await createRefreshToken(user.id, familyId, sessionId);
  await logSecurityEvent({ userId: user.id, type: "LOGIN", req, tenantId: user.tenantId });

  const response = NextResponse.redirect(new URL(`/${locale}/security?recovered=1`, req.url));
  setAuthCookies(response, accessToken, refreshToken);
  return response;
}
