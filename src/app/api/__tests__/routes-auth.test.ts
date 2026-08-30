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
  mockSetAuthCookies,
  mockClearAuthCookies,
  mockConsumeBackupCode,
  mockLogSecurityEvent,
  mockIsPasswordBreached,
  mockIssueEmailOtp,
  mockIsDevFallbackAllowed,
  mockRequireAuth,
  mockQrCode,
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
}));

vi.mock("@/lib/refresh-tokens", () => ({
  newFamilyId: mockNewFamilyId,
  createRefreshToken: mockCreateRefreshToken,
  getFamilyForToken: mockGetFamilyForToken,
  revokeFamily: mockRevokeFamily,
}));

vi.mock("@/lib/auth-cookies", () => ({
  setAuthCookies: mockSetAuthCookies,
  clearAuthCookies: mockClearAuthCookies,
}));

vi.mock("@/lib/backup-codes", () => ({
  consumeBackupCode: mockConsumeBackupCode,
}));

vi.mock("@/lib/security-events", () => ({
  logSecurityEvent: mockLogSecurityEvent,
}));

vi.mock("@/lib/hibp", () => ({
  isPasswordBreached: mockIsPasswordBreached,
  getPwnedCount: vi.fn().mockResolvedValue(0),
}));

vi.mock("@/lib/email-verification", () => ({
  issueEmailOtp: mockIssueEmailOtp,
  isDevFallbackAllowed: mockIsDevFallbackAllowed,
}));

vi.mock("@/lib/api-guard", () => ({
  requireAuth: mockRequireAuth,
  requirePermission: vi.fn().mockResolvedValue({ role: "ADMIN", response: null }),
}));

vi.mock("qrcode", () => ({ default: mockQrCode }));

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
