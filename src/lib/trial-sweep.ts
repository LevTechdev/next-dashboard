import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { sendPushToUser } from "@/lib/web-push";

/**
 * Trial lifecycle sweep — the cron companion to signup provisioning.
 *
 * Every registration provisions a 14-day TRIALING Professional subscription
 * (see provisioning.ts). This job runs daily and closes the loop:
 *
 *   1. EXPIRE — any TRIALING subscription past `currentPeriodEnd` is flipped
 *      to CANCELED and the user gets a fresh Starter (ACTIVE) subscription,
 *      so tier resolution (which ignores lapsed TRIALING) and the fallback
 *      agree: the workspace cleanly reverts to Starter limits. Pro gates
 *      (analytics, API keys, multi-channel, higher quotas) re-close with no
 *      data loss — billing history, orders and settings are untouched.
 *   2. WARN — owners whose trial ends within 3 days (and who haven't already
 *      been warned for this trial) get one countdown email so the expiry
 *      never lands as a surprise.
 *
 * Both halves are idempotent: expiry is a status flip keyed on a state that
 * only moves forward, and the warning is de-duplicated by a marker
 * notification ("trial-warning:{subscriptionId}") so a repeated run the same
 * day can't spam the inbox. Runs are also idempotent across restarts because
 * every write is conditioned on the pre-read state.
 *
 * Entry points:
 *  - in-app scheduler job "trial-sweep" (daily, after the quota digest)
 *  - GET /api/billing/trial/sweep?secret=CRON_SECRET (Vercel cron / manual)
 */

export const TRIAL_WARN_DAYS = 3;
/**
 * Dedupe key for the in-app warning row. Deliberately a STABLE, human title:
 * the bell renders `title` verbatim, so an internal marker id there would be
 * visible slop — and a stable title is what lets the second run the same day
 * find the existing row and skip the duplicate email. The countdown lives in
 * `description`, which is refreshed on later runs.
 */
function warningTitle(planName: string): string {
  return `Your ${planName} trial ends soon`;
}

export interface TrialSweepResult {
  expired: number;
  warned: number;
  expiredUserIds: string[];
  warnedUserIds: string[];
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** The day the trial ends — used for the "ends on" line in the email. */
function endsOnLabel(end: Date): string {
  return end.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function warnEmailHtml(
  name: string | null,
  planName: string,
  endsAt: Date,
  daysLeft: number,
): string {
  return `
  <div style="font-family:ui-sans-serif,system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px">
    <h2 style="margin:0 0 8px;font-size:18px">Your ${planName} trial ends in ${daysLeft} day${daysLeft === 1 ? "" : "s"}</h2>
    <p style="margin:0 0 12px;color:#555;font-size:14px">
      Hi ${name || "there"} — your ${planName} trial finishes on <strong>${endsOnLabel(endsAt)}</strong>.
    </p>
    <p style="margin:0 0 16px;color:#555;font-size:14px">
      After it ends, the workspace moves to the Starter plan: analytics, API keys and
      multi-channel features close, and order/team limits drop to Starter quotas.
      Everything you've built stays exactly as it is.
    </p>
    <a href="${process.env.APP_URL ?? "http://localhost:3010"}/billing?tab=plans"
       style="display:inline-block;background:#111;color:#fff;padding:10px 18px;border-radius:8px;font-size:14px;text-decoration:none">
      Keep ${planName} — choose a plan
    </a>
  </div>`;
}

function warnEmailText(
  name: string | null,
  planName: string,
  endsAt: Date,
  daysLeft: number,
): string {
  return [
    `Your ${planName} trial ends in ${daysLeft} day${daysLeft === 1 ? "" : "s"}.`,
    `Hi ${name || "there"} — your ${planName} trial finishes on ${endsOnLabel(endsAt)}.`,
    "After it ends, the workspace moves to the Starter plan (analytics, API keys and multi-channel features close; limits drop to Starter quotas). Everything you've built stays.",
    `Choose a plan: ${process.env.APP_URL ?? "http://localhost:3010"}/billing?tab=plans`,
  ].join("\n");
}

function expiredEmailHtml(name: string | null, planName: string): string {
  return `
  <div style="font-family:ui-sans-serif,system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px">
    <h2 style="margin:0 0 8px;font-size:18px">Your ${planName} trial has ended</h2>
    <p style="margin:0 0 12px;color:#555;font-size:14px">
      Hi ${name || "there"} — your ${planName} trial finished and the workspace is now on the Starter plan.
    </p>
    <p style="margin:0 0 16px;color:#555;font-size:14px">
      Analytics, API keys and multi-channel features are closed and limits are back to Starter quotas.
      All of your data is safe — upgrade any time to reopen Pro features.
    </p>
    <a href="${process.env.APP_URL ?? "http://localhost:3010"}/billing?tab=plans"
       style="display:inline-block;background:#111;color:#fff;padding:10px 18px;border-radius:8px;font-size:14px;text-decoration:none">
      Upgrade to reopen Pro
    </a>
  </div>`;
}

function expiredEmailText(name: string | null, planName: string): string {
  return [
    `Your ${planName} trial has ended.`,
    `Hi ${name || "there"} — the workspace is now on the Starter plan.`,
    "Analytics, API keys and multi-channel features are closed; limits are back to Starter quotas. All data is safe.",
    `Upgrade any time: ${process.env.APP_URL ?? "http://localhost:3010"}/billing?tab=plans`,
  ].join("\n");
}

/**
 * Run one sweep pass.
 *
 * @param options.send    Mail owners about expiries/warnings (tests pass false).
 * @param options.dryRun  Report what WOULD happen and write nothing at all —
 *                        safe to hit against any environment (the cron route's
 *                        ?dryRun=1 mode).
 */
export async function runTrialSweep(
  options: { send?: boolean; dryRun?: boolean } = {},
): Promise<TrialSweepResult> {
  const send = options.send ?? true;
  const dryRun = options.dryRun ?? false;
  const now = new Date();
  const warnCutoff = new Date(startOfToday().getTime() + TRIAL_WARN_DAYS * 24 * 60 * 60 * 1000);
  const result: TrialSweepResult = { expired: 0, warned: 0, expiredUserIds: [], warnedUserIds: [] };

  // ── 1. Expire lapsed trials ────────────────────────────────────────────────
  // TRIALING rows with currentPeriodEnd strictly in the past. Tier resolution
  // already ignores these, so the flip is bookkeeping + a plan swap.
  const starterPlan = await prisma.plan.findUnique({
    where: { name: "Starter" },
    select: { id: true },
  });
  const lapsed = await prisma.subscription.findMany({
    where: { status: "TRIALING", currentPeriodEnd: { lt: now } },
    select: {
      id: true,
      userId: true,
      currentPeriodEnd: true,
      plan: { select: { name: true } },
      user: { select: { email: true, name: true, isActive: true } },
    },
  });

  for (const sub of lapsed) {
    if (!starterPlan) {
      // Unseeded plan catalogue — skip flipping so the user keeps a coherent
      // (if stale) TRIALING row rather than landing on nothing.
      console.warn("[trial-sweep] No Starter plan in catalogue; skipping expiry flip");
      break;
    }
    const planName = sub.plan?.name ?? "Professional";
    result.expired += 1;
    result.expiredUserIds.push(sub.userId);
    if (dryRun) continue;

    // Downgrade IN PLACE: Subscription.userId is unique (one row per user), so
    // the same row swaps Professional → Starter and stays ACTIVE. Tier
    // resolution then reads Starter quotas and the Pro gates re-close — no
    // data migration, no orphaned CANCELED row.
    const periodStart = new Date();
    await prisma.subscription.update({
      where: { id: sub.id },
      data: {
        planId: starterPlan.id,
        status: "ACTIVE",
        currentPeriodStart: periodStart,
        // Starter month from today — the period simply continues.
        currentPeriodEnd: new Date(new Date(periodStart).setMonth(periodStart.getMonth() + 1)),
      },
    });

    if (send && sub.user?.email && sub.user.isActive) {
      try {
        await sendEmail({
          to: sub.user.email,
          subject: `Your ${planName} trial has ended`,
          html: expiredEmailHtml(sub.user.name, planName),
          text: expiredEmailText(sub.user.name, planName),
        });
      } catch (err) {
        // Email failure must not fail the sweep — the state flip already happened.
        console.error("[trial-sweep] expiry email failed:", err);
      }
    }
  }

  // ── 2. Warn owners inside the 3-day window ────────────────────────────────
  const endingSoon = await prisma.subscription.findMany({
    where: {
      status: "TRIALING",
      currentPeriodEnd: { gte: now, lte: warnCutoff },
    },
    select: {
      id: true,
      userId: true,
      currentPeriodEnd: true,
      plan: { select: { name: true } },
      user: { select: { email: true, name: true, isActive: true } },
    },
  });

  for (const sub of endingSoon) {
    const planName = sub.plan?.name ?? "Professional";
    const title = warningTitle(planName);
    // Calendar-day countdown (never 0 — inside this window at least one day
    // of trial remains, and late-evening runs round up).
    const daysLeft = Math.max(
      1,
      Math.ceil(
        (sub.currentPeriodEnd.getTime() - startOfToday().getTime()) / (24 * 60 * 60 * 1000),
      ),
    );
    const countdown = `Your ${planName} trial ends in ${daysLeft} day${daysLeft === 1 ? "" : "s"}.`;

    const already = await prisma.notification.findFirst({
      // billing type — trial warnings live in the inbox's Billing tab (the
      // legacy "alert" is matched too so pre-existing markers still dedupe).
      where: { userId: sub.userId, type: { in: ["billing", "alert"] }, title },
      select: { id: true },
    });

    if (already) {
      // Already warned for this trial — refresh the visible countdown only.
      if (!dryRun) {
        await prisma.notification.update({
          where: { id: already.id },
          data: { description: countdown },
        });
      }
      continue;
    }

    result.warned += 1;
    result.warnedUserIds.push(sub.userId);
    if (dryRun) continue;

    await prisma.notification.create({
      data: {
        userId: sub.userId,
        type: "billing",
        title,
        description: countdown,
        link: "/billing?tab=plans",
      },
    });

    if (send && sub.user?.email && sub.user.isActive) {
      try {
        await sendEmail({
          to: sub.user.email,
          subject: `Your ${planName} trial ends soon — keep your features`,
          html: warnEmailHtml(sub.user.name, planName, sub.currentPeriodEnd, daysLeft),
          text: warnEmailText(sub.user.name, planName, sub.currentPeriodEnd, daysLeft),
        });
      } catch (err) {
        console.error("[trial-sweep] warning email failed:", err);
      }

      // Web Push — same countdown, lands even with the app closed.
      try {
        await sendPushToUser(sub.userId, {
          title,
          body: countdown,
          url: "/billing?tab=plans",
          tag: "trial-ending",
        });
      } catch {
        // Push is best-effort; the notification row is the record.
      }
    }
  }

  return result;
}
