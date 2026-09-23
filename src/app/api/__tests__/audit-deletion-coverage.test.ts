import { describe, it, expect, vi, beforeEach } from "vitest";

// ═══════════════════════════════════════════════════════════════════════════
// Hoisted mocks
// ═══════════════════════════════════════════════════════════════════════════

const {
  mockPrisma,
  mockRequireAuth,
  mockRequirePermission,
  mockGetChatConfig,
  mockDeleteChatChannel,
  mockLogSecurityEvent,
  mockVerifyPassword,
} = vi.hoisted(() => {
  /** Proxy-based model helper: returns overrides or default vi.fn */
  const chain = <T extends Record<string, unknown>>(overrides: Partial<T> = {}) =>
    new Proxy<T>({} as T, {
      get(_, prop) {
        const key = String(prop);
        return (overrides as any)[key] ?? vi.fn().mockResolvedValue(null);
      },
    });

  return {
    mockPrisma: {
      campaign: chain({
        findUnique: vi.fn().mockResolvedValue({ tenantId: "t1", name: "Summer Sale" }),
        delete: vi.fn().mockResolvedValue({}),
      }),
      discount: chain({
        findUnique: vi.fn().mockResolvedValue({ tenantId: "t1", code: "SAVE10", name: "Save 10%" }),
        delete: vi.fn().mockResolvedValue({}),
      }),
      notification: chain({
        deleteMany: vi.fn().mockResolvedValue({ count: 3 }),
        delete: vi.fn().mockResolvedValue({}),
      }),
      user: chain({
        findUnique: vi.fn().mockResolvedValue(null),
        delete: vi.fn().mockResolvedValue({}),
        update: vi.fn().mockResolvedValue({ id: "u1", avatar: null }),
      }),
      affiliatePlatform: chain({
        findUnique: vi.fn().mockResolvedValue({ name: "Shopee" }),
      }),
      platformConnection: chain({
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      }),
      ssoConnection: chain({
        findUnique: vi.fn().mockResolvedValue({ name: "Okta" }),
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      }),
      activityLog: chain({
        create: vi.fn().mockResolvedValue({}),
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      }),
      auditLog: chain({
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      }),
      order: chain({
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      }),
    },
    mockRequireAuth: vi.fn(),
    mockRequirePermission: vi.fn(),
    mockGetChatConfig: vi.fn(),
    mockDeleteChatChannel: vi.fn(),
    mockLogSecurityEvent: vi.fn().mockResolvedValue(undefined),
    mockVerifyPassword: vi.fn().mockResolvedValue(true),
  };
});

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));

vi.mock("@/lib/api-guard", () => ({
  requireAuth: mockRequireAuth,
  requirePermission: mockRequirePermission,
}));

vi.mock("@/lib/security-events", () => ({
  logSecurityEvent: mockLogSecurityEvent,
}));

vi.mock("@/lib/auth", () => ({
  verifyPassword: mockVerifyPassword,
}));

vi.mock("@/lib/chat-alerts-store", () => ({
  getChatConfig: mockGetChatConfig,
  deleteChatChannel: mockDeleteChatChannel,
  upsertChatChannel: vi.fn(),
  updateChatRules: vi.fn(),
}));

vi.mock("@/lib/tenancy", () => ({
  getTenantId: (s: any) => s?.user?.tenantId ?? null,
  sameTenant: (t: any, row: any) => !!row && (row.tenantId ?? null) === t,
  effectiveTenantId: vi.fn().mockResolvedValue("t1"),
  tenantWhere: (t: any) => ({ tenantId: t }),
}));

import { DELETE as marketingDELETE } from "../marketing/route";
import { DELETE as discountsDELETE } from "../discounts/route";
import { DELETE as notificationsDELETE } from "../notifications/route";
import { POST as notificationsBatchPOST } from "../notifications/batch/route";
import { DELETE as teamDELETE } from "../team/route";
import { DELETE as samlConnectionsDELETE } from "../auth/saml/connections/route";
import { DELETE as chatAlertsDELETE } from "../integrations/chat-alerts/route";
import { DELETE as profileDELETE } from "../profile/route";
import { DELETE as profileAvatarDELETE } from "../profile/avatar/route";
import { DELETE as affiliateConnectionDELETE } from "../affiliates/platforms/[id]/connection/route";

// ═══════════════════════════════════════════════════════════════════════════
// Fixtures
// ═══════════════════════════════════════════════════════════════════════════

const SESSION = {
  user: {
    id: "u1",
    sub: "u1",
    name: "Owner",
    email: "owner@example.com",
    role: "ADMIN",
    tenantId: "t1",
  },
};

function jsonReq(url: string, body?: unknown): Request {
  return new Request(url, {
    method: "DELETE",
    ...(body !== undefined
      ? {
          body: JSON.stringify(body),
          headers: { "content-type": "application/json" },
        }
      : {}),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockLogSecurityEvent.mockResolvedValue(undefined);
  mockVerifyPassword.mockResolvedValue(true);
  mockRequireAuth.mockResolvedValue({ session: SESSION, response: null });
  mockRequirePermission.mockResolvedValue({ role: "ADMIN", session: SESSION, response: null });
});

// ═══════════════════════════════════════════════════════════════════════════
// ActivityLog coverage (workspace-visible audit trail)
// ═══════════════════════════════════════════════════════════════════════════

describe("destructive action audit coverage", () => {
  it("marketing DELETE writes a DELETE_CAMPAIGN activity entry", async () => {
    const res = await marketingDELETE(jsonReq("http://localhost:3010/api/marketing", { id: "c1" }));

    expect(res.status).toBe(200);
    expect(mockPrisma.campaign.delete).toHaveBeenCalledWith({ where: { id: "c1" } });
    expect(mockPrisma.activityLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "DELETE_CAMPAIGN",
        entity: "Campaign",
        entityId: "c1",
        userId: "u1",
        tenantId: "t1",
      }),
    });
  });

  it("discounts DELETE writes a DELETE_DISCOUNT activity entry naming the code", async () => {
    const res = await discountsDELETE(jsonReq("http://localhost:3010/api/discounts", { id: "d1" }));

    expect(res.status).toBe(200);
    expect(mockPrisma.activityLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "DELETE_DISCOUNT",
        entity: "Discount",
        entityId: "d1",
      }),
    });
    const details = mockPrisma.activityLog.create.mock.calls[0][0].data.details as string;
    expect(details).toContain("SAVE10");
  });

  it("notifications clear-all logs the removed count", async () => {
    const res = await notificationsDELETE(
      jsonReq("http://localhost:3010/api/notifications", { action: "clear-all" }),
    );

    expect(res.status).toBe(200);
    expect(mockPrisma.activityLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "CLEAR_NOTIFICATIONS",
        entity: "Notification",
      }),
    });
    const details = mockPrisma.activityLog.create.mock.calls[0][0].data.details as string;
    expect(details).toContain("3 removed");
  });

  it("notifications single DELETE writes a DELETE_NOTIFICATION entry", async () => {
    const res = await notificationsDELETE(
      jsonReq("http://localhost:3010/api/notifications", { id: "n1" }),
    );

    expect(res.status).toBe(200);
    expect(mockPrisma.activityLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "DELETE_NOTIFICATION",
        entityId: "n1",
      }),
    });
  });

  it("notifications batch delete-all-read writes an audit entry", async () => {
    const res = await notificationsBatchPOST(
      new Request("http://localhost:3010/api/notifications/batch", {
        method: "POST",
        body: JSON.stringify({ action: "delete-all-read" }),
        headers: { "content-type": "application/json" },
      }),
    );

    expect(res.status).toBe(200);
    expect(mockPrisma.activityLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "DELETE_READ_NOTIFICATIONS",
        entity: "Notification",
      }),
    });
  });

  it("team DELETE writes a DELETE_TEAM_MEMBER entry naming the removed member", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "u9",
      name: "Jane Doe",
      email: "jane@example.com",
    });

    const res = await teamDELETE(jsonReq("http://localhost:3010/api/team", { id: "u9" }));

    expect(res.status).toBe(200);
    expect(mockPrisma.user.delete).toHaveBeenCalledWith({ where: { id: "u9" } });
    expect(mockPrisma.activityLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "DELETE_TEAM_MEMBER",
        entity: "User",
        entityId: "u9",
      }),
    });
    const details = mockPrisma.activityLog.create.mock.calls[0][0].data.details as string;
    expect(details).toContain("Jane Doe");
  });

  it("team DELETE refuses self-removal without deleting", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "u1",
      name: "Owner",
      email: "owner@example.com",
    });

    const res = await teamDELETE(jsonReq("http://localhost:3010/api/team", { id: "u1" }));

    expect(res.status).toBe(400);
    expect(mockPrisma.user.delete).not.toHaveBeenCalled();
    expect(mockPrisma.activityLog.create).not.toHaveBeenCalled();
  });

  it("chat-alerts DELETE writes an entry for the deleted channel", async () => {
    mockGetChatConfig.mockReturnValue({
      channels: [{ id: "ch1", name: "Ops Slack", platform: "slack" }],
    });
    mockDeleteChatChannel.mockReturnValue(true);

    const res = await chatAlertsDELETE(
      new Request("http://localhost:3010/api/integrations/chat-alerts?id=ch1", {
        method: "DELETE",
      }),
    );

    expect(res.status).toBe(200);
    expect(mockPrisma.activityLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "DELETE_CHAT_ALERT_CHANNEL",
        entity: "ChatChannel",
        entityId: "ch1",
      }),
    });
    const details = mockPrisma.activityLog.create.mock.calls[0][0].data.details as string;
    expect(details).toContain("Ops Slack");
  });

  it("avatar DELETE writes a DELETE_AVATAR entry", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: "u1" });

    const res = await profileAvatarDELETE(
      new Request("http://localhost:3010/api/profile/avatar", { method: "DELETE" }),
    );

    expect(res.status).toBe(200);
    expect(mockPrisma.activityLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "DELETE_AVATAR",
        entity: "User",
      }),
    });
  });

  it("affiliate connection DELETE writes a DISCONNECT entry naming the platform", async () => {
    const res = await affiliateConnectionDELETE(
      new Request("http://localhost:3010/api/affiliates/platforms/p1/connection", {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: "p1" }) },
    );

    expect(res.status).toBe(200);
    expect(mockPrisma.platformConnection.deleteMany).toHaveBeenCalledWith({
      where: { platformId: "p1" },
    });
    expect(mockPrisma.activityLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "DISCONNECT_AFFILIATE_PLATFORM",
        entity: "PlatformConnection",
        entityId: "p1",
      }),
    });
    const details = mockPrisma.activityLog.create.mock.calls[0][0].data.details as string;
    expect(details).toContain("Shopee");
  });

  it("a failed audit write never breaks the destructive operation", async () => {
    mockPrisma.activityLog.create.mockRejectedValueOnce(new Error("db down"));

    const res = await marketingDELETE(jsonReq("http://localhost:3010/api/marketing", { id: "c2" }));

    expect(res.status).toBe(200);
    expect(mockPrisma.campaign.delete).toHaveBeenCalledWith({ where: { id: "c2" } });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SecurityEvent coverage (credential/account destruction, hash-chained)
// ═══════════════════════════════════════════════════════════════════════════

describe("credential destruction security events", () => {
  it("SSO connection DELETE emits SSO_CONNECTION_DELETED with the provider name", async () => {
    const res = await samlConnectionsDELETE(
      new Request("http://localhost:3010/api/auth/saml/connections", { method: "DELETE" }),
    );

    expect(res.status).toBe(200);
    expect(mockPrisma.ssoConnection.deleteMany).toHaveBeenCalledWith({ where: { tenantId: "t1" } });
    expect(mockLogSecurityEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "SSO_CONNECTION_DELETED",
        tenantId: "t1",
        metadata: { name: "Okta" },
      }),
    );
  });

  it("delete account emits ACCOUNT_DELETED after the wipe (userId null)", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "u1",
      email: "owner@example.com",
      role: "ADMIN",
      tenantId: "t1",
      password: "hashed",
    });

    const res = await profileDELETE(
      jsonReq("http://localhost:3010/api/profile", { password: "pw" }),
    );

    expect(res.status).toBe(200);
    expect(mockPrisma.user.delete).toHaveBeenCalledWith({ where: { id: "u1" } });
    expect(mockLogSecurityEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "ACCOUNT_DELETED",
        userId: null,
        tenantId: "t1",
        metadata: { email: "owner@example.com", role: "ADMIN" },
      }),
    );
  });
});
