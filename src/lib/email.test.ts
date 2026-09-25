import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { sendEmail, sendPasswordResetEmail, sendOtpEmail } from "./email";

import { render } from "@react-email/render";
import * as React from "react";

import SecurityAlertEmail from "@/emails/SecurityAlertEmail";
import AccountRecoveryEmail from "@/emails/AccountRecoveryEmail";

const ORIGINAL_API_KEY = process.env.RESEND_API_KEY;
const ORIGINAL_FROM = process.env.EMAIL_FROM;
const ORIGINAL_RESEND_FROM = process.env.RESEND_FROM;
const ORIGINAL_TRANSPORT = process.env.EMAIL_TRANSPORT;
const ORIGINAL_SMTP: Record<string, string | undefined> = {
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: process.env.SMTP_PORT,
  SMTP_SECURE: process.env.SMTP_SECURE,
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASS: process.env.SMTP_PASS,
};

function setKey(value: string | undefined) {
  if (value === undefined) delete process.env.RESEND_API_KEY;
  else process.env.RESEND_API_KEY = value;
}

function clearSmtp() {
  delete process.env.SMTP_HOST;
  delete process.env.SMTP_PORT;
  delete process.env.SMTP_SECURE;
  delete process.env.SMTP_USER;
  delete process.env.SMTP_PASS;
}

beforeEach(() => {
  setKey(undefined);
  delete process.env.EMAIL_FROM;
  delete process.env.RESEND_FROM;
  delete process.env.EMAIL_TRANSPORT;
  clearSmtp();
  vi.resetModules();
  vi.restoreAllMocks();
});

afterEach(() => {
  setKey(ORIGINAL_API_KEY);
  if (ORIGINAL_FROM === undefined) delete process.env.EMAIL_FROM;
  else process.env.EMAIL_FROM = ORIGINAL_FROM;
  if (ORIGINAL_RESEND_FROM === undefined) delete process.env.RESEND_FROM;
  else process.env.RESEND_FROM = ORIGINAL_RESEND_FROM;
  if (ORIGINAL_TRANSPORT === undefined) delete process.env.EMAIL_TRANSPORT;
  else process.env.EMAIL_TRANSPORT = ORIGINAL_TRANSPORT;
  const host = ORIGINAL_SMTP.SMTP_HOST;
  if (host === undefined) delete process.env.SMTP_HOST;
  else process.env.SMTP_HOST = host;
  if (ORIGINAL_SMTP.SMTP_PORT === undefined) delete process.env.SMTP_PORT;
  else process.env.SMTP_PORT = ORIGINAL_SMTP.SMTP_PORT;
  if (ORIGINAL_SMTP.SMTP_SECURE === undefined) delete process.env.SMTP_SECURE;
  else process.env.SMTP_SECURE = ORIGINAL_SMTP.SMTP_SECURE;
  if (ORIGINAL_SMTP.SMTP_USER === undefined) delete process.env.SMTP_USER;
  else process.env.SMTP_USER = ORIGINAL_SMTP.SMTP_USER;
  if (ORIGINAL_SMTP.SMTP_PASS === undefined) delete process.env.SMTP_PASS;
  else process.env.SMTP_PASS = ORIGINAL_SMTP.SMTP_PASS;
});

describe("sendEmail — no mailer configured", () => {
  it("returns { sent: false } and logs the payload without throwing", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const result = await sendEmail({
      to: "user@example.com",
      subject: "Test",
      html: "<p>hi</p>",
      text: "hi",
    });
    expect(result).toEqual({ sent: false });
    expect(log).toHaveBeenCalled();
  });
});

describe("sendEmail — Resend configured", () => {
  it("sends via resend.emails.send and returns { sent: true }", async () => {
    setKey("re_testkey123");
    const sendMock = vi.fn().mockResolvedValue({ data: { id: "email_123" }, error: null });

    // Swap the module's Resend for a mock via the dynamic import below.
    vi.doMock("resend", () => ({
      Resend: class {
        emails = { send: sendMock };
      },
    }));

    const { sendEmail: send } = await import("./email");
    const result = await send({
      to: "user@example.com",
      subject: "Test",
      html: "<p>hi</p>",
      text: "hi",
    });

    expect(result).toEqual({ sent: true });
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "user@example.com",
        subject: "Test",
        from: expect.stringContaining("@"),
      }),
    );
  });

  it("falls back to { sent: false } outside production when resend errors", async () => {
    setKey("re_testkey123");
    vi.doMock("resend", () => ({
      Resend: class {
        emails = {
          send: vi
            .fn()
            .mockResolvedValue({ data: null, error: { message: "rate_limit_exceeded" } }),
        };
      },
    }));

    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    const { sendEmail: send } = await import("./email");
    const result = await send({ to: "a@b.com", subject: "s", html: "h", text: "t" });
    expect(result).toEqual({ sent: false });
    expect(errorLog).toHaveBeenCalledWith(expect.stringContaining("rate_limit_exceeded"));
  });

  it("throws when resend reports an error in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    try {
      setKey("re_testkey123");
      vi.doMock("resend", () => ({
        Resend: class {
          emails = {
            send: vi
              .fn()
              .mockResolvedValue({ data: null, error: { message: "rate_limit_exceeded" } }),
          };
        },
      }));

      const { sendEmail: send } = await import("./email");
      await expect(send({ to: "a@b.com", subject: "s", html: "h", text: "t" })).rejects.toThrow(
        /rate_limit_exceeded/,
      );
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

describe("sendEmail — SMTP configured (takes priority over Resend)", () => {
  it("sends via nodemailer and returns { sent: true }", async () => {
    process.env.SMTP_HOST = "smtp.example.com";
    process.env.SMTP_PORT = "2525";
    process.env.SMTP_USER = "user";
    process.env.SMTP_PASS = "pass";

    const sendMail = vi.fn().mockResolvedValue({ messageId: "m1" });
    const createTransport = vi.fn().mockReturnValue({ sendMail });
    vi.doMock("nodemailer", () => ({ default: { createTransport } }));

    const { sendEmail: send } = await import("./email");
    const result = await send({
      to: "u@example.com",
      subject: "Test",
      html: "<p>hi</p>",
      text: "hi",
    });

    expect(result).toEqual({ sent: true });
    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        host: "smtp.example.com",
        port: 2525,
        secure: false,
        auth: { user: "user", pass: "pass" },
      }),
    );
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "u@example.com", subject: "Test" }),
    );
  });

  it("defaults to secure 465 when SMTP_SECURE=true and omits auth without creds", async () => {
    process.env.SMTP_HOST = "smtp.example.com";
    process.env.SMTP_SECURE = "true";

    const sendMail = vi.fn().mockResolvedValue({});
    const createTransport = vi.fn().mockReturnValue({ sendMail });
    vi.doMock("nodemailer", () => ({ default: { createTransport } }));

    const { sendEmail: send } = await import("./email");
    await send({ to: "u@example.com", subject: "S", html: "h", text: "t" });

    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ port: 465, secure: true, auth: undefined }),
    );
  });

  it("throws when the SMTP transport rejects", async () => {
    process.env.SMTP_HOST = "smtp.example.com";
    const sendMail = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    vi.doMock("nodemailer", () => ({
      default: { createTransport: vi.fn().mockReturnValue({ sendMail }) },
    }));

    const { sendEmail: send } = await import("./email");
    await expect(send({ to: "u@example.com", subject: "S", html: "h", text: "t" })).rejects.toThrow(
      /ECONNREFUSED/,
    );
  });
});

describe("sendEmail — EMAIL_TRANSPORT override", () => {
  // The one exception to the override: Resend's sandbox sender cannot deliver
  // to anyone but the account owner, so that combination is rescued to SMTP
  // (see __tests__/email-transport.test.ts). A real configured sender keeps
  // the override exactly as asked.
  it("uses Resend when EMAIL_TRANSPORT=resend even with SMTP configured", async () => {
    setKey("re_testkey123");
    process.env.EMAIL_TRANSPORT = "resend";
    process.env.SMTP_HOST = "smtp.example.com";
    process.env.RESEND_FROM = "Dashboard <billing@your-domain.com>";
    const sendMock = vi.fn().mockResolvedValue({ data: { id: "email_1" }, error: null });
    vi.doMock("resend", () => ({
      Resend: class {
        emails = { send: sendMock };
      },
    }));

    const { sendEmail: send } = await import("./email");
    const result = await send({
      to: "u@example.com",
      subject: "S",
      html: "<p>h</p>",
      text: "t",
    });

    expect(result).toEqual({ sent: true });
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({ from: "Dashboard <billing@your-domain.com>" }),
    );
  });

  it("throws when EMAIL_TRANSPORT=smtp but no SMTP_HOST is configured", async () => {
    process.env.EMAIL_TRANSPORT = "smtp";
    const { sendEmail: send } = await import("./email");
    await expect(send({ to: "u@example.com", subject: "S", html: "h", text: "t" })).rejects.toThrow(
      /EMAIL_TRANSPORT=smtp requires SMTP_HOST/,
    );
  });
});

describe("sendOtpEmail", () => {
  it("falls back to console (no transport) and includes the 6-digit code", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const result = await sendOtpEmail({ to: "u@example.com", otp: "482913" });
    expect(result).toEqual({ sent: false });
    expect(log.mock.calls[0]?.[0]).toContain("482913");
  });

  it("sends the code in the subject and body via Resend", async () => {
    setKey("re_testkey123");
    const sendMock = vi.fn().mockResolvedValue({ data: { id: "email_otp" }, error: null });
    vi.doMock("resend", () => ({
      Resend: class {
        emails = { send: sendMock };
      },
    }));

    const { sendOtpEmail: send } = await import("./email");
    await send({ to: "u@example.com", otp: "482913", locale: "en" });

    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "u@example.com",
        subject: "Verify your email address",
        html: expect.stringContaining("482913"),
        text: expect.stringContaining("482913"),
      }),
    );
  });

  it("localizes the OTP subject", async () => {
    setKey("re_testkey123");
    const sendMock = vi.fn().mockResolvedValue({ data: { id: "email_otp" }, error: null });
    vi.doMock("resend", () => ({
      Resend: class {
        emails = { send: sendMock };
      },
    }));

    const { sendOtpEmail: send } = await import("./email");
    await send({ to: "u@example.com", otp: "482913", locale: "ja" });
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({ subject: expect.stringContaining("確認コード") }),
    );
  });
});

describe("password-reset sender", () => {
  it("falls back to console (no key) and includes the reset link in the text body", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const r = await sendPasswordResetEmail({
      to: "u@example.com",
      url: "https://app.example.com/en/reset-password?token=def",
    });
    expect(r).toEqual({ sent: false });
    expect(log.mock.calls[0]?.[0]).toContain("Reset your password");
  });

  it("localizes the subject line when a locale is provided", async () => {
    setKey("re_testkey123");
    const sendMock = vi.fn().mockResolvedValue({ data: { id: "email_2" }, error: null });
    vi.doMock("resend", () => ({
      Resend: class {
        emails = { send: sendMock };
      },
    }));

    const { sendPasswordResetEmail: sendR } = await import("./email");
    await sendR({
      to: "u@example.com",
      url: "https://app.example.com/reset?token=x",
      locale: "zh",
    });

    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({ subject: expect.stringContaining("重置密码") }),
    );
  });
});

const renderEmail = (component: React.ReactElement) => render(component);

/**
 * The two emails a user receives when their second factor is in trouble: the
 * last-resort recovery link, and the "2FA was turned off" alert that carries
 * the one-click "this wasn't me" revoke.
 *
 * Both are localized across the four supported locales — a security warning
 * that arrives in a language the recipient cannot read is not a warning. These
 * render the real templates, so a locale that silently falls back to English
 * fails here.
 */
describe("SecurityAlertEmail", () => {
  it("states what happened and offers the single revoke action", async () => {
    const html = await renderEmail(
      React.createElement(SecurityAlertEmail, {
        revokeUrl: "https://app.test/en/security-alert?token=abc",
        name: "Ada",
        locale: "en",
        happenedAt: "2026-09-21",
      }),
    );
    expect(html).toContain("Two-factor authentication was turned off");
    expect(html).toContain("Ada");
    expect(html).toContain("https://app.test/en/security-alert?token=abc");
    // The mail leads to the CONFIRMATION PAGE, not the action: a scanner that
    // fetches it must not be able to spend the single-use link.
    expect(html).not.toContain("/api/auth/security-alert/revoke");
    expect(html).toContain("Review this sign-in change");
    expect(html).toContain("expires in 7 days");
  });

  it("is translated in every supported locale", async () => {
    const expectations: Record<string, string> = {
      en: "Two-factor authentication was turned off",
      id: "Autentikasi dua faktor dinonaktifkan",
      ja: "二段階認証が無効になりました",
      zh: "两步验证已被关闭",
    };

    for (const [locale, heading] of Object.entries(expectations)) {
      const html = await renderEmail(
        React.createElement(SecurityAlertEmail, { revokeUrl: "https://app.test/x", locale }),
      );
      expect(html, locale).toContain(heading);
      expect(html, locale).toContain("https://app.test/x");
      // Never the placeholder from the default props.
      expect(html, locale).not.toContain("https://example.com");
    }
  });

  it("falls back to English for an unknown locale rather than rendering nothing", async () => {
    const html = await renderEmail(
      React.createElement(SecurityAlertEmail, { revokeUrl: "https://app.test/x", locale: "fr" }),
    );
    expect(html).toContain("Two-factor authentication was turned off");
  });
});

describe("AccountRecoveryEmail", () => {
  it("is translated in every supported locale (it used to be English-only)", async () => {
    const expectations: Record<string, string> = {
      en: "Recover access to your account",
      id: "Pulihkan akses ke akun Anda",
      ja: "アカウントへのアクセスを復旧",
      zh: "恢复账户访问权限",
    };

    for (const [locale, heading] of Object.entries(expectations)) {
      const html = await renderEmail(
        React.createElement(AccountRecoveryEmail, { url: "https://app.test/recover", locale }),
      );
      expect(html, locale).toContain(heading);
      expect(html, locale).toContain("https://app.test/recover");
    }
  });

  it("names the consequences before the user clicks", async () => {
    const html = await renderEmail(
      React.createElement(AccountRecoveryEmail, { url: "https://app.test/x", locale: "en" }),
    );
    expect(html).toContain("turns off two-factor authentication and signs out every device");
    expect(html).toContain("works once and expires in 30 minutes");
  });
});
