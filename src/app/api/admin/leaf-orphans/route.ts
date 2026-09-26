import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api-guard";
import { normalizeRole } from "@/lib/permissions";
import { leafSyncScriptPath, runSchedulerJob, recordExternalJobRun } from "@/lib/scheduler";
import {
  acknowledgeLeafOrphanRefs,
  readRawLeafOrphanReport,
  summarizeLeafOrphans,
} from "@/lib/leaf-orphans-admin";
import { runCli, type ExecFileAsync } from "@/lib/run-cli";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Shape of one table's entry in the projected orphan report. */
interface OrphanEntry {
  count: number;
  samples?: string[];
}

/**
 * GET /api/admin/leaf-orphans — the admin ops signal for the Supabase leaf
 * sync's unsyncable rows.
 *
 * The scheduler card surfaces the orphan report, but reconciliation relied on
 * someone opening Settings. This endpoint makes the open tally a first-class
 * health signal on the admin panel: the projected (acknowledged-ledger-aware)
 * per-table report plus an `unacknowledged` summary (table count + total row
 * count) whose data-state is `ok` when nothing needs reconciling, `warn` when
 * orphans exist but every sampled ref is acknowledged, and `bad` when sampled
 * refs are still unacknowledged — i.e. named rows an operator has not retired.
 *
 * GET is read-only; POST carries two actions: `sync` (default, the run-now
 * trigger) and `ack` — acknowledging the sampled refs the admin just reviewed
 * so they retire from every projected view. The ack writes the SAME ledger the
 * scripts/ack-leaf-orphans.mjs CLI maintains (scripts/lib/leaf-orphans.mjs is
 * the one mechanism), and never rewrites rows (SecurityEvent FKs are part of
 * the audit-hash canonical payload).
 */
export async function GET(req: Request) {
  const { session, response } = await requireAuth(req);
  if (response) return response;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (normalizeRole(user?.role) !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const summary = await summarizeLeafOrphans(await readRawLeafOrphanReport());
  return NextResponse.json({ ...summary, checkedAt: new Date().toISOString() });
}

/**
 * POST /api/admin/leaf-orphans — two admin actions on the orphan report.
 *
 * `{ action: "ack", refs: [...] }` acknowledges sampled refs (full
 * fingerprints or bare row ids) into the shared ledger and returns the
 * freshly projected summary — the report's named rows retire immediately,
 * no sync gate required.
 *
 * Default (no body, or `{ action: "sync" }`) runs the leaf-sync job NOW and
 * returns the freshly projected report. The scheduler runs this job every 30
 * minutes; the button exists so an operator reconciling refs does not wait
 * out the gate to see the ledger take effect. Same ledger the Settings card
 * reads.
 */
export async function POST(req: Request) {
  const { session, response } = await requireAuth(req);
  if (response) return response;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (normalizeRole(user?.role) !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as { action?: string; refs?: unknown };
  if ((body.action ?? "sync") === "ack") {
    const refs = Array.isArray(body.refs)
      ? body.refs.filter((r): r is string => typeof r === "string" && r.trim().length > 0)
      : [];
    if (refs.length === 0) {
      return NextResponse.json(
        { ok: false, error: "ack requires at least one ref" },
        { status: 400 },
      );
    }
    const acknowledged = await acknowledgeLeafOrphanRefs(refs);
    // Echo the projected view so the card flips without a second round-trip.
    return NextResponse.json({
      ok: true,
      acknowledged,
      summary: await summarizeLeafOrphans(await readRawLeafOrphanReport()),
    });
  }

  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const runFile = promisify(execFile) as unknown as ExecFileAsync;

  try {
    // Pre-flight the script's own credentials contract so an unconfigured
    // deployment gets a crisp message instead of a psql stack trace.
    await runCli(runFile, [leafSyncScriptPath(), "--verify-only"], {
      cwd: process.cwd(),
      timeout: 3 * 60_000,
      maxBuffer: 4 * 1024 * 1024,
    });
    const result = (await runSchedulerJob("supabase-leaf-sync")) as {
      output?: string;
      orphanReport?: Record<string, OrphanEntry>;
    };
    return NextResponse.json({
      ok: true,
      ...(result.orphanReport ? { report: result.orphanReport } : {}),
    });
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; message?: string };
    const output = `${e.stdout ?? ""}${e.stderr ?? ""}`.trim() || (e.message ?? "leaf sync failed");
    recordExternalJobRun("supabase-leaf-sync", undefined, output.slice(-800));
    return NextResponse.json({ ok: false, output: output.slice(-4000) }, { status: 200 });
  }
}
