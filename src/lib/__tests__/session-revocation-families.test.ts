import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Session revocation must kill the revoked devices' refresh-token FAMILIES.
 *
 * The re-entry bug: revoking a Session row left its refresh-token family
 * alive, so the revoked device's still-valid refresh cookie minted a fresh
 * (Session-less) access token and walked right back past the revocation
 * check — the exact path revokeAllRefreshTokens exists to close on the
 * everywhere path. Per-device revoke and revoke-others had the same hole,
 * and neither cleared the durable stay-login grant. All three paths now
 * revoke the families and wipe stayLoginUntil with them.
 */
const mockPrisma = {
  session: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    updateMany: vi.fn(async () => ({ count: 1 })),
  },
  refreshToken: {
    updateMany: vi.fn(async () => ({ count: 2 })),
  },
};

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/auth", () => ({ hashToken: (t: string) => `hashed-${t}` }));

const { revokeSession, revokeOtherSessions, revokeAllSessions } = await import("@/lib/sessions");

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.session.updateMany.mockResolvedValue({ count: 1 });
  mockPrisma.refreshToken.updateMany.mockResolvedValue({ count: 2 });
});

describe("session revocation kills refresh families", () => {
  it("revokeSession revokes the session's family and clears its stay grant", async () => {
    mockPrisma.session.findFirst.mockResolvedValueOnce({ familyId: "fam-1" });

    const ok = await revokeSession("user-1", "sess-1");

    expect(ok).toBe(true);
    expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { familyId: { in: ["fam-1"] }, revokedAt: null },
      data: { revokedAt: expect.any(Date), stayLoginUntil: null },
    });
  });

  it("revokeSession with no live session touches no family", async () => {
    mockPrisma.session.findFirst.mockResolvedValueOnce(null);

    const ok = await revokeSession("user-1", "sess-ghost");

    expect(ok).toBe(false);
    expect(mockPrisma.refreshToken.updateMany).not.toHaveBeenCalled();
  });

  it("revokeOtherSessions revokes every other device's family, not mine", async () => {
    mockPrisma.session.findMany.mockResolvedValueOnce([
      { familyId: "fam-a" },
      { familyId: "fam-b" },
      { familyId: null }, // legacy session without a family
    ]);

    const count = await revokeOtherSessions("user-1", "current-token");

    expect(count).toBe(1);
    // Deduped, nulls dropped, current token excluded from the where clause.
    expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { familyId: { in: ["fam-a", "fam-b"] }, revokedAt: null },
      data: { revokedAt: expect.any(Date), stayLoginUntil: null },
    });
    expect(mockPrisma.session.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tokenHash: { not: "hashed-current-token" },
        }),
      }),
    );
  });

  it("revokeAllSessions revokes every family including the caller's", async () => {
    mockPrisma.session.findMany.mockResolvedValueOnce([{ familyId: "fam-a" }]);

    await revokeAllSessions("user-1");

    expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { familyId: { in: ["fam-a"] }, revokedAt: null },
      data: { revokedAt: expect.any(Date), stayLoginUntil: null },
    });
  });

  it("handles sessions without families (no family revoke call is a no-op)", async () => {
    mockPrisma.session.findMany.mockResolvedValueOnce([{ familyId: null }, { familyId: null }]);

    await revokeAllSessions("user-1");

    // All-null → no ids → the family revoke is skipped entirely.
    expect(mockPrisma.refreshToken.updateMany).not.toHaveBeenCalled();
  });
});
