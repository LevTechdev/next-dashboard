import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHash } from "crypto";

/**
 * Account recovery — the last resort for a user who lost BOTH the authenticator
 * and every backup recovery code.
 *
 * The token store is exercised for real here (only Prisma is mocked), so these
 * tests cover the whole chain: request → emailed single-use link → confirm →
 * 2FA off, codes wiped, sessions revoked, signed in.
 */

const {
  mockPrisma,
  mockVerifyPassword,
  mockSignToken,
  mockLogSecurityEvent,
  mockCheckLoginRateLimit,
  mockSendAccountRecoveryEmail,
  mockSendSecurityAlertEmail,
  mockCreateSession,
  mockCreateRefreshToken,
  mockSetAuthCookies,
  mockRevokeAllTrustedDevices,
} = vi.hoisted(() => {
  const accountRecoveryToken = {
    findUnique: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
  };
  return {
    mockPrisma: {
      user: { findUnique: vi.fn(), update: vi.fn() },
      accountRecoveryToken,
      // The "2FA was turned off" alert mints a single-use revoke token here.
      securityAlertToken: { create: vi.fn(), updateMany: vi.fn() },
      // The recovery also removes the spare authenticator: it is inert while
      // 2FA is off, but it would become valid again on re-enrollment.
      backupAuthenticator: { deleteMany: vi.fn() },
      session: { updateMany: vi.fn() },
      refreshToken: { updateMany: vi.fn() },
      $transaction: vi.fn(),
    },
    mockVerifyPassword: vi.fn(),
    mockSignToken: vi.fn(),
    mockLogSecurityEvent: vi.fn(),
    mockCheckLoginRateLimit: vi.fn(),
    mockSendAccountRecoveryEmail: vi.fn(),
    mockSendSecurityAlertEmail: vi.fn(),
    mockCreateSession: vi.fn(),
    mockCreateRefreshToken: vi.fn(),
    mockSetAuthCookies: vi.fn(),
    mockRevokeAllTrustedDevices: vi.fn(),
  };
});

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/auth", () => ({
  verifyPassword: mockVerifyPassword,
  signToken: mockSignToken,
  hashPassword: vi.fn(),
  needsRehash: vi.fn().mockReturnValue(false),
}));
vi.mock("@/lib/security-events", () => ({ logSecurityEvent: mockLogSecurityEvent }));
vi.mock("@/lib/rate-limit", () => ({
  checkLoginRateLimit: mockCheckLoginRateLimit,
  // The route passes the (E2E-overridable) budget explicitly; a partial mock
  // without this export makes every request 500 instead of throttling.
  loginThrottleLimit: () => 10,
}));
vi.mock("@/lib/request-meta", () => ({
  getRequestMeta: () => ({
    ip: "203.0.113.9",
    userAgent: "vitest",
    device: "test",
    browser: "test",
  }),
}));
vi.mock("@/lib/email", () => ({
  sendAccountRecoveryEmail: mockSendAccountRecoveryEmail,
  sendSecurityAlertEmail: mockSendSecurityAlertEmail,
  sendEmail: vi.fn(),
  sendNewSignInAlert: vi.fn(),
}));
vi.mock("@/lib/sessions", () => ({ createSession: mockCreateSession }));
vi.mock("@/lib/refresh-tokens", () => ({
  newFamilyId: () => "family-1",
  createRefreshToken: mockCreateRefreshToken,
}));
vi.mock("@/lib/auth-cookies", () => ({ setAuthCookies: mockSetAuthCookies }));
vi.mock("@/lib/trusted-devices", () => ({
  revokeAllTrustedDevices: mockRevokeAllTrustedDevices,
}));

const requestRoute = await import("../auth/account-recovery/route");
const confirmRoute = await import("../auth/account-recovery/confirm/route");

const ACTIVE_USER = {
  id: "user-1",
  name: "Recovering User",
  email: "recover@test.com",
  role: "ADMIN",
  password: "$argon2id$hashed",
  tenantId: "tenant-1",
  isActive: true,
  totpEnabled: true,
  totpSecret: "ENCRYPTED-SECRET",
};

const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");

function post(body: unknown): Request {
  return new Request("http://localhost:3010/api/auth/account-recovery", {
    method: "POST",
    headers: { "Content-Type": "application/json", origin: "http://localhost:3010" },
    body: JSON.stringify(body),
  });
}

function confirm(token?: string) {
  const url = `http://localhost:3010/api/auth/account-recovery/confirm${
    token ? `?token=${token}&locale=en` : ""
  }`;
  return confirmRoute.GET(new Request(url));
}

describe("POST /api/auth/account-recovery (request)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckLoginRateLimit.mockResolvedValue({
      allowed: true,
      attempts: 1,
      limit: 10,
      retryAfterSeconds: 0,
    });
    mockVerifyPassword.mockResolvedValue(true);
    mockPrisma.user.findUnique.mockResolvedValue(ACTIVE_USER);
    mockPrisma.accountRecoveryToken.create.mockResolvedValue({ id: "t1" });
    mockPrisma.accountRecoveryToken.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.$transaction.mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops));
    mockSendAccountRecoveryEmail.mockResolvedValue({ sent: true });
  });

  it("requires both email and password", async () => {
    expect((await requestRoute.POST(post({ email: "a@test.com" }))).status).toBe(400);
    expect((await requestRoute.POST(post({ password: "pw" }))).status).toBe(400);
  });

  it("mails a single-use link and audits the request", async () => {
    const res = await requestRoute.POST(post({ email: ACTIVE_USER.email, password: "pw" }));
    expect(res.status).toBe(200);

    expect(mockSendAccountRecoveryEmail).toHaveBeenCalledTimes(1);
    const sent = mockSendAccountRecoveryEmail.mock.calls[0][0];
    expect(sent.to).toBe(ACTIVE_USER.email);
    expect(sent.url).toContain("/api/auth/account-recovery/confirm?token=");

    // Only the hash of the emailed token is stored.
    const token = new URL(sent.url).searchParams.get("token")!;
    expect(token).toHaveLength(64);
    expect(mockPrisma.accountRecoveryToken.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: "user-1", tokenHash: sha256(token) }),
    });

    expect(mockLogSecurityEvent).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-1", type: "ACCOUNT_RECOVERY_REQUESTED" }),
    );
  });

  it("answers identically for unknown, inactive, and wrong-password accounts", async () => {
    // No enumeration: the response must not reveal whether the account exists,
    // is active, or even has 2FA enabled.
    mockPrisma.user.findUnique.mockResolvedValue(null);
    const unknown = await requestRoute.POST(post({ email: "nobody@test.com", password: "pw" }));

    mockPrisma.user.findUnique.mockResolvedValue({ ...ACTIVE_USER, isActive: false });
    const inactive = await requestRoute.POST(post({ email: ACTIVE_USER.email, password: "pw" }));

    mockPrisma.user.findUnique.mockResolvedValue(ACTIVE_USER);
    mockVerifyPassword.mockResolvedValue(false);
    const wrongPw = await requestRoute.POST(post({ email: ACTIVE_USER.email, password: "nope" }));

    for (const res of [unknown, inactive, wrongPw]) {
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ success: true });
    }
    // …and no link is ever minted for them.
    expect(mockSendAccountRecoveryEmail).not.toHaveBeenCalled();
    expect(mockPrisma.accountRecoveryToken.create).not.toHaveBeenCalled();
  });

  it("refuses a wrong password before touching the token table", async () => {
    mockVerifyPassword.mockResolvedValue(false);
    await requestRoute.POST(post({ email: ACTIVE_USER.email, password: "nope" }));
    expect(mockPrisma.accountRecoveryToken.create).not.toHaveBeenCalled();
  });

  it("throttles like the login endpoint (it checks a password)", async () => {
    mockCheckLoginRateLimit.mockResolvedValueOnce({
      allowed: false,
      attempts: 11,
      limit: 10,
      retryAfterSeconds: 90,
    });
    const res = await requestRoute.POST(post({ email: ACTIVE_USER.email, password: "pw" }));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("90");
    expect(mockSendAccountRecoveryEmail).not.toHaveBeenCalled();
  });
});

describe("GET /api/auth/account-recovery/confirm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.accountRecoveryToken.findUnique.mockResolvedValue({
      id: "t1",
      userId: "user-1",
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: null,
    });
    mockPrisma.accountRecoveryToken.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.securityAlertToken.create.mockResolvedValue({ id: "sa-1" });
    mockPrisma.securityAlertToken.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.user.findUnique.mockResolvedValue(ACTIVE_USER);
    mockPrisma.user.update.mockResolvedValue(ACTIVE_USER);
    mockPrisma.session.updateMany.mockResolvedValue({ count: 2 });
    mockPrisma.refreshToken.updateMany.mockResolvedValue({ count: 2 });
    mockSendSecurityAlertEmail.mockResolvedValue({ sent: true });
    mockPrisma.$transaction.mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops));
    mockSignToken.mockReturnValue("recovered-access-token");
    mockCreateSession.mockResolvedValue("sess-1");
    mockCreateRefreshToken.mockResolvedValue("refresh-1");
    mockRevokeAllTrustedDevices.mockResolvedValue(1);
  });

  it("disables 2FA, wipes codes, revokes sessions, audits, and signs in", async () => {
    const res = await confirm("token-value");

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/en/security?recovered=1");
    expect(mockSetAuthCookies).toHaveBeenCalledWith(res, "recovered-access-token", "refresh-1");

    // The point of the whole flow.
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: expect.objectContaining({
        totpEnabled: false,
        totpSecret: null,
        backupCodes: { deleteMany: {} },
      }),
    });
    // Nothing that was already signed in may survive a recovery.
    expect(mockPrisma.session.updateMany).toHaveBeenCalled();
    expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalled();
    expect(mockRevokeAllTrustedDevices).toHaveBeenCalledWith("user-1");
    // …including the "skip 2FA" device grants.

    expect(mockLogSecurityEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "ACCOUNT_RECOVERY_COMPLETED" }),
    );
    expect(mockLogSecurityEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "TOTP_DISABLED", metadata: { via: "account_recovery" } }),
    );
  });

  it("emails the owner a 'this wasn't me' link when 2FA went off", async () => {
    await confirm("token-value");

    expect(mockSendSecurityAlertEmail).toHaveBeenCalledTimes(1);
    const sent = mockSendSecurityAlertEmail.mock.calls[0][0];
    expect(sent.to).toBe(ACTIVE_USER.email);
    expect(sent.locale).toBe("en");
    // The CONFIRMATION PAGE, not the revoke action — a mailbox scanner that
    // fetches this URL must not be able to spend the single-use token.
    expect(sent.revokeUrl).toContain("/en/security-alert?token=");
    expect(sent.revokeUrl).not.toContain("/api/auth/security-alert/revoke");

    // Only the hash of the link's token is stored, and older links are superseded.
    const token = new URL(sent.revokeUrl).searchParams.get("token")!;
    expect(token).toHaveLength(64);
    expect(mockPrisma.securityAlertToken.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: "user-1", tokenHash: sha256(token) }),
    });
    expect(mockLogSecurityEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "SECURITY_ALERT_SENT" }),
    );
  });

  it("does not alert when the recovery had no 2FA to turn off", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ ...ACTIVE_USER, totpEnabled: false });
    await confirm("token-value");

    // Nothing was disabled, so there is nothing to warn about — and no revoke
    // link should exist that could lock the owner out for no reason.
    expect(mockSendSecurityAlertEmail).not.toHaveBeenCalled();
    expect(mockPrisma.securityAlertToken.create).not.toHaveBeenCalled();
  });

  it("completes the recovery even when the alert cannot be sent", async () => {
    mockSendSecurityAlertEmail.mockRejectedValue(new Error("mailer down"));
    const res = await confirm("token-value");

    // The recovery already happened; a mail failure must not turn it into an error.
    expect(res.headers.get("location")).toContain("/en/security?recovered=1");
    expect(mockSetAuthCookies).toHaveBeenCalled();
  });

  it("is single-use: a second click cannot disable 2FA again", async () => {
    mockPrisma.accountRecoveryToken.updateMany.mockResolvedValueOnce({ count: 0 });

    const res = await confirm("token-value");
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/en/login?recovery=invalid");
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
    expect(mockSetAuthCookies).not.toHaveBeenCalled();
  });

  it("sends unknown and expired links back to the login form with a reason", async () => {
    mockPrisma.accountRecoveryToken.findUnique.mockResolvedValueOnce(null);
    const invalid = await confirm("nope");
    expect(invalid.headers.get("location")).toContain("/en/login?recovery=invalid");

    mockPrisma.accountRecoveryToken.findUnique.mockResolvedValueOnce({
      id: "t1",
      userId: "user-1",
      expiresAt: new Date(Date.now() - 1),
      usedAt: null,
    });
    const expired = await confirm("stale");
    expect(expired.headers.get("location")).toContain("/en/login?recovery=expired");
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it("does not sign in a deactivated account", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ ...ACTIVE_USER, isActive: false });
    const res = await confirm("token-value");
    expect(res.headers.get("location")).toContain("/en/login?recovery=invalid");
    expect(mockSetAuthCookies).not.toHaveBeenCalled();
  });
});
