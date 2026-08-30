import { execSync } from "node:child_process";
import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

/**
 * Audit tenant-isolation spec.
 *
 * Proves the read-side tenant scoping on /api/audit-log and
 * /api/auth/security-events: one workspace must never see another
 * workspace's audit rows.
 *
 * Setup: globalSetup (e2e/global-setup.ts) already seeded the DB and repaired
 * the audit chain once. This spec's beforeAll re-runs the IDEMPOTENT
 * scripts/seed-tenant-isolation.ts (seed is NOT re-run — a re-seed would wipe
 * the DB out from under parallel workers). Running the script HERE, not in
 * globalSetup, keeps its markers as the admin's MOST RECENT security events:
 * the /api/auth/security-events feed is capped at 20 rows, and markers
 * stamped at suite start would be buried under the ~30 admin LOGINs the
 * parallel workers generate before this spec runs. The script clears only its
 * own prior markers and re-chains only what it deleted, so on a fresh seed
 * this is a no-op re-chain + fresh stamps — race-free against concurrent
 * logins (which the advisory-locked logSecurityEvent path serializes).
 *
 * The script creates a SECOND workspace ("tenant-b") with its own STAFF actor
 * and stamps distinguishable audit markers on both sides:
 *   - activityLog: ISOLATION_TENANT_A_ACTION (default workspace) vs
 *     ISOLATION_TENANT_B_ACTION (tenant B)
 *   - SecurityEvents: A/B markers written through the real logSecurityEvent
 *     path (hash chain intact), plus a "poisoned" event carrying the DEFAULT
 *     workspace's userId but TENANT B's tenantId — it must be invisible to
 *     both feeds, proving the tenant scope (not just the per-user filter) is
 *     enforced.
 *
 * The default workspace's read scope admits its own rows + legacy null rows;
 * the non-default workspace sees strictly its own rows.
 */
interface IsolationFixture {
  email: string;
  password: string;
  actionA: string;
  actionB: string;
  eventA: string;
  eventB: string;
  contaminated: string;
}

let fixture: IsolationFixture;

test.beforeAll(() => {
  // globalSetup seeded + repaired the chain; stamp this spec's markers fresh
  // (idempotent script — no re-seed).
  const out = execSync(
    "npx tsx --tsconfig scripts/tsconfig.e2e.json scripts/seed-tenant-isolation.ts",
    { encoding: "utf8" },
  );
  fixture = JSON.parse(out.trim().split("\n").pop() ?? "{}");
  expect(fixture.email).toMatch(/@/);
});

test.describe("Audit tenant isolation", () => {
  test("the default workspace sees its own audit rows but never the other workspace's", async ({
    page,
  }) => {
    await loginAs(page); // seed admin = default workspace

    const audit = await (await page.request.get("/api/audit-log")).json();
    const actions = audit.logs.map((l: { action: string }) => l.action);
    expect(actions).toContain(fixture.actionA);
    expect(actions).not.toContain(fixture.actionB);

    const events = await (await page.request.get("/api/auth/security-events")).json();
    const types = (events as { type: string }[]).map((e) => e.type);
    expect(types).toContain(fixture.eventA);
    expect(types).not.toContain(fixture.eventB);
    // The poisoned row has the admin's userId but tenant B's id — the tenant
    // scope must hide it even though the userId filter alone would let it
    // through.
    expect(types).not.toContain(fixture.contaminated);
  });

  test("the non-default workspace is strictly isolated from the default workspace's rows", async ({
    request,
  }) => {
    const login = await request.post("/api/auth/login", {
      data: { email: fixture.email, password: fixture.password },
    });
    expect(login.status()).toBe(200);
    const { token } = await login.json();
    const auth = { Authorization: `Bearer ${token}` };

    const audit = await (await request.get("/api/audit-log", { headers: auth })).json();
    const actions = audit.logs.map((l: { action: string }) => l.action);
    expect(actions).toContain(fixture.actionB);
    expect(actions).not.toContain(fixture.actionA);

    const events = await (await request.get("/api/auth/security-events", { headers: auth })).json();
    const types = (events as { type: string }[]).map((e) => e.type);
    expect(types).toContain(fixture.eventB);
    expect(types).not.toContain(fixture.eventA);
    expect(types).not.toContain(fixture.contaminated);
  });

  test("the audit-log page renders only the caller workspace's rows", async ({ page }) => {
    await loginAs(page, fixture.email, fixture.password);
    await page.goto("/en/audit-log");
    await expect(page.getByText("Tenant B marker", { exact: true })).toBeVisible();
    await expect(page.getByText("Tenant A marker", { exact: true })).not.toBeVisible();
  });
});
