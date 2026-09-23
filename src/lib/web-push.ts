import "server-only";

import webpush from "web-push";
import { prisma } from "@/lib/db";

/**
 * Server-side Web Push delivery — closes the loop for closed tabs.
 *
 * In-app toasts vanish after ~6s and the bell only helps users who log in;
 * push reaches the browser even when the app tab is closed. Subscriptions
 * are registered by /api/notifications/push-subscribe; this module delivers.
 *
 * Delivery rules:
 *  - a 404/410 from the push service means the subscription is dead — it is
 *    pruned so the registry never accumulates ghosts
 *  - failures never throw into the caller: push is best-effort by design
 *    (the DB notification is the durable record)
 */

let configured: boolean | null = null;

function ensureConfigured(): boolean {
  if (configured !== null) return configured;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  // Subject (mailto or https URL) is required by some push services.
  const subject = process.env.VAPID_SUBJECT ?? "mailto:alerts@nextdashboard.local";
  if (!publicKey || !privateKey) {
    configured = false;
    return configured;
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return configured;
}

/** Whether push delivery is possible in this deployment. */
export function pushConfigured(): boolean {
  return ensureConfigured();
}

export interface PushPayload {
  title: string;
  body?: string;
  /** App path to open on click (the SW resolves it against the origin). */
  url?: string;
  tag?: string;
}

/** Send one notification; prunes the subscription on 404/410. Returns delivered. */
async function sendToOne(
  sub: { id: string; endpoint: string; p256dh: string; auth: string },
  payload: PushPayload,
): Promise<boolean> {
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload),
      { TTL: 60 * 60 * 24 }, // 24h — stale news is worthless
    );
    return true;
  } catch (err: unknown) {
    const status = (err as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) {
      // Subscription expired/revoked — prune so retries never hit it again.
      try {
        await prisma.pushSubscription.deleteMany({ where: { id: sub.id } });
      } catch {
        // Registry cleanup is best-effort.
      }
    }
    return false;
  }
}

/** Push to every subscription of one user. */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<number> {
  if (!ensureConfigured()) return 0;
  const subs = await prisma.pushSubscription.findMany({
    where: { userId },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });
  const results = await Promise.all(subs.map((s) => sendToOne(s, payload)));
  return results.filter(Boolean).length;
}

/** Push to every member of a workspace (tenant-scoped broadcast). */
export async function sendPushToTenant(
  tenantId: string | null | undefined,
  payload: PushPayload,
  opts: { roles?: string[] } = {},
): Promise<number> {
  if (!ensureConfigured() || !tenantId) return 0;
  const subs = await prisma.pushSubscription.findMany({
    where: { tenantId, ...(opts.roles?.length ? { user: { role: { in: opts.roles } } } : {}) },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });
  const results = await Promise.all(subs.map((s) => sendToOne(s, payload)));
  return results.filter(Boolean).length;
}
