import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * Offline-queue unit suite — the durable outbox rules.
 *
 * jsdom has no IndexedDB, so a minimal in-memory implementation backs the
 * module under test (open/transaction/store with the four operations the
 * queue uses). fetch and navigator.onLine are stubbed per test so the
 * enqueue/flush decision matrix is exercised deterministically:
 *
 *   offline → queue immediately (no network call)
 *   online  → real fetch, nothing stored
 *   flush   → oldest-first replay; 2xx removes, 4xx drops (poison),
 *             5xx keeps (transient), >24h fails as 410 without a request,
 *             network drop mid-flush stops and preserves position.
 */

vi.mock("node:fs", () => ({}));

interface Row {
  id: string;
  queuedAt: number;
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string | null;
  kind: string;
}

/** Minimal IDBRequest: value resolves async like the real thing. */
class FakeRequest<T> {
  result: T;
  error: unknown = null;
  onsuccess: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onupgradeneeded: ((ev: never) => void) | null = null;
  constructor(getValue: () => T) {
    this.result = getValue();
    queueMicrotask(() => this.onsuccess?.());
  }
}

class FakeObjectStore {
  constructor(private rows: Map<string, Row>) {}

  put(record: Row) {
    return new FakeRequest(() => {
      this.rows.set(record.id, record);
      return record.id;
    });
  }
  getAll() {
    return new FakeRequest<Row[]>(() => [...this.rows.values()]);
  }
  get(id: string) {
    return new FakeRequest<Row | undefined>(() => this.rows.get(id));
  }
  delete(id: string) {
    return new FakeRequest(() => {
      this.rows.delete(id);
      return undefined;
    });
  }
  count() {
    return new FakeRequest<number>(() => this.rows.size);
  }
}

class FakeTransaction {
  constructor(private store: FakeObjectStore) {}
  objectStore() {
    return this.store;
  }
  oncomplete: (() => void) | null = null;
  onerror: (() => void) | null = null;
}

class FakeDB {
  constructor(private rows: Map<string, Row>) {}
  objectStoreNames = { contains: () => true };
  createObjectStore() {
    return new FakeObjectStore(this.rows);
  }
  transaction() {
    return new FakeTransaction(new FakeObjectStore(this.rows));
  }
  close() {}
}

const rows = new Map<string, Row>();

const idb = {
  open: () => {
    const req = new FakeRequest<IDBDatabase>(() => new FakeDB(rows) as unknown as IDBDatabase);
    queueMicrotask(() => req.onupgradeneeded?.(null as never));
    return req;
  },
};

beforeEach(() => {
  rows.clear();
  vi.stubGlobal("indexedDB", idb);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

import {
  enqueueRequest,
  listQueuedRequests,
  countQueuedRequests,
  removeQueuedRequest,
  pruneStaleRequests,
  flushQueue,
  enqueueAndFlush,
} from "@/lib/offline-queue";

const entry = (url: string, extra: Partial<Row> = {}) => ({
  url,
  method: "PUT" as const,
  headers: { "Content-Type": "application/json" } as Record<string, string>,
  body: JSON.stringify({ status: "PROCESSING" }),
  kind: "order-status",
  ...extra,
});

/** Enqueue n entries at distinct timestamps; returns the queued records. */
async function enqueueAt(url: string, when: number, extra: Partial<Row> = {}) {
  vi.useFakeTimers();
  vi.setSystemTime(when);
  const rec = await enqueueRequest(entry(url, extra) as Parameters<typeof enqueueRequest>[0]);
  vi.useRealTimers();
  return rec;
}

describe("offline queue — enqueue & ordering", () => {
  it("stores entries and lists them oldest-first (FIFO)", async () => {
    const base = Date.now() - 10_000;
    const a = await enqueueAt("/api/orders/1", base);
    const b = await enqueueAt("/api/orders/2", base + 1_000);
    const c = await enqueueAt("/api/orders/3", base + 2_000);

    const list = await listQueuedRequests();
    expect(list.map((r) => r.id)).toEqual([a.id, b.id, c.id]);
    await expect(countQueuedRequests()).resolves.toBe(3);
  });

  it("enqueueAndFlush queues without a network call while offline", async () => {
    vi.stubGlobal("navigator", { onLine: false });
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const res = await enqueueAndFlush(
      "/api/orders/9",
      "PUT",
      { status: "SHIPPED" },
      "order-status",
    );

    expect(res.queued).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
    await expect(countQueuedRequests()).resolves.toBe(1);
  });

  it("enqueueAndFlush performs a real fetch and stores nothing while online", async () => {
    vi.stubGlobal("navigator", { onLine: true });
    const fetchSpy = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchSpy);

    const res = await enqueueAndFlush(
      "/api/orders/9",
      "PUT",
      { status: "SHIPPED" },
      "order-status",
    );

    expect(res.queued).toBe(false);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    await expect(countQueuedRequests()).resolves.toBe(0);
  });
});

describe("offline queue — flush outcomes", () => {
  it("replays oldest-first and removes entries on 2xx", async () => {
    const base = Date.now() - 5_000;
    const a = await enqueueAt("/api/a", base);
    const b = await enqueueAt("/api/b", base + 500);

    const calls: string[] = [];
    vi.stubGlobal("navigator", { onLine: true });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        calls.push(String(input));
        return new Response("{}", { status: 200 });
      }),
    );

    const results = await flushQueue();
    expect(calls).toEqual(["/api/a", "/api/b"]);
    expect(results).toEqual([
      { id: a.id, ok: true, status: 200 },
      { id: b.id, ok: true, status: 200 },
    ]);
    await expect(countQueuedRequests()).resolves.toBe(0);
  });

  it("drops 4xx entries — a poisoned request cannot wedge the queue head", async () => {
    const base = Date.now() - 5_000;
    const bad = await enqueueAt("/api/bad", base);
    const good = await enqueueAt("/api/good", base + 500);

    vi.stubGlobal("navigator", { onLine: true });
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async (input: RequestInfo | URL) =>
          new Response("{}", { status: String(input).endsWith("/bad") ? 422 : 200 }),
      ),
    );

    const results = await flushQueue();
    const byId = new Map(results.map((r) => [r.id, r]));
    expect(byId.get(bad.id)).toMatchObject({ ok: false, status: 422 });
    expect(byId.get(good.id)).toMatchObject({ ok: true, status: 200 });
    // The 422 was dropped, the good one replayed — queue is drained.
    await expect(countQueuedRequests()).resolves.toBe(0);
    await removeQueuedRequest(good.id); // no-op safety for the shared map
  });

  it("keeps 5xx entries for the next flush (transient server trouble)", async () => {
    const base = Date.now() - 5_000;
    const flaky = await enqueueAt("/api/flaky", base);

    vi.stubGlobal("navigator", { onLine: true });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status: 503 })),
    );

    let results = await flushQueue();
    expect(results[0]).toMatchObject({ id: flaky.id, ok: false, status: 503 });
    // Still queued — retryable.
    await expect(countQueuedRequests()).resolves.toBe(1);

    // Server recovers → next flush succeeds and drains.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status: 200 })),
    );
    results = await flushQueue();
    expect(results[0]).toMatchObject({ id: flaky.id, ok: true, status: 200 });
    await expect(countQueuedRequests()).resolves.toBe(0);
  });

  it("fails entries older than 24h as 410 without issuing the request", async () => {
    const stale = await enqueueAt("/api/stale", Date.now() - 25 * 60 * 60 * 1000);
    const fresh = await enqueueAt("/api/fresh", Date.now() - 1_000);

    const fetchSpy = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("navigator", { onLine: true });
    vi.stubGlobal("fetch", fetchSpy);

    const results = await flushQueue();
    const byId = new Map(results.map((r) => [r.id, r]));
    expect(byId.get(stale.id)).toMatchObject({ ok: false, status: 410 });
    expect(byId.get(fresh.id)).toMatchObject({ ok: true, status: 200 });
    expect(fetchSpy).toHaveBeenCalledTimes(1); // stale never hit the network
    await expect(countQueuedRequests()).resolves.toBe(0);
  });

  it("stops mid-flush when the network drops and keeps remaining entries", async () => {
    const base = Date.now() - 5_000;
    const first = await enqueueAt("/api/first", base);
    const second = await enqueueAt("/api/second", base + 500);
    const third = await enqueueAt("/api/third", base + 1_000);

    vi.stubGlobal("navigator", { onLine: true });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        if (String(input).endsWith("/second")) {
          throw new TypeError("Failed to fetch");
        }
        return new Response("{}", { status: 200 });
      }),
    );

    const results = await flushQueue();
    expect(results[0]).toMatchObject({ id: first.id, ok: true });
    // The failed one and everything after it stay put, in order.
    const remaining = await listQueuedRequests();
    expect(remaining.map((r) => r.id)).toEqual([second.id, third.id]);
  });
});

describe("offline queue — staleness pruning", () => {
  it("prunes only entries beyond the 24h cap", async () => {
    await enqueueAt("/api/old", Date.now() - 48 * 60 * 60 * 1000);
    await enqueueAt("/api/edge", Date.now() - (24 * 60 * 60 * 1000 + 60_000));
    await enqueueAt("/api/new", Date.now() - 60_000);

    const removed = await pruneStaleRequests();
    expect(removed).toBe(2);
    const list = await listQueuedRequests();
    expect(list.map((r) => r.url)).toEqual(["/api/new"]);
  });
});
