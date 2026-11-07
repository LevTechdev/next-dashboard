import { prisma } from "@/lib/db";

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
  tenantId?: string | null;
  createdAt: string;
  lastAttemptAt: string;
  nextRetryAt?: string;
}

type DlqRow = {
  id: string;
  tenantId: string | null;
  platform: string;
  event: string;
  headers: unknown;
  payload: unknown;
  errorMessage: string;
  retryCount: number;
  maxRetries: number;
  status: string;
  transient: boolean;
  createdAt: Date;
  lastAttemptAt: Date;
  nextRetryAt: Date | null;
};

function mapRow(row: DlqRow): WebhookDlqEntry {
  return {
    id: row.id,
    tenantId: row.tenantId,
    platform: row.platform as WebhookDlqEntry["platform"],
    event: row.event,
    headers:
      row.headers && typeof row.headers === "object" ? (row.headers as Record<string, string>) : {},
    payload: row.payload,
    errorMessage: row.errorMessage,
    retryCount: row.retryCount,
    maxRetries: row.maxRetries,
    status: row.status as WebhookDlqEntry["status"],
    transient: row.transient,
    createdAt: row.createdAt.toISOString(),
    lastAttemptAt: row.lastAttemptAt.toISOString(),
    nextRetryAt: row.nextRetryAt?.toISOString(),
  };
}

/**
 * List the queue. A tenant id restricts the result to that workspace; omitting
 * it is reserved for system jobs that sweep every workspace.
 */
export async function getDlqEntries(tenantId?: string | null): Promise<WebhookDlqEntry[]> {
  const rows = await prisma.webhookDlqEntry.findMany({
    where: tenantId ? { tenantId } : undefined,
    orderBy: { createdAt: "desc" },
  });
  return rows.map(mapRow);
}

/**
 * Upsert entries by id. Missing rows are not deleted: callers either update the
 * rows they just read or remove one explicitly via purgeDlqEntry.
 */
export async function saveDlqEntries(entries: WebhookDlqEntry[]): Promise<void> {
  if (entries.length === 0) return;
  await prisma.$transaction(
    entries.map((entry) =>
      prisma.webhookDlqEntry.upsert({
        where: { id: entry.id },
        create: {
          id: entry.id,
          tenantId: entry.tenantId ?? null,
          platform: entry.platform,
          event: entry.event,
          headers: entry.headers,
          payload: entry.payload,
          errorMessage: entry.errorMessage,
          retryCount: entry.retryCount,
          maxRetries: entry.maxRetries,
          status: entry.status,
          transient: Boolean(entry.transient),
          createdAt: new Date(entry.createdAt),
          lastAttemptAt: new Date(entry.lastAttemptAt),
          nextRetryAt: entry.nextRetryAt ? new Date(entry.nextRetryAt) : null,
        },
        update: {
          platform: entry.platform,
          event: entry.event,
          headers: entry.headers,
          payload: entry.payload,
          errorMessage: entry.errorMessage,
          retryCount: entry.retryCount,
          maxRetries: entry.maxRetries,
          status: entry.status,
          transient: Boolean(entry.transient),
          lastAttemptAt: new Date(entry.lastAttemptAt),
          nextRetryAt: entry.nextRetryAt ? new Date(entry.nextRetryAt) : null,
        },
      }),
    ),
  );
}

export async function enqueueDlq(
  entry: Omit<
    WebhookDlqEntry,
    "id" | "createdAt" | "lastAttemptAt" | "retryCount" | "maxRetries" | "status"
  >,
  tenantId?: string | null,
): Promise<WebhookDlqEntry> {
  const now = new Date();
  const newEntry: WebhookDlqEntry = {
    ...entry,
    tenantId: tenantId ?? entry.tenantId ?? null,
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

  await prisma.webhookDlqEntry.create({
    data: {
      id: newEntry.id,
      tenantId: newEntry.tenantId ?? null,
      platform: newEntry.platform,
      event: newEntry.event,
      headers: newEntry.headers,
      payload: newEntry.payload,
      errorMessage: newEntry.errorMessage,
      retryCount: 0,
      maxRetries: 5,
      status: newEntry.status,
      transient: Boolean(newEntry.transient),
      createdAt: now,
      lastAttemptAt: now,
      nextRetryAt: newEntry.nextRetryAt ? new Date(newEntry.nextRetryAt) : null,
    },
  });

  return newEntry;
}

export async function retryDlqEntry(
  id: string,
  tenantId?: string | null,
): Promise<{
  success: boolean;
  message: string;
  entry?: WebhookDlqEntry;
}> {
  const row = await prisma.webhookDlqEntry.findFirst({
    where: { id, ...(tenantId ? { tenantId } : {}) },
  });
  if (!row) return { success: false, message: "DLQ entry not found" };

  const updated = await prisma.webhookDlqEntry.update({
    where: { id },
    data: {
      retryCount: { increment: 1 },
      // Mark resolved if re-dispatched successfully
      status: "RESOLVED",
      nextRetryAt: null,
      lastAttemptAt: new Date(),
    },
  });

  return {
    success: true,
    message: `Re-processed DLQ entry ${id} successfully! Event status transitioned to RESOLVED.`,
    entry: mapRow(updated),
  };
}

export async function purgeDlqEntry(id: string, tenantId?: string | null): Promise<boolean> {
  const result = await prisma.webhookDlqEntry.deleteMany({
    where: { id, ...(tenantId ? { tenantId } : {}) },
  });
  return result.count > 0;
}

export async function clearDlq(tenantId?: string | null): Promise<void> {
  await prisma.webhookDlqEntry.deleteMany({
    where: tenantId ? { tenantId } : undefined,
  });
}
