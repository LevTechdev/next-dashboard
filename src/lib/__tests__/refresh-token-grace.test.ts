import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Refresh-token rotation grace window.
 *
 * Rotation is a single-use exchange, so a browser that presents the same token
 * twice in a moment (two tabs, a lost response) would otherwise be judged as
 * replay theft and lose every session in the family. The grace window mints a
 * sibling instead — but must NOT resurrect a deliberately ended session.
 *
 * prisma is mocked so the rotation rules themselves are what's under test.
 */

const db = {
  /** Rotated rows, keyed by token hash. */
  rows: new Map<string, any>(),
  revokedFamilies: new Set<string>(),
  created: [] as any[],
  revokeFamilyCalls: [] as string[],
};

vi.mock("@/lib/db", () => ({
  prisma: {
    refreshToken: {
      findUnique: vi.fn(async ({ where }: any) => db.rows.get(where.tokenHash) ?? null),
      count: vi.fn(async ({ where }: any) => (db.revokedFamilies.has(where.familyId) ? 1 : 0)),
      create: vi.fn(async ({ data }: any) => {
        db.created.push(data);
        db.rows.set(data.tokenHash, {
          id: "new-" + db.created.length,
          usedAt: null,
          revokedAt: null,
          ...data,
        });
        return data;
      }),
      update: vi.fn(async ({ where, data }: any) => {
        for (const [hash, row] of db.rows) {
          if (row.id === where.id) db.rows.set(hash, { ...row, ...data });
        }
        return data;
      }),
      updateMany: vi.fn(async ({ where, data }: any) => {
        db.revokedFamilies.add(where.familyId);
        let n = 0;
        for (const [hash, row] of db.rows) {
          if (row.familyId === where.familyId) {
            db.rows.set(hash, { ...row, ...data });
            n += 1;
          }
        }
        return { count: n };
      }),
    },
    $transaction: vi.fn(async (ops: any[]) => {
      for (const op of ops) await op;
      return [];
    }),
  },
}));

vi.mock("@/lib/sessions", () => ({
  revokeSessionsByFamily: vi.fn(async (familyId: string) => {
    db.revokeFamilyCalls.push(familyId);
  }),
}));

import { hashToken } from "@/lib/auth";
import { rotateRefreshToken, REFRESH_GRACE_MS } from "@/lib/refresh-tokens";

/** Plant a token row directly in the mocked store. */
function plantRow(rawToken: string, overrides: Partial<Record<string, any>> = {}) {
  const row = {
    id: "tok-" + rawToken,
    userId: "u1",
    familyId: "fam-1",
    sessionId: "sess-1",
    tokenHash: hashToken(rawToken),
    expiresAt: new Date(Date.now() + 60_000),
    usedAt: null,
    revokedAt: null,
    ...overrides,
  };
  db.rows.set(row.tokenHash, row);
  return row;
}

describe("refresh-token rotation grace window", () => {
  beforeEach(() => {
    db.rows.clear();
    db.revokedFamilies.clear();
    db.created = [];
    db.revokeFamilyCalls = [];
  });

  it("rotates a fresh token normally", async () => {
    plantRow("fresh-token");
    const res = await rotateRefreshToken("fresh-token");
    expect(res.status).toBe("ok");
    if (res.status === "ok") {
      expect(res.graced).toBeUndefined();
      expect(res.token).toBeTruthy();
      expect(res.familyId).toBe("fam-1");
    }
    expect(db.revokeFamilyCalls).toHaveLength(0);
  });

  it("mints a sibling for a token consumed seconds ago (two-tab race)", async () => {
    plantRow("used-token", { usedAt: new Date(Date.now() - 2_000) });
    const res = await rotateRefreshToken("used-token");

    expect(res.status).toBe("ok");
    if (res.status === "ok") {
      expect(res.graced).toBe(true);
      expect(res.token).not.toBe("used-token");
    }
    // The family survives: nothing revoked.
    expect(db.revokeFamilyCalls).toHaveLength(0);
    expect(db.revokedFamilies.size).toBe(0);
  });

  it("treats a replay older than the window as theft (family revoked)", async () => {
    plantRow("stale-token", { usedAt: new Date(Date.now() - REFRESH_GRACE_MS - 5_000) });
    const res = await rotateRefreshToken("stale-token");

    expect(res.status).toBe("reuse");
    expect(db.revokeFamilyCalls).toEqual(["fam-1"]);
  });

  it("never graces a revoked token", async () => {
    plantRow("revoked-token", { revokedAt: new Date(Date.now() - 1_000) });
    const res = await rotateRefreshToken("revoked-token");

    expect(res.status).toBe("reuse");
    expect(db.revokeFamilyCalls).toEqual(["fam-1"]);
  });

  it("never graces back into a family that was revoked by logout", async () => {
    // Consumed a moment ago (inside the grace window) BUT the family was ended.
    plantRow("logged-out-token", { usedAt: new Date(Date.now() - 1_000) });
    db.revokedFamilies.add("fam-1");

    const res = await rotateRefreshToken("logged-out-token");

    expect(res.status).toBe("reuse");
    expect(db.revokeFamilyCalls).toEqual(["fam-1"]);
  });

  it("rejects an unknown token as invalid", async () => {
    const res = await rotateRefreshToken("never-issued");
    expect(res.status).toBe("invalid");
    expect(db.revokeFamilyCalls).toHaveLength(0);
  });
});
