/**
 * Seed demo security-telemetry rows + re-chain the SecurityEvent hash chain.
 *
 * Complements prisma/seed.ts (which plants the same rows during a full seed):
 * this script is safe to run on an ALREADY-SEEDED database without touching
 * any other data — useful when the seeded rows have aged out of the telemetry
 * windows (24h throttles / 7d lockouts) or predate the userId attribution.
 *
 *   npx tsx scripts/seed-security-telemetry.ts
 *
 * Idempotent: attributed demo rows are refreshed (deleted + re-inserted with
 * fresh timestamps) only when the latest one has fallen outside its window.
 * The full table is re-chained afterwards so the tamper-evident audit chain
 * stays clean.
 */
import { PrismaClient } from "@prisma/client";
import { computeHash, GENESIS_HASH } from "../src/lib/audit-hash";

const prisma = new PrismaClient();

const DEMO_ENDPOINT = "login-burst-demo";
const THROTTLE_WINDOW_MS = 24 * 60 * 60 * 1000;
const LOCKOUT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

async function main() {
  const admin = await prisma.user.findUnique({
    where: { email: "nextdashboards@gmail.com" },
    select: { id: true, tenantId: true },
  });
  if (!admin) {
    console.error("[telemetry] seed admin not found — run the main seed first");
    process.exit(1);
  }
  if (!admin.tenantId) {
    console.error(
      "[telemetry] admin has no tenantId — rows would be invisible to the tenant-scoped feed",
    );
    process.exit(1);
  }

  const latest = await prisma.securityEvent.findFirst({
    where: { metadata: { path: ["endpoint"], equals: DEMO_ENDPOINT } },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true, userId: true },
  });

  const throttleFresh = latest && Date.now() - latest.createdAt.getTime() < THROTTLE_WINDOW_MS;
  const attributed = latest?.userId === admin.id;
  if (throttleFresh && attributed) {
    console.log("[telemetry] fresh attributed demo rows already present — skipping insert");
  } else {
    // Drop the stale/unattributed demo rows, re-insert with current timestamps
    // attributed to the admin so the user-scoped events feed surfaces them.
    await prisma.securityEvent.deleteMany({
      where: { metadata: { path: ["endpoint"], equals: DEMO_ENDPOINT } },
    });

    const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000);
    const offenderIp = "203.0.113.77"; // TEST-NET-3 documentation range
    const ua = "curl/8.9.1 (demo burst)";

    // Recent timestamps (30–75 min) so the rows sit inside the events feed's
    // take window even on a busy dev DB — old-but-in-window rows can be
    // pushed out by newer LOGIN events and the card would never see them.
    const throttleRows = [
      { blocked: false, attempt: 8, limit: 10, minsAgo: 75 },
      { blocked: true, attempt: 11, limit: 10, minsAgo: 60 },
      { blocked: true, attempt: 12, limit: 10, minsAgo: 45 },
      { blocked: true, attempt: 13, limit: 10, minsAgo: 30 },
    ];
    for (const row of throttleRows) {
      await prisma.securityEvent.create({
        data: {
          userId: admin.id,
          tenantId: admin.tenantId,
          type: "RATE_LIMITED",
          ip: offenderIp,
          userAgent: ua,
          metadata: {
            endpoint: DEMO_ENDPOINT,
            attempt: row.attempt,
            limit: row.limit,
            blocked: row.blocked,
          },
          createdAt: minutesAgo(row.minsAgo),
        },
      });
    }
    await prisma.securityEvent.create({
      data: {
        userId: admin.id,
        tenantId: admin.tenantId,
        type: "ACCOUNT_LOCKED",
        ip: offenderIp,
        userAgent: ua,
        metadata: { endpoint: DEMO_ENDPOINT, attempt: 5, failed: 5 },
        createdAt: minutesAgo(50),
      },
    });
    console.log("[telemetry] inserted 4 RATE_LIMITED + 1 ACCOUNT_LOCKED attributed to admin");
  }

  // Re-chain the whole table (same algorithm as prisma/seed.ts) so the
  // tamper-evident chain stays verifiable after the direct inserts.
  const events = await prisma.securityEvent.findMany({ orderBy: { seq: "asc" } });
  let prevHash = GENESIS_HASH;
  let rechained = 0;
  for (const e of events) {
    const hash = computeHash(prevHash, e);
    if (e.hash !== hash || (e.prevHash ?? GENESIS_HASH) !== prevHash) {
      await prisma.securityEvent.update({ where: { id: e.id }, data: { prevHash, hash } });
      rechained++;
    }
    prevHash = hash;
  }
  console.log(`[telemetry] chain re-chained (${rechained} rows updated)`);
}

main()
  .catch((err) => {
    console.error("[telemetry] failed:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
