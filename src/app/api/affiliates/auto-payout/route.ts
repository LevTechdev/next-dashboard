import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-guard";
import { normalizeRole } from "@/lib/permissions";
import {
  runAutoPayout,
  AUTO_PAYOUT_THRESHOLD_USD,
  AUTO_PAYOUT_RATIO,
} from "@/lib/affiliate-auto-payout";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Affiliate auto-payout control endpoint (ADMIN only).
 *
 * GET previews what the rule would do right now without side effects.
 * POST executes the evaluation; ?force=1 re-runs within the same cycle
 * (tests / manual ops). The scheduler calls the same engine hourly — this
 * route exists for observability and manual triggering.
 */
async function guard(req?: Request) {
  const { session, response } = await requireAuth(req);
  if (response) return { response, session: null };
  if (normalizeRole(session.user.role) !== "ADMIN") {
    return { response: NextResponse.json({ error: "Forbidden" }, { status: 403 }), session: null };
  }
  return { response: null, session };
}

export async function GET(req: Request) {
  const { response } = await guard(req);
  if (response) return response;

  const result = await runAutoPayout();
  return NextResponse.json({
    ...result,
    threshold: AUTO_PAYOUT_THRESHOLD_USD,
    ratio: AUTO_PAYOUT_RATIO,
  });
}

export async function POST(req: Request) {
  const { response } = await guard(req);
  if (response) return response;

  const force = new URL(req.url).searchParams.get("force") === "1";
  const result = await runAutoPayout(new Date(), force);
  return NextResponse.json({
    ...result,
    threshold: AUTO_PAYOUT_THRESHOLD_USD,
    ratio: AUTO_PAYOUT_RATIO,
  });
}
