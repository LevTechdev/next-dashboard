import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api-guard";
import { logSecurityEvent } from "@/lib/security-events";
import { getStepUpToken, verifyStepUpToken } from "@/lib/step-up";

export const dynamic = "force-dynamic";

/** GET: list the current user's registered passkeys. */
export async function GET(req: Request) {
  const { session, response } = await requireAuth(req);
  if (response) return response;

  const creds = await prisma.webAuthnCredential.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, deviceName: true, transports: true, createdAt: true, lastUsedAt: true },
  });
  return NextResponse.json(creds);
}

/**
 * DELETE: remove one of the current user's passkeys.
 * Sensitive action — requires a fresh step-up (re-auth) token for the
 * manage_2fa purpose so a stolen session can't silently drop passkeys.
 */
export async function DELETE(req: Request) {
  const { session, response } = await requireAuth(req);
  if (response) return response;

  if (!verifyStepUpToken(getStepUpToken(req), session.user.id, "manage_2fa")) {
    return NextResponse.json(
      { error: "Re-authentication required", stepUpRequired: true },
      { status: 401 },
    );
  }

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const res = await prisma.webAuthnCredential.deleteMany({
    where: { id, userId: session.user.id },
  });
  if (res.count === 0) {
    return NextResponse.json({ error: "Passkey not found" }, { status: 404 });
  }

  await logSecurityEvent({ userId: session.user.id, type: "PASSKEY_REMOVED", req });
  return NextResponse.json({ success: true });
}
