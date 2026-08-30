/**
 * SecurityEvent hash-chain tamper guard (E2E, added 2026-08-13).
 *
 * Proves the tamper-evident chain actually catches tampering through the REAL
 * admin endpoint: it modifies and deletes SecurityEvent rows in the DB and
 * asserts /api/security/audit/verify reports ok:false with the EXACT break
 * (seq, id, reason) — not just "something is wrong". This is the regression
 * guard for src/lib/audit-chain.ts + /api/security/audit/verify.
 *
 * The chain is re-chained ONCE by globalSetup (e2e/global-setup.ts) before
 * any worker starts — this spec must NOT re-chain in its own beforeAll, since
 * parallel workers' logins write security events concurrently and a mid-run
 * repair would race them. Every tamper is surgically undone in a finally
 * block so a passing run leaves the DB byte-identical, and a clean-chain
 * assertion guards the baseline itself. Touching only its own captured rows
 * keeps the shared chain safe under parallel workers.
 */
import { expect, test } from "@playwright/test";
import { execSync } from "node:child_process";
import { Prisma, PrismaClient } from "@prisma/client";
import { SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD } from "./helpers";

const prisma = new PrismaClient();
const BASE = "http://localhost:3010";

/** The two rows we tamper with — captured once the baseline is verified. */
let target: SecurityRow | null = null;
let successor: SecurityRow | null = null;
let adminTokenValue = "";

interface SecurityRow {
  id: string;
  seq: number;
  userId: string | null;
  type: string;
  ip: string | null;
  userAgent: string | null;
  metadata: Prisma.JsonValue | null;
  prevHash: string | null;
  hash: string | null;
  createdAt: Date;
  tenantId: string | null;
}

async function adminToken(): Promise<string> {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: SEED_ADMIN_EMAIL, password: SEED_ADMIN_PASSWORD }),
  });
  expect(res.ok, "admin API login should succeed").toBe(true);
  const body = await res.json();
  const token = body.token ?? body.accessToken;
  expect(token, "login response should include a token").toBeTruthy();
  return token as string;
}

/** GET /api/security/audit/verify as admin; returns HTTP status + JSON body. */
async function verifyChain(): Promise<{
  status: number;
  body: {
    ok: boolean;
    total: number;
    verified: number;
    firstBreakSeq: number | null;
    breaks: Array<{ seq: number; id: string; reason: string }>;
  };
}> {
  const res = await fetch(`${BASE}/api/security/audit/verify`, {
    headers: { Authorization: `Bearer ${adminTokenValue}` },
  });
  return { status: res.status, body: await res.json() };
}

function rowOf(r: SecurityRow | null): SecurityRow {
  if (!r) throw new Error("target/successor row not captured — baseline test must run first");
  return r;
}

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  // globalSetup already re-chained the whole table under the current
  // algorithm (deterministic clean baseline, absorbs leftovers from failed
  // CI retries). Two admin logins follow so the tail always has >= 2 real,
  // properly-chained events to tamper with (on a fresh CI DB the table is
  // otherwise empty).
  adminTokenValue = await adminToken();
  await adminToken();
});

test.afterAll(async () => {
  await prisma.$disconnect();
});

test("reports a clean chain when untouched (baseline)", async () => {
  const { status, body } = await verifyChain();
  expect(status).toBe(200);
  expect(body.ok).toBe(true);
  expect(body.firstBreakSeq).toBeNull();
  expect(body.breaks).toEqual([]);
  expect(body.verified).toBe(body.total);

  // Capture two ADJACENT rows (second-newest + newest) to tamper with in the
  // next tests. They were created by the beforeAll logins via the real
  // logSecurityEvent path, so they're correctly chained onto the repaired tail.
  target = await prisma.securityEvent.findFirst({ orderBy: { seq: "desc" }, skip: 1 });
  successor = await prisma.securityEvent.findFirst({ orderBy: { seq: "desc" } });
  expect(target, "need a row with a successor to tamper with").not.toBeNull();
  expect(successor, "need a successor row").not.toBeNull();
  expect(successor!.seq).toBe(target!.seq + 1);
});

test("catches a content modification and reports the exact break", async () => {
  const t = rowOf(target);
  const originalMetadata = t.metadata;

  try {
    await prisma.securityEvent.update({
      where: { id: t.id },
      data: { metadata: { tampered: true, by: "security-chain-tamper.spec" } },
    });

    const { status, body } = await verifyChain();
    expect(status).toBe(409);
    expect(body.ok).toBe(false);
    expect(body.firstBreakSeq).toBe(t.seq);
    expect(body.breaks).toHaveLength(1);
    expect(body.breaks[0]).toEqual({
      seq: t.seq,
      id: t.id,
      reason: "content hash mismatch (record was modified)",
    });
  } finally {
    await prisma.securityEvent.update({
      where: { id: t.id },
      data: { metadata: originalMetadata as Prisma.InputJsonValue },
    });
  }

  // Restore is exact — the chain must verify clean again.
  const { status, body } = await verifyChain();
  expect(status).toBe(200);
  expect(body.ok).toBe(true);
});

test("catches a deletion and reports the exact break at the successor", async () => {
  const t = rowOf(target);
  const s = rowOf(successor);
  const backup: SecurityRow = { ...t };

  try {
    await prisma.securityEvent.delete({ where: { id: t.id } });

    const { status, body } = await verifyChain();
    expect(status).toBe(409);
    expect(body.ok).toBe(false);
    expect(body.firstBreakSeq).toBe(s.seq);
    expect(body.breaks).toHaveLength(1);
    expect(body.breaks[0]).toEqual({
      seq: s.seq,
      id: s.id,
      reason: "prevHash does not match previous event hash (insert/delete/reorder)",
    });
  } finally {
    // Best-effort restore: re-insert the deleted row with every original
    // field (id, seq, prevHash, hash, ...) so the chain is byte-identical.
    try {
      await prisma.securityEvent.create({
        data: {
          id: backup.id,
          seq: backup.seq,
          userId: backup.userId,
          type: backup.type,
          ip: backup.ip,
          userAgent: backup.userAgent,
          metadata: backup.metadata as Prisma.InputJsonValue,
          prevHash: backup.prevHash,
          hash: backup.hash,
          createdAt: backup.createdAt,
          tenantId: backup.tenantId,
        },
      });
    } catch {
      // Already restored or restore raced a failure — the next run's
      // beforeAll repair re-chains anyway.
    }
  }

  const { status, body } = await verifyChain();
  expect(status).toBe(200);
  expect(body.ok).toBe(true);
});
