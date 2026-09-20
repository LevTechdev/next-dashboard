import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-guard";
import { computeDigestFor } from "@/lib/usage-digest";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/usage/digest/preview
 *
 * Session-authenticated preview of the daily digest for the caller's own
 * workspace — the exact compute path the cron job emails (computeDigestFor),
 * with `send` never attempted. Powers the Settings → Notifications digest
 * preview card; owners see precisely what their daily email will contain.
 *
 * The cron route (?secret=…, bulk, sends email) remains separate: this route
 * is strictly read-your-own, no secret, no writes.
 */
export async function GET(req: Request) {
  const { session, response } = await requireAuth(req);
  if (response) return response;

  try {
    const digest = await computeDigestFor(session.user.id);
    if (!digest) {
      return NextResponse.json({ error: "Digest unavailable" }, { status: 404 });
    }
    // Fill the owner fields the cron path copies from the owners query —
    // the preview is always about the caller.
    digest.email = session.user.email ?? null;
    digest.name = session.user.name ?? null;
    return NextResponse.json({ digest });
  } catch (error) {
    console.error("Digest preview error:", error);
    return NextResponse.json({ error: "Failed to compute digest preview" }, { status: 500 });
  }
}
