import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * /api/auth/totp/backup — the spare authenticator.
 *
 * The route is exercised against the real library (only Prisma, the session
 * guard, and TOTP verification are mocked), so these tests cover the wiring:
 * offer → confirm → status → remove, plus the refusals that keep enrollment
 * honest.
 */

const {
  mockPrisma,
  mockRequireAuth,
  mockResolveSessionUserId,
  mockLogSecurityEvent,
  mockVerifyTotp,
  mockGenerateTotpSecret,
  mockTotpKeyUri,
  mockQrCode,
} = vi.hoisted(() => ({
  mockPrisma: {
    user: { findUnique: vi.fn() },
    backupCode: { count: vi.fn() },
    backupAuthenticator: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
  mockRequireAuth: vi.fn(),
  mockResolveSessionUserId: vi.fn(),
  mockLogSecurityEvent: vi.fn(),
  mockVerifyTotp: vi.fn(),
  mockGenerateTotpSecret: vi.fn(),
  mockTotpKeyUri: vi.fn(),
  mockQrCode: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/api-guard", () => ({ requireAuth: mockRequireAuth }));
vi.mock("@/lib/session-user", () => ({ resolveSessionUserId: mockResolveSessionUserId }));
vi.mock("@/lib/security-events", () => ({ logSecurityEvent: mockLogSecurityEvent }));
vi.mock("@/lib/totp", () => ({
  verifyTotp: mockVerifyTotp,
  generateTotpSecret: mockGenerateTotpSecret,
  totpKeyUri: mockTotpKeyUri,
}));
vi.mock("qrcode", () => ({ default: { toDataURL: mockQrCode } }));

const route = await import("../auth/totp/backup/route");

const USER = { id: "user-1", email: "user@test.com", tenantId: "tenant-1" };

function req(method: string, body?: unknown, query = ""): Request {
  return new Request(`http://localhost:3010/api/auth/totp/backup${query}`, {
    method,
    ...(body
      ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
      : {}),
  });
}

describe("/api/auth/totp/backup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue({
      session: { user: { id: "user-1", email: USER.email } },
      response: null,
    });
    mockResolveSessionUserId.mockResolvedValue("user-1");
    mockPrisma.user.findUnique.mockResolvedValue(USER);
    mockGenerateTotpSecret.mockResolvedValue("SPARESECRET234567");
    mockTotpKeyUri.mockReturnValue("otpauth://totp/Dashboard:user@test.com?secret=SPARESECRET");
    mockQrCode.mockResolvedValue("data:image/png;base64,AAA");
    mockVerifyTotp.mockReturnValue(true);
    mockPrisma.backupAuthenticator.upsert.mockResolvedValue({ id: "ba-1" });
    mockPrisma.backupAuthenticator.deleteMany.mockResolvedValue({ count: 1 });
    // Default: a well-covered account (2FA on, codes in hand, email verified),
    // so removing the spare is harmless and needs no acknowledgement.
    mockPrisma.backupCode.count.mockResolvedValue(10);
    mockPrisma.user.findUnique.mockResolvedValue({
      ...USER,
      totpEnabled: true,
      emailVerified: new Date("2026-09-01T00:00:00.000Z"),
      _count: { webauthnCredentials: 0 },
    });
  });

  it("returns 401 without a session, for every method", async () => {
    const denied = new Response("nope", { status: 401 });
    mockRequireAuth.mockResolvedValue({ session: null, response: denied });

    for (const res of [
      await route.GET(req("GET")),
      await route.POST(req("POST", { secret: "S", token: "123456" })),
      await route.DELETE(req("DELETE")),
    ]) {
      expect(res.status).toBe(401);
    }
  });

  it("reports enrollment status without a secret", async () => {
    mockPrisma.backupAuthenticator.findUnique.mockResolvedValue({
      secret: "SPARESECRET234567",
      label: "office iPad",
      createdAt: new Date("2026-09-01T00:00:00.000Z"),
      lastUsedAt: null,
    });

    const res = await route.GET(req("GET"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      enrolled: true,
      label: "office iPad",
      createdAt: "2026-09-01T00:00:00.000Z",
      lastUsedAt: null,
      usable: true,
    });
    expect(JSON.stringify(body)).not.toContain("SPARESECRET");
  });

  it("offers a QR + secret on request, persisting nothing", async () => {
    const res = await route.GET(req("GET", undefined, "?offer=1&label=Tablet"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      secret: "SPARESECRET234567",
      otpauth: "otpauth://totp/Dashboard:user@test.com?secret=SPARESECRET",
      qrCode: "data:image/png;base64,AAA",
      label: "Tablet",
    });
    expect(mockPrisma.backupAuthenticator.upsert).not.toHaveBeenCalled();
  });

  it("persists only after a live code verifies, and audits it", async () => {
    mockPrisma.backupAuthenticator.findUnique.mockResolvedValueOnce({ label: "iPad" });

    const res = await route.POST(
      req("POST", { secret: "SPARE", token: " 123456 ", label: "iPad" }),
    );
    expect(res.status).toBe(200);
    expect(mockVerifyTotp).toHaveBeenCalledWith("123456", "SPARE");
    expect(mockPrisma.backupAuthenticator.upsert).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      create: { userId: "user-1", secret: "SPARE", label: "iPad" },
      update: { secret: "SPARE", label: "iPad", lastUsedAt: null, lastUsedStep: null },
    });
    expect(mockLogSecurityEvent).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-1", type: "BACKUP_AUTHENTICATOR_ADDED" }),
    );
  });

  it("rejects a wrong code without storing anything", async () => {
    mockVerifyTotp.mockReturnValueOnce(false);
    const res = await route.POST(req("POST", { secret: "SPARE", token: "000000" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ code: "INVALID_CODE" });
    expect(mockPrisma.backupAuthenticator.upsert).not.toHaveBeenCalled();
    expect(mockLogSecurityEvent).not.toHaveBeenCalled();
  });

  it("rejects a missing secret", async () => {
    const res = await route.POST(req("POST", { token: "123456" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ code: "INVALID_SECRET" });
  });

  it("removes the spare and audits the removal", async () => {
    // Three lookups: the exists check, the acknowledgement assessment, and the
    // post-removal status — which must read as gone.
    mockPrisma.backupAuthenticator.findUnique
      .mockResolvedValueOnce({ id: "ba-1" })
      .mockResolvedValueOnce({ id: "ba-1" })
      .mockResolvedValueOnce(null);

    const res = await route.DELETE(req("DELETE"));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ enrolled: false });
    expect(mockPrisma.backupAuthenticator.deleteMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
    });
    expect(mockLogSecurityEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "BACKUP_AUTHENTICATOR_REMOVED" }),
    );
  });

  it("removing when nothing is enrolled is a no-op, not an audit trail", async () => {
    mockPrisma.backupAuthenticator.findUnique.mockResolvedValue(null);
    const res = await route.DELETE(req("DELETE"));
    expect(res.status).toBe(200);
    expect(mockLogSecurityEvent).not.toHaveBeenCalled();
  });

  /**
   * The acknowledgement gate. The client shows a warning and a checkbox, but a
   * client is not an enforcement point — without a server-side refusal, the
   * guard would be decoration that any direct DELETE could skip.
   */
  describe("refuses to remove the last way back in without acknowledgement", () => {
    /** 2FA on, no codes, no passkey, no verified email: the spare is it. */
    const lastResortAccount = () => {
      mockPrisma.backupAuthenticator.findUnique.mockResolvedValue({ id: "ba-1" });
      mockPrisma.user.findUnique.mockResolvedValue({
        ...USER,
        totpEnabled: true,
        emailVerified: null,
        _count: { webauthnCredentials: 0 },
      });
      mockPrisma.backupCode.count.mockResolvedValue(0);
    };

    it("returns 428 and leaves the row alone", async () => {
      lastResortAccount();

      const res = await route.DELETE(req("DELETE"));

      expect(res.status).toBe(428);
      expect(await res.json()).toMatchObject({
        code: "RECOVERY_ACKNOWLEDGEMENT_REQUIRED",
        after: "locked-out",
      });
      expect(mockPrisma.backupAuthenticator.deleteMany).not.toHaveBeenCalled();
      expect(mockLogSecurityEvent).not.toHaveBeenCalled();
    });

    it("proceeds once the caller acknowledges", async () => {
      lastResortAccount();
      mockPrisma.backupAuthenticator.findUnique
        .mockResolvedValueOnce({ id: "ba-1" })
        .mockResolvedValueOnce(null);

      const res = await route.DELETE(req("DELETE", undefined, "?acknowledge=1"));

      expect(res.status).toBe(200);
      expect(mockPrisma.backupAuthenticator.deleteMany).toHaveBeenCalledWith({
        where: { userId: "user-1" },
      });
    });

    it("does not gate a removal that a deeper path already covers", async () => {
      lastResortAccount();
      // A verified email is a real route back in (an emailed sign-in code), so
      // the removal downgrades the ladder rather than closing it.
      mockPrisma.user.findUnique.mockResolvedValue({
        ...USER,
        totpEnabled: true,
        emailVerified: new Date("2026-09-01T00:00:00.000Z"),
        _count: { webauthnCredentials: 0 },
      });
      mockPrisma.backupAuthenticator.findUnique
        .mockResolvedValueOnce({ id: "ba-1" })
        .mockResolvedValueOnce(null);

      const res = await route.DELETE(req("DELETE"));
      expect(res.status).toBe(200);
    });

    it("does not gate when something is still enrolled that could get you in", async () => {
      lastResortAccount();
      // Recovery codes in hand.
      mockPrisma.backupCode.count.mockResolvedValue(4);
      mockPrisma.backupAuthenticator.findUnique
        .mockResolvedValueOnce({ id: "ba-1" })
        .mockResolvedValueOnce(null);

      const res = await route.DELETE(req("DELETE"));
      expect(res.status).toBe(200);
    });
  });
});
