import "server-only";

/**
 * SIEM integration for security audit events.
 *
 * - toCEF: ArcSight Common Event Format line (widely ingestible by SIEMs).
 * - toSiemJSON: structured JSON record.
 * - forwardToSiem: best-effort real-time forward to SIEM_WEBHOOK_URL.
 *
 * Full delivery requires SIEM_WEBHOOK_URL (or an OTLP collector for traces via
 * instrumentation.ts). Without it, formatting/export still works for pull-based
 * ingestion via /api/security/audit/export.
 */

export interface SiemEvent {
  id: string;
  seq?: number | null;
  userId: string | null;
  type: string;
  ip: string | null;
  userAgent: string | null;
  metadata?: unknown;
  createdAt: Date | string;
}

// CEF severity 0-10; elevate auth-failure / anomaly events.
const SEVERITY: Record<string, number> = {
  LOGIN_FAILED: 7,
  ACCOUNT_LOCKED: 8,
  REFRESH_REUSE: 9,
  TOTP_DISABLED: 6,
  PASSWORD_CHANGE: 5,
  SESSIONS_REVOKED_ALL: 6,
};

function cefEscape(v: string): string {
  return v.replace(/\\/g, "\\\\").replace(/\|/g, "\\|").replace(/\n/g, " ");
}
function extEscape(v: string): string {
  return v.replace(/\\/g, "\\\\").replace(/=/g, "\\=").replace(/\n/g, " ");
}

/** Render a security event as a CEF line. */
export function toCEF(e: SiemEvent): string {
  const sev = SEVERITY[e.type] ?? 3;
  const rt = (e.createdAt instanceof Date ? e.createdAt : new Date(e.createdAt)).getTime();
  const ext: string[] = [`rt=${rt}`, `cs1Label=eventId`, `cs1=${extEscape(e.id)}`];
  if (e.userId) ext.push(`suser=${extEscape(e.userId)}`);
  if (e.ip) ext.push(`src=${extEscape(e.ip)}`);
  if (e.userAgent) ext.push(`requestClientApplication=${extEscape(e.userAgent)}`);
  return `CEF:0|NextDashboard|Dashboard|1.0|${cefEscape(e.type)}|${cefEscape(e.type)}|${sev}|${ext.join(" ")}`;
}

/** Render a security event as a structured JSON record. */
export function toSiemJSON(e: SiemEvent): Record<string, unknown> {
  return {
    id: e.id,
    seq: e.seq ?? null,
    timestamp: (e.createdAt instanceof Date ? e.createdAt : new Date(e.createdAt)).toISOString(),
    eventType: e.type,
    severity: SEVERITY[e.type] ?? 3,
    userId: e.userId,
    sourceIp: e.ip,
    userAgent: e.userAgent,
    metadata: e.metadata ?? null,
  };
}

/**
 * Fire-and-forget forward of a single event to the configured SIEM webhook.
 * Never throws into the caller.
 */
export async function forwardToSiem(e: SiemEvent): Promise<void> {
  const url = process.env.SIEM_WEBHOOK_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(process.env.SIEM_WEBHOOK_TOKEN
          ? { authorization: `Bearer ${process.env.SIEM_WEBHOOK_TOKEN}` }
          : {}),
      },
      body: JSON.stringify(toSiemJSON(e)),
    });
  } catch (err) {
    console.error("[siem] forward failed", e.type, err);
  }
}
