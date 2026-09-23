"use client";

/**
 * Offline mutation queue — IndexedDB-backed durable outbox.
 *
 * When the network drops mid-session, user mutations (order creation, status
 * changes, …) are stored locally instead of failing, and replayed in FIFO
 * order the moment connectivity returns. IndexedDB (not localStorage) keeps
 * the payload independent of the 5MB quota and survives browser restarts.
 *
 * A 24h age cap drops stale entries at flush time — a queued order older than
 * a day may conflict with the live inventory, so it is surfaced as failed
 * rather than silently replayed.
 */

const DB_NAME = "nextdashboard-offline-queue";
const DB_VERSION = 1;
const STORE = "requests";
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export interface QueuedRequest {
  /** Client-generated unique id (cuid-like; monotonic within a session). */
  id: string;
  /** Queue insertion order — flush replays oldest-first. */
  queuedAt: number;
  /** Absolute URL — queue survives across route/locale changes. */
  url: string;
  method: "POST" | "PUT" | "PATCH" | "DELETE";
  headers: Record<string, string>;
  /** Serialized request body. */
  body: string | null;
  /** Coarse label for the offline indicator ("order", "order-status", …). */
  kind: string;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

/** Persist a mutation for later replay. */
export async function enqueueRequest(
  entry: Omit<QueuedRequest, "id" | "queuedAt">,
): Promise<QueuedRequest> {
  const record: QueuedRequest = {
    ...entry,
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`,
    queuedAt: Date.now(),
  };
  await withStore("readwrite", (store) => store.put(record));
  return record;
}

/** Read (without draining) the queue, oldest first. */
export async function listQueuedRequests(): Promise<QueuedRequest[]> {
  const rows = await withStore<QueuedRequest[]>(
    "readonly",
    (store) => store.getAll() as IDBRequest<QueuedRequest[]>,
  );
  return rows.sort((a, b) => a.queuedAt - b.queuedAt);
}

/** Delete one entry by id (after successful replay or user discard). */
export async function removeQueuedRequest(id: string): Promise<void> {
  await withStore("readwrite", (store) => store.delete(id));
}

/** Count of pending mutations (offline indicator badge). */
export async function countQueuedRequests(): Promise<number> {
  return withStore<number>("readonly", (store) => store.count() as IDBRequest<number>);
}

/** Drop stale entries (>24h old). Returns how many were removed. */
export async function pruneStaleRequests(): Promise<number> {
  const rows = await listQueuedRequests();
  const cutoff = Date.now() - MAX_AGE_MS;
  const stale = rows.filter((r) => r.queuedAt < cutoff);
  for (const r of stale) await removeQueuedRequest(r.id);
  return stale.length;
}

/** Serialize a Request-style body the same way fetch callers do. */
function serializeBody(body: unknown): string | null {
  if (body === undefined || body === null) return null;
  if (typeof body === "string") return body;
  return JSON.stringify(body);
}

/**
 * One-call integration for mutation handlers:
 *
 *   const res = await enqueueAndFlush("/api/orders", "POST", body, "order");
 *   if (res.queued) → offline: the request is stored and will replay later
 *   else            → res.response is the real Response
 *
 * When navigator reports offline the request is queued immediately; online
 * failures (server 5xx, timeouts) surface as real errors — only genuine
 * connectivity failures are queued, so bugs never hide inside the queue.
 */
export async function enqueueAndFlush(
  url: string,
  method: QueuedRequest["method"],
  body: unknown,
  kind: string,
  headers: Record<string, string> = { "Content-Type": "application/json" },
): Promise<{ queued: true; entry: QueuedRequest } | { queued: false; response: Response }> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    const entry = await enqueueRequest({
      url,
      method,
      headers,
      body: serializeBody(body),
      kind,
    });
    return { queued: true, entry };
  }
  const response = await fetch(url, {
    method,
    headers,
    body: body === undefined || body === null ? undefined : serializeBody(body),
  });
  return { queued: false, response };
}

/**
 * Replay the whole queue oldest-first. Skips newly-offline flushes so the
 * remaining entries keep their position. Returns per-entry results for UI
 * reporting; each response body is a small JSON summary (status + id).
 */
export async function flushQueue(): Promise<Array<{ id: string; ok: boolean; status?: number }>> {
  const rows = await listQueuedRequests();
  const results: Array<{ id: string; ok: boolean; status?: number }> = [];

  for (const row of rows) {
    if (typeof navigator !== "undefined" && !navigator.onLine) break;

    // Age cap: stale entries fail instead of silently replaying day-old data.
    if (Date.now() - row.queuedAt > MAX_AGE_MS) {
      await removeQueuedRequest(row.id);
      results.push({ id: row.id, ok: false, status: 410 });
      continue;
    }

    try {
      const res = await fetch(row.url, {
        method: row.method,
        headers: row.headers,
        body: row.body ?? undefined,
      });
      if (res.ok) {
        await removeQueuedRequest(row.id);
        results.push({ id: row.id, ok: true, status: res.status });
      } else {
        // 4xx = the request itself is invalid — replaying can't fix it. Drop
        // it so one poisoned entry doesn't wedge the queue head forever.
        // 5xx = transient server trouble — keep for the next flush.
        if (res.status >= 400 && res.status < 500) {
          await removeQueuedRequest(row.id);
        }
        results.push({ id: row.id, ok: false, status: res.status });
      }
    } catch {
      // Network dropped mid-flush — stop and retry on the next trigger.
      results.push({ id: row.id, ok: false });
      break;
    }
  }
  return results;
}
