import "server-only";

import { prisma } from "@/lib/db";
import { enqueueEmail } from "@/lib/email-outbox";
import {
  readRawLeafOrphanReport,
  summarizeLeafOrphans,
  type OrphanEntry,
} from "@/lib/leaf-orphans-admin";
import { describeMailConfiguration } from "@/lib/email";

/**
 * Scheduled ops digest for the leaf-sync orphan report.
 *
 * The admin card answers "can the mirror take every row?" for whoever opens
 * the panel — but reconciliation is a human decision (review each named row,
 * reconcile it by hand or acknowledge it as a dev-fixture artifact), and a
 * decision nobody knows is pending is a decision that never happens. So when
 * the projected report still NAMES unacknowledged rows — the "Needs
 * reconciliation" verdict — this job queues one mail per admin per UTC day
 * through the durable outbox (src/lib/email-outbox): delivery retries with
 * backoff off the response path, so a slow SMTP handshake can never lose it.
 *
 * The quieter verdicts stay quiet: `warn` (counts remain but every sampled
 * ref is acknowledged) has no per-row action to take and `ok` needs no mail —
 * this digest arrives only when there is a named row waiting on a human.
 */

export interface LeafOrphansDigestResult {
  /** Admin inboxes the digest was queued for. */
  queued: number;
  /** How many named sample refs survive the acknowledged-ledger projection. */
  namedRows: number;
  /** True when the verdict was not "Needs reconciliation" and nothing was sent. */
  skipped?: boolean;
  reason?: string;
}

/** Outcome of an operator-requested test digest (see sendTestLeafOrphansDigest). */
export interface TestLeafOrphansDigestResult {
  ok: boolean;
  /** Emails durably queued (0 only when the report is clean). */
  mailQueued: number;
  /** Non-empty when the mail configuration cannot deliver to real addresses. */
  mailMisconfigured: boolean;
  namedRows: number;
  /** Machine-readable why-not, so callers can localize the refusal. */
  code?: "clean" | "no-recipient";
  reason?: string;
}

/** UTC calendar day key — dedupes the digest to one send per day. */
export function utcDay(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

/**
 * One line per affected table: "Session: 97 rows cannot sync". Ordered for a
 * stable email (the report object's own order is insertion-ordered already,
 * but sorting makes the digest diff-friendly across days).
 */
export function digestTableLines(tables: Record<string, OrphanEntry>): string[] {
  return Object.entries(tables)
    .filter(([, e]) => (e?.count ?? 0) > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([table, e]) => `${table}: ${e.count} row${e.count === 1 ? "" : "s"} cannot sync`);
}

/** The named refs an operator can act on, capped so one mega-report stays readable. */
const MAX_SAMPLES = 12;

export function digestSamples(tables: Record<string, OrphanEntry>): string[] {
  return Object.entries(tables)
    .sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([, e]) => e.samples ?? [])
    .slice(0, MAX_SAMPLES);
}

/**
 * Evaluate the orphan report and queue the digest. Safe to call repeatedly:
 * a `<day>` marker in data/leaf-orphans-digest-sent.json (the repo's
 * file-backed runtime-ledger pattern, gitignored) makes each UTC day send at
 * most once, and the mail itself is durable — the outbox retries it.
 */
export async function runLeafOrphansDigest(
  opts: { now?: Date; force?: boolean } = {},
): Promise<LeafOrphansDigestResult> {
  const now = opts.now ?? new Date();

  // Read the raw report + apply the ledger in one shot (the same projection
  // the admin card and GET endpoint show).
  const summary = await summarizeLeafOrphans(await readRawLeafOrphanReport());
  if (summary.state !== "bad" || summary.unacknowledgedSamples === 0) {
    return {
      queued: 0,
      namedRows: summary.unacknowledgedSamples,
      skipped: true,
      reason:
        summary.state === "ok"
          ? "no unsyncable rows"
          : "orphans exist but every sampled ref is acknowledged",
    };
  }

  // One send per UTC day: the marker records the day the digest last went
  // out, so a scheduler restart within the same day cannot double-mail.
  const day = utcDay(now);
  const markerPath = `${process.cwd()}/data/leaf-orphans-digest-sent.json`;
  const fs = await import("node:fs");
  let lastSentDay: string | null = null;
  try {
    lastSentDay =
      (JSON.parse(fs.readFileSync(markerPath, "utf-8")) as { day?: string }).day ?? null;
  } catch {
    // First run — nothing sent yet.
  }
  if (!opts.force && lastSentDay === day) {
    return {
      queued: 0,
      namedRows: summary.unacknowledgedSamples,
      skipped: true,
      reason: `digest already sent on ${day}`,
    };
  }

  // Recipients: every active admin. Ops mail is about the deployment, not a
  // workspace, so tenant attribution stays null — nobody to derive it from.
  const admins = await prisma.user.findMany({
    where: { role: "ADMIN", isActive: true },
    select: { id: true, email: true, tenantId: true },
    orderBy: { createdAt: "asc" },
  });
  const recipients = admins.filter((a) => !!a.email);
  if (recipients.length === 0) {
    return {
      queued: 0,
      namedRows: summary.unacknowledgedSamples,
      skipped: true,
      reason: "no active admin with an email address",
    };
  }

  const tables = digestTableLines(summary.tables);
  const samples = digestSamples(summary.tables);
  const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "";
  const dashboardUrl = appUrl ? `${appUrl}/admin` : undefined;

  for (const admin of recipients) {
    await enqueueEmail({
      to: admin.email!,
      template: "leaf_orphans_digest",
      params: { total: summary.total, tables, samples, ...(dashboardUrl ? { dashboardUrl } : {}) },
      userId: admin.id,
      tenantId: admin.tenantId ?? undefined,
    });
  }

  try {
    fs.mkdirSync(`${process.cwd()}/data`, { recursive: true });
    fs.writeFileSync(markerPath, `${JSON.stringify({ day, at: now.toISOString() }, null, 2)}\n`);
  } catch {
    // Best-effort: losing the marker only risks a duplicate send on restart.
  }

  return { queued: recipients.length, namedRows: summary.unacknowledgedSamples };
}

/**
 * Operator-requested test digest — the "does this pipeline reach my inbox?"
 * button, not an alarm.
 *
 * Renders the SAME report, template, and recipients logic as the scheduled
 * job and queues through the same durable outbox, but two deliberate
 * differences: it ignores the per-day marker (a test is not a send), and it
 * fires for the quieter `warn` verdict too — the report's counts are still
 * real content to eyeball, and a pipeline that only proves itself during an
 * incident is a pipeline nobody trusts. The `ok` verdict has nothing to show,
 * so it stays silent. Default recipients are the active admins; the test
 * route narrows them to the requesting admin so a smoke test never mails the
 * whole team.
 */
export async function sendTestLeafOrphansDigest(
  opts: {
    now?: Date;
    recipients?: Array<{ id?: string | null; email: string; tenantId?: string | null }>;
  } = {},
): Promise<TestLeafOrphansDigestResult> {
  const summary = await summarizeLeafOrphans(await readRawLeafOrphanReport());
  const mailMisconfigured = describeMailConfiguration().warnings.length > 0;

  if (summary.state === "ok") {
    return {
      ok: false,
      mailQueued: 0,
      mailMisconfigured,
      namedRows: 0,
      code: "clean",
      reason: "the mirror is complete — nothing to preview",
    };
  }

  let recipients = opts.recipients;
  if (!recipients) {
    const admins = await prisma.user.findMany({
      where: { role: "ADMIN", isActive: true },
      select: { id: true, email: true, tenantId: true },
      orderBy: { createdAt: "asc" },
    });
    recipients = admins.filter((a): a is typeof a & { email: string } => !!a.email);
  }
  if (recipients.length === 0) {
    return {
      ok: false,
      mailQueued: 0,
      mailMisconfigured,
      namedRows: summary.unacknowledgedSamples,
      code: "no-recipient",
      reason: "no recipient with an email address",
    };
  }

  const tables = digestTableLines(summary.tables);
  const samples = digestSamples(summary.tables);
  const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "";
  const dashboardUrl = appUrl ? `${appUrl}/admin` : undefined;

  for (const admin of recipients) {
    await enqueueEmail({
      to: admin.email,
      template: "leaf_orphans_digest",
      params: { total: summary.total, tables, samples, ...(dashboardUrl ? { dashboardUrl } : {}) },
      userId: admin.id ?? undefined,
      tenantId: admin.tenantId ?? undefined,
    });
  }

  return {
    ok: true,
    mailQueued: recipients.length,
    mailMisconfigured,
    namedRows: summary.unacknowledgedSamples,
  };
}
