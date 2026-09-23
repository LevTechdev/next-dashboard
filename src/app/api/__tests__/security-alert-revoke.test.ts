import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHash } from "crypto";

/**
 * The alert that fires when a recovery turns 2FA off, and the "This wasn't me"
 * action behind it — now split in two so the link survives mailbox scanners:
 *
 *   GET  /api/auth/security-alert          → peek: is this link still usable?
 *   POST /api/auth/security-alert/revoke   → claim it and secure the account
 *
 * The token store and the lockdown run for real (only Prisma is mocked). The
 * property that matters most is asserted below: fetching (or re-fetching) the
 * page must NOT consume the single use, and only the POST may.
 */

const { mockPrisma, mockLogSecurityEvent, mockClearAuthCookies, mockRevokeAllTrustedDevices } =
  vi.hoisted(() => ({
    mockPrisma: {
      securityAlertToken: { findUnique: vi.fn(), updateMany: vi.fn() },
      user: { findUnique: vi.fn(), update: vi.fn() },
      session: { updateMany: vi.fn() },
      refreshToken: { updateMany: vi.fn() },
      $transaction: vi.fn(),
    },
    mockLogSecurityEvent: vi.fn(),
    mockClearAuthCookies: vi.fn(),
    mockRevokeAllTrustedDevices: vi.fn(),
  }));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/security-events", () => ({ logSecurityEvent: mockLogSecurityEvent }));
vi.mock("@/lib/auth-cookies", () => ({ clearAuthCookies: mockClearAuthCookies }));
vi.mock("@/lib/trusted-devices", () => ({
  revokeAllTrustedDevices: mockRevokeAllTrustedDevices,
}));

const peekRoute = await import("../auth/security-alert/route");
const revokeRoute = await import("../auth/security-alert/revoke/route");

const USER = { id: "user-1", email: "user@test.com", tenantId: "tenant-1" };
const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");

function peek(token?: string) {
  const query = token ? `?token=${token}` : "";
  return peekRoute.GET(new Request(`http://localhost:3010/api/auth/security-alert${query}`));
}

function revoke(body: unknown) {
  return revokeRoute.POST(
    new Request("http://localhost:3010/api/auth/security-alert/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

describe("GET /api/auth/security-alert (peek)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.securityAlertToken.findUnique.mockResolvedValue({
      kind: "RECOVERY_2FA_DISABLED",
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: null,
    });
  });

  it("reports a usable link without claiming it", async () => {
    const res = await peek("live-token");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      valid: true,
      state: "VALID",
      kind: "RECOVERY_2FA_DISABLED",
    });

    // The whole point: fetching the page must not spend the link.
    expect(mockPrisma.securityAlertToken.updateMany).not.toHaveBeenCalled();
    expect(mockPrisma.securityAlertToken.findUnique).toHaveBeenCalledWith({
      where: { tokenHash: sha256("live-token") },
      select: { kind: true, expiresAt: true, usedAt: true },
    });
  });

  it("survives repeated fetches — a scanner cannot exhaust it for the owner", async () => {
    for (let i = 0; i < 3; i++) {
      expect(await (await peek("live-token")).json()).toMatchObject({ valid: true });
    }
    expect(mockPrisma.securityAlertToken.updateMany).not.toHaveBeenCalled();
  });

  it("names the reason a link is unusable", async () => {
    mockPrisma.securityAlertToken.findUnique.mockResolvedValueOnce(null);
    expect(await (await peek("unknown")).json()).toMatchObject({ valid: false, state: "INVALID" });

    mockPrisma.securityAlertToken.findUnique.mockResolvedValueOnce({
      kind: "k",
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: new Date(),
    });
    expect(await (await peek("spent")).json()).toMatchObject({ valid: false, state: "USED" });

    mockPrisma.securityAlertToken.findUnique.mockResolvedValueOnce({
      kind: "k",
      expiresAt: new Date(Date.now() - 1),
      usedAt: null,
    });
    expect(await (await peek("stale")).json()).toMatchObject({ valid: false, state: "EXPIRED" });
  });

  it("leaks no identifiers", async () => {
    const body = await (await peek("live-token")).json();
    expect(JSON.stringify(body)).not.toContain("user-1");
  });
});

describe("POST /api/auth/security-alert/revoke", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.securityAlertToken.findUnique.mockResolvedValue({
      id: "a1",
      userId: "user-1",
      kind: "RECOVERY_2FA_DISABLED",
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: null,
    });
    mockPrisma.securityAlertToken.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.user.findUnique.mockResolvedValue(USER);
    mockPrisma.user.update.mockResolvedValue(USER);
    mockPrisma.session.updateMany.mockResolvedValue({ count: 3 });
    mockPrisma.refreshToken.updateMany.mockResolvedValue({ count: 3 });
    mockPrisma.$transaction.mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops));
    mockRevokeAllTrustedDevices.mockResolvedValue(2);
  });

  it("claims the link once, stores only its hash, and secures the account", async () => {
    const res = await revoke({ token: "clicked-token", locale: "en" });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.secured).toBe(true);
    expect(body.sessionsRevoked).toBe(3);
    expect(body.resetUrl).toContain("/en/reset-password?token=");
    // The reset page shows the "your account was secured" notice off this flag.
    expect(body.resetUrl).toContain("alert=reverted");

    expect(mockPrisma.securityAlertToken.findUnique).toHaveBeenCalledWith({
      where: { tokenHash: sha256("clicked-token") },
      select: expect.anything(),
    });
    // Claimed atomically — guarded on the row still being unused.
    expect(mockPrisma.securityAlertToken.updateMany).toHaveBeenCalledWith({
      where: { id: "a1", usedAt: null },
      data: { usedAt: expect.any(Date) },
    });

    expect(mockPrisma.session.updateMany).toHaveBeenCalledWith({
      where: { userId: "user-1", revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalled();
    expect(mockRevokeAllTrustedDevices).toHaveBeenCalledWith("user-1");
    // The password is what the attacker still knows.
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: expect.objectContaining({ passwordResetRequired: true }),
    });
    expect(mockLogSecurityEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "SECURITY_ALERT_REVERTED",
        metadata: { kind: "RECOVERY_2FA_DISABLED", sessionsRevoked: 3 },
      }),
    );
    // The dead session cookie goes with the revoked session.
    expect(mockClearAuthCookies).toHaveBeenCalled();
  });

  it("hands over a reset link the standard reset endpoint accepts", async () => {
    await revoke({ token: "clicked-token" });
    const data = mockPrisma.user.update.mock.calls[0][0].data;
    expect(data.verificationToken).toHaveLength(64);
    expect(data.verificationTokenExpires.getTime()).toBeGreaterThan(Date.now());
  });

  it("is single-use: a replayed POST is refused and changes nothing", async () => {
    mockPrisma.securityAlertToken.updateMany.mockResolvedValueOnce({ count: 0 });

    const res = await revoke({ token: "clicked-token" });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "USED", secured: false });
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
    expect(mockPrisma.session.updateMany).not.toHaveBeenCalled();
  });

  it("refuses unknown, expired, and empty tokens with their reason", async () => {
    mockPrisma.securityAlertToken.findUnique.mockResolvedValueOnce(null);
    expect(await (await revoke({ token: "nope" })).json()).toMatchObject({ error: "INVALID" });

    mockPrisma.securityAlertToken.findUnique.mockResolvedValueOnce({
      id: "a1",
      userId: "user-1",
      kind: "k",
      expiresAt: new Date(Date.now() - 1),
      usedAt: null,
    });
    expect(await (await revoke({ token: "stale" })).json()).toMatchObject({ error: "EXPIRED" });

    expect(await (await revoke({})).json()).toMatchObject({ error: "INVALID" });
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it("refuses to lock down a user that no longer exists", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce(null);
    const res = await revoke({ token: "clicked-token" });
    expect(res.status).toBe(400);
    expect(mockPrisma.session.updateMany).not.toHaveBeenCalled();
  });

  it("keeps a bogus locale out of the reset URL", async () => {
    const res = await revoke({ token: "clicked-token", locale: "../evil" });
    expect((await res.json()).resetUrl).toContain("/en/reset-password");
  });
});
