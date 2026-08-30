import { describe, it, expect, vi, beforeEach } from "vitest";

// ═══════════════════════════════════════════════════════════════════════════
// Hoisted mocks
// ═══════════════════════════════════════════════════════════════════════════

const {
  mockPrisma,
  mockVerifyPassword,
  mockHashPassword,
  mockNeedsRehash,
  mockSignToken,
  mockVerifyToken,
  mockHashToken,
  mockGetTokenFromRequest,
  mockGetTokenFromCookie,
  mockVerifyTotp,
  mockGenerateTotpSecret,
  mockCreateSession,
  mockListActiveSessions,
  mockRevokeOtherSessions,
  mockNewFamilyId,
  mockCreateRefreshToken,
  mockGetFamilyForToken,
  mockRevokeFamily,
  mockRotateRefreshToken,
  mockRotateSessionAccessToken,
  mockRegenerateBackupCodes,
  mockCountUnusedBackupCodes,
  mockSignStepUpToken,
  mockSetAuthCookies,
  mockClearAuthCookies,
  mockConsumeBackupCode,
  mockLogSecurityEvent,
  mockIsPasswordBreached,
  mockIssueEmailOtp,
  mockIsDevFallbackAllowed,
  mockRequireAuth,
  mockQrCode,
  mockSendPasswordResetEmail,
  mockListSecurityEvents,
  mockRevokeSession,
  mockResolveConnectionByEmail,
  mockResolveConnectionByTenantSlug,
  mockBuildSaml,
  mockVerifyOtp,
  mockIsOtpExpired,
} = vi.hoisted(() => {
  const model = <T extends Record<string, unknown>>(overrides: Partial<T> = {}) =>
    new Proxy<T>({} as T, {
      get(_, prop) {
        const key = String(prop);
        return (overrides as any)[key] ?? vi.fn().mockImplementation(() => Promise.resolve(null));
      },
    });

  const deepModel = <T extends Record<string, unknown>>(overrides: Partial<T> = {}) =>
    model({
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      findFirst: vi.fn().mockResolvedValue(null),
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({}),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
      aggregate: vi.fn().mockResolvedValue({ _sum: {}, _count: 0 }),
      ...overrides,
    });

  return {
    mockPrisma: {
      user: deepModel({
        findUnique: vi.fn().mockResolvedValue(null),
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi
          .fn()
          .mockImplementation(({ data }) => Promise.resolve({ id: "user-new", ...data })),
        update: vi
          .fn()
          .mockImplementation(({ where, data }) =>
            Promise.resolve({ id: where?.id || "user-1", ...data }),
          ),
      }),
      session: deepModel({
        create: vi.fn().mockResolvedValue({ id: "sess-1" }),
        findMany: vi.fn().mockResolvedValue([]),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      }),
      refreshToken: deepModel({
        create: vi.fn().mockResolvedValue({ id: "rt-1" }),
        findUnique: vi.fn().mockResolvedValue(null),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      }),
      tenant: deepModel({
        findUnique: vi.fn().mockResolvedValue({ id: "tenant-1", slug: "default" }),
      }),
      activityLog: deepModel({}),
      securityEvent: deepModel({}),
      backupCode: deepModel({}),
      ssoConnection: deepModel({
        findUnique: vi.fn().mockResolvedValue(null),
        upsert: vi
          .fn()
          .mockImplementation(({ create }: any) => Promise.resolve({ id: "conn-1", ...create })),
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      }),
      auditLog: deepModel({}),
      $transaction: vi
        .fn()
        .mockImplementation((fns: any[]) =>
          Promise.all(fns.map((fn) => (typeof fn === "function" ? fn({}) : fn))),
        ),
    },

    mockVerifyPassword: vi.fn().mockResolvedValue(true),
    mockHashPassword: vi.fn().mockResolvedValue("$argon2id$v=19$m=19456,t=2,p=1$hashed"),
    mockNeedsRehash: vi.fn().mockReturnValue(false),
    mockSignToken: vi.fn().mockReturnValue("jwt-token-xxx"),
    mockVerifyToken: vi.fn().mockReturnValue({
      id: "user-1",
      name: "Admin",
      email: "a@test.com",
      role: "ADMIN",
      tenantId: "tenant-1",
    }),
    mockHashToken: vi.fn().mockReturnValue("hashed-token"),
    mockGetTokenFromRequest: vi.fn().mockReturnValue(null),
    mockGetTokenFromCookie: vi.fn().mockReturnValue(null),
    mockVerifyTotp: vi.fn().mockReturnValue(true),
    mockGenerateTotpSecret: vi.fn().mockResolvedValue("JBSWY3DPEHPK3PXP"),
    mockCreateSession: vi.fn().mockResolvedValue("sess-1"),
    mockListActiveSessions: vi.fn().mockResolvedValue([
      {
        id: "sess-1",
        ip: "127.0.0.1",
        browser: "Chrome",
        device: "Windows",
        location: null,
        lastActiveAt: new Date(),
        createdAt: new Date(),
        tokenHash: "hashed-token",
      },
    ]),
    mockRevokeOtherSessions: vi.fn().mockResolvedValue(2),
    mockNewFamilyId: vi.fn().mockReturnValue("family-1"),
    mockCreateRefreshToken: vi.fn().mockResolvedValue("refresh-token-xxx"),
    mockGetFamilyForToken: vi.fn().mockResolvedValue("family-1"),
    mockRotateRefreshToken: vi.fn().mockResolvedValue({
      status: "ok",
      userId: "user-1",
      familyId: "family-1",
      sessionId: "sess-1",
      token: "new-refresh-token",
    }),
    mockRotateSessionAccessToken: vi.fn().mockResolvedValue(undefined),
    mockRegenerateBackupCodes: vi
      .fn()
      .mockResolvedValue([
        "aaaa-bbbb",
        "cccc-dddd",
        "eeee-ffff",
        "gggg-hhhh",
        "iiii-jjjj",
        "kkkk-llll",
        "mmmm-nnnn",
        "oooo-pppp",
        "qqqq-rrrr",
        "ssss-tttt",
      ]),
    mockCountUnusedBackupCodes: vi.fn().mockResolvedValue(7),
    mockSignStepUpToken: vi.fn().mockReturnValue("step-up-token-xxx"),
    mockRevokeFamily: vi.fn().mockResolvedValue(undefined),
    mockSetAuthCookies: vi.fn(),
    mockClearAuthCookies: vi.fn(),
    mockConsumeBackupCode: vi.fn().mockResolvedValue(false),
    mockLogSecurityEvent: vi.fn().mockResolvedValue(undefined),
    mockIsPasswordBreached: vi.fn().mockResolvedValue(false),
    mockIssueEmailOtp: vi.fn().mockResolvedValue({ sent: true, code: "123456" }),
    mockIsDevFallbackAllowed: vi.fn().mockReturnValue(true),
    mockRequireAuth: vi.fn().mockResolvedValue({
      session: {
        user: {
          id: "user-1",
          sub: "user-1",
          name: "Admin",
          email: "a@test.com",
          role: "ADMIN",
          tenantId: "tenant-1",
        },
      },
      response: null,
    }),
    mockQrCode: { toDataURL: vi.fn().mockResolvedValue("data:image/png;base64,qrplaceholder") },
    mockSendPasswordResetEmail: vi.fn().mockResolvedValue({ sent: true }),
    mockListSecurityEvents: vi.fn().mockResolvedValue([]),
    mockRevokeSession: vi.fn().mockResolvedValue(true),
    mockResolveConnectionByEmail: vi.fn().mockResolvedValue(null),
    mockResolveConnectionByTenantSlug: vi.fn().mockResolvedValue(null),
    mockBuildSaml: vi.fn().mockReturnValue({
      validatePostResponseAsync: vi.fn().mockResolvedValue({ profile: null }),
      getAuthorizeUrlAsync: vi.fn().mockResolvedValue("https://idp.example.com/sso"),
      generateServiceProviderMetadata: vi.fn().mockReturnValue("<xml/>"),
    }),
    mockVerifyOtp: vi.fn().mockReturnValue(false),
    mockIsOtpExpired: vi.fn().mockReturnValue(false),
  };
});

// ═══════════════════════════════════════════════════════════════════════════
// Module mocks
// ═══════════════════════════════════════════════════════════════════════════

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));

vi.mock("@/lib/auth", () => ({
  verifyPassword: mockVerifyPassword,
  hashPassword: mockHashPassword,
  needsRehash: mockNeedsRehash,
  signToken: mockSignToken,
  verifyToken: mockVerifyToken,
  hashToken: mockHashToken,
  getTokenFromRequest: mockGetTokenFromRequest,
  getTokenFromCookie: mockGetTokenFromCookie,
  ACCESS_COOKIE: "token",
  REFRESH_COOKIE: "refresh_token",
}));

vi.mock("@/lib/totp", () => ({
  verifyTotp: mockVerifyTotp,
  generateTotpSecret: mockGenerateTotpSecret,
  totpKeyUri: (p: any) => `otpauth://totp/${p.issuer}:${p.email}?secret=${p.secret}`,
}));

vi.mock("@/lib/sessions", () => ({
  createSession: mockCreateSession,
  listActiveSessions: mockListActiveSessions,
  revokeOtherSessions: mockRevokeOtherSessions,
  rotateSessionAccessToken: mockRotateSessionAccessToken,
  revokeSession: mockRevokeSession,
}));

vi.mock("@/lib/refresh-tokens", () => ({
  newFamilyId: mockNewFamilyId,
  createRefreshToken: mockCreateRefreshToken,
  getFamilyForToken: mockGetFamilyForToken,
  revokeFamily: mockRevokeFamily,
  rotateRefreshToken: mockRotateRefreshToken,
}));

vi.mock("@/lib/auth-cookies", () => ({
  setAuthCookies: mockSetAuthCookies,
  clearAuthCookies: mockClearAuthCookies,
}));

vi.mock("@/lib/backup-codes", () => ({
  consumeBackupCode: mockConsumeBackupCode,
  regenerateBackupCodes: mockRegenerateBackupCodes,
  countUnusedBackupCodes: mockCountUnusedBackupCodes,
}));

vi.mock("@/lib/security-events", () => ({
  logSecurityEvent: mockLogSecurityEvent,
  listSecurityEvents: mockListSecurityEvents,
}));

vi.mock("@/lib/hibp", () => ({
  isPasswordBreached: mockIsPasswordBreached,
  getPwnedCount: vi.fn().mockResolvedValue(0),
}));

vi.mock("@/lib/email-verification", () => ({
  issueEmailOtp: mockIssueEmailOtp,
  isDevFallbackAllowed: mockIsDevFallbackAllowed,
  sanitizeVerifyEmailRedirect: (v: string | null) => v || "security",
}));

vi.mock("@/lib/email-otp", () => ({
  verifyOtp: mockVerifyOtp,
  isOtpExpired: mockIsOtpExpired,
  MAX_OTP_ATTEMPTS: 5,
}));

vi.mock("@/lib/saml", () => ({
  buildSaml: mockBuildSaml,
  resolveConnectionByEmail: mockResolveConnectionByEmail,
  resolveConnectionByTenantSlug: mockResolveConnectionByTenantSlug,
  profileToIdentity: (p: any) => ({ email: p?.email, name: p?.name }),
  getOrigin: () => "http://localhost:3000",
}));

vi.mock("@/lib/tenancy", () => ({
  getTenantId: (s: any) => s?.user?.tenantId,
  effectiveTenantId: async (s: any) => s?.user?.tenantId || "tenant-1",
  tenantWhere: () => ({}),
}));

vi.mock("@/lib/api-guard", () => ({
  requireAuth: mockRequireAuth,
  requirePermission: vi.fn().mockResolvedValue({ role: "ADMIN", response: null }),
}));

vi.mock("qrcode", () => ({ default: mockQrCode }));

vi.mock("@/lib/email", () => ({
  sendPasswordResetEmail: mockSendPasswordResetEmail,
  sendEmail: vi.fn().mockResolvedValue({ sent: true }),
}));

vi.mock("@/lib/step-up", () => ({
  signStepUpToken: mockSignStepUpToken,
  verifyStepUpToken: vi.fn().mockReturnValue(true),
  STEP_UP_COOKIE: "step_up",
  getStepUpToken: vi.fn().mockReturnValue("step-up-token"),
}));

vi.mock("@/lib/request-meta", () => ({
  getRequestMeta: () => ({
    ip: "127.0.0.1",
    userAgent: "Mozilla/5.0",
    browser: "Chrome",
    device: "Windows",
  }),
  getClientIp: () => "127.0.0.1",
  parseUserAgent: () => ({ browser: "Chrome", device: "Windows" }),
}));

// ═══════════════════════════════════════════════════════════════════════════
// Imports under test
// ═══════════════════════════════════════════════════════════════════════════

import * as loginRoutes from "../auth/login/route";
import * as registerRoutes from "../auth/register/route";
import * as meRoutes from "../auth/me/route";
import * as logoutRoutes from "../auth/logout/route";
import * as sessionsRoutes from "../auth/sessions/route";
import * as totpSetupRoutes from "../auth/totp/setup/route";
import * as totpVerifyRoutes from "../auth/totp/verify/route";
import * as totpDisableRoutes from "../auth/totp/disable/route";
import * as refreshRoutes from "../auth/refresh/route";
import * as backupCodesRoutes from "../auth/backup-codes/route";
import * as stepUpRoutes from "../auth/step-up/route";
import * as forgotPasswordRoutes from "../auth/forgot-password/route";
import * as resetPasswordRoutes from "../auth/reset-password/route";
import * as securityEventsRoutes from "../auth/security-events/route";
import * as sessionByIdRoutes from "../auth/sessions/[id]/route";
import * as verifyEmailOtpRoutes from "../auth/verify-email/otp/route";
import * as verifyEmailSendRoutes from "../auth/verify-email/send/route";
import * as verifyEmailConfirmRoutes from "../auth/verify-email/confirm/route";
import * as googleRoutes from "../auth/google/route";
import * as samlLoginRoutes from "../auth/saml/login/route";
import * as samlAcsRoutes from "../auth/saml/acs/route";

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

function post(body?: unknown, cookie?: string): Request {
  return {
    json: () => Promise.resolve(body ?? {}),
    url: "http://localhost:3000/api/auth/test",
    headers: {
      get: (name: string) => {
        if (name === "cookie" && cookie) return cookie;
        if (name === "user-agent") return "Mozilla/5.0";
        if (name === "x-forwarded-for") return "127.0.0.1";
        return null;
      },
    },
  } as unknown as Request;
}

function get(cookie?: string): Request {
  return {
    url: "http://localhost:3000/api/auth/test",
    headers: {
      get: (name: string) => {
        if (name === "cookie" && cookie) return cookie;
        if (name === "user-agent") return "Mozilla/5.0";
        if (name === "x-forwarded-for") return "127.0.0.1";
        return null;
      },
    },
  } as unknown as Request;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockVerifyPassword.mockResolvedValue(true);
  mockHashPassword.mockResolvedValue("$argon2id$v=19$m=19456,t=2,p=1$hashed");
  mockNeedsRehash.mockReturnValue(false);
  mockSignToken.mockReturnValue("jwt-token-xxx");
  mockVerifyToken.mockReturnValue({
    id: "user-1",
    name: "Admin",
    email: "a@test.com",
    role: "ADMIN",
    tenantId: "tenant-1",
  });
  mockGetTokenFromRequest.mockReturnValue(null);
  mockGetTokenFromCookie.mockReturnValue(null);
  mockVerifyTotp.mockReturnValue(true);
  mockIsPasswordBreached.mockResolvedValue(false);
  mockIsDevFallbackAllowed.mockReturnValue(true);
  mockRequireAuth.mockResolvedValue({
    session: {
      user: {
        id: "user-1",
        sub: "user-1",
        name: "Admin",
        email: "a@test.com",
        role: "ADMIN",
        tenantId: "tenant-1",
      },
    },
    response: null,
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Login
// ═══════════════════════════════════════════════════════════════════════════

describe("Login", () => {
  const mockUser = {
    id: "user-1",
    name: "Admin",
    email: "a@test.com",
    password: "$argon2id$v=19$m=19456,t=2,p=1$hashed",
    role: "ADMIN",
    isActive: true,
    totpEnabled: false,
    totpSecret: null,
    tenantId: "tenant-1",
    failedLoginCount: 0,
    lockedUntil: null,
  };

  beforeEach(() => {
    mockPrisma.user.findUnique.mockResolvedValue(mockUser);
  });

  describe("POST", () => {
    it("returns 400 when email missing", async () => {
      const res = await loginRoutes.POST(post({ password: "pass" }));
      expect(res.status).toBe(400);
    });

    it("returns 400 when password missing", async () => {
      const res = await loginRoutes.POST(post({ email: "a@test.com" }));
      expect(res.status).toBe(400);
    });

    it("returns 401 when user not found", async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);
      const res = await loginRoutes.POST(post({ email: "unknown@test.com", password: "pass" }));
      expect(res.status).toBe(401);
    });

    it("returns 403 when account is deactivated", async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({ ...mockUser, isActive: false });
      const res = await loginRoutes.POST(post({ email: "a@test.com", password: "pass" }));
      expect(res.status).toBe(403);
    });

    it("returns 423 when account is locked", async () => {
      const futureDate = new Date(Date.now() + 15 * 60000);
      mockPrisma.user.findUnique.mockResolvedValueOnce({ ...mockUser, lockedUntil: futureDate });
      const res = await loginRoutes.POST(post({ email: "a@test.com", password: "pass" }));
      expect(res.status).toBe(423);
    });

    it("returns 401 on wrong password and increments failed count", async () => {
      mockVerifyPassword.mockResolvedValueOnce(false);
      const res = await loginRoutes.POST(post({ email: "a@test.com", password: "wrong" }));
      expect(res.status).toBe(401);
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ failedLoginCount: 1 }),
        }),
      );
    });

    it("locks account after 5 failed attempts", async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({ ...mockUser, failedLoginCount: 4 });
      mockVerifyPassword.mockResolvedValueOnce(false);
      const res = await loginRoutes.POST(post({ email: "a@test.com", password: "wrong" }));
      expect(res.status).toBe(401);
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ failedLoginCount: 0, lockedUntil: expect.any(Date) }),
        }),
      );
    });

    it("returns 200 with requires2FA when TOTP is enabled but no code provided", async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        ...mockUser,
        totpEnabled: true,
        totpSecret: "SECRET",
      });
      const res = await loginRoutes.POST(post({ email: "a@test.com", password: "pass" }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.requires2FA).toBe(true);
    });

    it("returns 401 when TOTP code is invalid", async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        ...mockUser,
        totpEnabled: true,
        totpSecret: "SECRET",
      });
      mockVerifyTotp.mockReturnValueOnce(false);
      const res = await loginRoutes.POST(
        post({ email: "a@test.com", password: "pass", totpToken: "000000" }),
      );
      expect(res.status).toBe(401);
    });

    it("succeeds with valid TOTP code", async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        ...mockUser,
        totpEnabled: true,
        totpSecret: "SECRET",
      });
      const res = await loginRoutes.POST(
        post({ email: "a@test.com", password: "pass", totpToken: "123456" }),
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.token).toBe("jwt-token-xxx");
      expect(body.message).toBe("Login successful");
    });

    it("succeeds with valid backup code when TOTP fails", async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        ...mockUser,
        totpEnabled: true,
        totpSecret: "SECRET",
      });
      mockVerifyTotp.mockReturnValueOnce(false);
      mockConsumeBackupCode.mockResolvedValueOnce(true);
      const res = await loginRoutes.POST(
        post({
          email: "a@test.com",
          password: "pass",
          totpToken: "000000",
          backupCode: "abcd-1234",
        }),
      );
      expect(res.status).toBe(200);
    });

    it("creates session and refresh token on successful login", async () => {
      await loginRoutes.POST(post({ email: "a@test.com", password: "pass" }));
      expect(mockCreateSession).toHaveBeenCalled();
      expect(mockCreateRefreshToken).toHaveBeenCalled();
      expect(mockSetAuthCookies).toHaveBeenCalled();
    });

    it("rehashes password when needsRehash is true", async () => {
      mockNeedsRehash.mockReturnValueOnce(true);
      await loginRoutes.POST(post({ email: "a@test.com", password: "pass" }));
      expect(mockHashPassword).toHaveBeenCalledWith("pass");
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            password: expect.stringContaining("$argon2id"),
            passwordAlgo: "argon2id",
          }),
        }),
      );
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Register
// ═══════════════════════════════════════════════════════════════════════════

describe("Register", () => {
  beforeEach(() => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.tenant.findUnique.mockResolvedValue({ id: "tenant-1", slug: "default" });
  });

  describe("POST", () => {
    it("returns 400 when name missing", async () => {
      const res = await registerRoutes.POST(post({ email: "a@test.com", password: "pass123" }));
      expect(res.status).toBe(400);
    });

    it("returns 400 when email missing", async () => {
      const res = await registerRoutes.POST(post({ name: "Admin", password: "pass123" }));
      expect(res.status).toBe(400);
    });

    it("returns 400 when password missing", async () => {
      const res = await registerRoutes.POST(post({ name: "Admin", email: "a@test.com" }));
      expect(res.status).toBe(400);
    });

    it("returns 400 when password too short", async () => {
      const res = await registerRoutes.POST(
        post({ name: "Admin", email: "a@test.com", password: "ab" }),
      );
      expect(res.status).toBe(400);
    });

    it("returns 400 when email format is invalid", async () => {
      const res = await registerRoutes.POST(
        post({ name: "Admin", email: "notanemail", password: "pass123" }),
      );
      expect(res.status).toBe(400);
    });

    it("returns 400 when password is breached", async () => {
      mockIsPasswordBreached.mockResolvedValueOnce(true);
      const res = await registerRoutes.POST(
        post({ name: "Admin", email: "a@test.com", password: "password123" }),
      );
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("breach");
    });

    it("returns 409 when email already exists", async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({ id: "existing", email: "a@test.com" });
      const res = await registerRoutes.POST(
        post({ name: "Admin", email: "a@test.com", password: "pass123" }),
      );
      expect(res.status).toBe(409);
    });

    it("creates user and returns token on success", async () => {
      const res = await registerRoutes.POST(
        post({ name: "Admin", email: "a@test.com", password: "pass123" }),
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.token).toBe("jwt-token-xxx");
      expect(body.message).toBe("Account created successfully");
      expect(body.emailOtpRequired).toBe(true);
      expect(mockPrisma.user.create).toHaveBeenCalled();
    });

    it("creates session, refresh token, and activity log", async () => {
      await registerRoutes.POST(post({ name: "Admin", email: "a@test.com", password: "pass123" }));
      expect(mockCreateSession).toHaveBeenCalled();
      expect(mockCreateRefreshToken).toHaveBeenCalled();
      expect(mockSetAuthCookies).toHaveBeenCalled();
      expect(mockPrisma.activityLog.create).toHaveBeenCalled();
    });

    it("issues email OTP", async () => {
      await registerRoutes.POST(post({ name: "Admin", email: "a@test.com", password: "pass123" }));
      expect(mockIssueEmailOtp).toHaveBeenCalled();
    });

    it("returns devOtp in dev mode when no mailer configured", async () => {
      const res = await registerRoutes.POST(
        post({ name: "Admin", email: "a@test.com", password: "pass123" }),
      );
      const body = await res.json();
      expect(body.devOtp).toBe("123456");
    });

    it("uses default tenant when found", async () => {
      await registerRoutes.POST(post({ name: "Admin", email: "a@test.com", password: "pass123" }));
      expect(mockPrisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ tenantId: "tenant-1" }),
        }),
      );
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Auth Me
// ═══════════════════════════════════════════════════════════════════════════

describe("Auth Me", () => {
  beforeEach(() => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      name: "Admin",
      email: "a@test.com",
      phone: "555-0100",
      position: "Engineer",
      avatar: null,
      role: "ADMIN",
      isActive: true,
      totpEnabled: false,
      emailVerified: null,
      createdAt: new Date(),
    });
  });

  describe("GET", () => {
    it("returns 401 when no token provided", async () => {
      mockGetTokenFromRequest.mockReturnValueOnce(null);
      mockGetTokenFromCookie.mockReturnValueOnce(null);
      const res = await meRoutes.GET(get());
      expect(res.status).toBe(401);
    });

    it("returns 401 when token is invalid", async () => {
      mockGetTokenFromCookie.mockReturnValueOnce("bad-token");
      mockVerifyToken.mockReturnValueOnce(null);
      const res = await meRoutes.GET(get("token=bad-token"));
      expect(res.status).toBe(401);
    });

    it("returns user data when token is valid", async () => {
      mockGetTokenFromCookie.mockReturnValueOnce("valid-token");
      const res = await meRoutes.GET(get("token=valid-token"));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.id).toBe("user-1");
      expect(body.name).toBe("Admin");
      expect(body.email).toBe("a@test.com");
    });

    it("returns 404 when user not found in DB", async () => {
      mockGetTokenFromCookie.mockReturnValueOnce("valid-token");
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);
      const res = await meRoutes.GET(get("token=valid-token"));
      expect(res.status).toBe(404);
    });

    it("reads token from Authorization header", async () => {
      mockGetTokenFromRequest.mockReturnValueOnce("bearer-token");
      const res = await meRoutes.GET({
        url: "http://localhost/api/auth/me",
        headers: { get: (n: string) => (n === "authorization" ? "Bearer bearer-token" : null) },
      } as any);
      expect(mockGetTokenFromRequest).toHaveBeenCalled();
      expect(res.status).toBe(200);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Logout
// ═══════════════════════════════════════════════════════════════════════════

describe("Logout", () => {
  describe("POST", () => {
    it("returns success and clears cookies", async () => {
      const res = await logoutRoutes.POST(post({}, "refresh_token=family-1"));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(mockClearAuthCookies).toHaveBeenCalled();
    });

    it("revokes refresh token family when present", async () => {
      await logoutRoutes.POST(post({}, "refresh_token=raw-token"));
      expect(mockGetFamilyForToken).toHaveBeenCalled();
      expect(mockRevokeFamily).toHaveBeenCalledWith("family-1");
    });

    it("logs security event when access token is present", async () => {
      mockGetTokenFromCookie.mockReturnValueOnce("access-token");
      await logoutRoutes.POST(post({}, "token=access-token"));
      expect(mockLogSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({ type: "LOGOUT" }),
      );
    });

    it("works without any cookies", async () => {
      const res = await logoutRoutes.POST(post());
      expect(res.status).toBe(200);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Sessions
// ═══════════════════════════════════════════════════════════════════════════

describe("Sessions", () => {
  describe("GET", () => {
    it("returns 401 when not authenticated", async () => {
      mockRequireAuth.mockResolvedValueOnce({
        session: null,
        response: new Response("Unauthorized", { status: 401 }),
      });
      const res = await sessionsRoutes.GET(get());
      expect(res.status).toBe(401);
    });

    it("returns list of sessions with current flag", async () => {
      mockGetTokenFromCookie.mockReturnValueOnce("current-token");
      const res = await sessionsRoutes.GET(get("token=current-token"));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toHaveLength(1);
      expect(body[0].id).toBe("sess-1");
      expect(body[0].current).toBe(true); // tokenHash matches
    });

    it("marks non-matching session as not current", async () => {
      mockGetTokenFromCookie.mockReturnValueOnce("other-token");
      mockHashToken.mockReturnValueOnce("different-hash");
      const res = await sessionsRoutes.GET(get("token=other-token"));
      const body = await res.json();
      expect(body[0].current).toBe(false);
    });
  });

  describe("DELETE", () => {
    it("returns 401 when not authenticated", async () => {
      mockRequireAuth.mockResolvedValueOnce({
        session: null,
        response: new Response("Unauthorized", { status: 401 }),
      });
      const res = await sessionsRoutes.DELETE(post({}, "token=tok"));
      expect(res.status).toBe(401);
    });

    it("returns 400 when no token in request", async () => {
      mockGetTokenFromCookie.mockReturnValueOnce(null);
      mockGetTokenFromRequest.mockReturnValueOnce(null);
      const res = await sessionsRoutes.DELETE(post());
      expect(res.status).toBe(400);
    });

    it("revokes other sessions and logs event", async () => {
      mockGetTokenFromCookie.mockReturnValueOnce("current-token");
      const res = await sessionsRoutes.DELETE(post({}, "token=current-token"));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.revoked).toBe(2);
      expect(mockLogSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({ type: "SESSIONS_REVOKED_ALL" }),
      );
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// TOTP Setup
// ═══════════════════════════════════════════════════════════════════════════

describe("TOTP Setup", () => {
  describe("GET", () => {
    it("returns 401 when not authenticated", async () => {
      mockRequireAuth.mockResolvedValueOnce({
        session: null,
        response: new Response("Unauthorized", { status: 401 }),
      });
      const res = await totpSetupRoutes.GET(get());
      expect(res.status).toBe(401);
    });

    it("returns QR code and secret", async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({ id: "user-1", email: "a@test.com" });
      const res = await totpSetupRoutes.GET(get());
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.qrCode).toBe("data:image/png;base64,qrplaceholder");
      expect(body.secret).toBe("JBSWY3DPEHPK3PXP");
      expect(mockGenerateTotpSecret).toHaveBeenCalled();
      expect(mockQrCode.toDataURL).toHaveBeenCalled();
    });

    it("falls back to first ADMIN when user not found by id", async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);
      mockPrisma.user.findFirst.mockResolvedValueOnce({ id: "admin-1", email: "admin@test.com" });
      const res = await totpSetupRoutes.GET(get());
      expect(res.status).toBe(200);
    });

    it("returns 404 when no user found at all", async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);
      mockPrisma.user.findFirst.mockResolvedValueOnce(null);
      const res = await totpSetupRoutes.GET(get());
      expect(res.status).toBe(404);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// TOTP Verify
// ═══════════════════════════════════════════════════════════════════════════

describe("TOTP Verify", () => {
  describe("POST", () => {
    it("returns 400 when token missing", async () => {
      const res = await totpVerifyRoutes.POST(post({ secret: "SECRET" }));
      expect(res.status).toBe(400);
    });

    it("returns 400 when secret missing", async () => {
      const res = await totpVerifyRoutes.POST(post({ token: "123456" }));
      expect(res.status).toBe(400);
    });

    it("returns 400 when token too short", async () => {
      const res = await totpVerifyRoutes.POST(post({ token: "123", secret: "SECRET" }));
      expect(res.status).toBe(400);
    });

    it("returns 400 when TOTP code is invalid", async () => {
      mockVerifyTotp.mockReturnValueOnce(false);
      const res = await totpVerifyRoutes.POST(post({ token: "000000", secret: "SECRET" }));
      expect(res.status).toBe(400);
    });

    it("enables 2FA on valid code", async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({ id: "user-1", email: "a@test.com" });
      const res = await totpVerifyRoutes.POST(post({ token: "123456", secret: "SECRET" }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ totpSecret: "SECRET", totpEnabled: true }),
        }),
      );
      expect(mockLogSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({ type: "TOTP_ENABLED" }),
      );
    });

    it("falls back to first ADMIN when user not found", async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);
      mockPrisma.user.findFirst.mockResolvedValueOnce({ id: "admin-1", email: "admin@test.com" });
      const res = await totpVerifyRoutes.POST(post({ token: "123456", secret: "SECRET" }));
      expect(res.status).toBe(200);
    });

    it("returns 404 when no user found", async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);
      mockPrisma.user.findFirst.mockResolvedValueOnce(null);
      const res = await totpVerifyRoutes.POST(post({ token: "123456", secret: "SECRET" }));
      expect(res.status).toBe(404);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// TOTP Disable
// ═══════════════════════════════════════════════════════════════════════════

describe("TOTP Disable", () => {
  describe("POST", () => {
    it("returns 400 when password missing", async () => {
      const res = await totpDisableRoutes.POST(post({}));
      expect(res.status).toBe(400);
    });

    it("returns 403 when password is wrong", async () => {
      mockVerifyPassword.mockResolvedValueOnce(false);
      mockPrisma.user.findUnique.mockResolvedValueOnce({ id: "user-1", password: "$argon2id$xxx" });
      const res = await totpDisableRoutes.POST(post({ password: "wrong" }));
      expect(res.status).toBe(403);
    });

    it("disables 2FA on valid password", async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({ id: "user-1", password: "$argon2id$xxx" });
      const res = await totpDisableRoutes.POST(post({ password: "correct" }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ totpEnabled: false, totpSecret: null }),
        }),
      );
    });

    it("falls back to first ADMIN when user not found", async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);
      mockPrisma.user.findFirst.mockResolvedValueOnce({ id: "admin-1", password: "$argon2id$xxx" });
      const res = await totpDisableRoutes.POST(post({ password: "correct" }));
      expect(res.status).toBe(200);
    });

    it("returns 404 when no user found", async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);
      mockPrisma.user.findFirst.mockResolvedValueOnce(null);
      const res = await totpDisableRoutes.POST(post({ password: "correct" }));
      expect(res.status).toBe(404);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Refresh Token
// ═══════════════════════════════════════════════════════════════════════════

describe("Refresh Token", () => {
  const mockUser = {
    id: "user-1",
    name: "Admin",
    email: "a@test.com",
    role: "ADMIN",
    isActive: true,
    tenantId: "tenant-1",
    totpEnabled: false,
    totpSecret: null,
    password: "$argon2id$xxx",
    failedLoginCount: 0,
    lockedUntil: null,
  };

  describe("POST", () => {
    it("rotates token and returns success on valid refresh", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      const res = await refreshRoutes.POST(post({}, "refresh_token=valid-refresh"));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(mockSetAuthCookies).toHaveBeenCalled();
      expect(mockRotateSessionAccessToken).toHaveBeenCalled();
    });

    it("returns 401 on invalid refresh token", async () => {
      mockRotateRefreshToken.mockResolvedValueOnce({ status: "invalid" });
      const res = await refreshRoutes.POST(post({}, "refresh_token=bad"));
      expect(res.status).toBe(401);
      expect(mockClearAuthCookies).toHaveBeenCalled();
    });

    it("returns 401 when no refresh cookie present", async () => {
      mockRotateRefreshToken.mockResolvedValueOnce({ status: "invalid" });
      const res = await refreshRoutes.POST(post());
      expect(res.status).toBe(401);
    });

    it("detects reuse and logs security event", async () => {
      mockRotateRefreshToken.mockResolvedValueOnce({
        status: "reuse",
        userId: "user-1",
        familyId: "family-1",
      });
      mockPrisma.user.findUnique.mockResolvedValue({ id: "user-1", tenantId: "tenant-1" });
      const res = await refreshRoutes.POST(post({}, "refresh_token=reused"));
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toContain("reuse");
      expect(mockClearAuthCookies).toHaveBeenCalled();
      expect(mockLogSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({ type: "REFRESH_REUSE" }),
      );
    });

    it("returns 401 when user is inactive", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ ...mockUser, isActive: false });
      const res = await refreshRoutes.POST(post({}, "refresh_token=valid"));
      expect(res.status).toBe(401);
      expect(mockRevokeFamily).toHaveBeenCalled();
    });

    it("returns 401 when user not found in DB", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      const res = await refreshRoutes.POST(post({}, "refresh_token=valid"));
      expect(res.status).toBe(401);
      expect(mockRevokeFamily).toHaveBeenCalled();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Backup Codes
// ═══════════════════════════════════════════════════════════════════════════

describe("Backup Codes", () => {
  describe("GET", () => {
    it("returns 401 when not authenticated", async () => {
      mockRequireAuth.mockResolvedValueOnce({
        session: null,
        response: new Response("Unauthorized", { status: 401 }),
      });
      const res = await backupCodesRoutes.GET(get());
      expect(res.status).toBe(401);
    });

    it("returns remaining backup code count", async () => {
      const res = await backupCodesRoutes.GET(get());
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.remaining).toBe(7);
    });
  });

  describe("POST", () => {
    it("returns 401 when not authenticated", async () => {
      mockRequireAuth.mockResolvedValueOnce({
        session: null,
        response: new Response("Unauthorized", { status: 401 }),
      });
      const res = await backupCodesRoutes.POST(post());
      expect(res.status).toBe(401);
    });

    it("generates new backup codes and logs event", async () => {
      const res = await backupCodesRoutes.POST(post());
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.codes).toHaveLength(10);
      expect(body.codes[0]).toBe("aaaa-bbbb");
      expect(mockRegenerateBackupCodes).toHaveBeenCalledWith("user-1");
      expect(mockLogSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({ type: "BACKUP_CODES_GENERATED" }),
      );
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Step-Up Authentication
// ═══════════════════════════════════════════════════════════════════════════

describe("Step-Up Authentication", () => {
  const mockUser = {
    id: "user-1",
    name: "Admin",
    email: "a@test.com",
    role: "ADMIN",
    tenantId: "tenant-1",
    totpEnabled: false,
    totpSecret: null,
    password: "$argon2id$xxx",
  };

  describe("POST", () => {
    it("returns 400 when purpose is invalid", async () => {
      const res = await stepUpRoutes.POST(post({ purpose: "invalid" }));
      expect(res.status).toBe(400);
    });

    it("returns 400 when purpose is missing", async () => {
      const res = await stepUpRoutes.POST(post({ password: "pass" }));
      expect(res.status).toBe(400);
    });

    it("returns 404 when user not found", async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);
      const res = await stepUpRoutes.POST(post({ purpose: "change_password", password: "pass" }));
      expect(res.status).toBe(404);
    });

    it("returns 401 when password is wrong", async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(mockUser);
      mockVerifyPassword.mockResolvedValueOnce(false);
      const res = await stepUpRoutes.POST(post({ purpose: "change_password", password: "wrong" }));
      expect(res.status).toBe(401);
    });

    it("succeeds with valid password", async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(mockUser);
      const res = await stepUpRoutes.POST(
        post({ purpose: "change_password", password: "correct" }),
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(mockSignStepUpToken).toHaveBeenCalledWith("user-1", "change_password");
      expect(mockLogSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({ type: "STEP_UP_VERIFIED" }),
      );
    });

    it("succeeds with valid TOTP when 2FA is enabled", async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        ...mockUser,
        totpEnabled: true,
        totpSecret: "SECRET",
      });
      const res = await stepUpRoutes.POST(post({ purpose: "manage_2fa", totpToken: "123456" }));
      expect(res.status).toBe(200);
      expect(mockLogSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({ type: "MFA_VERIFIED" }),
      );
    });

    it("returns 401 when TOTP code is invalid", async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        ...mockUser,
        totpEnabled: true,
        totpSecret: "SECRET",
      });
      mockVerifyTotp.mockReturnValueOnce(false);
      const res = await stepUpRoutes.POST(post({ purpose: "manage_2fa", totpToken: "000000" }));
      expect(res.status).toBe(401);
    });

    it("accepts all valid purposes", async () => {
      const purposes = [
        "change_password",
        "change_email",
        "update_billing",
        "delete_account",
        "manage_2fa",
      ];
      for (const purpose of purposes) {
        mockPrisma.user.findUnique.mockResolvedValueOnce(mockUser);
        const res = await stepUpRoutes.POST(post({ purpose, password: "pass" }));
        expect(res.status).toBe(200);
      }
    });

    it("returns 401 when no password or TOTP provided and user has no 2FA", async () => {
      const userNoMfa = { ...mockUser, totpEnabled: false, totpSecret: null };
      mockPrisma.user.findUnique.mockResolvedValue(userNoMfa);
      mockVerifyPassword.mockResolvedValue(false);
      const res = await stepUpRoutes.POST(post({ purpose: "change_password" }));
      expect(res.status).toBe(401);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Refresh — additional branch coverage
// ═══════════════════════════════════════════════════════════════════════════

describe("Refresh (branch coverage)", () => {
  it("returns 401 when cookie header exists but no refresh token in it", async () => {
    mockRotateRefreshToken.mockResolvedValue({
      status: "invalid",
      userId: "user-1",
      familyId: "family-1",
    });
    const res = await refreshRoutes.POST(post({}, "other_cookie=value"));
    const body = await res.json();
    expect(body.error).toBe("Invalid or expired refresh token");
    expect(mockClearAuthCookies).toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Forgot Password
// ═══════════════════════════════════════════════════════════════════════════

describe("Forgot Password", () => {
  beforeEach(() => {
    mockSendPasswordResetEmail.mockResolvedValue({ sent: true });
    mockPrisma.user.findUnique.mockResolvedValue(null);
  });

  describe("POST", () => {
    it("returns 400 when email is missing", async () => {
      const res = await forgotPasswordRoutes.POST(post({}));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe("Email is required");
    });

    it("returns 400 when email is not a string", async () => {
      const res = await forgotPasswordRoutes.POST(post({ email: 123 }));
      expect(res.status).toBe(400);
    });

    it("returns success even when user does not exist (prevents enumeration)", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      const res = await forgotPasswordRoutes.POST(post({ email: "nobody@test.com" }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
    });

    it("returns success when user exists but is inactive", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "user-1",
        email: "a@test.com",
        isActive: false,
      });
      const res = await forgotPasswordRoutes.POST(post({ email: "a@test.com" }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it("generates token, sends email, and returns success for active user", async () => {
      const activeUser = {
        id: "user-1",
        email: "a@test.com",
        isActive: true,
      };
      mockPrisma.user.findUnique.mockResolvedValue(activeUser);

      const res = await forgotPasswordRoutes.POST(post({ email: "a@test.com" }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "user-1" },
          data: expect.objectContaining({
            verificationToken: expect.any(String),
            verificationTokenExpires: expect.any(Date),
          }),
        }),
      );
      expect(mockSendPasswordResetEmail).toHaveBeenCalledWith(
        expect.objectContaining({ to: "a@test.com" }),
      );
    });

    it("uses custom locale in reset URL", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "user-1",
        email: "a@test.com",
        isActive: true,
      });

      const res = await forgotPasswordRoutes.POST(post({ email: "a@test.com", locale: "ja" }));
      expect(res.status).toBe(200);
      expect(mockSendPasswordResetEmail).toHaveBeenCalledWith(
        expect.objectContaining({ locale: "ja" }),
      );
    });

    it("falls back to en locale when locale is not a string", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "user-1",
        email: "a@test.com",
        isActive: true,
      });

      const res = await forgotPasswordRoutes.POST(post({ email: "a@test.com", locale: 123 }));
      expect(res.status).toBe(200);
      expect(mockSendPasswordResetEmail).toHaveBeenCalledWith(
        expect.objectContaining({ locale: "en" }),
      );
    });

    it("logs reset link when email was not sent (no mailer)", async () => {
      mockSendPasswordResetEmail.mockResolvedValue({ sent: false });
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "user-1",
        email: "a@test.com",
        isActive: true,
      });
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const res = await forgotPasswordRoutes.POST(post({ email: "a@test.com" }));
      expect(res.status).toBe(200);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Reset link for a@test.com"));
      consoleSpy.mockRestore();
    });

    it("returns 500 when an exception occurs", async () => {
      mockPrisma.user.findUnique.mockRejectedValue(new Error("DB down"));
      const res = await forgotPasswordRoutes.POST(post({ email: "a@test.com" }));
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.error).toBe("Something went wrong");
    });

    it("returns success when body parsing fails", async () => {
      const badReq = {
        json: () => Promise.reject(new Error("bad json")),
        url: "http://localhost:3000/api/auth/forgot-password",
        headers: {
          get: (name: string) => {
            if (name === "user-agent") return "Mozilla/5.0";
            if (name === "x-forwarded-for") return "127.0.0.1";
            return null;
          },
        },
      } as unknown as Request;
      const res = await forgotPasswordRoutes.POST(badReq);
      expect(res.status).toBe(400);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Reset Password
// ═══════════════════════════════════════════════════════════════════════════

describe("Reset Password", () => {
  describe("POST", () => {
    it("returns 400 when token is missing", async () => {
      const res = await resetPasswordRoutes.POST(post({ password: "newpass123" }));
      expect(res.status).toBe(400);
    });

    it("returns 400 when token is not a string", async () => {
      const res = await resetPasswordRoutes.POST(post({ token: 123, password: "newpass123" }));
      expect(res.status).toBe(400);
    });

    it("returns 400 when password is missing", async () => {
      const res = await resetPasswordRoutes.POST(post({ token: "valid-token" }));
      expect(res.status).toBe(400);
    });

    it("returns 400 when password is too short", async () => {
      const res = await resetPasswordRoutes.POST(post({ token: "valid-token", password: "short" }));
      expect(res.status).toBe(400);
    });

    it("returns 400 when token is not found or expired", async () => {
      mockPrisma.user.findFirst.mockResolvedValueOnce(null);
      const res = await resetPasswordRoutes.POST(
        post({ token: "expired-token", password: "newpass123" }),
      );
      expect(res.status).toBe(400);
    });

    it("updates password and returns success on valid token", async () => {
      mockPrisma.user.findFirst.mockResolvedValueOnce({
        id: "user-1",
        email: "a@test.com",
        tenantId: "tenant-1",
      });
      const res = await resetPasswordRoutes.POST(
        post({ token: "valid-token", password: "newpass123" }),
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(mockHashPassword).toHaveBeenCalledWith("newpass123");
      expect(mockPrisma.user.update).toHaveBeenCalled();
      expect(mockPrisma.activityLog.create).toHaveBeenCalled();
    });

    it("returns 500 when an exception occurs", async () => {
      mockPrisma.user.findFirst.mockRejectedValue(new Error("DB down"));
      const res = await resetPasswordRoutes.POST(
        post({ token: "valid-token", password: "newpass123" }),
      );
      expect(res.status).toBe(500);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Security Events
// ═══════════════════════════════════════════════════════════════════════════

describe("Security Events", () => {
  describe("GET", () => {
    it("returns 401 when not authenticated", async () => {
      mockRequireAuth.mockResolvedValueOnce({
        session: null,
        response: new Response("Unauthorized", { status: 401 }),
      });
      const res = await securityEventsRoutes.GET(get());
      expect(res.status).toBe(401);
    });

    it("returns list of security events", async () => {
      mockListSecurityEvents.mockResolvedValueOnce([
        { id: "evt-1", type: "LOGIN", createdAt: new Date() },
      ]);
      const res = await securityEventsRoutes.GET(get());
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toHaveLength(1);
      expect(mockListSecurityEvents).toHaveBeenCalled();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Session by ID
// ═══════════════════════════════════════════════════════════════════════════

describe("Session by ID", () => {
  describe("DELETE", () => {
    it("returns 401 when not authenticated", async () => {
      mockRequireAuth.mockResolvedValueOnce({
        session: null,
        response: new Response("Unauthorized", { status: 401 }),
      });
      const req = post() as any;
      req.params = Promise.resolve({ id: "sess-1" });
      const res = await sessionByIdRoutes.DELETE(req, {
        params: Promise.resolve({ id: "sess-1" }),
      });
      expect(res.status).toBe(401);
    });

    it("returns 404 when session not found", async () => {
      mockRevokeSession.mockResolvedValueOnce(false);
      const res = await sessionByIdRoutes.DELETE(post(), {
        params: Promise.resolve({ id: "nonexistent" }),
      });
      expect(res.status).toBe(404);
    });

    it("revokes session and logs event on success", async () => {
      mockRevokeSession.mockResolvedValueOnce(true);
      const res = await sessionByIdRoutes.DELETE(post(), {
        params: Promise.resolve({ id: "sess-1" }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(mockLogSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({ type: "SESSION_REVOKED" }),
      );
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Verify Email OTP
// ═══════════════════════════════════════════════════════════════════════════

describe("Verify Email OTP", () => {
  const mockUserWithOtp = {
    id: "user-1",
    email: "a@test.com",
    emailVerified: null,
    emailOtpHash: "hashed-otp",
    emailOtpExpires: new Date(Date.now() + 3600000),
    emailOtpAttempts: 0,
    tenantId: "tenant-1",
  };

  describe("POST", () => {
    it("returns 400 when code is empty", async () => {
      const res = await verifyEmailOtpRoutes.POST(post({ code: "" }));
      expect(res.status).toBe(400);
    });

    it("returns 404 when user not found", async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);
      const res = await verifyEmailOtpRoutes.POST(post({ code: "123456" }));
      expect(res.status).toBe(404);
    });

    it("returns alreadyVerified when email is already verified", async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        ...mockUserWithOtp,
        emailVerified: new Date(),
      });
      const res = await verifyEmailOtpRoutes.POST(post({ code: "123456" }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.alreadyVerified).toBe(true);
    });

    it("returns OTP_NOT_REQUESTED when no OTP hash exists", async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        ...mockUserWithOtp,
        emailOtpHash: null,
      });
      const res = await verifyEmailOtpRoutes.POST(post({ code: "123456" }));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe("OTP_NOT_REQUESTED");
    });

    it("returns OTP_EXPIRED when OTP is expired", async () => {
      mockIsOtpExpired.mockReturnValueOnce(true);
      mockPrisma.user.findUnique.mockResolvedValueOnce(mockUserWithOtp);
      const res = await verifyEmailOtpRoutes.POST(post({ code: "123456" }));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe("OTP_EXPIRED");
    });

    it("returns OTP_TOO_MANY_ATTEMPTS when attempts exceeded", async () => {
      mockIsOtpExpired.mockReturnValueOnce(false);
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        ...mockUserWithOtp,
        emailOtpAttempts: 5,
      });
      const res = await verifyEmailOtpRoutes.POST(post({ code: "123456" }));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe("OTP_TOO_MANY_ATTEMPTS");
    });

    it("returns OTP_INVALID with attemptsLeft on wrong code", async () => {
      mockVerifyOtp.mockReturnValueOnce(false);
      mockIsOtpExpired.mockReturnValueOnce(false);
      mockPrisma.user.findUnique.mockResolvedValueOnce(mockUserWithOtp);
      const res = await verifyEmailOtpRoutes.POST(post({ code: "000000" }));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe("OTP_INVALID");
      expect(body.attemptsLeft).toBe(4);
    });

    it("returns success on valid code", async () => {
      mockVerifyOtp.mockReturnValueOnce(true);
      mockIsOtpExpired.mockReturnValueOnce(false);
      mockPrisma.user.findUnique.mockResolvedValueOnce(mockUserWithOtp);
      const res = await verifyEmailOtpRoutes.POST(post({ code: "123456" }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(mockLogSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({ type: "EMAIL_VERIFIED" }),
      );
    });

    it("returns 500 when an exception occurs", async () => {
      mockPrisma.user.findUnique.mockRejectedValue(new Error("DB down"));
      const res = await verifyEmailOtpRoutes.POST(post({ code: "123456" }));
      expect(res.status).toBe(500);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Verify Email Send
// ═══════════════════════════════════════════════════════════════════════════

describe("Verify Email Send", () => {
  describe("POST", () => {
    it("returns 404 when user not found", async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);
      const res = await verifyEmailSendRoutes.POST(post({}));
      expect(res.status).toBe(404);
    });

    it("returns alreadyVerified when email is already verified", async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: "user-1",
        emailVerified: new Date(),
      });
      const res = await verifyEmailSendRoutes.POST(post({}));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.alreadyVerified).toBe(true);
    });

    it("returns success with devOtp in dev mode", async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: "user-1",
        email: "a@test.com",
        emailVerified: null,
      });
      mockIssueEmailOtp.mockResolvedValueOnce({ sent: true, code: "654321" });
      mockIsDevFallbackAllowed.mockReturnValueOnce(true);
      const res = await verifyEmailSendRoutes.POST(post({}));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.devOtp).toBe("654321");
      expect(body.verificationUrl).toBeDefined();
    });

    it("returns success without devOtp when mailer is configured", async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: "user-1",
        email: "a@test.com",
        emailVerified: null,
      });
      mockIssueEmailOtp.mockResolvedValueOnce({ sent: true, code: "654321" });
      mockIsDevFallbackAllowed.mockReturnValue(false);
      const res = await verifyEmailSendRoutes.POST(post({}));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.devOtp).toBeUndefined();
    });

    it("uses custom locale and from in verification URL", async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: "user-1",
        email: "a@test.com",
        emailVerified: null,
      });
      mockIsDevFallbackAllowed.mockReturnValueOnce(true);
      const res = await verifyEmailSendRoutes.POST(post({ locale: "ja", from: "profile" }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.verificationUrl).toContain("locale=ja");
      expect(body.verificationUrl).toContain("from=profile");
    });

    it("returns 500 when an exception occurs", async () => {
      mockPrisma.user.findUnique.mockRejectedValue(new Error("DB down"));
      const res = await verifyEmailSendRoutes.POST(post({}));
      expect(res.status).toBe(500);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Verify Email Confirm
// ═══════════════════════════════════════════════════════════════════════════

describe("Verify Email Confirm", () => {
  describe("GET", () => {
    it("returns 400 when token is missing", async () => {
      const req = {
        url: "http://localhost:3000/api/auth/verify-email/confirm",
        headers: { get: () => null },
      } as unknown as Request;
      const res = await verifyEmailConfirmRoutes.GET(req);
      expect(res.status).toBe(400);
    });

    it("redirects with verified=invalid when token not found", async () => {
      mockPrisma.user.findFirst.mockResolvedValueOnce(null);
      const req = {
        url: "http://localhost:3000/api/auth/verify-email/confirm?token=bad-token",
        headers: { get: () => null },
      } as unknown as Request;
      const res = await verifyEmailConfirmRoutes.GET(req);
      expect(res.status).toBe(302);
      expect(res.headers.get("location")).toContain("verified=invalid");
    });

    it("redirects with verified=true on valid token", async () => {
      mockPrisma.user.findFirst.mockResolvedValueOnce({
        id: "user-1",
        tenantId: "tenant-1",
      });
      const req = {
        url: "http://localhost:3000/api/auth/verify-email/confirm?token=valid-token&locale=en&from=security",
        headers: { get: () => null },
      } as unknown as Request;
      const res = await verifyEmailConfirmRoutes.GET(req);
      expect(res.status).toBe(302);
      expect(res.headers.get("location")).toContain("verified=true");
      expect(mockLogSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({ type: "EMAIL_VERIFIED" }),
      );
    });

    it("falls back to en for unsupported locale", async () => {
      mockPrisma.user.findFirst.mockResolvedValueOnce({
        id: "user-1",
        tenantId: "tenant-1",
      });
      const req = {
        url: "http://localhost:3000/api/auth/verify-email/confirm?token=valid-token&locale=fr",
        headers: { get: () => null },
      } as unknown as Request;
      const res = await verifyEmailConfirmRoutes.GET(req);
      expect(res.status).toBe(302);
      expect(res.headers.get("location")).toContain("/en/");
    });

    it("returns 500 when an exception occurs", async () => {
      mockPrisma.user.findFirst.mockRejectedValue(new Error("DB down"));
      const req = {
        url: "http://localhost:3000/api/auth/verify-email/confirm?token=bad",
        headers: { get: () => null },
      } as unknown as Request;
      const res = await verifyEmailConfirmRoutes.GET(req);
      expect(res.status).toBe(500);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Google OAuth
// ═══════════════════════════════════════════════════════════════════════════

describe("Google OAuth", () => {
  describe("GET", () => {
    it("redirects to Google OAuth consent screen when configured", async () => {
      const original = process.env.GOOGLE_CLIENT_ID;
      process.env.GOOGLE_CLIENT_ID = "test-client-id";
      try {
        const res = await googleRoutes.GET();
        expect(res.status).toBe(307);
        const location = res.headers.get("location");
        expect(location).toContain("accounts.google.com");
        expect(location).toContain("response_type=code");
      } finally {
        process.env.GOOGLE_CLIENT_ID = original;
      }
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SAML Login
// ═══════════════════════════════════════════════════════════════════════════

describe("SAML Login", () => {
  describe("GET", () => {
    it("returns 404 when no SSO connection found", async () => {
      mockResolveConnectionByEmail.mockResolvedValueOnce(null);
      const req = {
        url: "http://localhost:3000/api/auth/saml/login?email=user@test.com",
        headers: { get: () => null },
      } as unknown as Request;
      const res = await samlLoginRoutes.GET(req);
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error).toContain("No SSO configured");
    });

    it("redirects to IdP when connection is found", async () => {
      mockResolveConnectionByEmail.mockResolvedValueOnce({
        id: "conn-1",
        entryPoint: "https://idp.example.com/sso",
      });
      const req = {
        url: "http://localhost:3000/api/auth/saml/login?email=user@test.com",
        headers: { get: () => null },
      } as unknown as Request;
      const res = await samlLoginRoutes.GET(req);
      expect([302, 307]).toContain(res.status);
      const location = res.headers.get("location");
      expect(location).toContain("idp.example.com");
    });

    it("resolves connection by tenant slug", async () => {
      mockResolveConnectionByTenantSlug.mockResolvedValueOnce({
        id: "conn-1",
        entryPoint: "https://idp.example.com/sso",
      });
      const req = {
        url: "http://localhost:3000/api/auth/saml/login?tenant=mycompany",
        headers: { get: () => null },
      } as unknown as Request;
      const res = await samlLoginRoutes.GET(req);
      expect([302, 307]).toContain(res.status);
      expect(mockResolveConnectionByTenantSlug).toHaveBeenCalledWith("mycompany");
    });

    it("returns 404 when no params provided", async () => {
      const req = {
        url: "http://localhost:3000/api/auth/saml/login",
        headers: { get: () => null },
      } as unknown as Request;
      const res = await samlLoginRoutes.GET(req);
      expect(res.status).toBe(404);
    });

    it("returns 500 when SAML init throws", async () => {
      mockResolveConnectionByEmail.mockResolvedValueOnce({
        id: "conn-1",
        entryPoint: "https://idp.example.com/sso",
      });
      mockBuildSaml.mockReturnValueOnce({
        getAuthorizeUrlAsync: vi.fn().mockRejectedValue(new Error("SAML init failed")),
      });
      const req = {
        url: "http://localhost:3000/api/auth/saml/login?email=user@test.com",
        headers: { get: () => null },
      } as unknown as Request;
      const res = await samlLoginRoutes.GET(req);
      expect(res.status).toBe(500);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SAML ACS
// ═══════════════════════════════════════════════════════════════════════════

describe("SAML ACS", () => {
  function formDataRequest(entries: Record<string, string>): Request {
    return {
      formData: () => {
        const fd = new FormData();
        for (const [k, v] of Object.entries(entries)) fd.append(k, v);
        return Promise.resolve(fd);
      },
      url: "http://localhost:3000/api/auth/saml/acs",
      headers: {
        get: (name: string) => {
          if (name === "user-agent") return "Mozilla/5.0";
          if (name === "x-forwarded-for") return "127.0.0.1";
          return null;
        },
      },
    } as unknown as Request;
  }

  describe("POST", () => {
    it("returns 400 when SAMLResponse is missing", async () => {
      const res = await samlAcsRoutes.POST(formDataRequest({ RelayState: "conn-1" }));
      expect(res.status).toBe(400);
    });

    it("returns 400 when RelayState is missing", async () => {
      const res = await samlAcsRoutes.POST(formDataRequest({ SAMLResponse: "response" }));
      expect(res.status).toBe(400);
    });

    it("returns 400 when both are missing", async () => {
      const res = await samlAcsRoutes.POST(formDataRequest({}));
      expect(res.status).toBe(400);
    });

    it("returns 400 when SSO connection not found", async () => {
      mockPrisma.ssoConnection.findUnique.mockResolvedValueOnce(null);
      const res = await samlAcsRoutes.POST(
        formDataRequest({ SAMLResponse: "response", RelayState: "unknown-conn" }),
      );
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("Unknown SSO connection");
    });

    it("returns 400 when SSO connection is disabled", async () => {
      mockPrisma.ssoConnection.findUnique.mockResolvedValueOnce({
        id: "conn-1",
        enabled: false,
        tenantId: "tenant-1",
      });
      const res = await samlAcsRoutes.POST(
        formDataRequest({ SAMLResponse: "response", RelayState: "conn-1" }),
      );
      expect(res.status).toBe(400);
    });

    it("returns 401 when SAML validation throws", async () => {
      mockPrisma.ssoConnection.findUnique.mockResolvedValueOnce({
        id: "conn-1",
        enabled: true,
        tenantId: "tenant-1",
        entryPoint: "https://idp.example.com",
        idpCert: "cert",
        spIssuer: "next-dashboard",
      });
      mockBuildSaml.mockReturnValueOnce({
        validatePostResponseAsync: vi.fn().mockRejectedValue(new Error("Invalid signature")),
      });
      const res = await samlAcsRoutes.POST(
        formDataRequest({ SAMLResponse: "bad-response", RelayState: "conn-1" }),
      );
      expect(res.status).toBe(401);
    });

    it("returns 401 when no SAML profile is returned", async () => {
      mockPrisma.ssoConnection.findUnique.mockResolvedValueOnce({
        id: "conn-1",
        enabled: true,
        tenantId: "tenant-1",
        entryPoint: "https://idp.example.com",
        idpCert: "cert",
        spIssuer: "next-dashboard",
      });
      mockBuildSaml.mockReturnValueOnce({
        validatePostResponseAsync: vi.fn().mockResolvedValue({ profile: null }),
      });
      const res = await samlAcsRoutes.POST(
        formDataRequest({ SAMLResponse: "response", RelayState: "conn-1" }),
      );
      expect(res.status).toBe(401);
    });

    it("returns 400 when SAML assertion has no email", async () => {
      mockPrisma.ssoConnection.findUnique.mockResolvedValueOnce({
        id: "conn-1",
        enabled: true,
        tenantId: "tenant-1",
        entryPoint: "https://idp.example.com",
        idpCert: "cert",
        spIssuer: "next-dashboard",
      });
      mockBuildSaml.mockReturnValueOnce({
        validatePostResponseAsync: vi.fn().mockResolvedValue({
          profile: { name: "No Email User" },
        }),
      });
      const res = await samlAcsRoutes.POST(
        formDataRequest({ SAMLResponse: "response", RelayState: "conn-1" }),
      );
      expect(res.status).toBe(400);
    });

    it("returns 403 when account belongs to different workspace", async () => {
      mockPrisma.ssoConnection.findUnique.mockResolvedValueOnce({
        id: "conn-1",
        enabled: true,
        tenantId: "tenant-1",
        entryPoint: "https://idp.example.com",
        idpCert: "cert",
        spIssuer: "next-dashboard",
      });
      mockBuildSaml.mockReturnValueOnce({
        validatePostResponseAsync: vi.fn().mockResolvedValue({
          profile: { email: "user@test.com", name: "Test" },
        }),
      });
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: "user-1",
        email: "user@test.com",
        tenantId: "different-tenant",
        isActive: true,
      });
      const res = await samlAcsRoutes.POST(
        formDataRequest({ SAMLResponse: "response", RelayState: "conn-1" }),
      );
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toContain("different workspace");
    });

    it("returns 403 when account is deactivated", async () => {
      mockPrisma.ssoConnection.findUnique.mockResolvedValueOnce({
        id: "conn-1",
        enabled: true,
        tenantId: "tenant-1",
        entryPoint: "https://idp.example.com",
        idpCert: "cert",
        spIssuer: "next-dashboard",
      });
      mockBuildSaml.mockReturnValueOnce({
        validatePostResponseAsync: vi.fn().mockResolvedValue({
          profile: { email: "user@test.com", name: "Test" },
        }),
      });
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: "user-1",
        email: "user@test.com",
        tenantId: "tenant-1",
        isActive: false,
      });
      const res = await samlAcsRoutes.POST(
        formDataRequest({ SAMLResponse: "response", RelayState: "conn-1" }),
      );
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toContain("deactivated");
    });

    it("JIT-provisions new user and issues session on first login", async () => {
      mockPrisma.ssoConnection.findUnique.mockResolvedValueOnce({
        id: "conn-1",
        enabled: true,
        tenantId: "tenant-1",
        entryPoint: "https://idp.example.com",
        idpCert: "cert",
        spIssuer: "next-dashboard",
        name: "Acme SSO",
      });
      mockBuildSaml.mockReturnValueOnce({
        validatePostResponseAsync: vi.fn().mockResolvedValue({
          profile: { email: "new@test.com", name: "New User" },
        }),
      });
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);
      mockPrisma.user.create.mockResolvedValueOnce({
        id: "user-new",
        email: "new@test.com",
        name: "New User",
        role: "STAFF",
        tenantId: "tenant-1",
      });

      const res = await samlAcsRoutes.POST(
        formDataRequest({ SAMLResponse: "response", RelayState: "conn-1" }),
      );
      expect([302, 303]).toContain(res.status);
      expect(mockPrisma.user.create).toHaveBeenCalled();
      expect(mockCreateSession).toHaveBeenCalled();
      expect(mockCreateRefreshToken).toHaveBeenCalled();
      expect(mockSetAuthCookies).toHaveBeenCalled();
      expect(mockLogSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({ type: "SAML_LOGIN" }),
      );
    });

    it("logs in existing active user without creating new account", async () => {
      mockPrisma.ssoConnection.findUnique.mockResolvedValueOnce({
        id: "conn-1",
        enabled: true,
        tenantId: "tenant-1",
        entryPoint: "https://idp.example.com",
        idpCert: "cert",
        spIssuer: "next-dashboard",
        name: "Acme SSO",
      });
      mockBuildSaml.mockReturnValueOnce({
        validatePostResponseAsync: vi.fn().mockResolvedValue({
          profile: { email: "existing@test.com", name: "Existing" },
        }),
      });
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: "user-1",
        email: "existing@test.com",
        tenantId: "tenant-1",
        isActive: true,
        name: "Existing",
        role: "STAFF",
      });

      const res = await samlAcsRoutes.POST(
        formDataRequest({ SAMLResponse: "response", RelayState: "conn-1" }),
      );
      expect([302, 303]).toContain(res.status);
      expect(mockPrisma.user.create).not.toHaveBeenCalled();
      expect(mockCreateSession).toHaveBeenCalled();
    });

    it("falls back to email prefix when name is missing in profile", async () => {
      mockPrisma.ssoConnection.findUnique.mockResolvedValueOnce({
        id: "conn-1",
        enabled: true,
        tenantId: "tenant-1",
        entryPoint: "https://idp.example.com",
        idpCert: "cert",
        spIssuer: "next-dashboard",
        name: "Acme SSO",
      });
      mockBuildSaml.mockReturnValueOnce({
        validatePostResponseAsync: vi.fn().mockResolvedValue({
          profile: { email: "noname@test.com" },
        }),
      });
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);
      mockPrisma.user.create.mockResolvedValueOnce({
        id: "user-new",
        email: "noname@test.com",
        name: "noname",
        role: "STAFF",
        tenantId: "tenant-1",
      });

      const res = await samlAcsRoutes.POST(
        formDataRequest({ SAMLResponse: "response", RelayState: "conn-1" }),
      );
      expect([302, 303]).toContain(res.status);
      expect(mockPrisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ name: "noname" }),
        }),
      );
    });
  });
});
