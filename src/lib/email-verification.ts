import "server-only";
import { prisma } from "@/lib/db";
import { createOtpPayload } from "@/lib/email-otp";
import { describeMailConfiguration, sendOtpEmail } from "@/lib/email";
import { enqueueEmail } from "@/lib/email-outbox";
import { logEmailDelivery } from "@/lib/email-delivery";

/** What an OTP issuance did — `sent` is "already delivered", `queued` is
 * "durably queued and will keep being retried until it is". */
export interface EmailOtpIssue {
  sent: boolean;
  queued: boolean;
  code: string;
}

/**
 * Issue a fresh email-verification OTP: generate a 6-digit code, persist only
 * its hash (with a 10-minute expiry and reset attempt counter), then hand the
 * code to the configured transport (SMTP → Resend → dev console).
 *
 * With a mailer configured the message goes through the durable outbox: the
 * SMTP handshake (~16s against Gmail in a cold process) used to run inside the
 * request and was killed mid-flight on a serverless host, so the code never
 * arrived while the user was told to check their inbox. Now the row is written
 * first and delivery happens off the response path, with the scheduler retrying
 * whatever failed. The outbox re-issues a fresh code at delivery time, so treat
 * the returned `code` as a dev-mode fallback only, never as "what was mailed".
 *
 * Returns the raw code so routes can surface it as a dev-mode fallback
 * (`NODE_ENV !== "production"`); production responses never include it.
 */
export async function issueEmailOtp(opts: {
  userId: string;
  email: string;
  locale?: string;
}): Promise<EmailOtpIssue> {
  const { code, hash, expiresAt } = createOtpPayload();

  const updated = await prisma.user.update({
    where: { id: opts.userId },
    data: { emailOtpHash: hash, emailOtpExpires: expiresAt, emailOtpAttempts: 0 },
    select: { tenantId: true },
  });

  // No transport at all: there is nothing to queue for and no retry that could
  // ever succeed. Keep the documented console fallback so the code is readable
  // in the dev log, and record the outcome so the audit trail still shows that
  // a code was issued and never left the process.
  if (describeMailConfiguration().transport === "none") {
    await sendOtpEmail({ to: opts.email, otp: code, locale: opts.locale }).catch(() => {});
    await logEmailDelivery({
      userId: opts.userId,
      status: "failed",
      template: "verify_email",
      to: opts.email,
      transport: "none",
      reason: "no mailer configured",
      tenantId: updated.tenantId,
    });
    return { sent: false, queued: false, code };
  }

  await enqueueEmail({
    to: opts.email,
    template: "verify_email",
    userId: opts.userId,
    // Attribution carried with the row: the drain runs with no session, so the
    // workspace has to travel with the message (never a defined null here).
    tenantId: updated.tenantId,
    locale: opts.locale ?? null,
    params: { locale: opts.locale },
  });

  return { sent: false, queued: true, code };
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
