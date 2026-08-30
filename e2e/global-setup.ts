import { execSync } from "node:child_process";

/**
 * One-time suite setup, run BEFORE any worker starts (Playwright runs
 * globalSetup once per invocation, never inside `--list` mode).
 *
 * WHY this exists: the E2E suite shares one Postgres database, and the seed
 * wipes EVERY table (users, orders, the audit chain, ...). With a single
 * worker that used to be safe — the specs that needed a fresh DB just
 * re-seeded in `beforeAll`, and nothing else was running. With parallel
 * workers that would be catastrophic: one spec's re-seed would wipe the DB
 * out from under another spec's in-flight login.
 *
 * So all destructive/shared-DB prep lives here, once, before the first
 * worker boots:
 *   1. `npm run db:seed` — fresh seed (admin user, ~360 orders, customers,
 *      products, discount/campaign fixtures, re-chained audit events).
 *   2. `npm run repair:audit-chain` — deterministic clean hash chain before
 *      any test logs in (the security-chain-tamper spec used to do this in
 *      its beforeAll; racing it against parallel workers' logins would be a
 *      data race on the shared table).
 *
 * The tenant-isolation markers are NOT stamped here: the spec re-runs the
 * idempotent isolation script in its own beforeAll so its markers are the
 * admin's MOST RECENT security events — the /api/auth/security-events feed is
 * capped at 20 rows, and stamping at suite start would bury them under the
 * ~30 admin LOGINs the parallel workers generate before that spec runs.
 */
export default function globalSetup() {
  execSync("npm run db:seed", { stdio: "inherit" });
  execSync("npm run repair:audit-chain", { stdio: "inherit" });
}
