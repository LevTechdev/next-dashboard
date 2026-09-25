import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Regression guard for the `x ?? null` attribution class.
 *
 * The bug: a call site forwarded a *defined* null (`session.user.tenantId ?? null`,
 * `metadata.tenantId ?? null`) into a writer that treats absence as "derive it
 * from the actor". A null is not "unknown" — it is "belongs to nobody", so the
 * row lands with no tenant and every tenant-scoped read (`tenantWhere` on the
 * audit log / activity feed) hides it forever.
 *
 * These tests pin both halves of the rule for the two writers that had it:
 *   1. a nullish tenant resolves through the actor, and
 *   2. an explicit non-null tenant still wins (and costs no extra query).
 */
const { activityLogCreate, userFindUnique } = vi.hoisted(() => ({
  activityLogCreate: vi.fn(),
  userFindUnique: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    activityLog: { create: activityLogCreate },
    user: { findUnique: userFindUnique },
  },
}));

vi.mock("@/lib/request-meta", () => ({
  getRequestMeta: vi.fn(() => ({ browser: "Chrome", device: "Desktop", ip: "203.0.113.7" })),
}));

import { resolveUserTenantId } from "@/lib/tenancy";
import { writeDeletionAudit } from "@/lib/activity-audit";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("resolveUserTenantId", () => {
  it("returns the actor's workspace", async () => {
    userFindUnique.mockResolvedValueOnce({ tenantId: "tenant-1" });

    await expect(resolveUserTenantId("u-1")).resolves.toBe("tenant-1");
    expect(userFindUnique).toHaveBeenCalledWith({
      where: { id: "u-1" },
      select: { tenantId: true },
    });
  });

  it("returns null for an absent actor id without querying", async () => {
    await expect(resolveUserTenantId(null)).resolves.toBeNull();
    await expect(resolveUserTenantId(undefined)).resolves.toBeNull();
    expect(userFindUnique).not.toHaveBeenCalled();
  });

  it("returns null when the actor row no longer exists", async () => {
    userFindUnique.mockResolvedValueOnce(null);
    await expect(resolveUserTenantId("ghost")).resolves.toBeNull();
  });

  it("degrades to null instead of throwing when the lookup fails", async () => {
    userFindUnique.mockRejectedValueOnce(new Error("db down"));
    await expect(resolveUserTenantId("u-1")).resolves.toBeNull();
  });
});

describe("writeDeletionAudit tenant attribution", () => {
  const base = {
    action: "DELETE",
    entity: "Product",
    entityId: "p-1",
    details: "Product deleted",
  };

  it("resolves the actor's workspace when the session carries no tenant claim", async () => {
    userFindUnique.mockResolvedValueOnce({ tenantId: "tenant-resolved" });

    await writeDeletionAudit({
      ...base,
      session: { user: { id: "u-1", tenantId: null } },
    });

    expect(activityLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ tenantId: "tenant-resolved", userId: "u-1" }),
    });
  });

  it("keeps a non-null session claim and does not pay for a lookup", async () => {
    await writeDeletionAudit({
      ...base,
      session: { user: { id: "u-1", tenantId: "tenant-claim" } },
    });

    expect(userFindUnique).not.toHaveBeenCalled();
    expect(activityLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ tenantId: "tenant-claim" }),
    });
  });

  it("stays best-effort when the write fails", async () => {
    userFindUnique.mockResolvedValueOnce({ tenantId: "tenant-1" });
    activityLogCreate.mockRejectedValueOnce(new Error("boom"));

    await expect(
      writeDeletionAudit({ ...base, session: { user: { id: "u-1", tenantId: null } } }),
    ).resolves.toBeUndefined();
  });
});
