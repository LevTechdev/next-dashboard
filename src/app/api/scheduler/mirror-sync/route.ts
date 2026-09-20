import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api-guard";
import { normalizeRole } from "@/lib/permissions";
import { recordExternalJobRun, supabaseMirrorScriptPath } from "@/lib/scheduler";
import { runCli, type ExecFileAsync } from "@/lib/run-cli";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/scheduler/mirror-sync — read-only drift check of the Supabase
 * mirror.
 *
 * Runs `scripts/sync-supabase-mirror.mjs --verify-only` (compares per-table row
 * counts between the local Postgres and the remote; writes nothing) and appends
 * the outcome to the same scheduler ledger the Settings card reads — so a
 * manual check from the System Health page shows up exactly like a scheduled
 * run would.
 *
 * Admin-only. Returns 200 with `ok: false` when the check itself reports drift
 * or fails: this is a health REPORT, not a failed request, and the page renders
 * the script's output either way.
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

  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const runFile = promisify(execFile) as unknown as ExecFileAsync;

  try {
    const { stdout, stderr } = await runCli(
      runFile,
      [supabaseMirrorScriptPath(), "--verify-only"],
      { cwd: process.cwd(), timeout: 5 * 60_000, maxBuffer: 4 * 1024 * 1024 },
    );
    const output = `${stdout ?? ""}${stderr ?? ""}`.trim().slice(-4000);
    recordExternalJobRun("supabase-sync", {
      mode: "verify-only",
      ok: true,
      output: output.slice(-800),
    });
    return NextResponse.json({ ok: true, output });
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; message?: string };
    const output =
      `${e.stdout ?? ""}${e.stderr ?? ""}`.trim() || (e.message ?? "mirror check failed");
    recordExternalJobRun("supabase-sync", undefined, output.slice(-800));
    return NextResponse.json({ ok: false, output: output.slice(-4000) });
  }
}
