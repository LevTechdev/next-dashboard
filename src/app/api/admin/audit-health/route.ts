import { requireAuth } from "@/lib/api-guard";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { normalizeRole } from "@/lib/permissions";
import { verifyAuditChain } from "@/lib/audit-chain";
import { emailOutboxHealth } from "@/lib/email-outbox";

export const dynamic = "force-dynamic";

/**
 * Admin audit-health report — the dashboard twin of the CI gate in
 * scripts/check-audit-chain.ts, extended with the durable-mail outbox.
 *
 * Section A (audit chain): walk the tamper-evident SecurityEvent chain with the
 * REAL verifier (src/lib/audit-chain.ts — the same function behind
 * GET /api/security/audit/verify and the CI check) so the panel can never
 * disagree with the chain walk. Attribution health is reported separately from
 * chain integrity because tenantId is NOT part of the canonical hash payload —
 * a row can verify clean on-chain while its attribution is broken:
 *
 *   • missingTenant  — hashed rows WITH AN ACTOR (userId set) carrying a NULL
 *     tenantId. logSecurityEvent resolves a tenant for every event that has an
 *     actor, so any such row is a real attribution bug (actor-less rows are
 *     deployment telemetry with no workspace to attribute — exempt, as in the
 *     CI check).
 *   • orphanTenant   — rows whose tenantId references NO existing tenant
 *     (deleted/bogus tenant or cross-DB import): cross-tenant contamination
 *     invisible to the hash chain.
 *   • nullHash       — rows outside the chain entirely; on a fresh seed there
 *     are none, and their presence means corruption or a legacy pre-hashing
 *     table (npm run repair:audit-chain re-chains them).
 *
 * Section B (mail outbox): emailOutboxHealth() — queue depth, permanent
 * failures, and stuck mail. This is the same data the scheduler's 5-minute
 * email-outbox job and `npm run verify:mail` reason about; surfacing it here
 * closes the loop on the Phase-2 outbox: a misconfigured sender or a dead SMTP
 * transport shows up on the admin panel instead of being discovered by a user
 * who "didn't receive the email".
 *
 * Read-only: no writes, no events logged, safe to poll from the panel.
 */
export async function GET(req: Request) {
  const { session, response } = await requireAuth(req);
  if (response) return response;

  if (normalizeRole(session.user.role) !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const [verification, nullHash, missingTenant, orphanTenant, mail] = await Promise.all([
      verifyAuditChain(),
      prisma.securityEvent.count({ where: { hash: null } }),
      // Attribution health mirrors scripts/check-audit-chain.ts check 3,
      // including the actor-less exemption.
      prisma.securityEvent.count({
        where: { hash: { not: null }, userId: { not: null }, tenantId: null },
      }),
      (async () => {
        const attributed = await prisma.securityEvent.findMany({
          where: { hash: { not: null }, tenantId: { not: null } },
          select: { tenantId: true },
          distinct: ["tenantId"],
        });
        const tenantIds = attributed
          .map((r) => r.tenantId)
          .filter((id): id is string => Boolean(id));
        const existing = await prisma.tenant.findMany({
          where: { id: { in: tenantIds } },
          select: { id: true },
        });
        const have = new Set(existing.map((t) => t.id));
        return tenantIds.filter((id) => !have.has(id)).length;
      })(),
      emailOutboxHealth(),
    ]);

    return NextResponse.json({
      chain: {
        ok: verification.ok,
        total: verification.total,
        verified: verification.verified,
        firstBreakSeq: verification.firstBreakSeq,
        breaks: verification.breaks.slice(0, 5),
      },
      attribution: {
        missingTenant,
        orphanTenant,
        nullHash,
      },
      mail: {
        pending: mail.pending,
        sending: mail.sending,
        sent: mail.sent,
        failed: mail.failed,
        stuck: mail.stuck,
        oldestPendingAt: mail.oldestPendingAt,
      },
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error building audit-health report:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
