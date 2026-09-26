import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * email-outbox.ts — the durable half of mail delivery.
 *
 * The failure this exists for: a ~16s SMTP handshake running inside a signup
 * request was killed by the serverless timeout, so the message vanished while
 * the user was told to check an inbox, and a transient provider error lost the
 * mail permanently because nothing retried it. These tests pin the queue's
 * contract: rows are durable before any transport is touched, transient
 * failures come back for another attempt, permanent ones are recorded once, and
 * a one-time code is re-issued at delivery time instead of being stored.
 */

const db = vi.hoisted(() => ({
  emailOutbox: {
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    findFirst: vi.fn(),
  },
  user: { update: vi.fn() },
}));

const mail = vi.hoisted(() => ({
  sendTemplatedEmail: vi.fn(),
  sendOtpEmail: vi.fn(),
  describeMailConfiguration: vi.fn(() => ({ transport: "smtp", from: "a@b.c", warnings: [] })),
}));

const audit = vi.hoisted(() => ({ logEmailDelivery: vi.fn() }));

vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/email-delivery", () => audit);
vi.mock("@/lib/email", async (importOriginal) => {
  // Keep the real classifier: whether an error is retryable is the behavior
  // under test, not something to fake.
  const actual = await importOriginal<typeof import("@/lib/email")>();
  return { ...actual, ...mail };
});

import {
  drainEmailOutbox,
  emailOutboxHealth,
  enqueueEmail,
  recordNoMailerDelivery,
} from "@/lib/email-outbox";
import { hashOtp } from "@/lib/email-otp";

const now = new Date("2026-09-25T10:00:00.000Z");

function row(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "row-1",
    to: "user@example.com",
    template: "welcome",
    params: { name: "Ada" },
    userId: "user-1",
    tenantId: "tenant-1",
    locale: "en",
    status: "PENDING",
    attempts: 0,
    maxAttempts: 5,
    nextAttemptAt: now,
    claimedAt: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  db.emailOutbox.updateMany.mockResolvedValue({ count: 1 });
  db.emailOutbox.update.mockResolvedValue({});
  db.emailOutbox.findMany.mockResolvedValue([]);
  mail.sendTemplatedEmail.mockResolvedValue({ sent: true });
  mail.sendOtpEmail.mockResolvedValue({ sent: true });
  audit.logEmailDelivery.mockResolvedValue(undefined);
});

describe("recordNoMailerDelivery", () => {
  it("writes a terminal FAILED row the automatic drain can never pick up", async () => {
    db.emailOutbox.create.mockResolvedValue({ id: "row-no-mailer" });

    await recordNoMailerDelivery({
      to: "user@example.com",
      template: "verify_email",
      userId: "user-1",
      tenantId: "tenant-1",
    });

    const data = db.emailOutbox.create.mock.calls[0][0].data;
    expect(data.status).toBe("FAILED");
    expect(data.maxAttempts).toBe(1); // terminal — no retry budget
    expect(data.transport).toBe("none");
    expect(data.lastError).toMatch(/[Nn]o mailer configured/);
  });

  it("never stores a code and stays invisible to the PENDING/SENDING drain", async () => {
    db.emailOutbox.create.mockResolvedValue({ id: "row-no-mailer" });

    await recordNoMailerDelivery({ to: "user@example.com", template: "welcome" });

    const data = db.emailOutbox.create.mock.calls[0][0].data;
    // A one-time code is never stored; the trace row carries no params at all.
    expect(data.params).toBeUndefined();
    // The drain's claim filter is status PENDING/SENDING — a FAILED row can
    // never be claimed, so the stored hash (and the dev-displayed code) is
    // safe from any re-issue.
    expect(data.status).not.toBe("PENDING");
    expect(data.status).not.toBe("SENDING");
  });
});

describe("enqueueEmail", () => {
  it("persists the message before any transport is touched", async () => {
    db.emailOutbox.create.mockResolvedValue({ id: "row-9" });

    const result = await enqueueEmail({
      to: "user@example.com",
      template: "welcome",
      userId: "user-1",
      tenantId: "tenant-1",
      locale: "en",
      params: { name: "Ada" },
    });

    expect(result).toEqual({ id: "row-9" });
    expect(db.emailOutbox.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          to: "user@example.com",
          template: "welcome",
          userId: "user-1",
          // Attribution travels with the row: the drain runs with no session.
          tenantId: "tenant-1",
        }),
      }),
    );
    // The transport is not called from here — delivery happens off the
    // response path (after() in a request, the scheduler otherwise).
    expect(mail.sendTemplatedEmail).not.toHaveBeenCalled();
  });

  it("cancels an older undelivered code so the newest one is the one that verifies", async () => {
    db.emailOutbox.create.mockResolvedValue({ id: "row-10" });

    await enqueueEmail({
      to: "user@example.com",
      template: "verify_email",
      userId: "user-1",
      params: { locale: "en" },
    });

    expect(db.emailOutbox.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "user-1",
          template: "verify_email",
          status: { in: ["PENDING", "SENDING"] },
        }),
        data: { status: "CANCELLED" },
      }),
    );
  });
});

describe("drainEmailOutbox", () => {
  it("marks a delivered message SENT and records it in the audit trail", async () => {
    db.emailOutbox.findMany.mockResolvedValue([row()]);

    const result = await drainEmailOutbox({ now });

    expect(result).toEqual({ sent: 1, retried: 0, failed: 0, skipped: 0 });
    expect(db.emailOutbox.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "row-1" },
        data: expect.objectContaining({ status: "SENT", attempts: 1, transport: "smtp" }),
      }),
    );
    expect(audit.logEmailDelivery).toHaveBeenCalledWith(
      expect.objectContaining({ status: "sent", to: "user@example.com", tenantId: "tenant-1" }),
    );
  });

  it("returns a transiently failed message to PENDING with a backoff", async () => {
    db.emailOutbox.findMany.mockResolvedValue([row()]);
    mail.sendTemplatedEmail.mockRejectedValue(
      Object.assign(new Error("socket hang up"), { code: "ECONNRESET" }),
    );

    const result = await drainEmailOutbox({ now });

    expect(result).toEqual({ sent: 0, retried: 1, failed: 0, skipped: 0 });
    const update = db.emailOutbox.update.mock.calls[0][0];
    expect(update.data.status).toBe("PENDING");
    expect(update.data.attempts).toBe(1);
    expect(update.data.lastError).toMatch(/socket hang up/);
    // Backoff must move forward, or the sweep would hammer the provider.
    expect(update.data.nextAttemptAt.getTime()).toBeGreaterThan(now.getTime());
  });

  it("gives up on a permanent failure instead of burning attempts", async () => {
    db.emailOutbox.findMany.mockResolvedValue([row()]);
    mail.sendTemplatedEmail.mockResolvedValue({
      sent: false,
      transport: "none",
      reason: "no mailer configured",
    });

    const result = await drainEmailOutbox({ now });

    expect(result).toEqual({ sent: 0, retried: 0, failed: 1, skipped: 0 });
    expect(db.emailOutbox.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "FAILED", lastError: "no mailer configured" }),
      }),
    );
    expect(audit.logEmailDelivery).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed", reason: "no mailer configured" }),
    );
  });

  it("fails a transient error once its attempts are exhausted", async () => {
    db.emailOutbox.findMany.mockResolvedValue([row({ attempts: 4, maxAttempts: 5 })]);
    mail.sendTemplatedEmail.mockRejectedValue(
      Object.assign(new Error("ETIMEDOUT"), { code: "ETIMEDOUT" }),
    );

    const result = await drainEmailOutbox({ now });

    expect(result).toEqual({ sent: 0, retried: 0, failed: 1, skipped: 0 });
    expect(db.emailOutbox.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "FAILED", attempts: 5 }),
      }),
    );
  });

  it("re-issues a fresh code at delivery time rather than storing one", async () => {
    db.emailOutbox.findMany.mockResolvedValue([
      row({ template: "verify_email", params: { locale: "en" } }),
    ]);

    await drainEmailOutbox({ now });

    const [template, params] = mail.sendTemplatedEmail.mock.calls[0];
    expect(template).toBe("verify_email");
    const sentCode = params.code as string;
    expect(sentCode).toMatch(/^\d{6}$/);
    const stored = db.user.update.mock.calls[0][0];
    // The stored hash matches the code that actually went out — a queued code
    // can never be stale, because it is generated when it is sent.
    expect(stored.data.emailOtpHash).toBe(hashOtp(sentCode));
    expect(stored.data.emailOtpAttempts).toBe(0);
    expect(db.user.update.mock.calls[0][0].where).toEqual({ id: "user-1" });
  });

  it("fails a code whose user is gone instead of sending an unusable code", async () => {
    db.emailOutbox.findMany.mockResolvedValue([
      row({ template: "verify_email", userId: null, params: {} }),
    ]);

    const result = await drainEmailOutbox({ now });

    expect(result.failed).toBe(1);
    expect(mail.sendTemplatedEmail).not.toHaveBeenCalled();
  });

  it("skips a row another drain already claimed", async () => {
    db.emailOutbox.findMany.mockResolvedValue([row()]);
    db.emailOutbox.updateMany.mockResolvedValue({ count: 0 });

    const result = await drainEmailOutbox({ now });

    expect(result).toEqual({ sent: 0, retried: 0, failed: 0, skipped: 1 });
    expect(mail.sendTemplatedEmail).not.toHaveBeenCalled();
  });

  it("reclaims messages abandoned mid-flight by a killed process", async () => {
    db.emailOutbox.findMany.mockResolvedValue([row({ status: "SENDING", claimedAt: now })]);
    db.emailOutbox.updateMany.mockResolvedValue({ count: 1 });

    const result = await drainEmailOutbox({ now });

    // Anything still SENDING after the lease is treated as abandoned; the
    // fast path and the sweep therefore cannot strand a message between them.
    const selector = db.emailOutbox.findMany.mock.calls[0][0].where;
    expect(JSON.stringify(selector)).toMatch(/SENDING/);
    expect(JSON.stringify(selector)).toMatch(/claimedAt/);
    expect(result.sent).toBe(1);
  });
});

describe("emailOutboxHealth", () => {
  it("surfaces a stuck queue so an operator sees it before a user complains", async () => {
    db.emailOutbox.count
      .mockResolvedValueOnce(3) // pending
      .mockResolvedValueOnce(1) // sending
      .mockResolvedValueOnce(20) // sent
      .mockResolvedValueOnce(2) // failed
      .mockResolvedValueOnce(2); // stuck
    db.emailOutbox.findFirst.mockResolvedValue({ createdAt: now });

    const health = await emailOutboxHealth();

    expect(health).toEqual({
      pending: 3,
      sending: 1,
      sent: 20,
      failed: 2,
      stuck: 2,
      oldestPendingAt: now.toISOString(),
    });
    // "Stuck" is the number worth alerting on: exhausted attempts, or waiting
    // for longer than an hour with nobody draining.
    const stuckQuery = db.emailOutbox.count.mock.calls[4][0].where;
    expect(JSON.stringify(stuckQuery)).toMatch(/FAILED/);
  });
});
