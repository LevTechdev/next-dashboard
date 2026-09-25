import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * /api/auth/stay-login — the durable "stay signed in" grant.
 *
 * The sentinel's extension used to live only in localStorage, so a redirect,
 * a site-data wipe, or a second account on the same browser silently ended it
 * and the user was signed out despite having clicked "Stay signed in". The
 * grant now lives on the refresh-token family:
 *
 *   • POST stamps stayLoginUntil on every live token of the caller's family,
 *     logs STAY_LOGIN_GRANTED, and mirrors a client-readable stay_login hint
 *     cookie (a UX hint, NOT a credential — possession of the refresh cookie
 *     is what authenticates).
 *   • GET reports whether the family holds a live grant — the sentinel's
 *     mount-time and pre-sign-out reconciliation source.
 *   • DELETE clears it (future settings surface).
 *
 * No family (anonymous caller, or no refresh cookie) ⇒ POST 409, GET reports
 * not-granted — never a 500, and never a grant without a family.
 */
const mockRequireAuth = vi.fn();

vi.mock("@/lib/api-guard", () => ({ requireAuth: mockRequireAuth }));
vi.mock("@/lib/security-events", () => ({ logSecurityEvent: vi.fn(async () => {}) }));
vi.mock("@/lib/refresh-tokens", () => ({
  getFamilyForToken: vi.fn(async () => "family-1"),
  STAY_LOGIN_GRANT_MS: 7 * 24 * 60 * 60 * 1000,
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    refreshToken: {
      updateMany: vi.fn(async () => ({ count: 1 })),
      findFirst: vi.fn(async () => ({
        stayLoginUntil: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000),
      })),
    },
  },
}));

const route = await import("@/app/api/auth/stay-login/route");
const { prisma } = await import("@/lib/db");

function req(method: "GET" | "POST" | "DELETE"): Request {
  return new Request("http://localhost/api/auth/stay-login", {
    method,
    headers: { cookie: "refresh_token=abc" },
  });
}

describe("/api/auth/stay-login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue({
      session: { user: { id: "user-1", role: "CLIENT", tenantId: "t1" } },
      response: null,
    });
  });

  it("POST stamps the grant on the family and logs the event", async () => {
    const res = await route.POST(req("POST"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(new Date(body.until).getTime()).toBeGreaterThan(Date.now() + 6 * 24 * 3600 * 1000);

    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ familyId: "family-1" }) }),
    );
    // The hint cookie is client-readable by design.
    expect(res.headers.getSetCookie().some((c) => c.startsWith("stay_login=1"))).toBe(true);
  });

  it("POST refuses without a refresh family (409, no grant)", async () => {
    const { getFamilyForToken } = await import("@/lib/refresh-tokens");
    (getFamilyForToken as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);

    const res = await route.POST(req("POST"));
    expect(res.status).toBe(409);
    expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
  });

  it("GET reports a live grant with its expiry", async () => {
    const res = await route.GET(req("GET"));
    const body = await res.json();
    expect(body.granted).toBe(true);
    expect(typeof body.until).toBe("string");
  });

  it("GET reports not-granted when the family has none", async () => {
    (prisma.refreshToken.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);

    const res = await route.GET(req("GET"));
    const body = await res.json();
    expect(body).toEqual({ granted: false, until: null });
  });

  it("GET answers not-granted without a family instead of erroring", async () => {
    const { getFamilyForToken } = await import("@/lib/refresh-tokens");
    (getFamilyForToken as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);

    const res = await route.GET(req("GET"));
    const body = await res.json();
    expect(body.granted).toBe(false);
    expect(prisma.refreshToken.findFirst).not.toHaveBeenCalled();
  });

  it("DELETE clears the grant and the hint cookie", async () => {
    const res = await route.DELETE(req("DELETE"));
    expect(res.status).toBe(200);
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ stayLoginUntil: null }),
      }),
    );
    expect(res.headers.getSetCookie().some((c) => c.startsWith("stay_login=;"))).toBe(true);
  });
});
