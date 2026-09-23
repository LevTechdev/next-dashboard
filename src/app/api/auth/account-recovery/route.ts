import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/auth";
import { logSecurityEvent } from "@/lib/security-events";
import { checkLoginRateLimit, loginThrottleLimit } from "@/lib/rate-limit";
import { getRequestMeta } from "@/lib/request-meta";
import { sendAccountRecoveryEmail } from "@/lib/email";
import { hashIp, issueAccountRecoveryToken, RECOVERY_TTL_MS } from "@/lib/account-recovery";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/account-recovery — request the last-resort recovery link.
 *
 * Body: { email, password, locale? }
 *
 * For a user who lost BOTH the authenticator and every backup recovery code.
 * The account PASSWORD is required here (not just the inbox): the emailed link
 * is a bearer credential that disables 2FA, so an attacker who has only
 * compromised the mailbox must not be able to start a recovery. The inbox is
 * the second check, not the only one.
 *
 * Non-enumerating: an unknown email, a wrong password, a deactivated account,
 * and an account without 2FA all get the same `{ success: true }`, so this
 * endpoint cannot be used to probe who exists or who uses 2FA.
 *
 * Rate-limited with the login throttle (per-IP, persisted in SecurityEvent) so
 * it is not a free password-guessing oracle.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const locale = typeof body.locale === "string" && body.locale ? body.locale : "en";

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    const rl = await checkLoginRateLimit(req, { email, limit: loginThrottleLimit() });
    if (!rl.allowed) {
      return NextResponse.json(
        {
          error: `Too many attempts. Try again in ${Math.ceil(rl.retryAfterSeconds / 60)} minute(s).`,
        },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } },
      );
    }

    const user = await prisma.user.findUnique({ where: { email } });

    // Everything below answers identically, so nothing here can be used to
    // discover whether the account exists, is active, or has 2FA enabled.
    if (user && user.isActive && (await verifyPassword(password, user.password))) {
      const { token } = await issueAccountRecoveryToken(user.id, hashIp(getRequestMeta(req).ip));

      const origin = req.headers.get("origin") || `http://localhost:${process.env.PORT || 3010}`;
      const recoveryUrl = `${origin}/api/auth/account-recovery/confirm?token=${token}&locale=${locale}`;

      await logSecurityEvent({
        userId: user.id,
        type: "ACCOUNT_RECOVERY_REQUESTED",
        req,
        tenantId: user.tenantId,
        metadata: { ttlMinutes: RECOVERY_TTL_MS / 60_000 },
      });

      const { sent } = await sendAccountRecoveryEmail({
        to: user.email,
        url: recoveryUrl,
        name: user.name,
        locale,
      });
      if (!sent) {
        // No mailer configured — log the link so it can be used in development.
        console.log(`[account-recovery] Recovery link for ${email}: ${recoveryUrl}`);
      }

      const hasMailer = Boolean(process.env.SMTP_HOST || process.env.RESEND_API_KEY);
      if (process.env.NODE_ENV !== "production" && !hasMailer) {
        // Dev/E2E contract, same as forgot-password: surface the link inline.
        return NextResponse.json({ success: true, recoveryUrl });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Account recovery request error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
