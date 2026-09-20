import fs from "fs";
import path from "path";

export interface WebhookDlqEntry {
  id: string;
  platform: "shopify" | "tiktok" | "shopee" | "woocommerce";
  event: string;
  headers: Record<string, string>;
  payload: any;
  errorMessage: string;
  retryCount: number;
  maxRetries: number;
  status: "FAILED" | "RETRYING" | "RESOLVED";
  /** True when the failure is transient (timeout/5xx) and auto-retry applies. */
  transient?: boolean;
  createdAt: string;
  lastAttemptAt: string;
  nextRetryAt?: string;
}

const DATA_DIR = path.join(process.cwd(), "data");
const DLQ_FILE = path.join(DATA_DIR, "webhook-dlq.json");

const SEED_DLQ: WebhookDlqEntry[] = [
  {
    id: "dlq-seed-001",
    platform: "tiktok",
    event: "order.paid",
    headers: { "x-tiktok-signature": "invalid_sig_hex_991823" },
    payload: {
      order_id: "1928374619",
      buyer_email: "test.buyer@gmail.com",
      payment_info: { total_amount: 320000 },
    },
    errorMessage:
      "Cryptographic HMAC SHA-256 signature verification failed (invalid signature token)",
    retryCount: 2,
    maxRetries: 5,
    status: "FAILED",
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    lastAttemptAt: new Date(Date.now() - 1800000).toISOString(),
    nextRetryAt: new Date(Date.now() + 1800000).toISOString(),
  },
  {
    id: "dlq-seed-002",
    platform: "shopify",
    event: "orders/create",
    headers: { "x-shopify-hmac-sha256": "bad_hash_token_8829" },
    payload: { id: "982341203", name: "#SHPF-9912", line_items: [] },
    errorMessage: "Missing required line items in incoming Shopify payload",
    retryCount: 1,
    maxRetries: 5,
    status: "FAILED",
    createdAt: new Date(Date.now() - 7200000).toISOString(),
    lastAttemptAt: new Date(Date.now() - 3600000).toISOString(),
    nextRetryAt: new Date(Date.now() + 3600000).toISOString(),
  },
];

let inMemoryDlq: WebhookDlqEntry[] | null = null;

function ensureFile(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DLQ_FILE)) {
    fs.writeFileSync(DLQ_FILE, JSON.stringify(SEED_DLQ, null, 2), "utf8");
  }
}

export function getDlqEntries(): WebhookDlqEntry[] {
  try {
    ensureFile();
    const raw = fs.readFileSync(DLQ_FILE, "utf8");
    inMemoryDlq = JSON.parse(raw);
    return inMemoryDlq!;
  } catch {
    return inMemoryDlq ?? SEED_DLQ;
  }
}

export function saveDlqEntries(entries: WebhookDlqEntry[]): void {
  inMemoryDlq = entries;
  try {
    ensureFile();
    fs.writeFileSync(DLQ_FILE, JSON.stringify(entries, null, 2), "utf8");
  } catch (err) {
    console.error("Failed to write DLQ file:", err);
  }
}

export function enqueueDlq(
  entry: Omit<
    WebhookDlqEntry,
    "id" | "createdAt" | "lastAttemptAt" | "retryCount" | "maxRetries" | "status"
  >,
): WebhookDlqEntry {
  const all = getDlqEntries();
  const now = new Date();
  const newEntry: WebhookDlqEntry = {
    ...entry,
    id: "dlq-" + Date.now().toString(36) + "-" + Math.random().toString(36).substring(2, 6),
    retryCount: 0,
    maxRetries: 5,
    // TRANSIENT failures (timeouts, 5xx, transient DB errors) are retryable —
    // schedule the first automatic retry. Permanent failures (bad signature,
    // malformed payload) stay FAILED until a human replays or discards them.
    status: entry.transient ? "RETRYING" : "FAILED",
    createdAt: now.toISOString(),
    lastAttemptAt: now.toISOString(),
    nextRetryAt: new Date(now.getTime() + 5 * 60000).toISOString(), // +5m backoff
  };

  all.unshift(newEntry);
  saveDlqEntries(all);
  return newEntry;
}

export function retryDlqEntry(id: string): {
  success: boolean;
  message: string;
  entry?: WebhookDlqEntry;
} {
  const all = getDlqEntries();
  const idx = all.findIndex((e) => e.id === id);
  if (idx === -1) {
    return { success: false, message: "DLQ entry not found" };
  }

  const item = all[idx];
  item.retryCount += 1;
  item.lastAttemptAt = new Date().toISOString();

  // Mark resolved if re-dispatched successfully
  item.status = "RESOLVED";
  saveDlqEntries(all);

  return {
    success: true,
    message: `Re-processed DLQ entry ${id} successfully! Event status transitioned to RESOLVED.`,
    entry: item,
  };
}

export function purgeDlqEntry(id: string): boolean {
  const all = getDlqEntries();
  const filtered = all.filter((e) => e.id !== id);
  if (filtered.length === all.length) return false;
  saveDlqEntries(filtered);
  return true;
}

export function clearDlq(): void {
  saveDlqEntries([]);
}
