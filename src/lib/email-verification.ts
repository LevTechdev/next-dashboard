import "server-only";
import { prisma } from "@/lib/db";
import { createOtpPayload } from "@/lib/email-otp";
import { sendOtpEmail } from "@/lib/email";

/**
 * Issue a fresh email-verification OTP: generate a 6-digit code, persist only
 * its hash (with a 10-minute expiry and reset attempt counter), then email the
 * code via the configured transport (SMTP → Resend → dev console).
 *
 * Returns the raw code so routes can surface it as a dev-mode fallback
 * (`NODE_ENV !== "production"`); production responses never include it.
 */
export async function issueEmailOtp(opts: {
  userId: string;
  email: string;
  locale?: string;
}): Promise<{ sent: boolean; code: string }> {
  const { code, hash, expiresAt } = createOtpPayload();

  await prisma.user.update({
    where: { id: opts.userId },
    data: { emailOtpHash: hash, emailOtpExpires: expiresAt, emailOtpAttempts: 0 },
  });

  const { sent } = await sendOtpEmail({
    to: opts.email,
    otp: code,
    locale: opts.locale,
  });

  return { sent, code };
}

/** Whether the current environment may expose the dev-mode OTP/code fallback. */
export function isDevFallbackAllowed(): boolean {
  // If a real mailer is configured (SMTP or Resend), force the user to check their email
  // even in development mode, so they can verify real email delivery.
  const hasMailer = Boolean(process.env.SMTP_HOST || process.env.RESEND_API_KEY);
  return process.env.NODE_ENV !== "production" && !hasMailer;
}

/**
 * Pages the email-verification confirm route may redirect back to. The hint is
 * carried from the surface that requested the send (profile vs. Security
 * Center) through the confirm link, and is strictly whitelisted so a tampered
 * `from` value can never cause an open redirect.
 */
export const VERIFY_EMAIL_REDIRECT_PAGES = ["profile", "security"] as const;

export type VerifyEmailRedirectPage = (typeof VERIFY_EMAIL_REDIRECT_PAGES)[number];

/**
 * Coerce an untrusted `from` value into a known redirect target, falling back
 * to the Security Center (the historical default) for anything else.
 */
export function sanitizeVerifyEmailRedirect(
  from: string | null | undefined,
): VerifyEmailRedirectPage {
  return from && (VERIFY_EMAIL_REDIRECT_PAGES as readonly string[]).includes(from)
    ? (from as VerifyEmailRedirectPage)
    : "security";
}
