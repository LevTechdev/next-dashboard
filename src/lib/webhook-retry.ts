import { getDlqEntries, saveDlqEntries, type WebhookDlqEntry } from "@/lib/webhook-dlq-store";

/**
 * Webhook delivery health — automatic retry scheduling for failed inbound
 * webhooks.
 *
 * Failed deliveries land in the DLQ (webhook-dlq-store.ts); this module
 * schedules their re-delivery with capped exponential backoff and promotes
 * entries that exceed MAX_ATTEMPTS to a terminal FAILED state (no
 * nextRetryAt). The dispatcher is injected so tests can drive retries
 * without HTTP, and the UI's one-click "Replay" reuses the same path.
 */

export const MAX_ATTEMPTS = 5;
/** Base delay for the first retry — doubles each attempt, capped at 30 min. */
export const BASE_DELAY_MS = 5 * 60_000;
const MAX_DELAY_MS = 30 * 60_000;

export function backoffDelay(retryCount: number): number {
  return Math.min(BASE_DELAY_MS * Math.pow(2, Math.max(0, retryCount - 1)), MAX_DELAY_MS);
}

/**
 * Sweep due entries: anything RETRYING whose nextRetryAt has passed gets
 * dispatched. A successful dispatch marks the entry RESOLVED; a failure
 * either schedules the next backoff or promotes to terminal FAILED once
 * MAX_ATTEMPTS is reached.
 *
 * @param dispatch re-delivers an entry; return true on success.
 * @param now injectable clock for tests.
 */
export async function processDueRetries(
  dispatch: (entry: WebhookDlqEntry) => Promise<boolean>,
  now: Date = new Date(),
): Promise<{ attempted: number; resolved: number; failed: number }> {
  const entries = getDlqEntries();
  const result = { attempted: 0, resolved: 0, failed: 0 };

  for (const entry of entries) {
    if (entry.status !== "RETRYING") continue;
    if (!entry.nextRetryAt || new Date(entry.nextRetryAt) > now) continue;

    result.attempted += 1;
    const ok = await dispatch(entry);
    entry.lastAttemptAt = now.toISOString();

    if (ok) {
      entry.status = "RESOLVED";
      entry.nextRetryAt = undefined;
      result.resolved += 1;
    } else if (entry.retryCount + 1 >= MAX_ATTEMPTS) {
      // Terminal failure — stays FAILED, never retried again.
      entry.retryCount += 1;
      entry.status = "FAILED";
      entry.nextRetryAt = undefined;
      result.failed += 1;
    } else {
      entry.retryCount += 1;
      entry.status = "RETRYING";
      entry.nextRetryAt = new Date(now.getTime() + backoffDelay(entry.retryCount)).toISOString();
      result.failed += 1;
    }
  }

  saveDlqEntries(entries);
  return result;
}

/**
 * Schedule (or re-schedule) an entry for automatic retry. Used by the DLQ
 * "Replay" action: moves the entry into RETRYING with an immediate
 * nextRetryAt so the next sweep picks it up.
 */
export function scheduleRetry(id: string): {
  success: boolean;
  message: string;
  entry?: WebhookDlqEntry;
} {
  const entries = getDlqEntries();
  const item = entries.find((e) => e.id === id);
  if (!item) return { success: false, message: "DLQ entry not found" };

  item.status = "RETRYING";
  item.nextRetryAt = new Date().toISOString();
  saveDlqEntries(entries);
  return { success: true, message: `Scheduled retry for DLQ entry ${id}`, entry: item };
}

/** True when an entry has exhausted every attempt (terminal state). */
export function isExhausted(entry: WebhookDlqEntry): boolean {
  return entry.status === "FAILED" && entry.retryCount >= MAX_ATTEMPTS && !entry.nextRetryAt;
}
