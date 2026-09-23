import { NextResponse } from "next/server";
import { runQuotaDigest } from "@/lib/usage-digest";
import { recordExternalJobRun } from "@/lib/scheduler";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/usage/digest?secret=<CRON_SECRET>
 *
 * Daily quota digest for workspace owners — the cron/HTTP entry point for
 * runQuotaDigest() (shared with the in-app scheduler). Auth: shared-secret
 * via ?secret= or the Authorization header (CRON_SECRET env). Returns 401
 * when CRON_SECRET is unset or mismatched. A ?dryRun=1 call computes
 * digests and returns them as JSON without sending email — handy for
 * staging verification and tests.
 *
 * Registered twice by design:
 *  - vercel.json crons → daily 02:00 HTTP hit (production)
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
    const { owners, sent, digests } = await runQuotaDigest(!dryRun);

    // Surface externally-triggered runs (Vercel cron) in the Settings
    // scheduler card too — the ledger is shared, in-app or HTTP.
    if (!dryRun) {
      recordExternalJobRun("usage-digest", { owners, sent });
    }

    if (dryRun) {
      return NextResponse.json({ dryRun: true, count: digests.length, digests });
    }

    return NextResponse.json({ ok: true, owners, sent });
  } catch (error) {
    recordExternalJobRun(
      "usage-digest",
      undefined,
      error instanceof Error ? error.message : String(error),
    );
    console.error("Usage digest error:", error);
    return NextResponse.json({ error: "Failed to compute usage digest" }, { status: 500 });
  }
}
