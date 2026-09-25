import { requireAuth } from "@/lib/api-guard";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { normalizeRole } from "@/lib/permissions";
import { describeMailConfiguration } from "@/lib/email";
import { emailOutboxHealth, resendLatestFailedOutboxEmail } from "@/lib/email-outbox";

export const dynamic = "force-dynamic";

/**
 * Admin live mail-delivery health.
 *
 * Resolved transport + from-address sanity (describeMailConfiguration — the
 * same resolver the send path uses, so the panel can never disagree with what
 * a send would actually do), the durable outbox queue depths, and the most
 * recent FAILED rows with their provider/SMTP error reasons — the evidence a
 * platform admin needs to answer "users say they get no email".
 *
 * POST /api/admin/mail-health/resend re-queues the most recent failed row
 * (resetting its attempt budget) and drains it immediately, so a fixed
 * configuration can be verified end-to-end with one click.
 */

const RECENT_FAILED_LIMIT = 8;

/**
 * POST: one-click resend of the most recent FAILED email (attempt budget
 * reset, drained immediately). ADMIN-only like the report itself.
 */
export async function POST(req: Request) {
  const { session, response } = await requireAuth(req);
  if (response) return response;

  if (normalizeRole(session.user.role) !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const result = await resendLatestFailedOutboxEmail();
    if (result.status === "none") {
      return NextResponse.json({ status: "none", message: "No failed email to resend." });
    }
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error resending failed email:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const { session, response } = await requireAuth(req);
  if (response) return response;

  if (normalizeRole(session.user.role) !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const [config, health, recentFailed] = await Promise.all([
      Promise.resolve(describeMailConfiguration()),
      emailOutboxHealth(),
      prisma.emailOutbox.findMany({
        where: { status: "FAILED" },
        orderBy: { updatedAt: "desc" },
        take: RECENT_FAILED_LIMIT,
        select: {
          id: true,
          to: true,
          template: true,
          attempts: true,
          maxAttempts: true,
          lastError: true,
          transport: true,
          updatedAt: true,
        },
      }),
    ]);

    return NextResponse.json({
      config: {
        transport: config.transport,
        from: config.from ?? null,
        warnings: config.warnings,
        // From-address sanity at a glance: the classic failure is a sender
        // the provider will not deliver for (Resend's sandbox, or a From on
        // a domain nobody verified).
        sandboxSender: config.from != null && /@resend\.dev$/i.test(config.from),
      },
      outbox: health,
      recentFailed: recentFailed.map((r) => ({
        id: r.id,
        to: r.to,
        template: r.template,
        attempts: r.attempts,
        maxAttempts: r.maxAttempts,
        lastError: r.lastError,
        transport: r.transport,
        at: r.updatedAt.toISOString(),
      })),
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error building mail-health report:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
