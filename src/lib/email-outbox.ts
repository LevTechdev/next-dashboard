import "server-only";

import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { logEmailDelivery } from "@/lib/email-delivery";
import {
  describeMailConfiguration,
  isTransientMailError,
  sendTemplatedEmail,
  type EmailTemplate,
  type MailTransport,
} from "@/lib/email";
import { createOtpPayload } from "@/lib/email-otp";

/**
 * Durable outbound-email queue.
 *
 * WHY: mail used to be sent inline, inside the request that triggered it, and
 * awaited. A cold SMTP/TLS handshake to Gmail measured ~16s here — longer than
 * a serverless function's budget, so the send was killed mid-flight and the
 * message was simply gone, while the user had already been told to check their
 * inbox. There was also no retry: a provider blip (429, timeout, 4xx) lost the
 * mail permanently.
 *
 * The contract here is **at-least-once**: a row is persisted before any
 * transport is touched, the send is attempted off the response path, and the
 * scheduler keeps retrying transient failures with backoff. A duplicate is
 * possible in the narrow case where a delivery completes after its claim lease
 * expired (see CLAIM_LEASE_MS) — acceptable, because a duplicated signup code or
 * receipt beats a missing one, and the newest code is the one that verifies.
 */

/** Rows one drain pass touches. */
const DEFAULT_DRAIN_LIMIT = 25;
/** Backoff before retry N: 1, 2, 4, 8 … minutes, capped. */
const BASE_BACKOFF_MS = 60_000;
const MAX_BACKOFF_MS = 30 * 60_000;
/**
 * How long a claim may stay in flight before another drain may take the row.
 * A process that claimed a row and then died (killed mid-handshake) leaves it in
 * SENDING forever otherwise — this is what makes the fast path and the sweep
 * safe to run at the same time.
 */
const CLAIM_LEASE_MS = 2 * 60_000;

export interface EnqueueEmailInput {
  to: string;
  template: EmailTemplate;
  /** Non-secret render inputs only — never a one-time code. */
  params?: Record<string, unknown>;
  userId?: string | null;
  tenantId?: string | null;
  locale?: string | null;
}

export interface DrainEmailOutboxResult {
  sent: number;
  retried: number;
  failed: number;
  skipped: number;
}

/** Statuses a row can hold. Kept as strings to match the rest of the schema. */
type EmailOutboxStatus = "PENDING" | "SENDING" | "SENT" | "FAILED" | "CANCELLED";

interface EmailOutboxRow {
  id: string;
  to: string;
  template: string;
  params: unknown;
  userId: string | null;
  tenantId: string | null;
  locale: string | null;
  status: string;
  attempts: number;
  maxAttempts: number;
  nextAttemptAt: Date;
  claimedAt: Date | null;
}

const errorText = (err: unknown): string => (err instanceof Error ? err.message : String(err));

/** Attempts left before a row is declared undeliverable. */
function backoffMs(attempts: number): number {
  const delay = BASE_BACKOFF_MS * 2 ** Math.max(0, attempts - 1);
  return Math.min(delay, MAX_BACKOFF_MS);
}

/**
 * Queue a message for delivery. Returns as soon as the row is durable — the
 * transport handshake happens after the response (or on the next scheduler tick
 * if this process does not survive long enough).
 */
export async function enqueueEmail(input: EnqueueEmailInput): Promise<{ id: string }> {
  // A one-time code must not race an older copy of itself. The DB holds only
  // the newest hash, so an older queued OTP would deliver a code that can never
  // verify; cancel undelivered siblings and let this one own the mailbox.
  if (input.template === "verify_email" && input.userId) {
    await prisma.emailOutbox.updateMany({
      where: {
        userId: input.userId,
        template: "verify_email",
        status: { in: ["PENDING", "SENDING"] as EmailOutboxStatus[] },
      },
      data: { status: "CANCELLED" },
    });
  }

  const row = await prisma.emailOutbox.create({
    data: {
      to: input.to,
      template: input.template,
      params: (input.params ?? undefined) as Prisma.InputJsonValue | undefined,
      userId: input.userId ?? null,
      tenantId: input.tenantId ?? undefined,
      locale: input.locale ?? undefined,
    },
    select: { id: true },
  });

  await kickEmailOutbox();
  return row;
}

/**
 * Start a drain off the response path.
 *
 * Inside a request, `after()` is the right tool: the response is flushed first,
 * so a slow transport no longer holds the API call open (nor gets it killed
 * mid-send). Outside a request scope — scripts, the scheduler, tests — there is
 * nothing to defer to, so the drain runs inline.
 */
export async function kickEmailOutbox(): Promise<"after" | "inline" | "skipped"> {
  try {
    const { after } = await import("next/server");
    after(async () => {
      try {
        await drainEmailOutbox();
      } catch (err) {
        console.error("[email-outbox] deferred drain failed:", errorText(err));
      }
    });
    return "after";
  } catch {
    // No request scope here. Tests drive the drain explicitly, so they must not
    // fire real transports as a side effect of enqueueing.
    if (process.env.NODE_ENV === "test") return "skipped";
    try {
      await drainEmailOutbox();
      return "inline";
    } catch (err) {
      console.error("[email-outbox] inline drain failed:", errorText(err));
      return "inline";
    }
  }
}

/**
 * Deliver one queued row. `verify_email` is re-issued rather than replayed: the
 * code is generated HERE and the stored hash replaced, so a message that waited
 * for a retry always carries a code that verifies (and never sits in the queue,
 * where a DB reader could use it).
 */
async function deliverRow(
  row: EmailOutboxRow,
): Promise<{ sent: boolean; transport: MailTransport; reason?: string }> {
  const transport = describeMailConfiguration().transport;
  const template = row.template as EmailTemplate;
  const locale = row.locale ?? undefined;

  if (template === "verify_email") {
    if (!row.userId) {
      return {
        sent: false,
        transport,
        reason: "queued verify_email row has no user to re-issue for",
      };
    }
    const { code, hash, expiresAt } = createOtpPayload();
    await prisma.user.update({
      where: { id: row.userId },
      data: { emailOtpHash: hash, emailOtpExpires: expiresAt, emailOtpAttempts: 0 },
    });
    const outcome = await sendTemplatedEmail("verify_email", {
      to: row.to,
      code,
      locale,
    });
    return {
      sent: outcome.sent,
      transport: outcome.transport ?? transport,
      reason: outcome.reason,
    };
  }

  const params = (row.params ?? {}) as Record<string, unknown>;
  const outcome = await sendTemplatedEmail(template, { ...params, to: row.to, locale });
  // The reason must survive: it is what the failure is recorded and retried on.
  return { sent: outcome.sent, transport: outcome.transport ?? transport, reason: outcome.reason };
}

/**
 * Deliver every due row. Also reclaims rows whose claim lease expired, so a
 * request killed mid-send does not strand its message in SENDING.
 */
export async function drainEmailOutbox(
  options: { limit?: number; now?: Date } = {},
): Promise<DrainEmailOutboxResult> {
  const now = options.now ?? new Date();
  const limit = options.limit ?? DEFAULT_DRAIN_LIMIT;
  const result: DrainEmailOutboxResult = { sent: 0, retried: 0, failed: 0, skipped: 0 };

  const due = (await prisma.emailOutbox.findMany({
    where: {
      OR: [
        { status: "PENDING", nextAttemptAt: { lte: now } },
        { status: "SENDING", claimedAt: { lte: new Date(now.getTime() - CLAIM_LEASE_MS) } },
      ],
    },
    orderBy: { createdAt: "asc" },
    take: limit,
  })) as unknown as EmailOutboxRow[];

  for (const row of due) {
    // Optimistic claim: only the drain that flips the reported status owns the
    // row. Two concurrent drains can see the same row; exactly one wins.
    const claimed = await prisma.emailOutbox.updateMany({
      where: { id: row.id, status: row.status },
      data: { status: "SENDING", claimedAt: now },
    });
    if (claimed.count === 0) {
      result.skipped += 1;
      continue;
    }

    let sent = false;
    let transport: MailTransport | undefined;
    let reason: string | undefined;
    let transient = false;
    try {
      const outcome = await deliverRow(row);
      sent = outcome.sent;
      transport = outcome.transport;
      reason = outcome.reason;
      // A declined send (no mailer, provider rejection reported as an outcome)
      // is classified from its reason; a thrown error is classified directly.
      transient = !sent && isTransientMailError(outcome.reason ?? "");
    } catch (err) {
      reason = errorText(err);
      transient = isTransientMailError(err);
    }

    const attempts = row.attempts + 1;

    if (sent) {
      await prisma.emailOutbox.update({
        where: { id: row.id },
        data: { status: "SENT", sentAt: new Date(), attempts, transport, lastError: null },
      });
      await logEmailDelivery({
        userId: row.userId,
        status: "sent",
        template: auditTemplate(row.template),
        to: row.to,
        transport: transport ?? "none",
        tenantId: row.tenantId,
      });
      result.sent += 1;
      continue;
    }

    // A permanent failure (bad sender, invalid API key, stale recipient, no
    // mailer at all) will not be fixed by waiting; record it once and let the
    // operator see it. Transient failures get the remaining attempts.
    const giveUp = !transient || attempts >= row.maxAttempts;
    const failureReason = reason ?? "transport did not accept the message";

    if (giveUp) {
      await prisma.emailOutbox.update({
        where: { id: row.id },
        data: { status: "FAILED", attempts, transport, lastError: failureReason.slice(0, 500) },
      });
      await logEmailDelivery({
        userId: row.userId,
        status: "failed",
        template: auditTemplate(row.template),
        to: row.to,
        transport: transport ?? "none",
        reason: failureReason.slice(0, 200),
        tenantId: row.tenantId,
      });
      result.failed += 1;
      continue;
    }

    await prisma.emailOutbox.update({
      where: { id: row.id },
      data: {
        status: "PENDING",
        attempts,
        transport,
        lastError: failureReason.slice(0, 500),
        nextAttemptAt: new Date(now.getTime() + backoffMs(attempts)),
      },
    });
    result.retried += 1;
  }

  return result;
}

/** Map a queue template onto the audit-trail template vocabulary. */
function auditTemplate(
  template: string,
): "verify_email" | "password_reset" | "new_sign_in" | "other" {
  if (template === "verify_email") return "verify_email";
  if (template === "password_reset") return "password_reset";
  if (template === "new_sign_in") return "new_sign_in";
  return "other";
}

/**
 * Delivery health for the admin surface: how much mail is waiting, how much
 * has permanently failed, and whether anything has been stuck for long enough
 * that a human should look. `stuck` counts rows that exhausted their attempts
 * or have been pending for over an hour.
 */
export async function emailOutboxHealth(): Promise<{
  pending: number;
  sending: number;
  sent: number;
  failed: number;
  stuck: number;
  oldestPendingAt: string | null;
}> {
  const hourAgo = new Date(Date.now() - 60 * 60_000);
  const [pending, sending, sent, failed, stuck, oldest] = await Promise.all([
    prisma.emailOutbox.count({ where: { status: "PENDING" } }),
    prisma.emailOutbox.count({ where: { status: "SENDING" } }),
    prisma.emailOutbox.count({ where: { status: "SENT" } }),
    prisma.emailOutbox.count({ where: { status: "FAILED" } }),
    prisma.emailOutbox.count({
      where: { OR: [{ status: "FAILED" }, { status: "PENDING", createdAt: { lte: hourAgo } }] },
    }),
    prisma.emailOutbox.findFirst({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    }),
  ]);

  return {
    pending,
    sending,
    sent,
    failed,
    stuck,
    oldestPendingAt: oldest?.createdAt.toISOString() ?? null,
  };
}
