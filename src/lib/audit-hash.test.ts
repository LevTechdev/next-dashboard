import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { GENESIS_HASH, stableStringify, computeHash, type ChainableEvent } from "./audit-hash";

/**
 * audit-hash.ts — the canonical form of the SecurityEvent tamper-evident
 * chain. The seed and the chain walker MUST agree byte-for-byte on these
 * helpers, so these tests pin the exact serialization: sorted keys, Date
 * normalization to ISO, nulls for missing fields, and the
 * `prevHash|canonical` concat before sha256.
 */

const baseEvent: ChainableEvent = {
  userId: "user-1",
  type: "login.success",
  ip: "10.0.0.1",
  userAgent: "vitest",
  metadata: { method: "password" },
  createdAt: new Date("2026-01-15T08:30:00.000Z"),
};

describe("stableStringify", () => {
  it("sorts object keys so key order cannot change the hash", () => {
    const a = stableStringify({ b: 1, a: 2 });
    const b = stableStringify({ a: 2, b: 1 });
    expect(a).toBe(b);
    expect(a).toBe('{"a":2,"b":1}');
  });

  it("sorts recursively through nested objects and arrays", () => {
    const a = stableStringify({ z: { y: 1, x: { c: 3, b: 2, a: 1 } }, arr: [{ d: 1, c: 2 }] });
    const b = stableStringify({ arr: [{ c: 2, d: 1 }], z: { x: { a: 1, b: 2, c: 3 }, y: 1 } });
    expect(a).toBe(b);
  });

  it("serializes primitives exactly as JSON.stringify does", () => {
    expect(stableStringify(null)).toBe("null");
    expect(stableStringify(42)).toBe("42");
    expect(stableStringify(true)).toBe("true");
    expect(stableStringify("hi")).toBe('"hi"');
    expect(stableStringify(undefined)).toBe("null"); // JSON.stringify(undefined) is undefined -> "null"
  });

  it("serializes arrays with escaped inner quotes", () => {
    expect(stableStringify([1, 'x"y'])).toBe('[1,"x\\"y"]');
  });
});

describe("computeHash", () => {
  it("links the first event to GENESIS_HASH (64 zeros)", () => {
    expect(GENESIS_HASH).toBe("0".repeat(64));
    const expected = createHash("sha256")
      .update(
        GENESIS_HASH +
          "|" +
          stableStringify({
            ...baseEvent,
            createdAt:
              baseEvent.createdAt instanceof Date
                ? baseEvent.createdAt.toISOString()
                : baseEvent.createdAt,
          }),
      )
      .digest("hex");
    expect(computeHash(GENESIS_HASH, baseEvent)).toBe(expected);
  });

  it("chains: second event differs when prevHash differs", () => {
    const h1 = computeHash(GENESIS_HASH, baseEvent);
    const h2 = computeHash(h1, baseEvent);
    expect(h2).not.toBe(h1);
    expect(h2).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is sensitive to every canonical field", () => {
    const h = computeHash(GENESIS_HASH, baseEvent);
    const variants: ChainableEvent[] = [
      { ...baseEvent, userId: "user-2" },
      { ...baseEvent, userId: null },
      { ...baseEvent, type: "login.failed" },
      { ...baseEvent, ip: "10.0.0.2" },
      { ...baseEvent, userAgent: "other" },
      { ...baseEvent, metadata: { method: "passkey" } },
      { ...baseEvent, metadata: null },
      { ...baseEvent, createdAt: new Date("2026-01-15T08:30:00.001Z") },
    ];
    for (const v of variants) {
      expect(computeHash(GENESIS_HASH, v)).not.toBe(h);
    }
  });

  it("normalizes createdAt regardless of Date or ISO-string input", () => {
    const asDate = computeHash(GENESIS_HASH, {
      ...baseEvent,
      createdAt: new Date("2026-03-01T12:00:00Z"),
    });
    const asString = computeHash(GENESIS_HASH, { ...baseEvent, createdAt: "2026-03-01T12:00:00Z" });
    expect(asDate).toBe(asString);
  });

  it("matches the sha256 of prevHash|canonical byte-for-byte (seed/walker contract)", () => {
    const prev = "a".repeat(64);
    const event: ChainableEvent = { ...baseEvent, metadata: { b: 2, a: 1 } };
    const manual = createHash("sha256")
      .update(
        prev +
          "|" +
          '{"createdAt":"2026-01-15T08:30:00.000Z","ip":"10.0.0.1","metadata":{"a":1,"b":2},"type":"login.success","userAgent":"vitest","userId":"user-1"}',
      )
      .digest("hex");
    expect(computeHash(prev, event)).toBe(manual);
  });

  it("produces a verifiable chain over several events (tamper detection)", () => {
    const events: ChainableEvent[] = [
      { ...baseEvent, type: "login.success" },
      {
        ...baseEvent,
        type: "password.changed",
        userId: null,
        ip: null,
        userAgent: null,
        metadata: null,
      },
      { ...baseEvent, type: "session.revoked" },
    ];
    let prev = GENESIS_HASH;
    const hashes = events.map((e) => {
      prev = computeHash(prev, e);
      return prev;
    });
    // Rewalking from genesis reproduces the same chain
    let reprev = GENESIS_HASH;
    for (const e of events) {
      reprev = computeHash(reprev, e);
      expect(reprev).toBe(hashes[events.indexOf(e)]);
    }
    // Any tampering with a middle event breaks every later link
    const tampered = [...events];
    tampered[1] = { ...tampered[1], type: "tampered" };
    let tprev = GENESIS_HASH;
    const thashes = tampered.map((e) => {
      tprev = computeHash(tprev, e);
      return tprev;
    });
    expect(thashes[1]).not.toBe(hashes[1]);
    expect(thashes[2]).not.toBe(hashes[2]);
    expect(thashes[0]).toBe(hashes[0]); // earlier links unaffected
  });
});
