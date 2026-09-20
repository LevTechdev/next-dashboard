import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-guard";
import { getTenantId } from "@/lib/tenancy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Web Push subscription registry — the missing half of the push stack.
 *
 * The client already asks permission and builds a PushSubscription
 * (lib/push-notifications.ts) and the service worker handles push +
 * notificationclick events (public/sw.js); the notifications page has been
 * POSTing here since the Alert Rules tab shipped. These routes persist and
 * remove the subscription rows; delivery lives in lib/web-push.ts.
 */

interface PushSubscriptionPayload {
  endpoint?: string;
  keys?: { p256dh?: string; auth?: string };
}

export async function POST(req: Request) {
  const { session, response } = await requireAuth(req);
  if (response) return response;
  const userId = session.user.id;
  const tenantId = getTenantId(session);

  const body = (await req.json().catch(() => null)) as {
    subscription?: PushSubscriptionPayload;
  } | null;
  const sub = body?.subscription;
  if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
    return NextResponse.json(
      { error: "Invalid subscription — endpoint and keys required" },
      { status: 400 },
    );
  }

  const userAgent = req.headers.get("user-agent")?.slice(0, 250) ?? null;

  // Upsert on the unique endpoint: re-subscribing the same browser refreshes
  // its keys (they rotate on resubscribe) instead of piling rows.
  const row = await prisma.pushSubscription.upsert({
    where: { endpoint: sub.endpoint },
    create: {
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
      userId,
      tenantId,
      userAgent,
    },
    update: {
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
      userId,
      tenantId,
      userAgent,
    },
  });

  return NextResponse.json({ ok: true, id: row.id });
}

export async function DELETE(req: Request) {
  const { session, response } = await requireAuth(req);
  if (response) return response;

  const body = (await req.json().catch(() => null)) as { endpoint?: string } | null;
  if (!body?.endpoint) {
    return NextResponse.json({ error: "endpoint required" }, { status: 400 });
  }

  // Scope the delete to the caller: a stolen cookie can't prune someone
  // else's subscriptions.
  await prisma.pushSubscription.deleteMany({
    where: { endpoint: body.endpoint, userId: session.user.id },
  });

  return NextResponse.json({ ok: true });
}
