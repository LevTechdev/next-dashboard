import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Regression guard for the login rate limiter's SecurityEvent append.
 *
 * BUG (fixed): `checkLoginRateLimit` wrote its per-attempt row with a raw
 * `prisma.securityEvent.create`, leaving prevHash/hash null. Those rows are
 * always the newest by seq, so the next real event linked itself to GENESIS
 * and broke the tamper-evident audit chain — meaning routine login throttling
 * silently corrupted the security ledger. It must append through
 * logSecurityEvent so every row is chained.
 */

/** Shape of the param object logSecurityEvent receives. */
interface LoggedEvent {
  userId: string | null;
  type: string;
  metadata?: Record<string, unknown>;
}

const { rawCreate, count, findFirst, logSecurityEvent } = vi.hoisted(() => ({
  rawCreate: vi.fn(),
  count: vi.fn(),
  findFirst: vi.fn(),
  logSecurityEvent: vi.fn(async (_event: LoggedEvent) => {}),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    securityEvent: { create: rawCreate, count: count, findFirst: findFirst },
  },
}));

vi.mock("@/lib/security-events", () => ({
  logSecurityEvent: logSecurityEvent,
}));

import { checkLoginRateLimit } from "@/lib/rate-limit";

function loginRequest(ip = "203.0.113.9"): Request {
  return new Request("http://localhost/api/auth/login", {
    method: "POST",
    headers: { "x-forwarded-for": ip, "user-agent": "vitest" },
  });
}

beforeEach(() => {
  rawCreate.mockReset();
  count.mockReset();
  findFirst.mockReset();
  logSecurityEvent.mockClear();
  count.mockResolvedValue(0);
  findFirst.mockResolvedValue(null);
});

describe("checkLoginRateLimit — audit chain", () => {
  it("appends through logSecurityEvent, never a raw hashless create", async () => {
    const res = await checkLoginRateLimit(loginRequest(), { email: "a@b.co" });

    expect(res.allowed).toBe(true);
    expect(rawCreate).not.toHaveBeenCalled();
    expect(logSecurityEvent).toHaveBeenCalledTimes(1);

    const arg = logSecurityEvent.mock.calls[0][0];
    expect(arg.type).toBe("RATE_LIMITED");
    expect(arg.metadata).toMatchObject({
      endpoint: "login",
      attempt: 1,
      limit: 10,
      blocked: false,
    });
  });

  it("still records the attempt once the window is full (no bypass)", async () => {
    count.mockResolvedValue(10);
    const res = await checkLoginRateLimit(loginRequest());
    expect(res.allowed).toBe(false);
    expect(rawCreate).not.toHaveBeenCalled();
    expect(logSecurityEvent.mock.calls[0][0].metadata?.blocked).toBe(true);
  });

  it("counts attempts per IP inside the window", async () => {
    await checkLoginRateLimit(loginRequest("198.51.100.4"));
    expect(count).toHaveBeenCalledWith({
      where: {
        type: "RATE_LIMITED",
        createdAt: { gte: expect.any(Date) },
        ip: "198.51.100.4",
      },
    });
  });
});
