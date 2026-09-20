import { Resend } from "resend";
import { render } from "@react-email/render";
import VerifyEmail from "@/emails/VerifyEmail";
import ResetPasswordEmail from "@/emails/ResetPasswordEmail";
import WelcomeEmail from "@/emails/WelcomeEmail";
import InvoiceEmail from "@/emails/InvoiceEmail";
import * as React from "react";

export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/**
 * Normalize a configured From address: dotenv-style wrapping quotes (a common
 * misconfiguration that makes Resend reject every send with 422 "Invalid
 * `from` field") are stripped, and a value with no address part falls back.
 */
function sanitizeFromAddress(raw: string | undefined): string | undefined {
  const value = raw
    ?.trim()
    .replace(/^"([\s\S]*)"$/, "$1")
    .trim();
  return value && /<[^>]+@[^>]+>|[^\s<]+@[^\s>]+/.test(value) ? value : undefined;
}

const EMAIL_FROM =
  sanitizeFromAddress(process.env.EMAIL_FROM) || "Dashboard <onboarding@resend.dev>";

/** Localized subject lines for the four supported locales (en/id/zh/ja). */
const OTP_SUBJECTS: Record<string, string> = {
  en: "Verify your email address",
  id: "Verifikasi Email Anda",
  zh: "验证您的邮箱地址",
  ja: "メール確認コード",
};

const RESET_SUBJECTS: Record<string, string> = {
  en: "Reset your password",
  id: "Atur Ulang Kata Sandi",
  zh: "重置密码",
  ja: "パスワードの再設定",
};

function subjectFor(locale: string | undefined, subjects: Record<string, string>): string {
  return subjects[locale ?? "en"] ?? subjects.en;
}

/**
 * Send a transactional email.
 * Returns `{ sent: false }` when no mailer is configured (caller keeps its
 * dev-mode fallback). Throws when a configured transport fails — silent
 * non-delivery is worse than an explicit error.
 *
 * Transport selection (`EMAIL_TRANSPORT`):
 * - "auto" (default) — SMTP when SMTP_HOST is set, otherwise Resend.
 * - "smtp"           — force SMTP (throws when SMTP_HOST is missing).
 * - "resend"         — force Resend even when SMTP is configured.
 *
 * Resend sends from `RESEND_FROM` when set, falling back to EMAIL_FROM.
 */
export async function sendEmail(payload: EmailPayload): Promise<{ sent: boolean }> {
  const transport = (process.env.EMAIL_TRANSPORT ?? "auto").toLowerCase();
  const smtpConfigured = isSmtpConfigured();
  const useSmtp = transport === "smtp" || (transport === "auto" && smtpConfigured);

  if (useSmtp) {
    if (!smtpConfigured) {
      throw new Error("EMAIL_TRANSPORT=smtp requires SMTP_HOST to be configured");
    }
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
  // Bound the Resend HTTP call: the SDK sets no timeout of its own, so an
  // unreachable Resend endpoint would otherwise hold the request open for the
  // OS-level TCP timeout (~30s) — a mailer outage must never block an API
  // response that long. Mirrors the 10s connection/socket budget nodemailer
  // uses for SMTP. The dangling fetch settles on its own and is discarded.
  const resendFrom = sanitizeFromAddress(process.env.RESEND_FROM) || EMAIL_FROM;
  const sendPromise = resend.emails.send({
    from: resendFrom,
    to: payload.to,
    subject: payload.subject,
    html: payload.html,
    text: payload.text,
  });
  let timeout: NodeJS.Timeout | undefined;
  const { error } = await Promise.race([
    sendPromise.finally(() => {
      if (timeout) clearTimeout(timeout);
    }),
    new Promise<{ error: Error }>((resolve) => {
      timeout = setTimeout(
        () => resolve({ error: new Error("Resend request timed out after 10s") }),
        10_000,
      );
    }),
  ]);

  if (error) {
    console.error(`[mailer] Resend failed for ${payload.to}: ${error.message}`);
    // In production a failed send must never look like a success — throw.
    // Outside production (local dev / CI) delivery to unverified recipients is
    // expected to fail (Resend's test sender only reaches the account owner),
    // so fall back to the caller's dev-mode console behaviour ({ sent: false })
    // instead of breaking the whole flow with a 500.
    if (process.env.NODE_ENV === "production") {
      throw new Error(error.message);
    }
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
  const smtpFrom = sanitizeFromAddress(process.env.SMTP_FROM) || EMAIL_FROM;
  const sendPromise = transporter.sendMail({
    from: smtpFrom,
    to: payload.to,
    subject: payload.subject,
    html: payload.html,
    text: payload.text,
  });

  // Always await delivery so emails are actually sent before the API responds.
  const info = await sendPromise;
  console.log(`[mailer] SMTP delivered to ${payload.to} — messageId: ${info.messageId}`);
  return { sent: true };
}

/** Email OTP (signup / identity verification). Uses localized templates. */
export async function sendOtpEmail(opts: {
  to: string;
  otp: string;
  locale?: string;
}): Promise<{ sent: boolean }> {
  const html = await render(
    React.createElement(VerifyEmail, { otp: opts.otp, locale: opts.locale }),
  );
  const text = await render(
    React.createElement(VerifyEmail, { otp: opts.otp, locale: opts.locale }),
    { plainText: true },
  );

  return sendEmail({
    to: opts.to,
    subject: subjectFor(opts.locale, OTP_SUBJECTS),
    html,
    text,
  });
}

/** Password reset (forgot-password flow). Uses localized templates. */
export async function sendPasswordResetEmail(opts: {
  to: string;
  url: string;
  locale?: string;
}): Promise<{ sent: boolean }> {
  const html = await render(
    React.createElement(ResetPasswordEmail, { url: opts.url, locale: opts.locale }),
  );
  const text = await render(
    React.createElement(ResetPasswordEmail, { url: opts.url, locale: opts.locale }),
    { plainText: true },
  );

  return sendEmail({
    to: opts.to,
    subject: subjectFor(opts.locale, RESET_SUBJECTS),
    html,
    text,
  });
}
export async function sendWelcomeEmail(opts: {
  to: string;
  name?: string;
}): Promise<{ sent: boolean }> {
  const html = await render(React.createElement(WelcomeEmail, { name: opts.name }));
  const text = await render(React.createElement(WelcomeEmail, { name: opts.name }), {
    plainText: true,
  });

  return sendEmail({
    to: opts.to,
    subject: "Welcome to Next Dashboard!",
    html,
    text,
  });
}

export async function sendInvoiceEmail(opts: {
  to: string;
  invoiceNumber: string;
  amount: string;
  date: string;
  url: string;
}): Promise<{ sent: boolean }> {
  const html = await render(React.createElement(InvoiceEmail, { ...opts }));
  const text = await render(React.createElement(InvoiceEmail, { ...opts }), { plainText: true });

  return sendEmail({
    to: opts.to,
    subject: `Payment Receipt (${opts.invoiceNumber})`,
    html,
    text,
  });
}
