#!/usr/bin/env node
/**
 * Incremental Supabase mirror sync — leaf tables only.
 *
 * The full mirror sync (sync-supabase-mirror.mjs) truncate/restores all
 * tables through the pooler, which takes ~30 minutes. The mirror only drifts
 * *between* runs on five append-mostly "leaf" tables that nothing on the
 * remote references by FK (two are User-referencing snapshot series whose
 * users always exist remotely):
 *
 *   Session · RefreshToken · SecurityEvent ·
 *   RecoveryReadinessSnapshot · FxRateSnapshot
 *
 * Every login, token rotation, and security event mints rows locally, so a
 * daily full sync leaves production analytics up to 24h stale on exactly the
 * tables that move fastest. This script tops up just those tables:
 *
 *   1. \copy each leaf table (or only rows newer than the watermark) from
 *      local to a CSV file
 *   2. \copy into a remote temp staging table, then one set-based
 *      INSERT..SELECT..ON CONFLICT DO NOTHING (no column list, so every
 *      unique key participates) — leaf rows are immutable once written,
 *      so DO NOTHING is the merge
 *   3. Re-count both sides and exit 1 when the remote is missing rows it
 *      could have taken. Rows excluded because their FK target (a dev-seed
 *      user) does not exist remotely are tallied and remembered, so only
 *      real gaps fail the run.
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
const LEAF_TABLES = [
  "Session",
  "RefreshToken",
  "SecurityEvent",
  "RecoveryReadinessSnapshot",
  "FxRateSnapshot",
];

/**
 * FK targets the remote enforces that local dev data can violate: a dev seed
 * wipes and recreates users/tenants, so local Session/RefreshToken/
 * SecurityEvent rows can reference ids the remote mirror has never seen
 * (both userId → User AND tenantId → Tenant have bitten). The list is
 * DISCOVERED from the remote catalog (pg_constraint) once per run rather
 * than hardcoded — a new FK on a leaf table then costs nothing here, and
 * rows failing any of them are excluded (and counted) instead of aborting
 * the whole table.
 */
const remoteFkCache = new Map();
function remoteForeignKeysFor(table, url) {
  if (remoteFkCache.has(table)) return remoteFkCache.get(table);
  let fks = [];
  try {
    // One row per (constraint, column-pair): conname|col|refTable|refCol|ord
    const out = run("psql", [
      url,
      "-tA",
      "-F",
      "|",
      "-c",
      `SELECT con.conname, src.attname, ref_cl.relname, ref.attname, k.ord\nFROM pg_constraint con\nJOIN LATERAL unnest(con.conkey) WITH ORDINALITY AS k(attnum, ord) ON true\nJOIN LATERAL unnest(con.confkey) WITH ORDINALITY AS rk(attnum, ord) ON rk.ord = k.ord\nJOIN pg_attribute src ON src.attrelid = con.conrelid AND src.attnum = k.attnum\nJOIN pg_attribute ref ON ref.attrelid = con.confrelid AND ref.attnum = rk.attnum\nJOIN pg_class ref_cl ON ref_cl.oid = con.confrelid\nWHERE con.contype = 'f' AND con.conrelid = 'public."${table}"'::regclass\nORDER BY con.conname, k.ord`,
    ]);
    const byName = new Map();
    for (const line of out.split("\n")) {
      const [name, col, refTable, refCol, ord] = line.trim().split("|");
      if (!name || !col || !refTable || !refCol) continue;
      const existing = byName.get(name);
      if (existing) {
        existing.pairs[Number(ord) - 1] = [col, refCol];
      } else {
        byName.set(name, { name, refTable, pairs: [[col, refCol]] });
      }
    }
    fks = [...byName.values()];
  } catch {
    // Probe failed — an empty list restores the old abort-on-FK behaviour;
    // a failing catalog query is a broken mirror anyway.
  }
  remoteFkCache.set(table, fks);
  return fks;
}

/**
 * The merge must be idempotent under every replay. Leaf tables can carry
 * MORE unique keys than the id PK — SecurityEvent has a `seq` key, and
 * FxRateSnapshot a natural (base, quote, day) key — and a re-run after a
 * failed commit re-copies rows the remote already took under a DIFFERENT
 * id. A column-listed `ON CONFLICT (id)` cannot absorb those: Postgres
 * raises on the other unique constraint. `ON CONFLICT DO NOTHING` with NO
 * column list skips conflicts on EVERY unique key, which is exactly the
 * merge semantics an append-only mirror wants. Rows the merge skipped are
 * recovered from accounting (staged − inserted − orphans), so no catalog
 * introspection of unique keys is needed at all.
 */
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

/**
 * The SESSION pooler port (:5432) is the right remote target — the docblock
 * below says so and the full-sync script agrees — but the stored credential
 * has historically pointed at the TRANSACTION pooler (:6543), which stalls
 * long sessions and 400s mid-copy. Rewrite the port whenever a URL carries
 * the transaction one; a URL already on :5432 is left untouched. (The host
 * is deliberately not named here: committed sources must not embed the
 * remote URL, per the env policy guard.)
 */
function forceSessionPort(url) {
  if (!url) return url;
  return url.replace(/:6543\//, ":5432/");
}

const localUrl = cleanUrl(
  process.env.LOCAL_DATABASE_URL ?? readDbUrlFromEnvFile(join(ROOT, ".env.local")),
);
const remoteUrl = forceSessionPort(
  cleanUrl(
    process.env.REMOTE_SUPABASE_DATABASE_URL ??
      readDbUrlFromEnvFile(join(ROOT, ".env.remote-supabase.bak")),
  ),
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
  const unions = LEAF_TABLES.map((t) => `SELECT max("createdAt") AS w FROM public."${t}"`).join(
    " UNION ALL ",
  );
  const out = run("psql", ["-tAc", `SELECT max(w) FROM ( ${unions} ) w`, url]).trim();
  return out && out !== "NULL" ? out : null;
}

/**
 * Persisted clean-run state: the watermark, per table the rows excluded from
 * the merge (FK orphans pointing at dev-seed users the remote has never
 * seen, and conflict-key duplicates of remote rows under another id), and —
 * for the last run only — an operator-facing orphan report (count + sample
 * fingerprints per table) the scheduler card reads. The excluded totals must
 * be remembered across runs — those rows stay local forever, so without the
 * tally every later run would re-report the same phantom shortfall.
 */
function readPersistedState() {
  try {
    const raw = JSON.parse(readFileSync(WATERMARK_PATH, "utf-8"));
    if (typeof raw.watermark !== "string") return null;
    const excluded =
      raw.excluded && typeof raw.excluded === "object"
        ? Object.fromEntries(Object.entries(raw.excluded).filter(([, v]) => typeof v === "number"))
        : {};
    const orphanReport =
      raw.orphanReport && typeof raw.orphanReport === "object" ? raw.orphanReport : {};
    return { watermark: raw.watermark, excluded, orphanReport };
  } catch {
    return null;
  }
}

function persistState(watermark, excluded, orphanReport = {}) {
  try {
    mkdirSync(dirname(WATERMARK_PATH), { recursive: true });
    writeFileSync(
      WATERMARK_PATH,
      `${JSON.stringify({ watermark, excluded, orphanReport, at: new Date().toISOString() }, null, 2)}\n`,
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
 * Returns `{ excluded, orphans, samples }`: the rows the merge could not
 * take (FK orphans + conflict-key replays — the verify step subtracts it),
 * the orphan component alone, and up to 6 orphan row fingerprints for the
 * operator-facing report (0/[] when nothing new was staged).
 */
function applyTable(table, watermark) {
  const stamp = Date.now();
  const csvPath = join(tmpdir(), `leaf-${table}-${stamp}.csv`);
  const sqlPath = join(tmpdir(), `leaf-${table}-${stamp}.sql`);
  try {
    // 1. COPY rows out of local. Columns are listed EXPLICITLY, intersected
    //    with the remote table's actual columns: a blind SELECT * breaks the
    //    moment local and remote schema drift apart (e.g. a new local column
    //    like RefreshToken.stayLoginUntil that the remote hasn't been
    //    migrated to yet) — the staging \copy then rejects every row and the
    //    run dies mid-flight.
    const remoteCols = run("psql", [
      remoteUrl,
      "-tAc",
      `SELECT column_name FROM information_schema.columns WHERE table_name='${table}' AND table_schema='public' ORDER BY ordinal_position`,
    ])
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    const localCols = run("psql", [
      localUrl,
      "-tAc",
      `SELECT column_name FROM information_schema.columns WHERE table_name='${table}' AND table_schema='public' ORDER BY ordinal_position`,
    ])
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    const common = localCols.filter((c) => remoteCols.includes(c));
    if (common.length === 0) {
      throw new Error(`[leaf-sync] ${table}: no common columns between local and remote`);
    }
    const colList = common.map((c) => `"${c}"`).join(", ");
    const select = watermark
      ? `SELECT ${colList} FROM public."${table}" WHERE "createdAt" > '${watermark}'`
      : `SELECT ${colList} FROM public."${table}"`;
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
      return { excluded: 0, orphans: 0, samples: [] };
    }

    // 2. Stage + merge on the remote in one transaction. The staging table
    //    is built from the SAME column list so the \copy column count always
    //    matches. Rows whose local-only FK targets do not exist on the remote
    //    (dev-seed users behind Session.userId / RefreshToken.userId) are
    //    EXCLUDED from the insert rather than allowed to abort the batch:
    //    one orphan row used to kill the whole table with a FK violation,
    //    and the scheduler job then failed on every tick. The orphan count
    //    queried after the commit feeds the verify step's accounting.
    const fks = remoteForeignKeysFor(table, remoteUrl);
    // FK semantics: a NULL FK value is LEGAL (SecurityEvent.userId is nullable
    // — most rows are system events with no actor) and must insert; only a
    // fully-NULL-free FK whose target is missing remotely is an orphan. A
    // bare `AND EXISTS (...)` evaluates to NULL (→ false) for NULL FKs and
    // silently dropped thousands of legitimate rows per run. Composite FKs
    // (none today, but cheap to be correct) are unenforced when ANY column
    // is NULL.
    const fkFilters = fks
      .map((fk) => {
        const nullish = fk.pairs.map(([c]) => `s."${c}" IS NULL`).join(" OR ");
        const match = fk.pairs.map(([c, rc]) => `r."${rc}" = s."${c}"`).join(" AND ");
        return `AND ((${nullish}) OR EXISTS (SELECT 1 FROM public."${fk.refTable}" r WHERE ${match}))`;
      })
      .join("\n      ");
    // Post-merge accounting, computed in the SAME transaction as the insert:
    //   - orphans: staged rows whose NOT-NULL FK target (a dev-seed user)
    //     does not exist remotely — permanent local-only rows;
    //   - inserted: rows the merge actually took (WITH ... RETURNING count).
    // Skipped (conflict key already remote, possibly under another id)
    // = staged − inserted − orphans. Deriving the skipped count by
    // subtraction instead of probing unique indexes keeps the accounting
    // correct for ANY set of unique keys and needs no catalog lookups.
    // The meta values live in a temp table written inside the transaction
    // and read after the commit (temp tables survive within the session) —
    // replacing the old DO-block NOTICE, which psql captured but the script
    // never surfaced. Without this accounting a healthy run looks short by
    // exactly the rows it correctly refused to copy, and verify fails forever.
    const orphanExpr =
      fks
        .map((fk) => {
          const notNull = fk.pairs.map(([c]) => `s."${c}" IS NOT NULL`).join(" AND ");
          const match = fk.pairs.map(([c, rc]) => `r."${rc}" = s."${c}"`).join(" AND ");
          return `(SELECT count(*)::int FROM leaf_stage s WHERE ${notNull} AND NOT EXISTS (SELECT 1 FROM public."${fk.refTable}" r WHERE ${match}))`;
        })
        .join(" + ") || "0";
    const sampleBranches = fks.map((fk) => {
      const notNull = fk.pairs.map(([c]) => `s."${c}" IS NOT NULL`).join(" AND ");
      const match = fk.pairs.map(([c, rc]) => `r."${rc}" = s."${c}"`).join(" AND ");
      const fingerprint = `s."id" || ' [' || ${fk.pairs
        .map(([c]) => `'${c}=' || coalesce(s."${c}"::text, 'NULL')`)
        .join(" || ' ' || ")} || ']'`;
      return `SELECT ${fingerprint} AS x FROM leaf_stage s WHERE ${notNull} AND NOT EXISTS (SELECT 1 FROM public."${fk.refTable}" r WHERE ${match}) LIMIT 3`;
    });
    const sampleStmt =
      fks.length > 0
        ? // Each branch needs its own parentheses: a bare `LIMIT 3 UNION ALL`
          // is a syntax error — LIMIT binds inside a set operation only when
          // the branch is parenthesized.
          `SELECT 'leafsync-samples|${table}|' || coalesce(string_agg(x, ' ; '), '') FROM (${sampleBranches
            .map((b) => `(${b})`)
            .join(" UNION ALL ")}) samples`
        : null;
    const insertWithMeta = [
      // Postgres only allows a data-modifying CTE at the TOP level, so the
      // INSERT..RETURNING and the leaf_meta UPDATE sharing its result must
      // live in one statement's WITH clause (the count subquery inside the
      // UPDATE is plain-read and fine).
      "WITH ins AS (",
      `INSERT INTO public."${table}" (${colList})`,
      `SELECT s.${common.map((c) => `"${c}"`).join(", s.")} FROM leaf_stage s`,
      `WHERE s.id IS NOT NULL ${fkFilters}`.trim(),
      "ON CONFLICT DO NOTHING",
      "RETURNING 1",
      "),",
      "upd AS (",
      "UPDATE leaf_meta SET inserted = (SELECT count(*)::int FROM ins) RETURNING 1",
      ")",
      "SELECT 1 FROM upd;",
    ].join("\n");
    const sql = [
      "BEGIN;",
      `CREATE TEMP TABLE leaf_stage AS SELECT ${colList} FROM public."${table}" WHERE false;`,
      `\\copy leaf_stage(${colList}) FROM '${csvPath}' WITH (FORMAT csv)`,
      "CREATE TEMP TABLE leaf_meta AS SELECT 0::int AS staged, 0::int AS inserted, 0::int AS orphans;",
      "UPDATE leaf_meta SET staged = (SELECT count(*)::int FROM leaf_stage);",
      insertWithMeta,
      `UPDATE leaf_meta SET orphans = (${orphanExpr});`,
      "COMMIT;",
      `SELECT 'leafsync-meta|${table}|' || staged::text || '|' || inserted::text || '|' || orphans::text FROM leaf_meta;`,
      // Orphan fingerprints, read in the SAME file (same psql connection —
      // the session temp table is invisible to a second one). A single-line
      // aggregate separated by ' ; ' parses trivially: cuids contain no
      // semicolons, and the sentinel can never collide with the meta row.
      ...(sampleStmt ? [sampleStmt] : []),
    ].join("\n");
    writeFileSync(sqlPath, sql, "utf-8");
    const out = run("psql", [remoteUrl, "-v", "ON_ERROR_STOP=1", "-tA", "-f", sqlPath]);
    const metaMatch = out.match(
      new RegExp(`^leafsync-meta\\|${table}\\|(\\d+)\\|(\\d+)\\|(\\d+)$`, "m"),
    );
    const staged = metaMatch ? Number(metaMatch[1]) : 0;
    const inserted = metaMatch ? Number(metaMatch[2]) : 0;
    const orphans = metaMatch ? Number(metaMatch[3]) : 0;
    const skipped = Math.max(0, staged - inserted - orphans);
    if (skipped + orphans > 0) {
      console.log(
        `[leaf-sync] ${table}: ${skipped + orphans} staged rows not copied (orphans=${orphans}, conflict-key already remote=${skipped})`,
      );
    }
    const samplesMatch = out.match(new RegExp(`^leafsync-samples\\|${table}\\|(.*)$`, "m"));
    const orphanSamples =
      samplesMatch && samplesMatch[1]
        ? samplesMatch[1]
            .split(" ; ")
            .map((s) => s.trim().replace(/\|/g, " "))
            .filter(Boolean)
            .slice(0, 6)
        : [];
    console.log(`[leaf-sync] ${table}: merged (${(bytes / 1024).toFixed(0)} KB payload)`);
    return { excluded: orphans + skipped, orphans, samples: orphanSamples };
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

let excludedForVerify = {};
let freshOrphanReport = {};
let pendingWatermark = null;
// Scope bridges for the verify/persist block below (the sync block may not
// run under --verify-only): whether the run was a full load, and the state
// file the run started from.
let fullLoadRef = false;
let persistedRef = null;
if (VERIFY_ONLY) {
  // --verify-only writes nothing, so it has no per-run tally; it verifies
  // against the exclusions the last CLEAN run persisted (a missing file
  // means the baseline is 0 — stricter, never looser).
  excludedForVerify = readPersistedState()?.excluded ?? {};
} else {
  // Incremental watermark: the persisted file certifies that a PREVIOUS RUN
  // FINISHED CLEAN (verify passed and the file was written only then). The
  // DB's own max is deliberately NOT trusted on its own: after a failed run
  // (pooler brownout, mid-copy crash) the local max has already advanced past
  // rows that never reached the remote, and trusting it would skip them
  // FOREVER — the silent-drift bug this job exists to prevent. A failed run
  // leaves the old file, so the next run re-copies everything after the last
  // KNOWN-GOOD watermark; DO NOTHING makes the overlap free.
  // No file → full-leaf load; a lost watermark must not silently skip rows.
  const persisted = readPersistedState();
  const watermark = persisted?.watermark ?? null;
  const fullLoad = !watermark;
  fullLoadRef = fullLoad;
  persistedRef = persisted;
  if (watermark) {
    console.log(`[leaf-sync] incremental (createdAt > ${watermark}, last clean run)`);
  } else {
    console.log("[leaf-sync] no clean-run watermark — full leaf-table load");
  }
  const fresh = {};
  for (const t of LEAF_TABLES) {
    fresh[t] = applyTable(t, watermark) ?? { excluded: 0, orphans: 0, samples: [] };
  }
  // applyTable returns the per-run tally of permanently-unstorable rows:
  // FK orphans, plus rows skipped because their conflict key is already on
  // the remote under another id. Adding the skipped count can only err
  // toward ALLOWING the verify (every skipped row exists remotely), and on
  // a replayed full load the same rows are simply re-counted — so no state
  // can make a short remote look healthy.
  // A full load re-stages every local row, so this run's orphan tally is
  // complete and REPLACES the remembered one; an incremental run only saw
  // new rows, so its tally ADDS to what earlier clean runs excluded — those
  // rows stay local forever and must keep being accounted for.
  excludedForVerify = {};
  freshOrphanReport = {};
  for (const t of LEAF_TABLES) {
    excludedForVerify[t] = fullLoad
      ? fresh[t].excluded
      : (persisted?.excluded[t] ?? 0) + fresh[t].excluded;
    if (fresh[t].orphans > 0) {
      freshOrphanReport[t] = { count: fresh[t].orphans, samples: fresh[t].samples };
    }
  }
  pendingWatermark = readWatermarkFromDb(localUrl);
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

// Verify: the remote must hold everything local holds — NOT the same count.
// Local legitimately prunes leaf rows (a seed wipes users, and Session /
// RefreshToken / SecurityEvent cascade with them), so local < remote is the
// STEADY STATE after any prune, and demanding equality made every run after
// one fail forever with an un-actionable MISMATCH. The direction that
// matters for analytics completeness is remote being BEHIND local: that is
// the only failure the sync can fix, so it is the only one that fails the
// run. (remote > local is fine — the mirror simply retains pruned history.)
let ok = true;
for (const t of LEAF_TABLES) {
  const excluded = excludedForVerify[t] ?? 0;
  const expectedMin = after.local[t] - excluded;
  if (!Number.isFinite(expectedMin)) {
    // Fail CLOSED on broken bookkeeping: a NaN here (a missing tally entry)
    // makes every comparison false, which would let a short remote pass
    // vacuously — the exact silent drift this job exists to prevent.
    console.error(
      `[leaf-sync] MISMATCH ${t}: verify accounting is corrupt (excluded=${excluded}) — refusing to pass`,
    );
    ok = false;
  } else if (after.remote[t] < expectedMin) {
    console.error(
      `[leaf-sync] MISMATCH ${t}: remote=${after.remote[t]} < local=${after.local[t]} - ${excluded} orphan-excluded`,
    );
    ok = false;
  } else if (after.remote[t] !== after.local[t]) {
    // Rough-but-honest reason split: the tallied exclusions cover FK orphans
    // AND replayed rows whose conflict key the remote already holds under a
    // different id (both counted by applyTable); any residual gap is pruning.
    const fkReason =
      excluded > 0
        ? `${excluded} local rows not copyable (FK targets/dev-seed refs missing remotely)`
        : null;
    const reason = fkReason ? `${fkReason} + local pruned rows` : "local pruned rows";
    console.log(
      `[leaf-sync] ${t}: remote=${after.remote[t]} local=${after.local[t]} (${reason} — remote retains history)`,
    );
  }
}

// Persist the watermark + orphan tally ONLY after a clean verify — writing
// it earlier would let a failed run skip never-synced rows forever. The
// operator-facing orphan report rides in the same clean-run state file for
// the scheduler card to read: a FULL load re-derives the complete standing
// picture (every local row is re-examined, so the report REPLACES the old
// one — reconciled orphans drop out); an incremental run only sees new rows,
// so its report MERGES into the previous one (reconciled rows may linger
// until the next full load). The samples cap keeps the file bounded.
if (ok && pendingWatermark) {
  const mergedReport = {};
  for (const t of LEAF_TABLES) {
    const prev = fullLoadRef ? {} : (persistedRef?.orphanReport?.[t] ?? {});
    const fresh = freshOrphanReport[t];
    if (!fresh) {
      if (prev.count) mergedReport[t] = prev;
      continue;
    }
    mergedReport[t] = {
      count: (prev.count ?? 0) + fresh.count,
      samples: [...(prev.samples ?? []), ...fresh.samples].slice(0, 6),
    };
  }
  persistState(pendingWatermark, excludedForVerify, mergedReport);
  const reported = Object.entries(mergedReport).filter(([, r]) => (r.count ?? 0) > 0);
  if (reported.length > 0) {
    console.log("[leaf-sync] orphan report (see data/leaf-sync-watermark.json):");
    for (const [t, rep] of reported) {
      console.log(`[leaf-sync]   ${t}: ${rep.count} unsyncable rows`);
      for (const s of rep.samples ?? []) console.log(`[leaf-sync]     ${s}`);
    }
  }
}

if (!ok) process.exit(1);
console.log("[leaf-sync] OK — leaf tables in sync");
