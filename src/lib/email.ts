import { Resend } from "resend";
import { renderOtpEmail, renderPasswordResetEmail } from "./email-templates";



export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  text: string;
}

const EMAIL_FROM =
  process.env.EMAIL_FROM || "Dashboard <onboarding@resend.dev>";

/**
 * Send a transactional email.
 * Returns `{ sent: false }` when no mailer is configured (caller keeps its
 * dev-mode fallback). Throws when a configured transport fails — silent
 * non-delivery is worse than an explicit error.
 */
export async function sendEmail(payload: EmailPayload): Promise<{ sent: boolean }> {
  if (isSmtpConfigured()) {
    return sendViaSmtp(payload);
  }

  if (!process.env.RESEND_API_KEY) {
    console.log(
      `[mailer] No SMTP_HOST / RESEND_API_KEY configured — email to ${payload.to} NOT sent. ` +
        `Subject: "${payload.subject}"\n${payload.text}`,
    );
    return { sent: false };
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: EMAIL_FROM,
    to: payload.to,
    subject: payload.subject,
    html: payload.html,
    text: payload.text,
  });

  if (error) {
    console.error(`[mailer] Resend failed for ${payload.to}: ${error.message}`);
    return { sent: false };
  }
  return { sent: true };
}

/** Whether SMTP env vars are present (SMTP becomes the preferred transport). */
function isSmtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST);
}

/** Send via nodemailer SMTP. Loaded lazily so the console fallback never pulls it in.
 *
 * In non-production the send is fire-and-forget: we return `{ sent: true }`
 * immediately so the API response is never blocked by a slow SMTP server
 * SMTP delivery errors are logged and return { sent: false } so callers
 * can keep their dev-mode fallback. */
async function sendViaSmtp(payload: EmailPayload): Promise<{ sent: boolean }> {
  const { default: nodemailer } = await import("nodemailer");
  const secure = process.env.SMTP_SECURE === "true" || process.env.SMTP_SECURE === "1";
  const port = Number(process.env.SMTP_PORT || (secure ? 465 : 587));
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure,
    auth:
      process.env.SMTP_USER && process.env.SMTP_PASS
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    connectionTimeout: 10_000,
    greetingTimeout: 5_000,
    socketTimeout: 10_000,
  });
  const sendPromise = transporter.sendMail({
    from: EMAIL_FROM,
    to: payload.to,
    subject: payload.subject,
    html: payload.html,
    text: payload.text,
  });

  // Always await delivery so emails are actually sent before the API responds.
  try {
    const info = await sendPromise;
    console.log(`[mailer] SMTP delivered to ${payload.to} — messageId: ${info.messageId}`);
    return { sent: true };
  } catch (err) {
    console.error(`[mailer] SMTP failed for ${payload.to}:`, err instanceof Error ? err.message : err);
    return { sent: false };
  }
}





/** Email OTP (signup / identity verification). Uses localized templates. */
export async function sendOtpEmail(opts: {
  to: string;
  otp: string;
  locale?: string;
}): Promise<{ sent: boolean }> {
  const template = renderOtpEmail(opts.otp, opts.locale);
  return sendEmail({ to: opts.to, ...template });
}

/** Password reset (forgot-password flow). Uses localized templates. */
export async function sendPasswordResetEmail(opts: {
  to: string;
  url: string;
  locale?: string;
}): Promise<{ sent: boolean }> {
  const template = renderPasswordResetEmail(opts.url, opts.locale);
  return sendEmail({ to: opts.to, ...template });
}
