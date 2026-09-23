import "server-only";

import { render } from "@react-email/render";
import * as React from "react";
import NewSignInEmail from "@/emails/NewSignInEmail";
import { sendEmail } from "@/lib/email";
import { getSignInGeo } from "@/lib/geo-ip";
import { getRequestMeta } from "@/lib/request-meta";
import { recognitionExplanation, type RecognitionResult } from "@/lib/device-recognition";
import { logSecurityEvent } from "@/lib/security-events";

/** Whether new-sign-in alerts are enabled (off when no mailer is configured). */
export function signInAlertsEnabled(): boolean {
  return Boolean(process.env.SMTP_HOST || process.env.RESEND_API_KEY);
}

const DEFAULT_APP_NAME = "Next Dashboard Web";

async function renderNewSignInEmail(opts: {
  appName: string;
  timeText: string;
  location: string;
  device: string;
  locale?: string;
  recognition: RecognitionResult;
}): Promise<{ html: string; text: string }> {
  const props = {
    appName: opts.appName,
    timeText: opts.timeText,
    location: opts.location,
    device: opts.device,
    locale: opts.locale,
    reasonText: recognitionExplanation(opts.recognition.outcome, opts.locale),
    isNewDevice: opts.recognition.outcome !== "known",
  };
  return {
    html: await render(React.createElement(NewSignInEmail, props)),
    text: await render(React.createElement(NewSignInEmail, props), { plainText: true }),
  };
}

async function deliverSignInAlert(opts: {
  to: string;
  req: Request;
  locale?: string;
  appName?: string;
  recognition: RecognitionResult;
}): Promise<void> {
  const meta = getRequestMeta(opts.req);
  // Precise IP-resolved geography: CDN headers first, ip-api fallback, and a
  // single WIB/WITA/WIT stamp derived from the resolved IANA zone.
  const geo = await getSignInGeo(opts.req);
  const { html, text } = await renderNewSignInEmail({
    appName: opts.appName ?? DEFAULT_APP_NAME,
    timeText: geo.timeText,
    location: geo.location,
    device: [meta.device, meta.browser].filter(Boolean).join(" · ") || "Unknown device",
    locale: opts.locale,
    recognition: opts.recognition,
  });

  await sendEmail({
    to: opts.to,
    subject: "New sign-in to your Next Dashboards account",
    html,
    text,
  });
}

/**
 * Unconditional "new sign-in" security email — used where recognition is not
 * meaningful (e.g. admin-triggered flows). Best-effort: a mail failure must
 * never block or fail the caller.
 */
export async function sendNewSignInEmail(opts: {
  to: string;
  req: Request;
  locale?: string;
  appName?: string;
}): Promise<void> {
  if (!signInAlertsEnabled()) return;
  try {
    await deliverSignInAlert({
      to: opts.to,
      req: opts.req,
      locale: opts.locale,
      appName: opts.appName,
      recognition: { shouldAlert: true, outcome: "new_device_and_ip" },
    });
  } catch (err) {
    console.error("[security-notifications] new-sign-in email failed:", err);
  }
}

/**
 * Production entry point for /api/auth/login: delivers the alert ONLY when
 * the caller's precomputed recognition says the sign-in was unrecognized.
 *
 * The recognition query MUST run before this sign-in's own Session row is
 * inserted (done in the login route) — otherwise every sign-in would match
 * its own row and no alert could ever fire.
 */
export async function sendNewSignInAlert(opts: {
  to: string;
  req: Request;
  recognition: RecognitionResult;
  /** The signing-in user — attribution for the audit-log entry. */
  userId?: string;
  locale?: string;
  appName?: string;
  /** Diagnostic hook: ops/e2e observability of the recognition decision. */
  onDecision?: (outcome: RecognitionResult["outcome"] | "alerts_disabled") => void;
}): Promise<void> {
  if (!signInAlertsEnabled()) {
    opts.onDecision?.("alerts_disabled");
    return;
  }
  // Audit trail: every recognition decision lands in the hash-chained log
  // alongside the EMAIL_DELIVERY events, so reviewers can see both why an
  // alert fired AND when one was deliberately suppressed. Logged against the
  // signing-in user (email is the account's own address).
  try {
    await logSecurityEvent({
      userId: opts.userId ?? null,
      type: opts.recognition.shouldAlert ? "SIGNIN_ALERT_SENT" : "SIGNIN_ALERT_SUPPRESSED",
      req: opts.req,
      metadata: {
        outcome: opts.recognition.outcome,
        recipient: opts.to,
      },
    });
  } catch {
    /* best-effort */
  }

  if (!opts.recognition.shouldAlert) {
    opts.onDecision?.("known");
    return;
  }
  opts.onDecision?.(opts.recognition.outcome);
  try {
    await deliverSignInAlert({
      to: opts.to,
      req: opts.req,
      locale: opts.locale,
      appName: opts.appName,
      recognition: opts.recognition,
    });
  } catch (err) {
    console.error("[security-notifications] new-sign-in alert failed:", err);
  }
}
