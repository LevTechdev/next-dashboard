import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * recovery-drift.ts — recovery readiness over time.
 *
 * The interesting assertions are the ones about NOT speaking up: the third
 * capture in a day must not alert twice, an improvement must not alert, and
 * switching 2FA off must not be reported as a recovery drop (its own, much
 * louder alert already covers that). A drift alerter that cries wolf on
 * non-drift events is worse than none.
 */

const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn(), findMany: vi.fn() },
  backupAuthenticator: { findUnique: vi.fn() },
  backupCode: { count: vi.fn() },
  webAuthnCredential: { count: vi.fn() },
  recoveryReadinessSnapshot: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    upsert: vi.fn(),
  },
  notification: { findFirst: vi.fn(), create: vi.fn() },
}));

const logSecurityEventMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/security-events", () => ({ logSecurityEvent: logSecurityEventMock }));
vi.mock("server-only", () => ({}));

import {
  captureRecoveryReadiness,
  recoveryFactsForUser,
  recoveryReadinessHistory,
  runRecoveryDriftSweep,
  utcDay,
} from "@/lib/recovery-drift";

/** Account facts → the four mocked reads that feed a capture. */
function facts(opts: {
  totpEnabled?: boolean;
  emailVerified?: Date | null;
  spare?: boolean;
  codes?: number;
  passkeys?: number;
}) {
  prismaMock.user.findUnique.mockResolvedValue({
    totpEnabled: opts.totpEnabled ?? true,
    emailVerified: opts.emailVerified ?? null,
  });
  prismaMock.backupAuthenticator.findUnique.mockResolvedValue(
    opts.spare ? { id: "spare-1" } : null,
  );
  prismaMock.backupCode.count.mockResolvedValue(opts.codes ?? 0);
  prismaMock.webAuthnCredential.count.mockResolvedValue(opts.passkeys ?? 0);
}

const YESTERDAY = utcDay(new Date(Date.now() - 86_400_000));

describe("recovery drift", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.recoveryReadinessSnapshot.upsert.mockResolvedValue({});
    prismaMock.recoveryReadinessSnapshot.findFirst.mockResolvedValue(null);
    prismaMock.notification.findFirst.mockResolvedValue(null);
    prismaMock.notification.create.mockResolvedValue({});
    prismaMock.user.findMany.mockResolvedValue([]);
    facts({});
  });

  it("reads the facts an account's ladder is computed from", async () => {
    facts({ spare: true, codes: 3, passkeys: 2, emailVerified: new Date("2026-01-01") });

    const f = await recoveryFactsForUser("u1");

    expect(f).toMatchObject({
      totpEnabled: true,
      spareEnrolled: true,
      backupRemaining: 3,
      passkeyCount: 2,
    });
    expect(f?.emailVerified).toBe("2026-01-01T00:00:00.000Z");
  });

  it("records the first verdict without alerting", async () => {
    const result = await captureRecoveryReadiness("u1", { now: new Date("2026-09-22T03:00:00Z") });

    expect(result).toMatchObject({ day: "2026-09-22", dropped: false, notified: false });
    expect(prismaMock.recoveryReadinessSnapshot.upsert).toHaveBeenCalledTimes(1);
    expect(prismaMock.notification.create).not.toHaveBeenCalled();
  });

  it("updates today's row instead of appending a second one", async () => {
    await captureRecoveryReadiness("u1");
    await captureRecoveryReadiness("u1");

    const [first, second] = prismaMock.recoveryReadinessSnapshot.upsert.mock.calls;
    expect(first[0].where.userId_day.day).toBe(utcDay());
    expect(second[0].where.userId_day.day).toBe(utcDay());
    // Same key both times — the unique constraint is what makes this a series.
    expect(first[0].where).toEqual(second[0].where);
  });

  it("alerts when a covered account becomes fragile", async () => {
    prismaMock.recoveryReadinessSnapshot.findFirst.mockResolvedValue({ level: "ready" });
    // Spare gone, 5 codes left, no passkey, unverified email → thin.
    facts({ spare: false, codes: 5, passkeys: 0, emailVerified: null });

    const result = await captureRecoveryReadiness("u1");

    expect(result).toMatchObject({
      level: "thin",
      previous: "ready",
      dropped: true,
      notified: true,
    });
    const created = prismaMock.notification.create.mock.calls[0][0].data;
    expect(created.type).toBe("alert");
    expect(created.link).toBe("/security");
    expect(created.title).toBe("Account recovery got weaker");
    expect(created.description).toContain("covered to fragile");
    // The alert names the one thing to fix, not just the bad news.
    expect(created.description).toContain("spare authenticator");
    expect(logSecurityEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u1",
        type: "RECOVERY_READINESS_DROPPED",
        metadata: { from: "ready", to: "thin", nextAction: "addSpare" },
      }),
    );
  });

  it("alerts when the last path back disappears entirely", async () => {
    prismaMock.recoveryReadinessSnapshot.findFirst.mockResolvedValue({ level: "thin" });
    facts({ spare: false, codes: 0, passkeys: 0, emailVerified: null });

    const result = await captureRecoveryReadiness("u1");

    expect(result).toMatchObject({ level: "locked-out", dropped: true });
    const created = prismaMock.notification.create.mock.calls[0][0].data;
    expect(created.description).toContain("fragile to locked out");
    expect(created.description).toContain("no way back into this account");
    expect(created.description).toContain("Verify your email");
  });

  it("does not stack a second alert for the same drop", async () => {
    prismaMock.recoveryReadinessSnapshot.findFirst.mockResolvedValue({ level: "ready" });
    facts({ spare: false, codes: 5 });
    prismaMock.notification.findFirst.mockResolvedValue({ id: "n1" });

    const result = await captureRecoveryReadiness("u1");

    expect(result).toMatchObject({ dropped: true, notified: false });
    expect(prismaMock.notification.create).not.toHaveBeenCalled();
  });

  it("stays silent when readiness improves or holds", async () => {
    prismaMock.recoveryReadinessSnapshot.findFirst.mockResolvedValue({ level: "locked-out" });
    facts({ spare: true, codes: 10, emailVerified: new Date() });

    const result = await captureRecoveryReadiness("u1");

    expect(result).toMatchObject({ level: "ready", previous: "locked-out", dropped: false });
    expect(prismaMock.notification.create).not.toHaveBeenCalled();
  });

  it("keeps 2FA being switched off on its own axis", async () => {
    // Covered yesterday; the owner turned 2FA off today. That is a protection
    // change with its own alert — not a recovery-ladder drop.
    prismaMock.recoveryReadinessSnapshot.findFirst.mockResolvedValue({ level: "ready" });
    facts({ totpEnabled: false, codes: 10, emailVerified: new Date() });

    const result = await captureRecoveryReadiness("u1");

    expect(result).toMatchObject({ level: "unprotected", dropped: false, notified: false });
    expect(prismaMock.notification.create).not.toHaveBeenCalled();
  });

  it("returns null for a user that does not exist", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    expect(await captureRecoveryReadiness("ghost")).toBeNull();
    expect(prismaMock.recoveryReadinessSnapshot.upsert).not.toHaveBeenCalled();
  });

  it("compares the first capture of a day against the newest earlier day", async () => {
    facts({ spare: true, codes: 10, emailVerified: new Date() });

    await captureRecoveryReadiness("u1", { now: new Date("2026-09-22T03:00:00Z") });

    // Today has no row yet, so the baseline is the previous measured day.
    const [today, earlier] = prismaMock.recoveryReadinessSnapshot.findFirst.mock.calls;
    expect(today[0].where).toEqual({ userId: "u1", day: "2026-09-22" });
    expect(earlier[0].where).toEqual({ userId: "u1", day: { lt: "2026-09-22" } });
    expect(earlier[0].orderBy).toEqual({ day: "desc" });
  });

  it("reports a drop the same day it happens, not a day later", async () => {
    // Captured 'ready' this morning, spare deleted this afternoon: the second
    // capture compares against today's own earlier row, so the alert arrives
    // while the user is still at the security settings — not tomorrow.
    prismaMock.recoveryReadinessSnapshot.findFirst.mockResolvedValueOnce({ level: "ready" });
    facts({ spare: false, codes: 3 });

    const result = await captureRecoveryReadiness("u1");

    expect(result).toMatchObject({
      previous: "ready",
      level: "thin",
      dropped: true,
      notified: true,
    });
    // The earlier-day lookup is skipped entirely once today's row answered.
    expect(prismaMock.recoveryReadinessSnapshot.findFirst).toHaveBeenCalledTimes(1);
  });

  it("sweeps every account, counting captures, drops and failures", async () => {
    prismaMock.user.findMany.mockResolvedValue([{ id: "u1" }, { id: "u2" }, { id: "u3" }]);
    // Per-account facts: u1 lost everything (2FA on, no path back → a drop),
    // u2 is unchanged and covered, u3's read throws.
    prismaMock.user.findUnique.mockImplementation(async (args: { where: { id: string } }) => {
      if (args.where.id === "u1") return { totpEnabled: true, emailVerified: null };
      if (args.where.id === "u2") return { totpEnabled: true, emailVerified: new Date() };
      throw new Error("db down");
    });
    prismaMock.recoveryReadinessSnapshot.findFirst.mockResolvedValue({ level: "ready" });
    prismaMock.backupAuthenticator.findUnique.mockImplementation(
      async (args: { where: { userId: string } }) =>
        args.where.userId === "u2" ? { id: "s" } : null,
    );
    prismaMock.backupCode.count.mockImplementation(async (args: { where: { userId: string } }) =>
      args.where.userId === "u2" ? 10 : 0,
    );
    prismaMock.webAuthnCredential.count.mockResolvedValue(0);

    const result = await runRecoveryDriftSweep();

    expect(result).toEqual({ captured: 2, dropped: 1, failed: 1 });
    // The sweep is scoped to accounts whose readiness means something.
    expect(prismaMock.user.findMany.mock.calls[0][0].where).toEqual({
      OR: [{ totpEnabled: true }, { readinessSnapshots: { some: {} } }],
    });
  });

  it("returns the series oldest-first within the window", async () => {
    prismaMock.recoveryReadinessSnapshot.findMany.mockResolvedValue([
      { day: YESTERDAY, level: "thin", availableCount: 1, codesLow: true },
    ]);

    const rows = await recoveryReadinessHistory("u1", 30);

    expect(rows).toEqual([{ day: YESTERDAY, level: "thin", availableCount: 1, codesLow: true }]);
    const args = prismaMock.recoveryReadinessSnapshot.findMany.mock.calls[0][0];
    expect(args.orderBy).toEqual({ day: "asc" });
    expect(args.where.day.gte).toBe(utcDay(new Date(Date.now() - 29 * 86_400_000)));
  });
});
