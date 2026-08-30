import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-guard";
import { regenerateBackupCodes, countUnusedBackupCodes } from "@/lib/backup-codes";
import { logSecurityEvent } from "@/lib/security-events";

export const dynamic = "force-dynamic";

/** GET: how many unused backup codes remain. */
export async function GET(req: Request) {
  const { session, response } = await requireAuth(req);
  if (response) return response;
  const remaining = await countUnusedBackupCodes(session.user.id);
  return NextResponse.json({ remaining });
}

/** POST: (re)generate a fresh set of backup codes. Returns plaintext ONCE. */
export async function POST(req: Request) {
  const { session, response } = await requireAuth(req);
  if (response) return response;

  const codes = await regenerateBackupCodes(session.user.id);
  await logSecurityEvent({
    userId: session.user.id,
    type: "BACKUP_CODES_GENERATED",
    req,
    tenantId: session.user.tenantId,
  });
  return NextResponse.json({ codes });
}
