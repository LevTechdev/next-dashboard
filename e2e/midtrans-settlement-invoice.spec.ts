import { test, expect } from "@playwright/test";
import crypto from "node:crypto";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

/**
 * Midtrans settlement → invoice, end to end in test mode.
 *
 * Sandbox keys are configured in .env.local (MIDTRANS_SANDBOX_SERVER_KEY), so
 * the real signed webhook flow is exercisable without external services:
 *
 *  1. Seed a PENDING ledger invoice INV-<orderId> (the shape checkout creates)
 *     via psql — userId/planId present so the webhook's reconcile branch runs.
 *  2. POST a Midtrans `settlement` notification with a valid signature
 *     (sha512(order_id + status_code + gross_amount + server_key)) to the real
 *     /api/billing/midtrans/webhook route — the same code path production
 *     notifications take (non-browser callers skip CSRF by design).
 *  3. Assert the invoice flipped to PAID with the gateway's amount and payment
 *     type, and that snapshotJson re-frozen at settlement carries the payload's
 *     gross amount — the invoice PDF reflects the real gateway payload.
 *
 * Also pins the security contract: a tampered payload (wrong gross_amount for
 * the signature) is rejected 400 and changes nothing.
 */

const dbUrl = (): string => {
  for (const f of [".env.local", ".env"]) {
    try {
      const env = readFileSync(f, "utf-8");
      const line = env.split("\n").find((l: string) => l.startsWith("DATABASE_URL="));
      if (line) return line.slice("DATABASE_URL=".length).trim().split("?")[0];
    } catch {
      /* try next */
    }
  }
  throw new Error("DATABASE_URL not found");
};

function psql(sql: string): string {
  const oneLine = sql.replace(/\s+/g, " ").trim();
  // Command tags ("INSERT 0 1") trail RETURNING output — first line only.
  return execSync(`psql "${dbUrl()}" -tAc "${oneLine.replace(/"/g, '\\\"')}"`, {
    encoding: "utf-8",
  })
    .trim()
    .split(/\r?\n/)[0]
    .trim();
}

const serverKey = (): string => {
  const env = readFileSync(".env.local", "utf-8");
  const m = env.match(/^MIDTRANS_SANDBOX_SERVER_KEY=(.*)$/m);
  if (!m) throw new Error("MIDTRANS_SANDBOX_SERVER_KEY missing in .env.local");
  return m[1].trim();
};

function signature(orderId: string, statusCode: string, grossAmount: string): string {
  return crypto
    .createHash("sha512")
    .update(`${orderId}${statusCode}${grossAmount}${serverKey()}`)
    .digest("hex");
}

/** The PENDING ledger invoice the spec's settlement will reconcile. */
let orderId: string;
let userId: string;
let planId: string;

test.beforeAll(() => {
  orderId = `E2E-SETTLE-${Date.now()}`;
  const stamp = Date.now();
  const email = `settle-${stamp}@example.com`;
  const findPlan = psql(`SELECT id FROM "Plan" ORDER BY price ASC LIMIT 1`);
  planId = findPlan;
  userId = psql(
    `INSERT INTO "User" (id, name, email, password, "emailVerified", "createdAt", "updatedAt") ` +
      `VALUES (gen_random_uuid()::text, 'Settle Test', '${email}', (SELECT password FROM "User" WHERE email = '${"nextdashboards@gmail.com"}' LIMIT 1), now(), now(), now()) RETURNING id`,
  );
  psql(
    `INSERT INTO "Invoice" (id, "invoiceNumber", "userId", "planId", amount, currency, status, description, "createdAt", "updatedAt") ` +
      `VALUES (gen_random_uuid()::text, 'INV-${orderId}', '${userId}', '${planId}', 199000, 'IDR', 'PENDING', 'Midtrans settlement e2e', now(), now())`,
  );
});

test.afterAll(() => {
  try {
    psql(
      `DELETE FROM "Invoice" WHERE "invoiceNumber" = 'INV-${orderId}'; ` +
        `DELETE FROM "Subscription" WHERE "userId" = '${userId}'; ` +
        `DELETE FROM "User" WHERE id = '${userId}'`,
    );
  } catch {
    /* best effort */
  }
});

const baseUrl = `http://localhost:${process.env.E2E_PORT ?? "3010"}`;

async function postNotification(
  orderIdIn: string,
  statusCode: string,
  grossAmount: string,
  status: string,
  overrideSignature?: string,
) {
  const request = await fetch(`${baseUrl}/api/billing/midtrans/webhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      order_id: orderIdIn,
      status_code: statusCode,
      gross_amount: grossAmount,
      signature_key: overrideSignature ?? signature(orderIdIn, statusCode, grossAmount),
      transaction_status: status,
      payment_type: "gopay",
      fraud_status: "accept",
    }),
  });
  return {
    httpStatus: request.status,
    body: (await request.json().catch(() => ({}))) as Record<string, unknown>,
  };
}

test.describe("Midtrans settlement → invoice", () => {
  test("signed settlement flips the invoice to PAID with the gateway payload", async () => {
    test.setTimeout(120_000);
    const gross = "205000.00"; // gateway may adjust gross (fees); webhoook re-freezes snapshot with this
    const res = await postNotification(orderId, "200", gross, "settlement");
    expect(res.httpStatus, JSON.stringify(res.body)).toBe(200);

    const row = psql(
      `SELECT status || '|' || COALESCE("paymentMethod", '') || '|' || amount::text || '|' || ` +
        `COALESCE("snapshotJson"::text, 'null') FROM "Invoice" WHERE "invoiceNumber" = 'INV-${orderId}'`,
    );
    const [status, method, amount, snapshot] = row.split("|");

    expect(status).toBe("PAID");
    expect(method).toBe("gopay");
    expect(Number(amount)).toBe(205000);
    // Snapshot re-frozen at settlement time carries the gateway payload's
    // gross amount, so the PDF shows what was actually paid.
    expect(snapshot).toContain("205000");

    // Subscription activated through the reconcile path.
    const sub = psql(
      `SELECT status || '|' || gateway FROM "Subscription" WHERE "userId" = '${userId}'`,
    );
    expect(sub).toBe("ACTIVE|midtrans");
  });

  test("tampered gross_amount fails signature and leaves the invoice untouched", async () => {
    test.setTimeout(120_000);
    // Signature computed over a DIFFERENT amount than the payload claims —
    // exactly what a man-in-the-middle amount rewrite looks like.
    const validSig = signature(orderId, "200", "199000.00");
    const res = await postNotification(orderId, "200", "999999.00", "settlement", validSig);
    expect(res.httpStatus).toBe(400);

    const status = psql(`SELECT status FROM "Invoice" WHERE "invoiceNumber" = 'INV-${orderId}'`);
    expect(status).toBe("PAID"); // unchanged by the rejected notification
  });
});
