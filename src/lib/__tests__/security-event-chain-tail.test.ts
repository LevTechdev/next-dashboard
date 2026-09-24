import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Regression guard for the SecurityEvent hash-chain tail lookup.
 *
 * BUG (fixed): `logSecurityEvent` read the tail with
 * `findFirst({ orderBy: { seq: "desc" } })` and linked to
 * `last?.hash ?? GENESIS_HASH`. Any row written WITHOUT a hash (the login
 * rate limiter used a raw `securityEvent.create`) was always the newest by
 * seq, so its `hash` was null → the next real event stored
 * `prevHash = GENESIS_HASH`, permanently breaking the tamper-evident chain
 * on every throttled login (6+ breaks per E2E run, caught by
 * /api/security/audit/verify at 409).
 *
 * FIX: the tail query filters `hash: { not: null }`, so the link target is
 * always the newest genuinely-chained row.
 */

const { findFirst, create, executeRawUnsafe, forwardToSiem, userFindUnique } = vi.hoisted(() => ({
  findFirst: vi.fn(),
  create: vi.fn(),
  executeRawUnsafe: vi.fn(),
  forwardToSiem: vi.fn(async () => {}),
  // Used by the tenant-attribution resolver (see the describe block below).
  userFindUnique: vi.fn(),
}));

vi.mock("@/lib/db", () => {
  const tx = {
    $executeRawUnsafe: executeRawUnsafe,
    securityEvent: { findFirst: findFirst, create: create },
  };
  return {
    prisma: {
      securityEvent: { findFirst: findFirst, create: create },
      user: { findUnique: userFindUnique },
      // The non-pgbouncer path wraps the append in an advisory-locked
      // interactive transaction; run the callback against the same spies.
      $transaction: vi.fn(async (cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
    },
  };
});

vi.mock("@/lib/siem", () => ({ forwardToSiem: forwardToSiem }));

import { logSecurityEvent } from "@/lib/security-events";
import { computeHash, GENESIS_HASH } from "@/lib/audit-hash";

const HASH_OF_PREVIOUS = "a".repeat(64);

beforeEach(() => {
  findFirst.mockReset();
  create.mockReset();
  create.mockImplementation(async (args: { data: Record<string, unknown> }) => ({
    id: "evt-1",
    seq: 42,
    ...args.data,
  }));
  forwardToSiem.mockClear();
  userFindUnique.mockReset();
  userFindUnique.mockResolvedValue({ tenantId: "t-actor" });
});

/** The `data` payload handed to securityEvent.create. */
function createdData(): Record<string, unknown> {
  expect(create).toHaveBeenCalledTimes(1);
  return create.mock.calls[0][0].data as Record<string, unknown>;
}

describe("logSecurityEvent — chain tail", () => {
  it("links to the newest HASHED row, ignoring newer unhashed rows at the tail", async () => {
    // The DB tail holds a hash-null row (seq 11) newer than the last
    // properly-chained row (seq 10). The filtered query returns seq 10.
    findFirst.mockResolvedValue({ hash: HASH_OF_PREVIOUS });

    await logSecurityEvent({ userId: null, type: "LOGIN" });

    // The lookup must ask only for hashable rows...
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { hash: { not: null } } }),
    );

    // ...and the stored prevHash must be that row's hash, never GENESIS.
    const data = createdData();
    expect(data.prevHash).toBe(HASH_OF_PREVIOUS);
    expect(data.prevHash).not.toBe(GENESIS_HASH);
    expect(data.hash).not.toBeNull();
  });

  it("stores a hash that verifies against the canonical algorithm", async () => {
    findFirst.mockResolvedValue({ hash: HASH_OF_PREVIOUS });
    await logSecurityEvent({
      userId: "u1",
      type: "LOGIN_FAILED",
      metadata: { attempt: 3 },
      tenantId: "t1",
    });

    const data = createdData();
    const recomputed = computeHash(HASH_OF_PREVIOUS, {
      userId: data.userId,
      type: data.type,
      ip: data.ip,
      userAgent: data.userAgent,
      metadata: data.metadata,
      tenantId: data.tenantId,
      createdAt: data.createdAt,
    } as never);
    expect(recomputed).toBe(data.hash);
  });

  it("anchors the very first hashed row to GENESIS", async () => {
    findFirst.mockResolvedValue(null);
    await logSecurityEvent({ userId: null, type: "LOGIN" });
    expect(createdData().prevHash).toBe(GENESIS_HASH);
  });

  it("never throws when the append fails (best-effort logging)", async () => {
    findFirst.mockRejectedValue(new Error("db down"));
    await expect(logSecurityEvent({ userId: null, type: "LOGIN" })).resolves.toBeUndefined();
  });
});

/**
 * Regression guard for tenant attribution.
 *
 * BUG (fixed): the resolver only ran when `tenantId` was `undefined`, but call
 * sites routinely forward the session value as-is (`tenantId: actor?.tenantId
 * ?? null`, `logEmailDelivery`), which is a DEFINED `null`. Those events were
 * therefore stored with no tenant at all — an audit row that belongs to nobody
 * under strict tenant scoping, and a hard failure for `check:audit-chain`
 * ("every hashed row with an actor carries a tenantId").
 *
 * The rule under test: a NON-NULL tenantId always wins; otherwise an event
 * with an actor resolves the actor's workspace, and an actor-less event stays
 * unattributed (deployment-level telemetry — nothing to resolve from).
 */
describe("logSecurityEvent — tenant attribution", () => {
  beforeEach(() => {
    findFirst.mockResolvedValue({ hash: HASH_OF_PREVIOUS });
  });

  it("resolves the actor's workspace when tenantId is omitted", async () => {
    await logSecurityEvent({ userId: "u1", type: "LOGIN" });
    expect(userFindUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "u1" } }));
    expect(createdData().tenantId).toBe("t-actor");
  });

  it("resolves anyway when a call site forwards an explicit null", async () => {
    // The `logEmailDelivery` / `session.tenantId ?? null` shape that caused the
    // unattributed EMAIL_DELIVERY_* rows.
    await logSecurityEvent({ userId: "u1", type: "EMAIL_DELIVERY_FAILED", tenantId: null });
    expect(createdData().tenantId).toBe("t-actor");
  });

  it("prefers an explicit tenant over the actor lookup", async () => {
    await logSecurityEvent({ userId: "u1", type: "LOGIN", tenantId: "t-explicit" });
    expect(createdData().tenantId).toBe("t-explicit");
    expect(userFindUnique).not.toHaveBeenCalled();
  });

  it("leaves an actor-less event unattributed without querying", async () => {
    await logSecurityEvent({ userId: null, type: "RATE_LIMITED" });
    expect(createdData().tenantId).toBeNull();
    expect(userFindUnique).not.toHaveBeenCalled();
  });

  it("stays unattributed when the actor lookup fails (best-effort)", async () => {
    userFindUnique.mockRejectedValue(new Error("db down"));
    await expect(logSecurityEvent({ userId: "u1", type: "LOGIN" })).resolves.toBeUndefined();
    expect(createdData().tenantId).toBeNull();
  });
});
