import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * email.ts — the two ways a working-looking mail setup silently loses mail.
 *
 *  1. Resend's sandbox sender (`onboarding@resend.dev`) delivers ONLY to the
 *     Resend account owner's own address. A deployment with a real API key and
 *     a real recipient is therefore rejected by the provider while every log
 *     line reads as success — this is the configuration the repo's own env
 *     templates shipped, and the reason users stopped receiving mail.
 *  2. Transient provider failures (rate limit, timeout, dropped socket) were
 *     never retried, so one blip lost the message for good.
 *
 * Both are pinned here, alongside the explicit-override contract that must NOT
 * change: an operator who forces Resend with a real configured sender still
 * gets Resend, even when SMTP is configured.
 */

const ORIGINAL = {
  apiKey: process.env.RESEND_API_KEY,
  from: process.env.EMAIL_FROM,
  resendFrom: process.env.RESEND_FROM,
  transport: process.env.EMAIL_TRANSPORT,
  smtpHost: process.env.SMTP_HOST,
  smtpUser: process.env.SMTP_USER,
  smtpPass: process.env.SMTP_PASS,
};

function setEnv(values: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

beforeEach(() => {
  setEnv({
    RESEND_API_KEY: undefined,
    EMAIL_FROM: undefined,
    RESEND_FROM: undefined,
    EMAIL_TRANSPORT: undefined,
    SMTP_HOST: undefined,
    SMTP_USER: undefined,
    SMTP_PASS: undefined,
  });
  vi.resetModules();
  vi.restoreAllMocks();
});

afterEach(() => {
  setEnv({
    RESEND_API_KEY: ORIGINAL.apiKey,
    EMAIL_FROM: ORIGINAL.from,
    RESEND_FROM: ORIGINAL.resendFrom,
    EMAIL_TRANSPORT: ORIGINAL.transport,
    SMTP_HOST: ORIGINAL.smtpHost,
    SMTP_USER: ORIGINAL.smtpUser,
    SMTP_PASS: ORIGINAL.smtpPass,
  });
});

describe("describeMailConfiguration", () => {
  it("rescues a sandbox sender to SMTP instead of mailing nobody", async () => {
    setEnv({
      EMAIL_TRANSPORT: "resend",
      RESEND_API_KEY: "re_live_key",
      RESEND_FROM: "Next Dashboard <onboarding@resend.dev>",
      SMTP_HOST: "smtp.gmail.com",
      SMTP_USER: "ops@example.com",
      SMTP_PASS: "app-password",
    });

    const { describeMailConfiguration } = await import("@/lib/email");
    const config = describeMailConfiguration();

    // Resend cannot deliver this sender to a real recipient; SMTP can — and it
    // sends as the authenticated account, not as Resend's placeholder address.
    expect(config.transport).toBe("smtp");
    expect(config.from).toBe("ops@example.com");
    expect(config.warnings.join(" ")).toMatch(/sandbox sender/i);
    expect(config.warnings.join(" ")).toMatch(/verify a sending domain/i);
  });

  it("still reports the sandbox sender as undeliverable when no SMTP exists", async () => {
    setEnv({
      EMAIL_TRANSPORT: "resend",
      RESEND_API_KEY: "re_live_key",
      RESEND_FROM: "onboarding@resend.dev",
    });

    const { describeMailConfiguration } = await import("@/lib/email");
    const config = describeMailConfiguration();

    expect(config.transport).toBe("resend");
    expect(config.warnings.join(" ")).toMatch(/only delivers to the Resend account owner/i);
  });

  it("honours an explicit Resend override when the sender is a real domain", async () => {
    setEnv({
      EMAIL_TRANSPORT: "resend",
      RESEND_API_KEY: "re_live_key",
      RESEND_FROM: "Billing <billing@your-domain.com>",
      SMTP_HOST: "smtp.gmail.com",
    });

    const { describeMailConfiguration } = await import("@/lib/email");
    const config = describeMailConfiguration();

    expect(config.transport).toBe("resend");
    expect(config.from).toBe("Billing <billing@your-domain.com>");
    expect(config.warnings).toEqual([]);
  });

  it("reports the missing host behind EMAIL_TRANSPORT=smtp", async () => {
    setEnv({ EMAIL_TRANSPORT: "smtp" });

    const { describeMailConfiguration } = await import("@/lib/email");
    const config = describeMailConfiguration();

    expect(config.transport).toBe("none");
    expect(config.warnings.join(" ")).toMatch(/SMTP_HOST is missing/i);
  });

  it("defaults to SMTP when configured, and to Resend otherwise", async () => {
    setEnv({ RESEND_API_KEY: "re_live_key", SMTP_HOST: "smtp.example.com" });
    const first = await import("@/lib/email");
    expect(first.describeMailConfiguration().transport).toBe("smtp");

    vi.resetModules();
    setEnv({ SMTP_HOST: undefined });
    const second = await import("@/lib/email");
    expect(second.describeMailConfiguration().transport).toBe("resend");
  });
});

describe("sendEmail — transport choice", () => {
  it("sends over SMTP when Resend is only configured with its sandbox sender", async () => {
    setEnv({
      EMAIL_TRANSPORT: "resend",
      RESEND_API_KEY: "re_live_key",
      RESEND_FROM: "onboarding@resend.dev",
      SMTP_HOST: "smtp.example.com",
      SMTP_USER: "user",
      SMTP_PASS: "pass",
    });

    const sendMail = vi.fn().mockResolvedValue({ messageId: "smtp-1" });
    const createTransport = vi.fn().mockReturnValue({ sendMail });
    const resendSend = vi.fn();
    vi.doMock("nodemailer", () => ({ default: { createTransport } }));
    vi.doMock("resend", () => ({
      Resend: class {
        emails = { send: resendSend };
      },
    }));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const { sendEmailDetailed } = await import("@/lib/email");
    const outcome = await sendEmailDetailed({
      to: "customer@example.com",
      subject: "S",
      html: "<p>h</p>",
      text: "t",
    });

    expect(outcome).toMatchObject({ sent: true, transport: "smtp" });
    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(resendSend).not.toHaveBeenCalled();
    expect(warn.mock.calls.flat().join(" ")).toMatch(/sandbox sender/i);
  });

  it("keeps using Resend when the override names a real sender", async () => {
    setEnv({
      EMAIL_TRANSPORT: "resend",
      RESEND_API_KEY: "re_live_key",
      RESEND_FROM: "Billing <billing@your-domain.com>",
      SMTP_HOST: "smtp.example.com",
    });

    const resendSend = vi.fn().mockResolvedValue({ data: { id: "e1" }, error: null });
    const createTransport = vi.fn();
    vi.doMock("resend", () => ({
      Resend: class {
        emails = { send: resendSend };
      },
    }));
    vi.doMock("nodemailer", () => ({ default: { createTransport } }));

    const { sendEmailDetailed } = await import("@/lib/email");
    const outcome = await sendEmailDetailed({
      to: "customer@example.com",
      subject: "S",
      html: "<p>h</p>",
      text: "t",
    });

    expect(outcome).toMatchObject({ sent: true, transport: "resend" });
    expect(resendSend).toHaveBeenCalledWith(
      expect.objectContaining({ from: "Billing <billing@your-domain.com>" }),
    );
    expect(createTransport).not.toHaveBeenCalled();
  });
});

describe("sendEmail — transient failures are retried, permanent ones are not", () => {
  it("retries a dropped SMTP connection and succeeds on the third attempt", async () => {
    setEnv({ SMTP_HOST: "smtp.example.com", SMTP_USER: "u", SMTP_PASS: "p" });

    const reset = Object.assign(new Error("socket hang up"), { code: "ECONNRESET" });
    const sendMail = vi
      .fn()
      .mockRejectedValueOnce(reset)
      .mockRejectedValueOnce(reset)
      .mockResolvedValue({ messageId: "m3" });
    vi.doMock("nodemailer", () => ({
      default: { createTransport: vi.fn().mockReturnValue({ sendMail }) },
    }));
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});

    const { sendEmailDetailed } = await import("@/lib/email");
    const outcome = await sendEmailDetailed({
      to: "u@example.com",
      subject: "S",
      html: "<p>h</p>",
      text: "t",
    });

    expect(outcome.sent).toBe(true);
    expect(sendMail).toHaveBeenCalledTimes(3);
  });

  it("does not retry a permanent SMTP rejection (5xx)", async () => {
    setEnv({ SMTP_HOST: "smtp.example.com", SMTP_USER: "u", SMTP_PASS: "p" });

    const rejected = Object.assign(new Error("550 mailbox unavailable"), { responseCode: 550 });
    const sendMail = vi.fn().mockRejectedValue(rejected);
    vi.doMock("nodemailer", () => ({
      default: { createTransport: vi.fn().mockReturnValue({ sendMail }) },
    }));

    const { sendEmailDetailed } = await import("@/lib/email");
    await expect(
      sendEmailDetailed({ to: "u@example.com", subject: "S", html: "<p>h</p>", text: "t" }),
    ).rejects.toThrow(/550 mailbox unavailable/);
    expect(sendMail).toHaveBeenCalledTimes(1);
  });

  it("retries a Resend rate limit, then reports the failure outside production", async () => {
    setEnv({ RESEND_API_KEY: "re_live_key", RESEND_FROM: "App <mail@example.com>" });

    const sendMock = vi
      .fn()
      .mockResolvedValue({ data: null, error: { message: "rate_limit_exceeded" } });
    vi.doMock("resend", () => ({
      Resend: class {
        emails = { send: sendMock };
      },
    }));
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});

    const { sendEmailDetailed } = await import("@/lib/email");
    const outcome = await sendEmailDetailed({
      to: "u@example.com",
      subject: "S",
      html: "<p>h</p>",
      text: "t",
    });

    expect(outcome.sent).toBe(false);
    expect(outcome.reason).toMatch(/rate_limit_exceeded/);
    expect(sendMock).toHaveBeenCalledTimes(3);
    expect(errorLog.mock.calls.flat().join(" ")).toMatch(/rate_limit_exceeded/);
  });
});

describe("sendEmail — no mailer configured", () => {
  it("keeps the dev console fallback and reports no transport", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    const { sendEmailDetailed } = await import("@/lib/email");
    const outcome = await sendEmailDetailed({
      to: "u@example.com",
      subject: "S",
      html: "<p>h</p>",
      text: "t",
    });

    expect(outcome).toEqual({ sent: false, transport: "none", reason: "no mailer configured" });
    expect(log).toHaveBeenCalled();
  });
});
