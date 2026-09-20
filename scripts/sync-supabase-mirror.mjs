#!/usr/bin/env node
/**
 * Nightly Supabase mirror sync — refresh the remote from the local Postgres.
 *
 * Registered as the "supabase-sync" scheduler job (03:30 daily, after the
 * 02:00 quota digest) and runnable on demand:
 *
 *   node scripts/sync-supabase-mirror.mjs              # full sync (safe by default)
 *   node scripts/sync-supabase-mirror.mjs --verify-only  # compare counts, no writes
 *   node scripts/sync-supabase-mirror.mjs --dry-run    # schema diff + drift report, zero writes
 *   node scripts/sync-supabase-mirror.mjs --force      # allow overwriting remote-only rows
 *
 * Pipeline (mirrors the one-off migration proven earlier this cycle):
 *   1. pg_dump the local mirror (custom format) → a temp file
 *   2. pg_dump remote → a rollback backup next to the temp file
 *   3. TRUNCATE all remote public tables (data refresh, schema untouched)
 *   4. pg_restore --clean into the remote so remote DDL aligns exactly with local
 *   5. Compare per-table row counts; any mismatch exits 1 so the scheduler
 *      ledger records the failure and the Settings card goes red.
 *
 * Credentials come from env files — DATABASE_URL (local) and
 * REMOTE_SUPABASE_DATABASE_URL or .env.remote-supabase.bak (remote). Values
 * are never logged.
 */

import { execFileSync } from "node:child_process";
import {
  readFileSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  rmSync,
  readdirSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const VERIFY_ONLY = process.argv.includes("--verify-only");
const DRY_RUN = process.argv.includes("--dry-run");
// --force documented in the usage banner is registered here (see full sync).

function readDbUrlFromEnvFile(path, key = "DATABASE_URL") {
  if (!existsSync(path)) return null;
  const line = readFileSync(path, "utf-8")
    .split(/\r?\n/)
    .find((l) => l.startsWith(`${key}=`));
  return line ? line.slice(key.length + 1).trim() : null;
}

/**
 * Prisma-style query params (`?schema=public`, `pgbouncer=true`, …) are not
 * valid for psql/pg_dump/pg_restore — they reject the URL outright. Every CLI
 * call below takes the bare connection string; Prisma-only parameters carry no
 * meaning for these tools.
 */
const cleanUrl = (url) => (url ? url.split("?")[0] : url);

const localUrl = cleanUrl(
  process.env.LOCAL_DATABASE_URL ?? readDbUrlFromEnvFile(join(ROOT, ".env.local")),
);
const remoteUrl = cleanUrl(
  process.env.REMOTE_SUPABASE_DATABASE_URL ??
    readDbUrlFromEnvFile(join(ROOT, ".env.remote-supabase.bak")),
);

if (!localUrl || !remoteUrl) {
  console.error(
    "[sync] missing DATABASE_URL (local) or REMOTE_SUPABASE_DATABASE_URL / .env.remote-supabase.bak",
  );
  process.exit(2);
}

/** Run a command without ever echoing its args (they embed credentials). */
function run(cmd, args, opts = {}) {
  return execFileSync(cmd, args, {
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 10 * 60_000,
    ...opts,
  }).toString();
}

function listTables(url) {
  const out = run("psql", [
    url,
    "-tAc",
    "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename",
  ]);
  return out
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

function tableCounts(url, tables) {
  const counts = {};
  for (const t of tables) {
    const out = run("psql", [url, "-tAc", `SELECT count(*) FROM public."${t}"`]);
    counts[t] = Number(out.trim());
  }
  return counts;
}

function truncateAll(url, tables) {
  const list = tables.map((t) => `public."${t}"`).join(", ");
  run("psql", [url, "-v", "ON_ERROR_STOP=1", "-c", `TRUNCATE TABLE ${list} CASCADE`]);
}

/**
 * Schema-only dump, normalized for diffing: owner/privilege lines, psql
 * SET/config chatter, comments and blank lines are stripped so only real
 * DDL differences survive. pg_restore/psql boilerplate noise otherwise
 * swamps the diff with lines that mean nothing.
 */
function normalizedSchemaSql(url) {
  // --schema=public scopes the diff to project DDL: the remote carries
  // Supabase platform schemas (auth, storage, vault, realtime, …) that the
  // sync must never touch — diffing them would drown the signal in noise.
  // _prisma_migrations is excluded by the dump itself: it lives only on the
  // remote (Prisma's own bookkeeping there), so leaving it in would make a
  // perfectly converged mirror report drift forever.
  const out = run("pg_dump", [
    "--no-owner",
    "--no-privileges",
    "--schema-only",
    "-Fp",
    "--schema=public",
    "--exclude-table=public._prisma_migrations",
    url,
  ]);
  return out
    .split("\n")
    .map((l) => l.replace(/\r$/, "").trimEnd())
    .filter((l) => {
      const s = l.trim();
      if (!s || s.startsWith("--")) return false;
      if (
        /^(SET |SELECT pg_catalog\.set_config|\\restrict|\\unrestrict|GRANT |REVOKE |ALTER .* OWNER TO )/.test(
          s,
        )
      )
        return false;
      return true;
    })
    .join("\n");
}

// ── Dry-run mode: DDL diff + row-count drift, zero writes anywhere ──────────
if (DRY_RUN) {
  console.log("[dry-run] comparing local mirror vs remote Supabase (no writes)…");

  const localSchema = normalizedSchemaSql(localUrl);
  const remoteSchema = normalizedSchemaSql(remoteUrl);
  let ddlDrift = [];
  if (localSchema === remoteSchema) {
    console.log("[dry-run] DDL: identical ✓");
  } else {
    const a = localSchema.split("\n");
    const b = remoteSchema.split("\n");
    const setA = new Set(a);
    const setB = new Set(b);
    const onlyLocal = a.filter((l) => !setB.has(l));
    const onlyRemote = b.filter((l) => !setA.has(l));
    ddlDrift = [...onlyLocal, ...onlyRemote];
    console.log(
      `[dry-run] DDL drift: ${onlyLocal.length} local-only + ${onlyRemote.length} remote-only DDL line(s)`,
    );
    for (const l of onlyLocal.slice(0, 20)) console.log(`  local-only: ${l.slice(0, 140)}`);
    for (const l of onlyRemote.slice(0, 20)) console.log(`  remote-only: ${l.slice(0, 140)}`);
  }

  const tables = listTables(localUrl);
  const remoteTables = new Set(listTables(remoteUrl));
  const missingRemote = tables.filter((t) => !remoteTables.has(t));
  const extraRemote = [...remoteTables].filter((t) => !tables.includes(t));
  const localCounts = tableCounts(
    localUrl,
    tables.filter((t) => remoteTables.has(t) && t !== "_prisma_migrations"),
  );
  const remoteCounts = tableCounts(
    remoteUrl,
    [...remoteTables].filter((t) => tables.includes(t) && t !== "_prisma_migrations"),
  );
  const drift = [...remoteTables]
    .filter((t) => tables.includes(t) && t !== "_prisma_migrations")
    .filter((t) => (localCounts[t] ?? 0) !== (remoteCounts[t] ?? 0));

  console.log(`[dry-run] tables: local ${tables.length} / remote ${remoteTables.size}`);
  if (missingRemote.length) console.log(`[dry-run] missing on remote: ${missingRemote.join(", ")}`);
  // _prisma_migrations lives only on the remote (it tracks applied migrations
  // there) — expected, not drift.
  const meaningfulExtra = extraRemote.filter((t) => t !== "_prisma_migrations");
  if (meaningfulExtra.length)
    console.log(`[dry-run] extra on remote: ${meaningfulExtra.join(", ")}`);
  if (drift.length) {
    console.log("[dry-run] row-count drift:");
    for (const t of drift)
      console.log(`  ${t}: local ${localCounts[t] ?? 0} → remote ${remoteCounts[t] ?? 0}`);
  }

  const clean =
    ddlDrift.length === 0 &&
    missingRemote.length === 0 &&
    meaningfulExtra.length === 0 &&
    drift.length === 0;
  console.log(
    clean
      ? "[dry-run] OK — full sync would be a no-op ✓"
      : "[dry-run] drift found — a full sync would rewrite the remote ✗",
  );
  process.exit(clean ? 0 : 1);
}

// ── Verify-only mode: compare counts and leave both sides untouched ────────
if (VERIFY_ONLY) {
  const tables = listTables(localUrl);
  const localCounts = tableCounts(localUrl, tables);
  const remoteCounts = tableCounts(remoteUrl, tables);
  const drift = tables.filter((t) => (localCounts[t] ?? 0) !== (remoteCounts[t] ?? 0));
  if (drift.length) {
    console.error(`[sync] drift detected in ${drift.length} table(s):`, drift.join(", "));
    process.exit(1);
  }
  console.log(`[sync] verify-only OK — ${tables.length} tables match`);
  process.exit(0);
}

// ── Full sync ────────────────────────────────────────────────────────────────
//
// Safe by default: refuse to run when the remote holds rows that local lacks
// (remote-only drift) — a full sync would silently destroy them. An explicit
// --force acknowledges the data loss; either way a rollback snapshot is taken
// before any write.
const FORCE = process.argv.includes("--force");

const remoteOnly = [];
{
  console.log("[sync] preflight: checking for remote-only rows…");
  const tables = listTables(localUrl);
  const remoteTables = new Set(listTables(remoteUrl));
  const shared = tables.filter((t) => remoteTables.has(t) && t !== "_prisma_migrations");
  const localCounts = tableCounts(localUrl, shared);
  const remoteCounts = tableCounts(remoteUrl, shared);
  for (const t of shared) {
    if ((remoteCounts[t] ?? 0) > (localCounts[t] ?? 0)) {
      remoteOnly.push(`${t}: remote ${remoteCounts[t]} > local ${localCounts[t]}`);
    }
  }
  if (remoteOnly.length) {
    console.error("[sync] REFUSED — remote has rows local lacks (full sync would delete them):");
    for (const r of remoteOnly) console.error(`  ${r}`);
    if (!FORCE) {
      console.error(
        "[sync] Re-run with --force to overwrite, or sync after backing up the remote.",
      );
      process.exit(1);
    }
    console.error("[sync] --force given: proceeding anyway (rollback snapshot still taken first).");
  } else {
    console.log("[sync] preflight OK — no remote-only rows.");
  }
}

const tmp = mkdtempSync(join(tmpdir(), "supabase-sync-"));
const dumpPath = join(tmp, "local.dump");

// The remote backup is PERSISTENT (not a temp file): this step truncates and
// rewrites the remote, so the pre-sync snapshot must outlive the run as the
// rollback artifact. It lands in the gitignored .freebuff/backups/ so it never
// pollutes the working tree.
const backupDir = join(ROOT, ".freebuff", "backups");
mkdirSync(backupDir, { recursive: true });
const backupPath = join(backupDir, `remote-${new Date().toISOString().replace(/[:.]/g, "-")}.dump`);

try {
  console.log("[sync] 1/5 dumping local mirror…");
  run("pg_dump", ["--no-owner", "--no-privileges", "-Fc", "-f", dumpPath, localUrl]);

  console.log("[sync] 2/5 backing up current remote state…");
  run("pg_dump", ["--no-owner", "--no-privileges", "-Fc", "-f", backupPath, remoteUrl]);
  const backupMb = (statSync(backupPath).size / (1024 * 1024)).toFixed(2);
  console.log(`[sync]    rollback snapshot: ${backupPath} (${backupMb} MB) — RETAINED`);

  const tables = listTables(localUrl);
  console.log(`[sync] 3/5 truncating ${tables.length} remote tables…`);
  truncateAll(remoteUrl, tables);

  console.log("[sync] 4/5 restoring dump into remote (--clean)…");
  run("pg_restore", ["--no-owner", "--no-privileges", "--clean", "-d", remoteUrl, dumpPath]);

  console.log("[sync] 5/5 verifying per-table counts…");
  const localCounts = tableCounts(localUrl, tables);
  const remoteCounts = tableCounts(remoteUrl, tables);
  const drift = tables.filter((t) => (localCounts[t] ?? 0) !== (remoteCounts[t] ?? 0));
  if (drift.length) {
    console.error(`[sync] FAILED — drift in ${drift.length} table(s):`, drift.join(", "));
    process.exit(1);
  }
  console.log(`[sync] OK — ${tables.length} tables match row-for-row.`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
