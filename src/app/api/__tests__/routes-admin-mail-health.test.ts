import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * /api/admin/mail-health — the live mail-delivery report + one-click resend.
 *
 * GET resolves the transport with the REAL describeMailConfiguration (the
 * send path's own resolver), folds in the outbox depths, and lists recent
 * FAILED rows with their reasons. POST re-queues the most recent failure
 * with a fresh attempt budget and drains it now. ADMIN-only on both.
 */
const mockRequireAuth = vi.fn();
const mockEmailOutboxHealth = vi.fn();
const mockResendLatest = vi.fn();

vi.mock("@/lib/api-guard", () => ({ requireAuth: mockRequireAuth }));
vi.mock("@/lib/email", () => ({
  describeMailConfiguration: vi.fn(() => ({
    transport: "smtp",
    from: "billing@your-domain.com",
    warnings: [],
  })),
}));
vi.mock("@/lib/email-outbox", () => ({
  emailOutboxHealth: mockEmailOutboxHealth,
  resendLatestFailedOutboxEmail: mockResendLatest,
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    emailOutbox: {
      findMany: vi.fn(async () => [
        {
          id: "row-1",
          to: "user@example.com",
          template: "verify_email",
          attempts: 5,
          maxAttempts: 5,
          lastError: "SMTP 550: recipient rejected",
          transport: "smtp",
          updatedAt: new Date("2026-09-25T00:00:00Z"),
        },
      ]),
    },
  },
}));

const route = await import("@/app/api/admin/mail-health/route");

function req(method: "GET" | "POST"): Request {
  return new Request("http://localhost/api/admin/mail-health", { method });
}

const HEALTH = {
  pending: 1,
  sending: 0,
  sent: 10,
  failed: 2,
  stuck: 2,
  oldestPendingAt: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockEmailOutboxHealth.mockResolvedValue(HEALTH);
  mockRequireAuth.mockResolvedValue({
    session: { user: { id: "admin-1", role: "ADMIN", tenantId: "t1" } },
    response: null,
  });
});

describe("GET /api/admin/mail-health", () => {
  it("returns 403 for non-admin sessions", async () => {
    mockRequireAuth.mockResolvedValue({
      session: { user: { id: "u", role: "CLIENT", tenantId: "t1" } },
      response: null,
    });
    const res = await route.GET(req("GET"));
    expect(res.status).toBe(403);
  });

  it("reports resolved transport, from sanity, queue depths, and failures", async () => {
    const res = await route.GET(req("GET"));
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.config).toEqual({
      transport: "smtp",
      from: "billing@your-domain.com",
      warnings: [],
      sandboxSender: false,
    });
    expect(body.outbox).toEqual(HEALTH);
    expect(body.recentFailed).toHaveLength(1);
    expect(body.recentFailed[0]).toMatchObject({
      to: "user@example.com",
      template: "verify_email",
      lastError: "SMTP 550: recipient rejected",
    });
  });

  it("flags a sandbox from-address as insane", async () => {
    const { describeMailConfiguration } = await import("@/lib/email");
    (describeMailConfiguration as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      transport: "resend",
      from: "onboarding@resend.dev",
      warnings: ["sandbox"],
    });

    const res = await route.GET(req("GET"));
    const body = await res.json();
    expect(body.config.sandboxSender).toBe(true);
  });
});

describe("POST /api/admin/mail-health (one-click resend)", () => {
  it("returns 403 for non-admin sessions", async () => {
    mockRequireAuth.mockResolvedValue({
      session: { user: { id: "u", role: "CLIENT", tenantId: "t1" } },
      response: null,
    });
    const res = await route.POST(req("POST"));
    expect(res.status).toBe(403);
    expect(mockResendLatest).not.toHaveBeenCalled();
  });

  it("resends the latest failure and reports the outcome", async () => {
    mockResendLatest.mockResolvedValueOnce({
      status: "sent",
      id: "row-1",
      to: "user@example.com",
      template: "verify_email",
      transport: "smtp",
    });
    const res = await route.POST(req("POST"));
    const body = await res.json();
    expect(body.status).toBe("sent");
    expect(body.to).toBe("user@example.com");
  });

  it("answers 'none' when nothing has failed", async () => {
    mockResendLatest.mockResolvedValueOnce({ status: "none" });
    const res = await route.POST(req("POST"));
    const body = await res.json();
    expect(body.status).toBe("none");
  });
});
