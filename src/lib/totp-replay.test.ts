import { describe, expect, it, vi, beforeEach } from "vitest";

const userFindUnique = vi.fn();
const userUpdateMany = vi.fn();
const spareFindUnique = vi.fn();
const spareUpdateMany = vi.fn();
const verifyTotpDetailed = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findUnique: (...a: unknown[]) => userFindUnique(...a),
      updateMany: (...a: unknown[]) => userUpdateMany(...a),
    },
    backupAuthenticator: {
      findUnique: (...a: unknown[]) => spareFindUnique(...a),
      updateMany: (...a: unknown[]) => spareUpdateMany(...a),
    },
  },
}));

vi.mock("@/lib/totp", () => ({
  verifyTotpDetailed: (...a: unknown[]) => verifyTotpDetailed(...a),
}));

const { spendPrimaryTotp, spendBackupTotp } = await import("./totp-replay");

/**
 * RFC 6238 §5.2: a TOTP code is valid for its whole time step, so a code that
 * has been observed can be replayed for the rest of that step. The guard exists
 * to make each code spendable exactly once, per secret.
 */
describe("TOTP replay guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userUpdateMany.mockResolvedValue({ count: 1 });
    spareUpdateMany.mockResolvedValue({ count: 1 });
  });

  describe("primary authenticator", () => {
    it("accepts a fresh step and records it", async () => {
      userFindUnique.mockResolvedValue({ totpSecret: "PRIMARY", totpLastUsedStep: 100 });
      verifyTotpDetailed.mockReturnValue({ valid: true, timeStep: 101, delta: 0 });

      await expect(spendPrimaryTotp("u1", "123456")).resolves.toEqual({
        ok: true,
        timeStep: 101,
      });

      // The stored counter is offered to the verifier so a replayed code can be
      // distinguished from a wrong one.
      expect(verifyTotpDetailed).toHaveBeenCalledWith("123456", "PRIMARY", {
        afterTimeStep: 100,
      });
      expect(userUpdateMany).toHaveBeenCalledWith({
        where: {
          id: "u1",
          OR: [{ totpLastUsedStep: null }, { totpLastUsedStep: { lt: 101 } }],
        },
        data: { totpLastUsedStep: 101 },
      });
    });

    it("reports REPLAY when the code's step has already been spent", async () => {
      userFindUnique.mockResolvedValue({ totpSecret: "PRIMARY", totpLastUsedStep: 100 });
      verifyTotpDetailed.mockReturnValue({ valid: false, reason: "REPLAY" });

      await expect(spendPrimaryTotp("u1", "123456")).resolves.toEqual({
        ok: false,
        reason: "REPLAY",
      });
      // Nothing is written: a refused code must not advance the counter.
      expect(userUpdateMany).not.toHaveBeenCalled();
    });

    it("reports INVALID for a wrong code", async () => {
      userFindUnique.mockResolvedValue({ totpSecret: "PRIMARY", totpLastUsedStep: null });
      verifyTotpDetailed.mockReturnValue({ valid: false, reason: "INVALID" });

      await expect(spendPrimaryTotp("u1", "000000")).resolves.toEqual({
        ok: false,
        reason: "INVALID",
      });
    });

    it("loses the race gracefully when a concurrent request claims the step", async () => {
      // Two requests holding the same code: exactly one may win. The loser sees
      // count 0 and is told REPLAY rather than being let through.
      userFindUnique.mockResolvedValue({ totpSecret: "PRIMARY", totpLastUsedStep: null });
      verifyTotpDetailed.mockReturnValue({ valid: true, timeStep: 500, delta: 0 });
      userUpdateMany.mockResolvedValue({ count: 0 });

      await expect(spendPrimaryTotp("u1", "123456")).resolves.toEqual({
        ok: false,
        reason: "REPLAY",
      });
    });

    it("does not verify at all when no primary secret is enrolled", async () => {
      userFindUnique.mockResolvedValue({ totpSecret: null, totpLastUsedStep: null });

      await expect(spendPrimaryTotp("u1", "123456")).resolves.toEqual({
        ok: false,
        reason: "NOT_ENROLLED",
      });
      expect(verifyTotpDetailed).not.toHaveBeenCalled();
    });
  });

  describe("spare authenticator", () => {
    it("accepts a fresh step and records both the counter and the use", async () => {
      spareFindUnique.mockResolvedValue({ id: "ba-1", secret: "SPARE", lastUsedStep: 7 });
      verifyTotpDetailed.mockReturnValue({ valid: true, timeStep: 8, delta: 0 });

      await expect(spendBackupTotp("u1", "654321")).resolves.toEqual({
        ok: true,
        timeStep: 8,
        id: "ba-1",
      });
      expect(verifyTotpDetailed).toHaveBeenCalledWith("654321", "SPARE", {
        afterTimeStep: 7,
      });
      expect(spareUpdateMany).toHaveBeenCalledWith({
        where: { id: "ba-1", OR: [{ lastUsedStep: null }, { lastUsedStep: { lt: 8 } }] },
        data: { lastUsedStep: 8, lastUsedAt: expect.any(Date) },
      });
    });

    it("keeps the two secrets' counters independent", async () => {
      // Spending a code on the spare must never touch the primary's counter —
      // the phone in your pocket is not the tablet in the drawer.
      spareFindUnique.mockResolvedValue({ id: "ba-1", secret: "SPARE", lastUsedStep: null });
      verifyTotpDetailed.mockReturnValue({ valid: true, timeStep: 9, delta: 0 });

      await spendBackupTotp("u1", "654321");
      expect(userUpdateMany).not.toHaveBeenCalled();
    });

    it("refuses a replayed spare code", async () => {
      spareFindUnique.mockResolvedValue({ id: "ba-1", secret: "SPARE", lastUsedStep: 9 });
      verifyTotpDetailed.mockReturnValue({ valid: false, reason: "REPLAY" });

      await expect(spendBackupTotp("u1", "654321")).resolves.toEqual({
        ok: false,
        reason: "REPLAY",
      });
      expect(spareUpdateMany).not.toHaveBeenCalled();
    });

    it("reports NOT_ENROLLED when there is no spare", async () => {
      spareFindUnique.mockResolvedValue(null);

      await expect(spendBackupTotp("u1", "654321")).resolves.toEqual({
        ok: false,
        reason: "NOT_ENROLLED",
      });
      expect(verifyTotpDetailed).not.toHaveBeenCalled();
    });
  });
});
