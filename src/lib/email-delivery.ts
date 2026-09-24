import "server-only";

import { logSecurityEvent, type SecurityEventType } from "@/lib/security-events";

/**
 * Email delivery outcomes recorded against a user's security audit trail.
 * - sent:   a configured transport accepted the message
 * - failed: no mailer configured, the transport rejected/timed out, or the
 *           send threw — with a short reason in metadata
 */
export type EmailDeliveryStatus = "sent" | "failed";

const EMAIL_EVENT: Record<EmailDeliveryStatus, SecurityEventType> = {
  sent: "EMAIL_DELIVERY_SENT",
  failed: "EMAIL_DELIVERY_FAILED",
};

/**
 * Record the outcome of a transactional email attempt (verification codes,
 * password resets) as a security event so the audit trail shows not only
 * *that* a code was issued but whether it ever left the building.
 */
export async function logEmailDelivery(params: {
  userId: string | null;
  status: EmailDeliveryStatus;
  template: "verify_email" | "password_reset" | "new_sign_in";
  to: string;
  /** Transport that handled (or would have handled) the message. */
  transport?: "smtp" | "resend" | "none";
  /** Short failure reason — never include message content. */
  reason?: string;
  req?: Request;
  tenantId?: string | null;
}): Promise<void> {
  await logSecurityEvent({
    userId: params.userId,
    type: EMAIL_EVENT[params.status],
    req: params.req,
    metadata: {
      template: params.template,
      to: params.to,
      transport: params.transport ?? "none",
      ...(params.reason ? { reason: params.reason } : {}),
    },
    // Forward as-is (undefined when the caller omitted it): a nullish tenantId
    // lets `logSecurityEvent` resolve the workspace from `userId`, so per-user
    // email events stay attributed even when the transport call site has no
    // session context.
    tenantId: params.tenantId,
  });
}
