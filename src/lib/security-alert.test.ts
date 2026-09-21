import { describe, expect, it, vi, beforeEach } from "vitest";
import { createHash } from "crypto";

const findUnique = vi.fn();
const create = vi.fn();
const updateMany = vi.fn();
const userUpdate = vi.fn();
const sessionUpdateMany = vi.fn();
const refreshUpdateMany = vi.fn();
const transaction = vi.fn();
const revokeAllTrustedDevices = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    securityAlertToken: {
      findUnique: (...a: unknown[]) => findUnique(...a),
      create: (...a: unknown[]) => create(...a),
      updateMany: (...a: unknown[]) => updateMany(...a),
    },
    user: { update: (...a: unknown[]) => userUpdate(...a) },
    session: { updateMany: (...a: unknown[]) => sessionUpdateMany(...a) },
    refreshToken: { updateMany: (...a: unknown[]) => refreshUpdateMany(...a) },
    $transaction: (...a: unknown[]) => transaction(...a),
  },
}));

vi.mock("@/lib/trusted-devices", () => ({
  revokeAllTrustedDevices: (...a: unknown[]) => revokeAllTrustedDevices(...a),
}));

const {
  issueSecurityAlertToken,
  consumeSecurityAlertToken,
  revokeAfterSecurityAlert,
  SECURITY_ALERT_TTL_MS,
  ALERT_RESET_TTL_MS,
} = await import("./security-alert");

const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");

/**
 * The alert that fires when a recovery turns 2FA off, and the one-click revoke
 * behind it. The revoke has to do more than sign sessions out — the attacker
 * used the account password, so sign-in must stay shut until it is replaced.
 */
describe("security alert token store", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    create.mockResolvedValue({ id: "a1" });
    updateMany.mockResolvedValue({ count: 1 });
    transaction.mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops));
    sessionUpdateMany.mockResolvedValue({ count: 3 });
    refreshUpdateMany.mockResolvedValue({ count: 3 });
    userUpdate.mockResolvedValue({ id: "user-1" });
    revokeAllTrustedDevices.mockResolvedValue(2);
  });

  it("stores only the hash, supersedes older links, and expires in a week", async () => {
    const { token, expiresAt } = await issueSecurityAlertToken("user-1", "RECOVERY_2FA_DISABLED");

    expect(token).toHaveLength(64);
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-1",
        kind: "RECOVERY_2FA_DISABLED",
        tokenHash: sha256(token),
      }),
    });
    expect(JSON.stringify(create.mock.calls)).not.toContain(`"${token}"`);
    expect(updateMany).toHaveBeenCalledWith({
      where: { userId: "user-1", usedAt: null },
      data: { usedAt: expect.any(Date) },
    });

    const window = expiresAt.getTime() - Date.now();
    expect(window).toBeGreaterThan(SECURITY_ALERT_TTL_MS - 5_000);
    expect(window).toBeLessThanOrEqual(SECURITY_ALERT_TTL_MS);
  });

  it("claims a link once, atomically", async () => {
    findUnique.mockResolvedValue({
      id: "a1",
      userId: "user-1",
      kind: "RECOVERY_2FA_DISABLED",
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: null,
    });
    await expect(consumeSecurityAlertToken("tok")).resolves.toEqual({
      ok: true,
      userId: "user-1",
      kind: "RECOVERY_2FA_DISABLED",
    });
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "a1", usedAt: null },
      data: { usedAt: expect.any(Date) },
    });

    // A second (scanner-prefetch + human click) cannot both count as the revoke.
    updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(consumeSecurityAlertToken("tok")).resolves.toEqual({
      ok: false,
      error: "USED",
    });
  });

  it("rejects unknown, spent, expired, and empty tokens", async () => {
    findUnique.mockResolvedValue(null);
    await expect(consumeSecurityAlertToken("nope")).resolves.toEqual({
      ok: false,
      error: "INVALID",
    });

    findUnique.mockResolvedValue({
      id: "a1",
      userId: "user-1",
      kind: "k",
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: new Date(),
    });
    await expect(consumeSecurityAlertToken("tok")).resolves.toEqual({ ok: false, error: "USED" });

    findUnique.mockResolvedValue({
      id: "a1",
      userId: "user-1",
      kind: "k",
      expiresAt: new Date(Date.now() - 1),
      usedAt: null,
    });
    await expect(consumeSecurityAlertToken("tok")).resolves.toEqual({
      ok: false,
      error: "EXPIRED",
    });

    await expect(consumeSecurityAlertToken("")).resolves.toEqual({ ok: false, error: "INVALID" });
  });

  it("evicts every session and holds sign-in shut until the password changes", async () => {
    const { sessionsRevoked, resetToken } = await revokeAfterSecurityAlert("user-1");

    expect(sessionsRevoked).toBe(3);
    expect(sessionUpdateMany).toHaveBeenCalledWith({
      where: { userId: "user-1", revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    expect(refreshUpdateMany).toHaveBeenCalled();
    // Sessions alone are not enough: the attacker knows this password.
    expect(userUpdate).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: {
        passwordResetRequired: true,
        verificationToken: resetToken,
        verificationTokenExpires: expect.any(Date),
      },
    });
    // A stale "skip 2FA on this device" grant must not outlive the revoke.
    expect(revokeAllTrustedDevices).toHaveBeenCalledWith("user-1");

    expect(resetToken).toHaveLength(64);
    const resetWindow =
      userUpdate.mock.calls[0][0].data.verificationTokenExpires.getTime() - Date.now();
    expect(resetWindow).toBeGreaterThan(ALERT_RESET_TTL_MS - 5_000);
  });
});
