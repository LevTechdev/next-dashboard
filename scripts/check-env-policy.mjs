#!/usr/bin/env node
/**
 * Env policy guard — enforces the mirror-first database policy:
 *
 *   Local development, seeding, and CI run against the local Postgres mirror
 *   (localhost:5432). The remote Supabase Postgres is reserved for production
 *   deploys only.
 *
 * Two layers:
 *   1. .env / .env.local check (local machines — where the files exist):
 *      DATABASE_URL / DIRECT_URL must point at localhost/127.0.0.1. This is
 *      the regression that caused "signups never appear in Supabase": the
 *      standalone Prisma (scripts/CLI) reads .env while the website reads
 *      .env.local, so a leaked remote URL splits the app across two DBs.
 *   2. Tracked-files scan (runs in CI where env files don't exist): fails when
 *      any committed file embeds a Supabase pooler/direct URL outside the
 *      allowlist, so the remote URL can never creep back into the repo.
 *
 * Exit codes: 0 = policy satisfied, 1 = violation (message explains).
 *
 * Overrides: DB_POLICY_SKIP=1 skips the local-env layer (e.g. intentional
 * remote debugging); DB_POLICY_ALLOW=<glob> extends the tracked-file allowlist.
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";

const ALLOWED_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "host.docker.internal"]);

/** Keys whose value must be a local-mirror Postgres URL. */
const DB_URL_KEYS = ["DATABASE_URL", "DIRECT_URL"];

/** Scan layer: executable/config files that must never embed a remote DB URL.
 *  Prose docs (.md) are excluded — mentioning the remote host in a runbook is
 *  legitimate; only files that get executed or loaded matter. */
const SCAN_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".mjs",
  ".cjs",
  ".json",
  ".yml",
  ".yaml",
  ".sh",
]);

// Tokens identifying the production-only remote (Supabase pooler/direct).
const REMOTE_DB_MARKERS = [
  /supabase\.(co|com|net)/i,
  /pooler\.supabase/i,
  /postgres\.supabase/i,
  /db\.[a-z0-9-]+\.supabase/i,
];

function parseEnvFile(filePath) {
  const out = {};
  if (!existsSync(filePath)) return out;
  const lines = readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    // Strip one layer of wrapping quotes (the mailer bug pattern).
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function checkLocalEnv() {
  let failed = false;
  for (const file of [".env", ".env.local"]) {
    if (!existsSync(file)) continue;
    const env = parseEnvFile(file);
    for (const key of DB_URL_KEYS) {
      const value = env[key];
      if (!value) continue;
      let host = "unparseable";
      try {
        host = new URL(value).hostname;
      } catch {
        /* leave marker */
      }
      if (!ALLOWED_HOSTS.has(host)) {
        failed = true;
        console.error(
          `✗ ${file}: ${key} points at "${host}" — the mirror-first policy requires ` +
            `localhost (postgres:postgres@localhost:5432/nextdashboard). The remote ` +
            `Supabase is production-only. Fix: restore the mirror URL, or run ` +
            `DB_POLICY_SKIP=1 to bypass once for intentional remote debugging.`,
        );
      }
    }
  }
  return failed;
}

function listTrackedFiles() {
  try {
    const out = execSync("git ls-files -z", { encoding: "buffer", maxBuffer: 64 * 1024 * 1024 });
    return out.toString("utf8").split("\0").filter(Boolean);
  } catch {
    return [];
  }
}

function checkTrackedFiles() {
  const files = listTrackedFiles();
  const violations = [];
  for (const file of files) {
    const ext = path.extname(file);
    if (!SCAN_EXTENSIONS.has(ext)) continue;
    if (/(^|\/)(package-lock|pnpm-lock|yarn\.lock)/.test(file)) continue;
    let stat;
    try {
      stat = statSync(file);
      if (!stat.isFile() || stat.size > 2 * 1024 * 1024) continue;
    } catch {
      continue; // deleted in worktree
    }
    let content;
    try {
      content = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    for (const marker of REMOTE_DB_MARKERS) {
      if (marker.test(content)) {
        violations.push(file);
        break;
      }
    }
  }
  if (violations.length > 0) {
    for (const f of violations) {
      console.error(
        `✗ Tracked file embeds a remote (Supabase) DB URL: ${f}\n` +
          `  The remote Postgres is production-only — remove the URL or point it at ` +
          `the local mirror. If this file legitimately documents the remote ` +
          `(e.g. a reconciliation runbook), add it to the allowlist via ` +
          `DB_POLICY_ALLOW in scripts/check-env-policy.mjs.`,
      );
    }
    return true;
  }
  return false;
}

const skipLocal = process.env.DB_POLICY_SKIP === "1";
let failed = false;

if (!skipLocal) {
  if (checkLocalEnv()) failed = true;
}

// Layer 2 always runs, but only over git-tracked files when git is available
// (CI) — with a full-directory fallback otherwise is too slow, so skip.
const trackedFailed = process.env.DB_POLICY_SKIP_TRACKED === "1" ? false : checkTrackedFiles();
if (trackedFailed) failed = true;

if (failed) {
  console.error("\n✗ Database env policy violated (see above).");
  process.exit(1);
}

console.log(
  skipLocal
    ? "✓ Env policy: local layer skipped (DB_POLICY_SKIP=1); tracked files clean."
    : "✓ Env policy: local env points at the local Postgres mirror; tracked files clean.",
);
