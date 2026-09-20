#!/usr/bin/env node
/**
 * Non-destructive reconciliation between the local Postgres mirror and the
 * remote Supabase database.
 *
 * `scripts/sync-supabase-mirror.mjs` is a one-way MIRROR: it makes the remote
 * look like local, which deletes any row that exists only on the remote (it
 * refuses to unless you pass --force). That is the wrong tool once the remote
 * holds production rows, because the drift is two-way — orders and users get
 * created remotely while sessions and security events accumulate locally.
 *
 * This script only ever INSERTS. For every table and both directions it copies
 * the source rows into a temporary staging table on the target and runs a
 * single `INSERT ... SELECT ... ON CONFLICT DO NOTHING`. Rows that already
 * exist are skipped by the primary key; nothing is updated or deleted, and
 * re-running is a no-op.
 *
 * Staging through COPY matters: replaying 8,000 single-row INSERTs through the
 * Supabase session pooler takes far longer than one COPY plus one INSERT, and
 * a multi-minute per-statement round trip is exactly how a "quick sync" turns
 * into a timeout.
 *
 *   node scripts/reconcile-supabase-drift.mjs                 # drifted tables
 *   node scripts/reconcile-supabase-drift.mjs Order OrderItem # specific tables
 *   node scripts/reconcile-supabase-drift.mjs --dry-run       # report only
 *
 * Credentials come from LOCAL_DATABASE_URL / REMOTE_SUPABASE_DATABASE_URL, or
 * from DATABASE_URL in `.env` and SUPABASE_SESSION_POOLER_URL in `.env.local`.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Parent-first so a child row never arrives before the row it references.
 * Keeping this order matters more than alphabetical neatness.
 */
const DEFAULT_TABLES = [
  "Tenant",
  "User",
  "Subscription",
  "ApiKey",
  "UsageRecord",
  "Notification",
  "Invoice",
  "OrderItem",
  "ActivityLog",
  "RefreshToken",
  "SecurityEvent",
  "Session",
];

function envValue(file, key) {
  try {
    const line = readFileSync(file, "utf-8")
      .split(/\r?\n/)
      .find((l) => l.startsWith(`${key}=`));
    if (!line) return null;
    // .env values are often quoted; psql wants the bare URL.
    return line
      .slice(key.length + 1)
      .trim()
      .replace(/^['"]|['"]$/g, "");
  } catch {
    return null;
  }
}

/** The recorded 6543 URL is the transaction pooler; dumps and migrations need the session pooler. */
function toSessionPooler(url) {
  return url.replace(/:6543\//, ":5432/").replace(/\?pgbouncer=true/, "");
}

function mask(url) {
  return url.replace(/:\/\/[^@]*@/, "://***@");
}

const argv = process.argv.slice(2);
const dryRun = argv.includes("--dry-run");
const requested = argv.filter((a) => !a.startsWith("--"));
const tables = requested.length ? requested : DEFAULT_TABLES;

const local = process.env.LOCAL_DATABASE_URL ?? envValue(".env", "DATABASE_URL");
const remote =
  process.env.REMOTE_SUPABASE_DATABASE_URL ??
  envValue(".env.local", "SUPABASE_SESSION_POOLER_URL") ??
  (envValue(".env.remote-supabase.bak", "DATABASE_URL")
    ? toSessionPooler(envValue(".env.remote-supabase.bak", "DATABASE_URL"))
    : null);

if (!local || !remote) {
  console.error("[reconcile] Missing a connection string for local or remote.");
  process.exit(1);
}

const work = mkdtempSync(join(tmpdir(), "reconcile-"));
const urls = { local, remote };

function psql(url, args) {
  return execFileSync("psql", [url, ...args], {
    encoding: "utf-8",
    maxBuffer: 512 * 1024 * 1024,
    timeout: 600_000,
  });
}

/** Row count for a table (used only by --dry-run, where accuracy beats speed). */
function rowCount(url, table) {
  return Number(psql(url, ["-tAc", `SELECT count(*) FROM public."${table}"`]).trim());
}

function copyPath(table, dir) {
  return join(work, `${table}-${dir}.csv`).replace(/\\/g, "/");
}

/** Snapshot a table to CSV on the client side (no server file access needed). */
function copyOut(url, table, file) {
  writeFileSync(file, "");
  psql(url, ["-c", `\\copy (SELECT * FROM public."${table}") TO '${file}' WITH CSV`]);
}

/** Stage the CSV on the target and insert only what is missing. */
function insertMissing(url, table, file) {
  const script = [
    `CREATE TEMP TABLE _stg (LIKE public."${table}" INCLUDING DEFAULTS);`,
    `\\copy _stg FROM '${file}' WITH CSV`,
    `INSERT INTO public."${table}" SELECT * FROM _stg ON CONFLICT DO NOTHING;`,
  ].join("\n");
  const scriptFile = join(work, `${table}-insert.sql`);
  writeFileSync(scriptFile, script);

  // No -q: psql's "COPY n" and "INSERT 0 m" tags are the report. -1 keeps a
  // failed table atomic, so a mid-way error leaves the target untouched.
  const log = psql(url, ["-1", "-v", "ON_ERROR_STOP=1", "-f", scriptFile]);
  const staged = Number(/^COPY (\d+)$/m.exec(log)?.[1] ?? 0);
  const inserted = Number(/^INSERT 0 (\d+)$/m.exec(log)?.[1] ?? 0);
  return { staged, inserted };
}

function firstLine(err) {
  return String(err.stderr ?? err.message).split("\n").find((l) => l.trim()) ?? "unknown error";
}

function runDirection(label, fromName, toName) {
  console.log(`\n[reconcile] ${label} → ${toName} (${mask(urls[toName])})`);
  for (const table of tables) {
    try {
      const file = copyPath(table, toName);
      if (dryRun) {
        console.log(`  ${table}: ${rowCount(urls[fromName], table)} source row(s), nothing written`);
        continue;
      }
      copyOut(urls[fromName], table, file);
      const { staged, inserted } = insertMissing(urls[toName], table, file);
      const already = staged - inserted;
      console.log(
        `  ${table}: staged ${staged}, inserted ${inserted}${already > 0 ? `, ${already} already present` : ""}`,
      );
    } catch (err) {
      console.log(`  ${table}: FAILED — ${firstLine(err)}`);
    }
  }
}

try {
  console.log(`[reconcile] local  ${mask(local)}`);
  console.log(`[reconcile] remote ${mask(remote)}`);
  if (dryRun) console.log("[reconcile] dry run — nothing will be written");

  runDirection("local → remote", "local", "remote");
  runDirection("remote → local", "remote", "local");

  console.log("\n[reconcile] done. Rows were only ever inserted.");
} finally {
  rmSync(work, { recursive: true, force: true });
}
