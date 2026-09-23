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
 *   3. Route warming — see warmRoutes() below. On a 2-core CI runner the
 *      dev server's on-demand Turbopack compiles were the dominant test
 *      failure mode: cold routes blew the 20s expect budget mid-test, and
 *      several compiles at once starved the box until the server died.
 *      Warming moves every compile into untimed setup.
 *
 * The tenant-isolation markers are NOT stamped here: the spec re-runs the
 * idempotent isolation script in its own beforeAll so its markers are the
 * admin's MOST RECENT security events — the /api/auth/security-events feed is
 * capped at 20 rows, and stamping at suite start would bury them under the
 * ~30 admin LOGINs the parallel workers generate before that spec runs.
 */

/** Dashboard routes the suite exercises most; every one is a cold compile. */
const WARM_ROUTES = [
  "/en/dashboard",
  "/en/security",
  "/en/orders",
  "/en/products",
  "/en/inventory",
  "/en/customers",
  "/en/integrations",
  "/en/affiliates",
  "/en/billing",
  "/en/analytics",
  "/en/reports",
  "/en/profile",
  "/en/settings",
  "/en/notifications",
  "/en/marketing",
  "/en/discounts",
  "/en/sales",
  "/en/admin",
  "/en/audit-log",
  "/en/api-docs",
  "/en/roles",
  "/en/system-health",
  "/en/sso",
  "/en/design-tokens",
  "/",
  "/en/pricing",
  "/en/changelog",
  "/en/login",
  "/en/register",
];

const WARM_TIMEOUT_MS = 120_000;

/**
 * Compile every route the suite will hit BEFORE any timed test starts.
 * Dashboard routes redirect unauthenticated visitors, so warm with a real
 * session: one API login mints the token cookie, then each GET forces the
 * dev server to compile the route. Best-effort by design — a warming
 * failure must never fail the suite; a cold route then just compiles
 * in-test the way it always has.
 */
async function warmRoutes() {
  const base = `http://localhost:${process.env.E2E_PORT ?? 3010}`;
  const email = process.env.SEED_ADMIN_EMAIL ?? "nextdashboards@gmail.com";
  const password = process.env.SEED_ADMIN_PASSWORD ?? "admin123";

  try {
    const login = await fetch(`${base}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      signal: AbortSignal.timeout(WARM_TIMEOUT_MS),
    });
    if (!login.ok) {
      console.warn(`[warm] login answered ${login.status} — warming only public routes`);
    }
    const cookie = (login.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");

    const deadline = Date.now() + 10 * 60_000;
    for (const route of WARM_ROUTES) {
      if (Date.now() > deadline) {
        console.warn("[warm] time budget exhausted; warming the rest in-test");
        break;
      }
      try {
        const res = await fetch(`${base}${route}`, {
          headers: cookie ? { cookie } : undefined,
          signal: AbortSignal.timeout(WARM_TIMEOUT_MS),
        });
        console.log(`[warm] ${route} -> ${res.status}`);
      } catch (err) {
        console.warn(`[warm] ${route} failed: ${String(err).slice(0, 120)}`);
      }
    }
  } catch (err) {
    console.warn(`[warm] skipped: ${String(err).slice(0, 160)}`);
  }
}

export default async function globalSetup() {
  if (process.env.SKIP_SEED === "1") {
    console.log("⏩ SKIP_SEED=1: Skipping global DB re-seeding.");
    return;
  }
  execSync("npm run db:seed", { stdio: "inherit" });
  execSync("npm run repair:audit-chain", { stdio: "inherit" });
  // Compiles must finish before the first timed test runs — that is the
  // whole point of warming.
  await warmRoutes();
}
