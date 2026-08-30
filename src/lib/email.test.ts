import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { sendEmail, sendPasswordResetEmail, sendOtpEmail } from "./email";

const ORIGINAL_API_KEY = process.env.RESEND_API_KEY;
const ORIGINAL_FROM = process.env.EMAIL_FROM;
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
  clearSmtp();
  vi.resetModules();
  vi.restoreAllMocks();
});

afterEach(() => {
  setKey(ORIGINAL_API_KEY);
  if (ORIGINAL_FROM === undefined) delete process.env.EMAIL_FROM;
  else process.env.EMAIL_FROM = ORIGINAL_FROM;
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

  it("throws when resend reports an error", async () => {
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
        subject: expect.stringContaining("verification code"),
        html: expect.stringContaining(">4</span>"),
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
