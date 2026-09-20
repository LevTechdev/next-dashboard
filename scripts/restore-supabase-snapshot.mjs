#!/usr/bin/env node
/**
 * Restore a retained mirror rollback snapshot into the remote Supabase.
 *
 * Usage: node scripts/restore-supabase-snapshot.mjs <snapshot.dump>
 *
 * The snapshot must live in .freebuff/backups/. Mirrors the sync script's
 * restore step (pg_restore --clean) so a botched sync can be rolled back to
 * exactly the pre-sync remote state. Credentials come from env files only.
 */
import { existsSync, readFileSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BACKUP_DIR = join(ROOT, ".freebuff", "backups");

const file = process.argv[2];
if (!file || file !== basename(file) || !file.endsWith(".dump")) {
  console.error("[restore] usage: node scripts/restore-supabase-snapshot.mjs <snapshot.dump>");
  process.exit(2);
}

const snapshotPath = join(BACKUP_DIR, file);
if (!existsSync(snapshotPath)) {
  console.error(`[restore] snapshot not found: ${snapshotPath}`);
  process.exit(2);
}

const envLine = existsSync(join(ROOT, ".env.remote-supabase.bak"))
  ? readFileSync(join(ROOT, ".env.remote-supabase.bak"), "utf-8")
      .split(/\r?\n/)
      .find((l) => l.startsWith("DATABASE_URL="))
  : null;
const rawUrl =
  process.env.REMOTE_SUPABASE_DATABASE_URL ??
  (envLine ? envLine.slice("DATABASE_URL=".length).trim() : null);
if (!rawUrl) {
  console.error("[restore] missing REMOTE_SUPABASE_DATABASE_URL / .env.remote-supabase.bak");
  process.exit(2);
}
// pg_restore rejects Prisma-style params; keep the bare connection string.
const url = rawUrl.split("?")[0];

console.log(`[restore] restoring ${file} into remote Supabase (--clean)…`);
try {
  execFileSync(
    "pg_restore",
    ["--no-owner", "--no-privileges", "--clean", "--if-exists", "-d", url, snapshotPath],
    { stdio: ["ignore", "pipe", "pipe"], timeout: 10 * 60_000 },
  );
  console.log(`[restore] OK — remote restored from ${file}`);
} catch (err) {
  // pg_restore exits non-zero on per-object errors (e.g. missing extensions
  // on the remote) even when the data restore largely succeeded — surface the
  // output tail but do not claim success.
  const stderr = err?.stderr?.toString?.().split("\n").filter(Boolean).slice(-8).join("\n") ?? "";
  console.error(`[restore] FAILED\n${stderr}`);
  process.exit(1);
}
