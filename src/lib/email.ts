import { Resend } from "resend";
import { render } from "@react-email/render";
import VerifyEmail from "@/emails/VerifyEmail";
import ResetPasswordEmail from "@/emails/ResetPasswordEmail";
import AccountRecoveryEmail from "@/emails/AccountRecoveryEmail";
import SecurityAlertEmail from "@/emails/SecurityAlertEmail";
import WelcomeEmail from "@/emails/WelcomeEmail";
import InvoiceEmail from "@/emails/InvoiceEmail";
import * as React from "react";

export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export type MailTransport = "smtp" | "resend" | "none";

/**
 * Outcome of a delivery attempt. The `sent` boolean alone cannot express
 * "a transport accepted this, but it will never reach the recipient" — which
 * is exactly the failure mode that makes a product's mail look broken while
 * every log line says success. `warnings` carries that distinction.
 */
export interface EmailDeliveryOutcome {
  sent: boolean;
  transport: MailTransport;
  /** Why it failed (or why it was accepted but cannot be delivered). */
  reason?: string;
  /** Configuration problems that affect this message's deliverability. */
  warnings?: string[];
}

export interface MailConfiguration {
  /** The transport a send would actually use right now. */
  transport: MailTransport;
  /** The sender address that send would use. */
  from: string | undefined;
  /** Non-empty when the configuration cannot deliver to a real recipient. */
  warnings: string[];
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

/**
 * Resend's sandbox sender. It is not a usable product sender: Resend delivers
 * `onboarding@resend.dev` only to the account owner's own address and rejects
 * every other recipient — so a deployment that looks fully configured mails
 * nobody but its own developer. The repo's env templates ship this address as
 * the placeholder, which is how a "correct" setup ends up with silent
 * non-delivery; treat it as a configuration error, never as a sender.
 */
const RESEND_SANDBOX_SENDER = /@resend\.dev\b/i;

/** Whether an address is Resend's sandbox sender (undeliverable to real users). */
export function isResendSandboxSender(from: string | undefined): boolean {
  return Boolean(from && RESEND_SANDBOX_SENDER.test(from));
}

/** Whether SMTP env vars are present (SMTP becomes the preferred transport). */
function isSmtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST);
}

/** Sender address for the Resend transport. */
function resendSender(): string {
  return sanitizeFromAddress(process.env.RESEND_FROM) || EMAIL_FROM;
}

/**
 * Sender address for the SMTP transport.
 *
 * When the only configured sender is Resend's sandbox placeholder, the
 * authenticated SMTP account is used instead: Gmail/Workspace rewrites a From
 * it does not own, and `@resend.dev` is not an address this account can send
 * as — the placeholder would cost the message its sender identity.
 */
function smtpSender(): string {
  const configured = sanitizeFromAddress(process.env.SMTP_FROM) || EMAIL_FROM;
  if (isResendSandboxSender(configured) && process.env.SMTP_USER) {
    return process.env.SMTP_USER;
  }
  return configured;
}

/** The requested transport, before the deliverability checks below. */
function requestedTransport(): string {
  return (process.env.EMAIL_TRANSPORT ?? "auto").toLowerCase();
}

/**
 * Resolve — and diagnose — the mail configuration.
 *
 * `EMAIL_TRANSPORT` decides the preference ("auto" = SMTP when SMTP_HOST is
 * set, otherwise Resend), but a preference the provider cannot honour must not
 * be followed off a cliff: when the selected sender is Resend's sandbox
 * address and SMTP is available, SMTP is the only transport that can reach the
 * recipient, so it is used and the misconfiguration is reported loudly.
 *
 * Exported for the diagnostic script and for routes that want to tell the user
 * "your mail configuration cannot deliver to real addresses".
 */
export function describeMailConfiguration(): MailConfiguration {
  const requested = requestedTransport();
  const smtpConfigured = isSmtpConfigured();
  const warnings: string[] = [];

  let transport: MailTransport;
  if (requested === "smtp") {
    transport = smtpConfigured ? "smtp" : "none";
    if (!smtpConfigured) {
      warnings.push("EMAIL_TRANSPORT=smtp is set but SMTP_HOST is missing — every send fails.");
    }
  } else if (requested === "auto" && smtpConfigured) {
    transport = "smtp";
  } else {
    transport = process.env.RESEND_API_KEY ? "resend" : "none";
  }

  if (transport === "resend" && isResendSandboxSender(resendSender())) {
    if (smtpConfigured) {
      transport = "smtp";
      warnings.push(
        `Resend's sandbox sender (${resendSender()}) only delivers to the Resend account ` +
          "owner's own address, so it cannot reach users — sending over SMTP instead. " +
          "Verify a sending domain in Resend and point RESEND_FROM/EMAIL_FROM at it, or set " +
          "EMAIL_TRANSPORT=smtp to make this explicit.",
      );
    } else {
      warnings.push(
        `Resend's sandbox sender (${resendSender()}) only delivers to the Resend account ` +
          "owner's own address — every other recipient is rejected by the provider. Verify a " +
          "sending domain in Resend and set RESEND_FROM/EMAIL_FROM to it, or configure SMTP_HOST.",
      );
    }
  }

  if (transport === "smtp" && !(process.env.SMTP_USER && process.env.SMTP_PASS)) {
    warnings.push(
      "SMTP_USER/SMTP_PASS are not both set — providers that require auth reject the send.",
    );
  }

  if (transport === "smtp" && isResendSandboxSender(smtpSender())) {
    warnings.push(
      "Resend's sandbox sender is configured, which this SMTP account cannot send as — " +
        "set EMAIL_FROM/SMTP_FROM to a real address of the sending domain.",
    );
  }

  const from =
    transport === "smtp" ? smtpSender() : transport === "resend" ? resendSender() : undefined;

  return { transport, from, warnings };
}

/** Config warnings printed once per process — mail paths run on every signup. */
const reportedWarnings = new Set<string>();

function logConfigWarnings(warnings: string[]): void {
  for (const warning of warnings) {
    if (reportedWarnings.has(warning)) continue;
    reportedWarnings.add(warning);
    console.warn(`[mailer] ${warning}`);
  }
}

/** Attempt budget for one message: the first try, then two backed-off retries. */
const RETRY_DELAYS_MS = [250, 750];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const errorText = (err: unknown): string => (err instanceof Error ? err.message : String(err));

/**
 * Whether a later attempt can plausibly succeed.
 *
 * Transient: DNS/connect/socket failures and provider-side pressure (SMTP 4xx
 * greeting, Resend 429, timeouts, 5xx). Permanent: the configuration or the
 * address is wrong (invalid `from`, unverified sender, sandbox sender, bad API
 * key, SMTP 5xx) — retrying those only burns provider quota and delays the
 * error the operator needs to see.
 */
export function isTransientMailError(err: unknown): boolean {
  const message = errorText(err);
  const code = String((err as { code?: unknown })?.code ?? "");
  if (/^(ETIMEDOUT|ESOCKET|ECONNRESET|ECONNECTION|ECONNREFUSED|EDNS|EAI_AGAIN|EPIPE)$/.test(code)) {
    return true;
  }
  const responseCode = (err as { responseCode?: unknown })?.responseCode;
  if (typeof responseCode === "number") return responseCode >= 400 && responseCode < 500;

  if (
    /rate[_ ]?limit|too many requests|timed? ?out|socket hang up|temporarily|try again|internal (server )?error|\b5\d\d\b/i.test(
      message,
    )
  ) {
    return true;
  }
  if (
    /validation_error|invalid .?from|not verified|only send|sandbox|api key|unauthorized/i.test(
      message,
    )
  ) {
    return false;
  }
  return false;
}

/** Run an attempt, retrying transient failures with exponential backoff. */
async function withTransientRetry<T>(label: string, attempt: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i <= RETRY_DELAYS_MS.length; i++) {
    try {
      return await attempt();
    } catch (err) {
      lastError = err;
      if (i === RETRY_DELAYS_MS.length || !isTransientMailError(err)) break;
      const delay = RETRY_DELAYS_MS[i];
      console.warn(
        `[mailer] ${label} attempt ${i + 1} failed (${errorText(err)}) — retrying in ${delay}ms`,
      );
      await sleep(delay);
    }
  }
  throw lastError;
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
 * - "resend"         — force Resend even when SMTP is configured, *except*
 *                      when the configured sender is Resend's sandbox address
 *                      (see `describeMailConfiguration`) — that combination
 *                      provably cannot deliver, so SMTP is used instead.
 *
 * Resend sends from `RESEND_FROM` when set, falling back to EMAIL_FROM.
 */
export async function sendEmailDetailed(payload: EmailPayload): Promise<EmailDeliveryOutcome> {
  if (requestedTransport() === "smtp" && !isSmtpConfigured()) {
    throw new Error("EMAIL_TRANSPORT=smtp requires SMTP_HOST to be configured");
  }

  const config = describeMailConfiguration();
  logConfigWarnings(config.warnings);

  if (config.transport === "none") {
    console.log(
      `[mailer] No SMTP_HOST / RESEND_API_KEY configured — email to ${payload.to} NOT sent. ` +
        `Subject: "${payload.subject}"\n${payload.text}`,
    );
    return { sent: false, transport: "none", reason: "no mailer configured" };
  }

  return config.transport === "smtp"
    ? sendViaSmtp(payload, config.warnings)
    : sendViaResend(payload, config.warnings);
}

/** Boolean-only convenience wrapper around `sendEmailDetailed`. */
export async function sendEmail(payload: EmailPayload): Promise<{ sent: boolean }> {
  const { sent } = await sendEmailDetailed(payload);
  return { sent };
}

/** Send over nodemailer SMTP.
 *
 * Loaded lazily so the console fallback never pulls nodemailer in. The send is
 * always awaited: a caller that needs the message out of the request's way
 * (see lib/email-outbox) enqueues it instead of relying on a detached promise,
 * which a serverless host would kill mid-handshake. Connection/greeting/socket
 * timeouts are bounded so a dead SMTP host cannot hold a request open
 * indefinitely, and transient failures are retried before giving up.
 */
async function sendViaSmtp(
  payload: EmailPayload,
  warnings: string[],
): Promise<EmailDeliveryOutcome> {
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

  const info = await withTransientRetry("smtp", () =>
    transporter.sendMail({
      from: smtpSender(),
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
    }),
  );
  console.log(`[mailer] SMTP delivered to ${payload.to} — messageId: ${info.messageId}`);
  return { sent: true, transport: "smtp", ...(warnings.length ? { warnings } : {}) };
}

/** Send over the Resend HTTP API, with a bounded request and transient retries. */
async function sendViaResend(
  payload: EmailPayload,
  warnings: string[],
): Promise<EmailDeliveryOutcome> {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const from = resendSender();

  const attempt = async (): Promise<void> => {
    // Bound the Resend HTTP call: the SDK sets no timeout of its own, so an
    // unreachable Resend endpoint would otherwise hold the request open for the
    // OS-level TCP timeout (~30s) — a mailer outage must never block an API
    // response that long. Mirror the 10s budget nodemailer uses for SMTP. The
    // dangling fetch settles on its own and is discarded.
    const sendPromise = resend.emails.send({
      from,
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
    if (error) throw new Error(error.message);
  };

  try {
    await withTransientRetry("resend", attempt);
    return { sent: true, transport: "resend", ...(warnings.length ? { warnings } : {}) };
  } catch (err) {
    const message = errorText(err);
    console.error(`[mailer] Resend failed for ${payload.to}: ${message}`);
    // In production a failed send must never look like a success — throw.
    // Outside production (local dev / CI) delivery to unverified recipients is
    // expected to fail (Resend's sandbox sender only reaches the account
    // owner), so fall back to the caller's dev-mode console behaviour
    // ({ sent: false }) instead of breaking the whole flow with a 500.
    if (process.env.NODE_ENV === "production") throw new Error(message);
    return {
      sent: false,
      transport: "resend",
      reason: message,
      ...(warnings.length ? { warnings } : {}),
    };
  }
}

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

const RECOVERY_SUBJECTS: Record<string, string> = {
  en: "Recover access to your account",
  id: "Pulihkan akses ke akun Anda",
  zh: "恢复您的账户访问权限",
  ja: "アカウントへのアクセスを復旧",
};

const SECURITY_ALERT_SUBJECTS: Record<string, string> = {
  en: "Two-factor authentication was turned off",
  id: "Autentikasi dua faktor dinonaktifkan",
  zh: "两步验证已被关闭",
  ja: "二段階認証が無効になりました",
};

function subjectFor(locale: string | undefined, subjects: Record<string, string>): string {
  return subjects[locale ?? "en"] ?? subjects.en;
}

/**
 * The emails the product can send. Named so a queued message can be re-rendered
 * at delivery time (see lib/email-outbox) instead of being stored as a finished
 * body — a one-time code must never sit in a table.
 */
export type EmailTemplate =
  "verify_email" | "welcome" | "password_reset" | "account_recovery" | "security_alert" | "invoice";

/** Render a template into subject/html/text. */
async function renderTemplate(
  template: EmailTemplate,
  params: Record<string, unknown> & { locale?: string },
): Promise<{ subject: string; html: string; text: string }> {
  const locale = typeof params.locale === "string" ? params.locale : undefined;
  const str = (key: string): string =>
    typeof params[key] === "string" ? (params[key] as string) : "";
  const optional = (key: string): string | undefined =>
    typeof params[key] === "string" ? (params[key] as string) : undefined;

  switch (template) {
    case "verify_email": {
      const props = { otp: str("code"), locale };
      return {
        subject: subjectFor(locale, OTP_SUBJECTS),
        html: await render(React.createElement(VerifyEmail, props)),
        text: await render(React.createElement(VerifyEmail, props), { plainText: true }),
      };
    }
    case "welcome": {
      const props = { name: optional("name") };
      return {
        subject: "Welcome to Next Dashboard!",
        html: await render(React.createElement(WelcomeEmail, props)),
        text: await render(React.createElement(WelcomeEmail, props), { plainText: true }),
      };
    }
    case "password_reset": {
      const props = { url: str("url"), locale };
      return {
        subject: subjectFor(locale, RESET_SUBJECTS),
        html: await render(React.createElement(ResetPasswordEmail, props)),
        text: await render(React.createElement(ResetPasswordEmail, props), { plainText: true }),
      };
    }
    case "account_recovery": {
      const props = { url: str("url"), name: optional("name"), locale };
      return {
        subject: subjectFor(locale, RECOVERY_SUBJECTS),
        html: await render(React.createElement(AccountRecoveryEmail, props)),
        text: await render(React.createElement(AccountRecoveryEmail, props), { plainText: true }),
      };
    }
    case "security_alert": {
      const props = {
        revokeUrl: str("revokeUrl"),
        name: optional("name"),
        locale,
        happenedAt: optional("happenedAt"),
      };
      return {
        subject: subjectFor(locale, SECURITY_ALERT_SUBJECTS),
        html: await render(React.createElement(SecurityAlertEmail, props)),
        text: await render(React.createElement(SecurityAlertEmail, props), { plainText: true }),
      };
    }
    case "invoice": {
      const props = {
        invoiceNumber: str("invoiceNumber"),
        amount: str("amount"),
        date: str("date"),
        url: str("url"),
      };
      return {
        subject: `Payment Receipt (${props.invoiceNumber})`,
        html: await render(React.createElement(InvoiceEmail, props)),
        text: await render(React.createElement(InvoiceEmail, props), { plainText: true }),
      };
    }
  }
}

/**
 * Render and send a named template. Used by the outbox drain (which re-renders
 * at delivery time) and by the typed helpers below, so every subject line and
 * template lives in exactly one place.
 */
export async function sendTemplatedEmail(
  template: EmailTemplate,
  params: Record<string, unknown> & { to: string; locale?: string },
): Promise<EmailDeliveryOutcome> {
  const { to, ...rest } = params;
  const { subject, html, text } = await renderTemplate(template, rest);
  return sendEmailDetailed({ to, subject, html, text });
}

/** Email OTP (signup / identity verification). Uses localized templates. */
export async function sendOtpEmail(opts: {
  to: string;
  otp: string;
  locale?: string;
}): Promise<{ sent: boolean }> {
  const { sent } = await sendTemplatedEmail("verify_email", {
    to: opts.to,
    code: opts.otp,
    locale: opts.locale,
  });
  return { sent };
}

/** Password reset (forgot-password flow). Uses localized templates. */
export async function sendPasswordResetEmail(opts: {
  to: string;
  url: string;
  locale?: string;
}): Promise<{ sent: boolean }> {
  const { sent } = await sendTemplatedEmail("password_reset", {
    to: opts.to,
    url: opts.url,
    locale: opts.locale,
  });
  return { sent };
}

/**
 * Last-resort account recovery link (authenticator AND backup codes lost).
 * The link disables 2FA and signs out other devices — see
 * /api/auth/account-recovery/confirm.
 */
export async function sendAccountRecoveryEmail(opts: {
  to: string;
  url: string;
  name?: string;
  locale?: string;
}): Promise<{ sent: boolean }> {
  const { sent } = await sendTemplatedEmail("account_recovery", {
    to: opts.to,
    url: opts.url,
    name: opts.name,
    locale: opts.locale,
  });
  return { sent };
}

/**
 * "Two-factor authentication was turned off" alert, with the one-click
 * "This wasn't me" revoke link. Sent from the account-recovery confirm route
 * when a recovery disables 2FA.
 */
export async function sendSecurityAlertEmail(opts: {
  to: string;
  revokeUrl: string;
  name?: string;
  locale?: string;
  happenedAt?: string;
}): Promise<{ sent: boolean }> {
  const { sent } = await sendTemplatedEmail("security_alert", {
    to: opts.to,
    revokeUrl: opts.revokeUrl,
    name: opts.name,
    locale: opts.locale,
    happenedAt: opts.happenedAt,
  });
  return { sent };
}

export async function sendWelcomeEmail(opts: {
  to: string;
  name?: string;
}): Promise<{ sent: boolean }> {
  const { sent } = await sendTemplatedEmail("welcome", { to: opts.to, name: opts.name });
  return { sent };
}

export async function sendInvoiceEmail(opts: {
  to: string;
  invoiceNumber: string;
  amount: string;
  date: string;
  url: string;
}): Promise<{ sent: boolean }> {
  const { sent } = await sendTemplatedEmail("invoice", {
    to: opts.to,
    invoiceNumber: opts.invoiceNumber,
    amount: opts.amount,
    date: opts.date,
    url: opts.url,
  });
  return { sent };
}
