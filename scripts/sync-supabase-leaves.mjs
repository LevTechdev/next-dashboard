#!/usr/bin/env node
/**
 * Incremental Supabase mirror sync — leaf tables only.
 *
 * The full mirror sync (sync-supabase-mirror.mjs) truncate/restores all 50
 * tables through the pooler, which takes ~30 minutes. The mirror only drifts
 * *between* runs on three append-mostly "leaf" tables that nothing on the
 * remote references by FK:
 *
 *   Session · RefreshToken · SecurityEvent
 *
 * Every login, token rotation, and security event mints rows locally, so a
 * daily full sync leaves production analytics up to 24h stale on exactly the
 * tables that move fastest. This script tops up just those tables:
 *
 *   1. \copy each leaf table (or only rows newer than the watermark) from
 *      local to a CSV file
 *   2. \copy into a remote temp staging table, then one set-based
 *      INSERT..SELECT..ON CONFLICT (id) DO NOTHING — leaf rows are immutable
 *      once written, so DO NOTHING is the merge
 *   3. Re-count both sides and exit 1 on mismatch so the scheduler ledger
 *      and Settings card surface any failure.
 *
 * The watermark is the highest `createdAt` seen when the last run FINISHED
 * (data/leaf-sync-watermark.json — written only after a successful verify).
 * A missing/corrupt watermark falls back to a full-leaf load: slower
 * (thousands of rows) but still seconds, not the full sync's half hour.
 *
 * Usage:
 *   node scripts/sync-supabase-leaves.mjs               # incremental top-up
 *   node scripts/sync-supabase-leaves.mjs --verify-only # counts only, no writes
 *
 * Credentials: DATABASE_URL (local) + REMOTE_SUPABASE_DATABASE_URL or
 * .env.remote-supabase.bak (remote) — same sources as the full sync. Values
 * are never logged. The session pooler (port 5432) is the right remote
 * target: the transaction pooler (:6543) stalls long sessions.
 */

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const VERIFY_ONLY = process.argv.includes("--verify-only");

/** Leaf tables — append-mostly, immutable rows, nothing references them. */
const LEAF_TABLES = ["Session", "RefreshToken", "SecurityEvent"];
const WATERMARK_PATH = join(ROOT, "data", "leaf-sync-watermark.json");

function readDbUrlFromEnvFile(path, key = "DATABASE_URL") {
  if (!existsSync(path)) return null;
  const line = readFileSync(path, "utf-8")
    .split(/\r?\n/)
    .find((l) => l.startsWith(`${key}=`));
  return line ? line.slice(key.length + 1).trim() : null;
}

/** Strip Prisma-only query params psql rejects. */
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
    "[leaf-sync] missing DATABASE_URL (local) or REMOTE_SUPABASE_DATABASE_URL / .env.remote-supabase.bak",
  );
  process.exit(2);
}

/** Run a command without echoing args (they embed credentials). */
function run(cmd, args, opts = {}) {
  return execFileSync(cmd, args, {
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 10 * 60_000,
    maxBuffer: 64 * 1024 * 1024,
    ...opts,
  }).toString();
}

function tableCounts(url, tables) {
  const counts = {};
  for (const t of tables) {
    const out = run("psql", [url, "-tAc", `SELECT count(*) FROM public."${t}"`]);
    counts[t] = Number(out.trim());
  }
  return counts;
}

/** Newest createdAt across the leaf tables (ISO string, or null when empty). */
function readWatermarkFromDb(url) {
  const out = run(
    "psql",
    [
      url,
      "-tAc",
      `SELECT max(w) FROM (
         SELECT max("createdAt") AS w FROM public."Session"
         UNION ALL SELECT max("createdAt") FROM public."RefreshToken"
         UNION ALL SELECT max("createdAt") FROM public."SecurityEvent"
       ) w`,
    ],
  ).trim();
  return out && out !== "NULL" ? out : null;
}

function readPersistedWatermark() {
  try {
    const raw = JSON.parse(readFileSync(WATERMARK_PATH, "utf-8"));
    return typeof raw.watermark === "string" ? raw.watermark : null;
  } catch {
    return null;
  }
}

function persistWatermark(iso) {
  try {
    mkdirSync(dirname(WATERMARK_PATH), { recursive: true });
    writeFileSync(
      WATERMARK_PATH,
      `${JSON.stringify({ watermark: iso, at: new Date().toISOString() }, null, 2)}\n`,
    );
  } catch {
    // Best-effort: a lost watermark just means a full-leaf load next run.
  }
}

/**
 * Set-based apply of one table: \copy local rows (CSV) → remote staging
 * table → INSERT..SELECT..ON CONFLICT (id) DO NOTHING. \copy streams the
 * data in one network pass per table; row-by-row INSERTs over the pooler
 * exceed any sane timeout, while this moves thousands of rows in seconds.
 * Windows note: psql needs a real file path (no /tmp virtual paths) and
 * multi-MB `-c` argv blows the command-line limit, hence the -f temp file.
 */
function applyTable(table, watermark) {
  const stamp = Date.now();
  const csvPath = join(tmpdir(), `leaf-${table}-${stamp}.csv`);
  const sqlPath = join(tmpdir(), `leaf-${table}-${stamp}.sql`);
  try {
    // 1. COPY rows out of local (complete columns, order preserved).
    const select = watermark
      ? `SELECT * FROM public."${table}" WHERE "createdAt" > '${watermark}'`
      : `SELECT * FROM public."${table}"`;
    run("psql", [
      localUrl,
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      `\\copy (${select}) TO '${csvPath}' WITH (FORMAT csv)`,
    ]);

    const bytes = existsSync(csvPath) ? statSync(csvPath).size : 0;
    if (bytes === 0) {
      console.log(`[leaf-sync] ${table}: nothing new`);
      return;
    }

    // 2. Stage + merge on the remote in one transaction.
    const sql = [
      "BEGIN;",
      `CREATE TEMP TABLE leaf_stage AS SELECT * FROM public."${table}" WHERE false;`,
      `\\copy leaf_stage FROM '${csvPath}' WITH (FORMAT csv)`,
      `INSERT INTO public."${table}" SELECT * FROM leaf_stage ON CONFLICT (id) DO NOTHING;`,
      "COMMIT;",
    ].join("\n");
    writeFileSync(sqlPath, sql, "utf-8");
    run("psql", [remoteUrl, "-v", "ON_ERROR_STOP=1", "-f", sqlPath]);
    console.log(`[leaf-sync] ${table}: merged (${(bytes / 1024).toFixed(0)} KB payload)`);
  } finally {
    rmSync(csvPath, { force: true });
    rmSync(sqlPath, { force: true });
  }
}

console.log("[leaf-sync] verifying…");
const before = {
  local: tableCounts(localUrl, LEAF_TABLES),
  remote: tableCounts(remoteUrl, LEAF_TABLES),
};
console.log(
  "[leaf-sync] local:",
  JSON.stringify(before.local),
  "remote:",
  JSON.stringify(before.remote),
);

if (!VERIFY_ONLY) {
  // The DB's own max is authoritative; the persisted file only certifies
  // that a previous run finished (so trusting the DB max skips nothing).
  // No file → full-leaf load; a lost watermark must not silently skip rows.
  const watermark = readPersistedWatermark() ? readWatermarkFromDb(localUrl) : null;
  if (watermark) {
    console.log(`[leaf-sync] incremental (createdAt > ${watermark})`);
  } else {
    console.log("[leaf-sync] no usable watermark — full leaf-table load");
  }
  for (const t of LEAF_TABLES) {
    applyTable(t, watermark);
  }
  const newWatermark = readWatermarkFromDb(localUrl);
  if (newWatermark) persistWatermark(newWatermark);
}

const after = {
  local: tableCounts(localUrl, LEAF_TABLES),
  remote: tableCounts(remoteUrl, LEAF_TABLES),
};
console.log(
  "[leaf-sync] local:",
  JSON.stringify(after.local),
  "remote:",
  JSON.stringify(after.remote),
);

let ok = true;
for (const t of LEAF_TABLES) {
  if (after.local[t] !== after.remote[t]) {
    console.error(`[leaf-sync] MISMATCH ${t}: local=${after.local[t]} remote=${after.remote[t]}`);
    ok = false;
  }
}

if (!ok) process.exit(1);
console.log("[leaf-sync] OK — leaf tables in sync");
