import { describe, expect, it, vi, beforeEach } from "vitest";
import { createHash } from "crypto";

const findUnique = vi.fn();
const create = vi.fn();
const updateMany = vi.fn();
const userUpdate = vi.fn();
const sessionUpdateMany = vi.fn();
const refreshUpdateMany = vi.fn();
const spareDeleteMany = vi.fn();
const transaction = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    accountRecoveryToken: {
      findUnique: (...a: unknown[]) => findUnique(...a),
      create: (...a: unknown[]) => create(...a),
      updateMany: (...a: unknown[]) => updateMany(...a),
    },
    user: { update: (...a: unknown[]) => userUpdate(...a) },
    backupAuthenticator: { deleteMany: (...a: unknown[]) => spareDeleteMany(...a) },
    session: { updateMany: (...a: unknown[]) => sessionUpdateMany(...a) },
    refreshToken: { updateMany: (...a: unknown[]) => refreshUpdateMany(...a) },
    $transaction: (...a: unknown[]) => transaction(...a),
  },
}));

const {
  issueAccountRecoveryToken,
  consumeAccountRecoveryToken,
  resetSecondFactorAndSessions,
  hashIp,
  RECOVERY_TTL_MS,
} = await import("./account-recovery");

const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");

describe("account recovery token store", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    create.mockResolvedValue({ id: "t1" });
    updateMany.mockResolvedValue({ count: 1 });
    // Prisma's array form: the mocked calls already resolved — just await them.
    transaction.mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops));
  });

  it("stores only the hash and supersedes any earlier live link", async () => {
    const { token, expiresAt } = await issueAccountRecoveryToken("user-1", "ip-hash");

    // The plaintext token is returned to the caller but never persisted.
    expect(token).toHaveLength(64);
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-1",
        tokenHash: sha256(token),
        ipHash: "ip-hash",
      }),
    });
    expect(JSON.stringify(create.mock.calls)).not.toContain(`"${token}"`);

    // A second request invalidates the first — two live links must not exist.
    expect(updateMany).toHaveBeenCalledWith({
      where: { userId: "user-1", usedAt: null },
      data: { usedAt: expect.any(Date) },
    });

    expect(expiresAt.getTime() - Date.now()).toBeGreaterThan(RECOVERY_TTL_MS - 5_000);
    expect(expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(RECOVERY_TTL_MS);
  });

  it("claims the token atomically (guarded updateMany), never on trust", async () => {
    findUnique.mockResolvedValue({
      id: "t1",
      userId: "user-1",
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: null,
    });
    updateMany.mockResolvedValue({ count: 1 });

    await expect(consumeAccountRecoveryToken("tok")).resolves.toEqual({
      ok: true,
      userId: "user-1",
    });
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "t1", usedAt: null },
      data: { usedAt: expect.any(Date) },
    });
  });

  it("loses the race when another request claimed it first", async () => {
    // Two clicks, one row: the loser must not disable 2FA a second time.
    findUnique.mockResolvedValue({
      id: "t1",
      userId: "user-1",
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: null,
    });
    updateMany.mockResolvedValue({ count: 0 });

    await expect(consumeAccountRecoveryToken("tok")).resolves.toEqual({
      ok: false,
      error: "USED",
    });
  });

  it("rejects unknown, spent, and expired tokens distinctly", async () => {
    findUnique.mockResolvedValue(null);
    await expect(consumeAccountRecoveryToken("nope")).resolves.toEqual({
      ok: false,
      error: "INVALID",
    });

    findUnique.mockResolvedValue({
      id: "t1",
      userId: "user-1",
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: new Date(),
    });
    await expect(consumeAccountRecoveryToken("tok")).resolves.toEqual({
      ok: false,
      error: "USED",
    });

    findUnique.mockResolvedValue({
      id: "t1",
      userId: "user-1",
      expiresAt: new Date(Date.now() - 1),
      usedAt: null,
    });
    await expect(consumeAccountRecoveryToken("tok")).resolves.toEqual({
      ok: false,
      error: "EXPIRED",
    });

    await expect(consumeAccountRecoveryToken("")).resolves.toEqual({
      ok: false,
      error: "INVALID",
    });
  });

  it("clears the second factor, the codes, and every live session", async () => {
    await resetSecondFactorAndSessions("user-1");

    expect(userUpdate).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: {
        totpEnabled: false,
        totpSecret: null,
        // Cleared with the secret it counts: a fresh secret starts a fresh
        // TOTP step sequence (RFC 6238 §5.2).
        totpLastUsedStep: null,
        // Codes printed for the old authenticator must not survive recovery.
        backupCodes: { deleteMany: {} },
      },
    });
    // The spare device goes too. Inert while 2FA is off, but it would become
    // valid again the moment the owner re-enrolled — handing whoever enrolled
    // it a working second factor on a freshly secured account.
    expect(spareDeleteMany).toHaveBeenCalledWith({ where: { userId: "user-1" } });
    // A recovery means the credentials may be compromised: nothing stays signed in.
    expect(sessionUpdateMany).toHaveBeenCalledWith({
      where: { userId: "user-1", revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    expect(refreshUpdateMany).toHaveBeenCalledWith({
      where: { userId: "user-1", revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it("hashes the requesting IP for the audit trail, and tolerates none", () => {
    expect(hashIp("203.0.113.9")).toBe(sha256("203.0.113.9"));
    expect(hashIp(null)).toBeNull();
  });
});
