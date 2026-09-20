/**
 * Webhook DLQ dispatch — re-delivers a stored payload to its endpoint.
 *
 * Used by the scheduler's webhook-retry sweep (and available for admin
 * replay). The DLQ entry keeps the original endpoint URL, platform, event
 * and payload, so a retry reproduces the original delivery.
 */

import type { WebhookDlqEntry } from "@/lib/webhook-dlq-store";

/**
 * Attempt one re-delivery. Return true when the endpoint accepts the
 * delivery (2xx), false on any failure — the retry engine handles backoff
 * and DLQ promotion from there.
 */
export async function dispatchWebhookRetry(entry: WebhookDlqEntry): Promise<boolean> {
  const url = (entry as { endpointUrl?: string }).endpointUrl;
  if (!url || !/^https?:\/\//.test(url)) return false;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-webhook-event": entry.event,
        "x-webhook-platform": entry.platform,
        "user-agent": "NextDashboard-Webhooks/1.0",
      },
      body: typeof entry.payload === "string" ? entry.payload : JSON.stringify(entry.payload),
      signal: AbortSignal.timeout(10_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
