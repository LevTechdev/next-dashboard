import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyApiKey } from "@/lib/api-keys";

export const dynamic = "force-dynamic";

/**
 * Example programmatic endpoint authenticated by a scoped API key
 * (`Authorization: Bearer dash_...`). Requires the "read" scope; enforces
 * status, expiry and IP allowlist via verifyApiKey.
 */
export async function GET(req: Request) {
  const auth = await verifyApiKey(req, "read");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const user = auth.userId
    ? await prisma.user.findUnique({
        where: { id: auth.userId },
        select: { id: true, name: true, email: true, role: true },
      })
    : null;

  return NextResponse.json({
    authenticated: true,
    keyId: auth.keyId,
    scopes: auth.permissions,
    user,
  });
}
