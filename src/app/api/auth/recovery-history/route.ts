import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/api-guard";
import {
  captureRecoveryReadiness,
  READINESS_HISTORY_DAYS,
  recoveryReadinessHistory,
} from "@/lib/recovery-drift";
import { readinessTrend } from "@/lib/recovery-readiness";

export const dynamic = "force-dynamic";

/**
 * GET: the account's recovery-readiness series (oldest → newest), plus the
 * trend across the window.
 *
 * `?capture=1` records today's verdict first. The Security Center sends it, so
 * a user who visits the page gets a point for today even if the nightly sweep
 * has not run since their last change; a plain GET stays read-only for callers
 * that only want the graph.
 */
export async function GET(req: Request) {
  const { session, response } = await requireAuth(req);
  if (response) return response;

  const userId = session.user.id;
  const { searchParams } = new URL(req.url);
  const days = Math.min(
    Math.max(parseInt(searchParams.get("days") ?? String(READINESS_HISTORY_DAYS), 10) || 0, 1),
    READINESS_HISTORY_DAYS,
  );

  let captured = false;
  if (searchParams.get("capture") === "1") {
    const result = await captureRecoveryReadiness(userId);
    captured = !!result;
  }

  const snapshots = await recoveryReadinessHistory(userId, days);

  return NextResponse.json({
    days,
    captured,
    snapshots,
    trend: readinessTrend(snapshots.map((s) => s.level)),
    current: snapshots.length ? snapshots[snapshots.length - 1].level : null,
  });
}
