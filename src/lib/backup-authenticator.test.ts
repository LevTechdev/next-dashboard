import { describe, expect, it, vi, beforeEach } from "vitest";

const findUnique = vi.fn();
const upsert = vi.fn();
const deleteMany = vi.fn();
const verifyTotp = vi.fn();
const generateTotpSecret = vi.fn();
const totpKeyUri = vi.fn();
const spendBackupTotp = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    backupAuthenticator: {
      findUnique: (...a: unknown[]) => findUnique(...a),
      upsert: (...a: unknown[]) => upsert(...a),
      // `update` is gone: recording a use now happens inside the replay guard's
      // atomic claim (src/lib/totp-replay.ts), which this file mocks.
      deleteMany: (...a: unknown[]) => deleteMany(...a),
    },
  },
}));

vi.mock("@/lib/totp", () => ({
  verifyTotp: (...a: unknown[]) => verifyTotp(...a),
  generateTotpSecret: (...a: unknown[]) => generateTotpSecret(...a),
  totpKeyUri: (...a: unknown[]) => totpKeyUri(...a),
}));

// Verification against the spare goes through the shared single-use guard
// (RFC 6238 §5.2), so this file tests the delegation and the guard itself is
// covered in totp-replay.test.ts.
vi.mock("@/lib/totp-replay", () => ({
  spendBackupTotp: (...a: unknown[]) => spendBackupTotp(...a),
}));

const {
  confirmBackupAuthenticator,
  getBackupAuthenticatorStatus,
  normalizeLabel,
  offerBackupAuthenticator,
  removeBackupAuthenticator,
  verifyBackupAuthenticator,
} = await import("./backup-authenticator");

/**
 * The spare authenticator: a second TOTP secret accepted at the same login
 * step as the primary one, so losing the phone that holds the primary secret
 * never escalates to a recovery that turns 2FA off.
 */
describe("backup authenticator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    generateTotpSecret.mockResolvedValue("SPARESECRET234567");
    totpKeyUri.mockReturnValue("otpauth://totp/Dashboard:user@test.com?secret=SPARESECRET234567");
    verifyTotp.mockReturnValue(true);
    upsert.mockResolvedValue({ id: "ba-1" });
    deleteMany.mockResolvedValue({ count: 1 });
    spendBackupTotp.mockResolvedValue({ ok: true, timeStep: 100, id: "ba-1" });
  });

  it("offers a secret without persisting anything", async () => {
    const offer = await offerBackupAuthenticator({ email: "user@test.com", label: "office iPad" });

    expect(offer.secret).toBe("SPARESECRET234567");
    expect(offer.otpauth).toContain("otpauth://totp/");
    expect(offer.label).toBe("office iPad");
    // Enrollment is two-step: an abandoned scan must leave nothing behind.
    expect(upsert).not.toHaveBeenCalled();
  });

  it("trims and bounds the device label, and treats blank as none", () => {
    expect(normalizeLabel("  iPad  ")).toBe("iPad");
    expect(normalizeLabel("   ")).toBeNull();
    expect(normalizeLabel(undefined)).toBeNull();
    expect(normalizeLabel(123)).toBeNull();
    expect(normalizeLabel("x".repeat(200))).toHaveLength(60);
  });

  it("persists only after a code generated from the offered secret verifies", async () => {
    verifyTotp.mockReturnValueOnce(false);
    await expect(
      confirmBackupAuthenticator({ userId: "u1", secret: "S", token: "123456" }),
    ).resolves.toEqual({ ok: false, error: "INVALID_CODE" });
    expect(verifyTotp).toHaveBeenCalledWith("123456", "S");
    expect(upsert).not.toHaveBeenCalled();

    verifyTotp.mockReturnValueOnce(true);
    await expect(
      confirmBackupAuthenticator({ userId: "u1", secret: "S", token: "123456", label: "iPad" }),
    ).resolves.toEqual({ ok: true });
    expect(upsert).toHaveBeenCalledWith({
      where: { userId: "u1" },
      create: { userId: "u1", secret: "S", label: "iPad" },
      // A new secret starts a fresh TOTP step sequence, so the replay counter
      // is cleared with it.
      update: { secret: "S", label: "iPad", lastUsedAt: null, lastUsedStep: null },
    });
  });

  it("rejects a missing secret or a short code outright", async () => {
    await expect(
      confirmBackupAuthenticator({ userId: "u1", secret: "", token: "123456" }),
    ).resolves.toEqual({ ok: false, error: "INVALID_SECRET" });
    await expect(
      confirmBackupAuthenticator({ userId: "u1", secret: "S", token: "12" }),
    ).resolves.toEqual({ ok: false, error: "INVALID_CODE" });
    expect(verifyTotp).not.toHaveBeenCalled();
  });

  it("never exposes the secret in the status payload", async () => {
    findUnique.mockResolvedValue({
      secret: "SPARESECRET234567",
      label: "iPad",
      createdAt: new Date("2026-09-01T00:00:00.000Z"),
      lastUsedAt: null,
    });
    const status = await getBackupAuthenticatorStatus("u1");
    expect(status).toEqual({
      enrolled: true,
      label: "iPad",
      createdAt: "2026-09-01T00:00:00.000Z",
      lastUsedAt: null,
      usable: true,
    });
    expect(JSON.stringify(status)).not.toContain("SPARESECRET");
  });

  it("reports not-enrolled when there is no spare", async () => {
    findUnique.mockResolvedValue(null);
    await expect(getBackupAuthenticatorStatus("u1")).resolves.toEqual({
      enrolled: false,
      label: null,
      createdAt: null,
      lastUsedAt: null,
      usable: false,
    });
  });

  it("spends a login code through the single-use guard", async () => {
    await expect(verifyBackupAuthenticator("u1", "654321")).resolves.toEqual({
      ok: true,
      id: "ba-1",
    });
    expect(spendBackupTotp).toHaveBeenCalledWith("u1", "654321");
  });

  it("fails closed when there is no spare, no token, or the guard refuses", async () => {
    spendBackupTotp.mockResolvedValueOnce({ ok: false, reason: "NOT_ENROLLED" });
    await expect(verifyBackupAuthenticator("u1", "654321")).resolves.toEqual({ ok: false });

    // An empty token never reaches the database at all.
    await expect(verifyBackupAuthenticator("u1", "")).resolves.toEqual({ ok: false });
    expect(spendBackupTotp).toHaveBeenCalledTimes(1);

    spendBackupTotp.mockResolvedValueOnce({ ok: false, reason: "INVALID" });
    await expect(verifyBackupAuthenticator("u1", "000000")).resolves.toEqual({ ok: false });

    // A replayed spare code is a refusal too — the caller only learns ok/false.
    spendBackupTotp.mockResolvedValueOnce({ ok: false, reason: "REPLAY" });
    await expect(verifyBackupAuthenticator("u1", "654321")).resolves.toEqual({ ok: false });
  });

  it("treats a successful spend with no row id as a failure", async () => {
    // Defensive: the ok branch promises an id, and callers use it as evidence
    // of which device rescued the account.
    spendBackupTotp.mockResolvedValueOnce({ ok: true, timeStep: 100 });
    await expect(verifyBackupAuthenticator("u1", "654321")).resolves.toEqual({ ok: false });
  });

  it("removes idempotently", async () => {
    await removeBackupAuthenticator("u1");
    expect(deleteMany).toHaveBeenCalledWith({ where: { userId: "u1" } });
  });
});
