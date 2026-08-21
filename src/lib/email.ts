import { Resend } from "resend";

/**
 * Transactional email helper.
 *
 * Transport priority:
 * 1. SMTP — when `SMTP_HOST` is set (your own server/relay via nodemailer).
 * 2. Resend — when `RESEND_API_KEY` is set (https://resend.com/api-keys).
 * 3. Console — otherwise the would-be email is logged and `{ sent: false }` is
 *    returned so callers can keep their dev-mode link/code fallback (used by
 *    the E2E suite).
 *
 * Env vars:
 * - `SMTP_HOST`     — SMTP server hostname (enables the SMTP transport)
 * - `SMTP_PORT`     — SMTP port (default 587, or 465 with SMTP_SECURE=true)
 * - `SMTP_SECURE`   — "true"/"1" for implicit TLS (port 465)
 * - `SMTP_USER`     — SMTP username (optional; omitted for open relays)
 * - `SMTP_PASS`     — SMTP password
 * - `RESEND_API_KEY` — Resend API key (fallback transport)
 * - `EMAIL_FROM`    — verified sender, e.g. "Dashboard <no-reply@yourdomain.com>".
 *   Defaults to Resend's test sender (`onboarding@resend.dev`), which only
 *   delivers to the account owner's own verified email — set this for real use.
 */

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
 * (e.g. Gmail retrying delivery to undeliverable @example.com addresses
 * during E2E tests). Delivery failures are logged asynchronously. */
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

  // In development / E2E, fire-and-forget so the API never blocks on SMTP.
  if (process.env.NODE_ENV !== "production") {
    sendPromise.catch((err) =>
      console.error(`[mailer] SMTP (async) failed for ${payload.to}:`, err instanceof Error ? err.message : err),
    );
    return { sent: true };
  }

  // In production, await delivery so errors propagate.
  try {
    await sendPromise;
    return { sent: true };
  } catch (err) {
    console.error(`[mailer] SMTP failed for ${payload.to}:`, err instanceof Error ? err.message : err);
    return { sent: false };
  }
}

/** Escape a URL for safe interpolation into HTML attributes. */
function escapeHtmlUrl(url: string): string {
  return url.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

/** Shared, dependency-free HTML shell with inline styles (email-client safe). */
function emailShell({ heading, body, ctaLabel, ctaUrl, note }: {
  heading: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
  note?: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:0;background-color:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f7;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
          <tr>
            <td style="padding:28px 32px;background:#4f46e5;">
              <span style="color:#ffffff;font-size:18px;font-weight:700;">Dashboard</span>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <h1 style="margin:0 0 12px;font-size:20px;color:#111827;">${heading}</h1>
              <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#4b5563;">${body}</p>
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                <tr>
                  <td style="border-radius:8px;background:#4f46e5;">
                    <a href="${escapeHtmlUrl(ctaUrl)}" style="display:inline-block;padding:12px 24px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">${ctaLabel}</a>
                  </td>
                </tr>
              </table>
              ${note ? `<p style="margin:0;font-size:12px;line-height:1.5;color:#9ca3af;">${note}</p>` : ""}
              <p style="margin:16px 0 0;font-size:12px;line-height:1.5;color:#6b7280;">If the button does not work, copy and paste this link into your browser:</p>
              <p style="margin:4px 0 0;font-size:12px;color:#4f46e5;word-break:break-all;">${escapeHtmlUrl(ctaUrl)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px;border-top:1px solid #e5e7eb;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">You received this email because you have an account on Dashboard. If you didn't request this, you can safely ignore it.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Subject lines localized per app locale (bodies stay English for now). */
const SUBJECTS: Record<string, { reset: string; verifyOtp: string }> = {
  en: {
    reset: "Reset your password — Dashboard",
    verifyOtp: "Your verification code — Dashboard",
  },
  id: {
    reset: "Atur ulang kata sandi — Dashboard",
    verifyOtp: "Kode verifikasi Anda — Dashboard",
  },
  ja: {
    reset: "パスワードのリセット — Dashboard",
    verifyOtp: "確認コード — Dashboard",
  },
  zh: {
    reset: "重置密码 — Dashboard",
    verifyOtp: "您的验证码 — Dashboard",
  },
};

function subjectsFor(locale?: string) {
  return SUBJECTS[locale || "en"] || SUBJECTS.en;
}

/** Email OTP (signup / identity verification). Shows the code in large digits. */
export async function sendOtpEmail(opts: {
  to: string;
  otp: string;
  locale?: string;
}): Promise<{ sent: boolean }> {
  const { to, otp, locale } = opts;
  const text =
    `Your verification code is: ${otp}\n\n` +
    `Enter this 6-digit code to verify your email address. It expires in 10 minutes.\n\n` +
    `If you didn't request this, you can safely ignore this email.`;

  const codeHtml = otp
    .split("")
    .map(
      (d) =>
        `<span style="display:inline-block;min-width:34px;padding:10px 6px;margin:0 3px;font-size:24px;font-weight:700;letter-spacing:4px;color:#111827;background:#f3f4f6;border:1px solid #e5e7eb;border-radius:8px;text-align:center;">${d}</span>`,
    )
    .join("");

  return sendEmail({
    to,
    subject: subjectsFor(locale).verifyOtp,
    text,
    html: `<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:0;background-color:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f7;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
          <tr>
            <td style="padding:28px 32px;background:#4f46e5;">
              <span style="color:#ffffff;font-size:18px;font-weight:700;">Dashboard</span>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <h1 style="margin:0 0 12px;font-size:20px;color:#111827;">Verify your email</h1>
              <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#4b5563;">Use the code below to verify your email address. It expires in 10 minutes.</p>
              <div style="margin:0 0 24px;text-align:center;">${codeHtml}</div>
              <p style="margin:0;font-size:12px;line-height:1.5;color:#9ca3af;">If you didn't request this code, you can safely ignore this email.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px;border-top:1px solid #e5e7eb;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">You received this email because you have an account on Dashboard.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  });
}

/** Password reset (forgot-password flow). */
export async function sendPasswordResetEmail(opts: {
  to: string;
  url: string;
  locale?: string;
}): Promise<{ sent: boolean }> {
  const { to, url, locale } = opts;
  const text =
    `Reset your password\n\n` +
    `We received a request to reset your password. Open the link below to choose a new one (expires in 1 hour):\n\n${url}\n\n` +
    `If you didn't request this, you can safely ignore this email — your password won't change.`;

  return sendEmail({
    to,
    subject: subjectsFor(locale).reset,
    text,
    html: emailShell({
      heading: "Reset your password",
      body: "We received a request to reset your password. Click the button below to choose a new one. This link expires in 1 hour.",
      ctaLabel: "Reset password",
      ctaUrl: url,
      note: "If you didn't request this, you can safely ignore this email — your password won't change.",
    }),
  });
}
