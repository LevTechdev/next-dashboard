import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-guard";
import { verifyAuditChain } from "@/lib/audit-chain";

export const dynamic = "force-dynamic";

/**
 * GET /api/security/audit/verify — ADMIN/AUDITOR.
 * Re-walks the SecurityEvent hash chain and reports tamper integrity.
 * Returns 200 when intact, 409 when any break is detected.
 */
export async function GET(req: Request) {
  const { response } = await requirePermission("read", "settings", req);
  if (response) return response;

  const result = await verifyAuditChain();
  return NextResponse.json(result, { status: result.ok ? 200 : 409 });
}
