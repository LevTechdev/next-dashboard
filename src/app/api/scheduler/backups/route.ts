import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-guard";
import { normalizeRole } from "@/lib/permissions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Supabase mirror rollback snapshots (.freebuff/backups/*.dump) for the
 * Settings scheduler card.
 *
 * GET lists the retained snapshots (newest first) — they are the pre-sync
 * rollback artifacts written by scripts/sync-supabase-mirror.mjs.
 *
 * POST { file } restores one snapshot into the REMOTE Supabase by spawning
 * the sync script's restore path. Restore is a destructive remote operation,
 * so it is admin-only and refuses path traversal (basename check).
 */

const BACKUP_DIR = join(process.cwd(), ".freebuff", "backups");

function listSnapshots(): Array<{ file: string; sizeMb: number; createdAt: string }> {
  try {
    return readdirSync(BACKUP_DIR)
      .filter((f) => f.endsWith(".dump"))
      .map((f) => {
        const st = statSync(join(BACKUP_DIR, f));
        return {
          file: f,
          sizeMb: Math.round((st.size / (1024 * 1024)) * 100) / 100,
          createdAt: st.mtime.toISOString(),
        };
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch {
    return [];
  }
}

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

  return NextResponse.json({ snapshots: listSnapshots() });
}

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

  const body = await req.json().catch(() => null);
  const file = (body as { file?: string; action?: string } | null)?.file;

  // Action "verify": restore the NEWEST snapshot into a throwaway scratch
  // database and drop it — proves restorability without touching production.
  if ((body as { action?: string } | null)?.action === "verify") {
    const { runBackupVerify } = await import("@/lib/backup-verify");
    const result = await runBackupVerify();
    const { recordExternalJobRun } = await import("@/lib/scheduler");
    recordExternalJobRun(
      "backup-verify",
      { verified: result.verified, file: result.file, tables: result.tables },
      result.verified ? undefined : result.detail,
    );
    return NextResponse.json(result);
  }

  if (
    !file ||
    typeof file !== "string" ||
    file !== file.split(/[\\/]/).pop() ||
    !file.endsWith(".dump")
  ) {
    return NextResponse.json({ error: "Invalid snapshot file" }, { status: 400 });
  }

  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const run = promisify(execFile);

  try {
    // The sync script's remote-restore path: pg_dump snapshot → pg_restore
    // --clean into the remote. Reusing it keeps one tested restore pipeline.
    await run("node", ["scripts/restore-supabase-snapshot.mjs", file], {
      cwd: process.cwd(),
      timeout: 10 * 60_000,
    });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message.slice(0, 300) : "restore failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
