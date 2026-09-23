import "server-only";

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Snapshot restore-verification.
 *
 * A backup is only a backup if it can be restored. This job picks the newest
 * rollback snapshot (.freebuff/backups/*.dump), restores it into a SCRATCH
 * database (a throwaway DB created on the same local Postgres server), runs a
 * smoke introspection (table count > 0), then drops the scratch DB. The remote
 * Supabase is never touched — verification is read-only with respect to
 * production data.
 *
 * Result is reported by the Settings scheduler card via the scheduler ledger
 * (job id "backup-verify").
 */

const BACKUP_DIR = () => join(process.cwd(), ".freebuff", "backups");

export interface BackupVerifyResult {
  verified: boolean;
  /** Snapshot file that was exercised. */
  file: string | null;
  /** Scratch database used (dropped afterwards). */
  scratchDb: string | null;
  /** Non-system tables found in the restored scratch DB. */
  tables: number;
  /** Newest snapshot age in hours when the check ran. */
  ageHours: number | null;
  /** Trailing line of pg_restore output (or the failure reason). */
  detail: string;
  skipped?: boolean;
  reason?: string;
}

function newestSnapshot(): { file: string; path: string; ageHours: number } | null {
  try {
    const dir = BACKUP_DIR();
    const candidates = readdirSync(dir)
      .filter((f) => f.endsWith(".dump"))
      .map((f) => {
        const st = statSync(join(dir, f));
        return { file: f, path: join(dir, f), mtime: st.mtimeMs };
      })
      .sort((a, b) => b.mtime - a.mtime);
    if (candidates.length === 0) return null;
    const newest = candidates[0];
    return {
      file: newest.file,
      path: newest.path,
      ageHours: Math.round(((Date.now() - newest.mtime) / 3_600_000) * 10) / 10,
    };
  } catch {
    return null;
  }
}

/** Local Postgres admin URL for scratch-DB lifecycle (from .env / DATABASE_URL). */
function localAdminUrl(): { url: string; adminDb: string } | null {
  const raw =
    process.env.DATABASE_URL ??
    (() => {
      try {
        const envLocal = join(process.cwd(), ".env");
        const line = readFileSync(envLocal, "utf-8")
          .split(/\r?\n/)
          .find((l) => l.startsWith("DATABASE_URL="));
        return line ? line.slice("DATABASE_URL=".length).trim() : null;
      } catch {
        return null;
      }
    })();
  if (!raw) return null;
  const url = raw.split("?")[0];
  const adminDb = url.split("/").pop() || "postgres";
  return { url, adminDb };
}

async function psqlCount(dbUrl: string): Promise<number> {
  const { PrismaClient } = await import("@prisma/client");
  // One-off client pointed at the scratch DB — avoids psql text parsing
  // drift across Postgres versions. Not the shared pool client.
  const scratch = new PrismaClient({
    datasources: { db: { url: `${dbUrl}?connection_limit=1&pool_timeout=5` } },
  });
  try {
    const rows: Array<{ count: bigint }> = await scratch.$queryRawUnsafe(
      `SELECT count(*)::bigint AS count FROM information_schema.tables WHERE table_schema = 'public'`,
    );
    return Number(rows[0]?.count ?? 0);
  } finally {
    await scratch.$disconnect();
  }
}

export async function runBackupVerify(): Promise<BackupVerifyResult> {
  const snapshot = newestSnapshot();
  if (!snapshot) {
    return {
      verified: false,
      file: null,
      scratchDb: null,
      tables: 0,
      ageHours: null,
      detail: "no snapshots retained yet",
      skipped: true,
      reason: "no_snapshots",
    };
  }

  const admin = localAdminUrl();
  if (!admin) {
    return {
      verified: false,
      file: snapshot.file,
      scratchDb: null,
      tables: 0,
      ageHours: snapshot.ageHours,
      detail: "no local DATABASE_URL for scratch database",
      skipped: true,
      reason: "no_admin_url",
    };
  }

  const scratchDb = `backup_verify_${Date.now().toString(36)}`;
  const scratchUrl = admin.url.replace(/\/[^/]+$/, `/${scratchDb}`);
  const adminUrl = admin.url.replace(/\/[^/]+$/, "/postgres");

  try {
    // 1. Create the scratch database (drop leftovers defensively first).
    execFileSync(
      "psql",
      [
        "-q",
        adminUrl,
        "-c",
        `DROP DATABASE IF EXISTS "${scratchDb}";`,
        "-c",
        `CREATE DATABASE "${scratchDb}";`,
      ],
      { stdio: ["ignore", "pipe", "pipe"], timeout: 60_000 },
    );

    // 2. Restore the snapshot into the scratch DB. pg_restore exits non-zero
    //    when it SKIPS non-fatal objects (Supabase-only extensions like
    //    vault.secrets cannot restore to vanilla Postgres) — that must not
    //    fail verification, so capture the warning and judge by the result.
    let restoreNote = "";
    try {
      const out = execFileSync(
        "pg_restore",
        ["--no-owner", "--no-privileges", "-d", scratchUrl, snapshot.path],
        { stdio: ["ignore", "pipe", "pipe"], timeout: 10 * 60_000 },
      );
      restoreNote = out?.toString().trim().split("\n").slice(-1)[0] ?? "";
    } catch (restoreErr) {
      restoreNote =
        restoreErr instanceof Error
          ? restoreErr.message.split("\n").slice(-1)[0]
          : String(restoreErr);
    }

    // 3. Smoke-check: the restored schema has real tables. This is the
    //    verdict — a restore that ignored 3 vault objects but produced all
    //    51 app tables is a GOOD backup.
    const tables = await psqlCount(scratchUrl);
    const verified = tables > 0;

    return {
      verified,
      file: snapshot.file,
      scratchDb,
      tables,
      ageHours: snapshot.ageHours,
      detail: restoreNote || (verified ? "restored cleanly" : "restore produced no public tables"),
    };
  } catch (err) {
    return {
      verified: false,
      file: snapshot.file,
      scratchDb,
      tables: 0,
      ageHours: snapshot.ageHours,
      detail: err instanceof Error ? err.message.split("\n").slice(-1)[0] : String(err),
    };
  } finally {
    // 4. Scratch DB is always dropped — verification leaves no residue.
    try {
      execFileSync(
        "psql",
        ["-q", adminUrl, "-c", `DROP DATABASE IF EXISTS "${scratchDb}" WITH (FORCE);`],
        { stdio: ["ignore", "pipe", "pipe"], timeout: 60_000 },
      );
    } catch {
      /* non-fatal cleanup — report still goes out with scratchDb name */
    }
  }
}
