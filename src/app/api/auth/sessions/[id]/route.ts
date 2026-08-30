import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-guard";
import { revokeSession } from "@/lib/sessions";
import { logSecurityEvent } from "@/lib/security-events";

export const dynamic = "force-dynamic";

/** DELETE /api/auth/sessions/[id]: revoke a single session owned by the user. */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireAuth(req);
  if (response) return response;

  const { id } = await params;
  const ok = await revokeSession(session.user.id, id);
  if (!ok) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  await logSecurityEvent({
    userId: session.user.id,
    type: "SESSION_REVOKED",
    req,
    metadata: { sessionId: id },
    tenantId: session.user.tenantId,
  });
  return NextResponse.json({ success: true });
}
