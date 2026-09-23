import { NextResponse } from "next/server";
import { runTrialSweep } from "@/lib/trial-sweep";
import { recordExternalJobRun } from "@/lib/scheduler";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/billing/trial/sweep?secret=<CRON_SECRET>
 *
 * Cron/HTTP entry point for runTrialSweep() — shared with the in-app
 * scheduler. Auth: shared-secret via ?secret= or the Authorization header
 * (CRON_SECRET env); returns 401 when CRON_SECRET is unset or mismatched.
 * A ?dryRun=1 call reports what WOULD expire/warn without writing or mailing.
 *
 * Registered twice by design (mirrors /api/usage/digest):
 *  - vercel.json crons → daily HTTP hit (production)
 *  - instrumentation.ts → in-app 5-minute scheduler (self-hosted/preview)
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const secret = process.env.CRON_SECRET;
  const provided =
    searchParams.get("secret") || req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (!secret || provided !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dryRun = searchParams.get("dryRun") === "1";

  try {
    const result = await runTrialSweep({ send: !dryRun, dryRun });

    if (!dryRun) {
      recordExternalJobRun("trial-sweep", {
        expired: result.expired,
        warned: result.warned,
      });
    }

    return NextResponse.json({
      dryRun,
      expired: result.expired,
      warned: result.warned,
      expiredUserIds: result.expiredUserIds,
      warnedUserIds: result.warnedUserIds,
    });
  } catch (error) {
    recordExternalJobRun(
      "trial-sweep",
      undefined,
      error instanceof Error ? error.message : String(error),
    );
    console.error("Trial sweep error:", error);
    return NextResponse.json({ error: "Trial sweep failed" }, { status: 500 });
  }
}
