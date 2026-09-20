import { test, expect } from "@playwright/test";
import crypto from "node:crypto";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

/**
 * Stripe settlement → invoice, end to end in test mode.
 *
 * Mirrors e2e/midtrans-settlement-invoice.spec.ts for the Stripe rail. Stripe
 * test-mode keys live in .env.local (STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET),
 * so the real signed webhook flow is exercisable without external services:
 *
 *  1. Seed a User (plus a Plan to bill) via psql — the workspace the checkout
 *     metadata will point at.
 *  2. POST a `checkout.session.completed` event with a valid Stripe signature
 *     (v1 = HMAC-SHA256(secret, "<timestamp>.<raw body>")) to the real
 *     /api/billing/webhook route — the same code path production events take
 *     (non-browser callers skip CSRF by design).
 *  3. Assert the invoice the handler created flipped to PAID with the
 *     gateway's amount + currency, and that snapshotJson froze the gateway
 *     payload at settlement time — the invoice PDF renders from that snapshot,
 *     so a later plan price change can never rewrite what was actually paid.
 *
 * Also pins the security contract: a tampered payload (signed with the wrong
 * key) is rejected 400 and changes nothing.
 */

const e2eBase = `http://localhost:${process.env.E2E_PORT ?? "3010"}`;

function readEnvFile(key: string): string | null {
  for (const f of [".env.local", ".env"]) {
    try {
      const content = readFileSync(f, "utf-8");
      const line = content.split(/\r?\n/).find((l) => l.startsWith(`${key}=`));
      const value = line?.slice(key.length + 1).trim();
      if (value) return value;
    } catch {
      /* try next file */
    }
  }
  return null;
}

/** Live Stripe config, falling back to the explicit test-mode names. */
const webhookSecret =
  readEnvFile("STRIPE_WEBHOOK_SECRET") ?? readEnvFile("STRIPE_TEST_WEBHOOK_SECRET");
const secretKey = readEnvFile("STRIPE_SECRET_KEY") ?? readEnvFile("STRIPE_TEST_SECRET_KEY");
const stripeConfigured = Boolean(webhookSecret && secretKey);

const SKIP_REASON =
  "Stripe test mode not configured — set STRIPE_SECRET_KEY=sk_test_… and STRIPE_WEBHOOK_SECRET=whsec_… in .env.local (the webhook route 503s without them).";

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
  return execSync(`psql "${dbUrl()}" -tAc "${oneLine.replace(/"/g, '\\"')}"`, {
    encoding: "utf-8",
  })
    .trim()
    .split(/\r?\n/)[0]
    .trim();
}

/**
 * Stripe's signing scheme: `t=<unix seconds>,v1=<hex hmac>` over the raw body
 * prefixed with the timestamp. Verified by the route via
 * stripe.webhooks.constructEvent(payload, signature, secret).
 */
function stripeSignature(payload: string, timestamp: number, secret: string): string {
  const v1 = crypto.createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
  return `t=${timestamp},v1=${v1}`;
}

/** The workspace the settlement will bill. */
let userId: string;
let planId: string;
let planName: string;

test.beforeAll(() => {
  if (!stripeConfigured) return;
  const stamp = Date.now();
  const email = `stripe-settle-${stamp}@example.com`;
  planId = psql(`SELECT id FROM "Plan" ORDER BY price ASC LIMIT 1`);
  planName = psql(`SELECT name FROM "Plan" WHERE id = '${planId}'`);
  userId = psql(
    `INSERT INTO "User" (id, name, email, password, "emailVerified", "createdAt", "updatedAt") ` +
      `VALUES (gen_random_uuid()::text, 'Stripe Settle Test', '${email}', ` +
      `(SELECT password FROM "User" WHERE email = 'nextdashboards@gmail.com' LIMIT 1), now(), now(), now()) RETURNING id`,
  );
});

test.afterAll(() => {
  if (!stripeConfigured || !userId) return;
  try {
    psql(
      `DELETE FROM "Invoice" WHERE "userId" = '${userId}'; ` +
        `DELETE FROM "Subscription" WHERE "userId" = '${userId}'; ` +
        `DELETE FROM "User" WHERE id = '${userId}'`,
    );
  } catch {
    /* best effort */
  }
});

/** Build a signed checkout.session.completed event exactly as Stripe would. */
function checkoutCompletedEvent(options: {
  amountTotal: number;
  currency?: string;
  paymentStatus?: string;
}) {
  const body = JSON.stringify({
    id: `evt_test_${Date.now()}`,
    object: "event",
    api_version: "2024-06-20",
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    type: "checkout.session.completed",
    data: {
      object: {
        id: `cs_test_${Date.now()}`,
        object: "checkout.session",
        customer: `cus_test_${Date.now()}`,
        subscription: `sub_test_${Date.now()}`,
        payment_status: options.paymentStatus ?? "paid",
        amount_total: options.amountTotal,
        currency: options.currency ?? "usd",
        metadata: { userId, planId },
      },
    },
  });
  return { body, signature: stripeSignature(body, Math.floor(Date.now() / 1000), webhookSecret!) };
}

async function postEvent(body: string, signature: string) {
  const res = await fetch(`${e2eBase}/api/billing/webhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "stripe-signature": signature },
    body,
  });
  return {
    httpStatus: res.status,
    body: (await res.json().catch(() => ({}))) as Record<string, unknown>,
  };
}

test.describe("Stripe settlement → invoice", () => {
  test("signed checkout.session.completed flips the invoice to PAID with the gateway payload frozen", async () => {
    test.skip(!stripeConfigured, SKIP_REASON);
    test.setTimeout(120_000);

    // Gateway reports 199.00 USD for the session (amount_total is in cents).
    const { body, signature } = checkoutCompletedEvent({ amountTotal: 19900 });
    const res = await postEvent(body, signature);
    expect(res.httpStatus, JSON.stringify(res.body)).toBe(200);

    const row = psql(
      `SELECT status || '|' || COALESCE("paymentMethod", '') || '|' || amount::text || '|' || ` +
        `COALESCE(currency, '') || '|' || COALESCE("snapshotJson"::text, 'null') ` +
        `FROM "Invoice" WHERE "userId" = '${userId}'`,
    );
    const [status, method, amount, currency, snapshot] = row.split("|");

    expect(status).toBe("PAID");
    expect(method).toBe("stripe");
    expect(Number(amount)).toBe(199);
    expect(currency).toBe("USD");
    // The gateway payload is frozen at settlement: the snapshot carries the
    // amount Stripe actually reported, so the PDF can never drift from it.
    expect(snapshot).toContain('"amount":199');
    expect(snapshot).toContain('"currency":"USD"');
    expect(snapshot).toContain(planName);

    // Subscription activated through the same handler.
    const sub = psql(
      `SELECT status || '|' || gateway FROM "Subscription" WHERE "userId" = '${userId}'`,
    );
    expect(sub).toBe("ACTIVE|stripe");
  });

  test("tampered payload fails signature verification and leaves the invoice untouched", async () => {
    test.skip(!stripeConfigured, SKIP_REASON);
    test.setTimeout(120_000);

    // Signed with a DIFFERENT secret than the one the route verifies against —
    // exactly what a forged/replayed event looks like.
    const body = JSON.stringify({
      id: `evt_tampered_${Date.now()}`,
      object: "event",
      api_version: "2024-06-20",
      created: Math.floor(Date.now() / 1000),
      livemode: false,
      type: "checkout.session.completed",
      data: {
        object: {
          id: `cs_tampered_${Date.now()}`,
          object: "checkout.session",
          payment_status: "paid",
          amount_total: 999_999_00,
          currency: "usd",
          metadata: { userId, planId },
        },
      },
    });
    const forged = stripeSignature(
      body,
      Math.floor(Date.now() / 1000),
      "whsec_not_the_real_secret",
    );

    const res = await postEvent(body, forged);
    expect(res.httpStatus).toBe(400);

    // Nothing moved: still exactly one PAID invoice, still the original amount.
    const row = psql(
      `SELECT count(*)::text || '|' || COALESCE(min(amount)::text, '') FROM "Invoice" WHERE "userId" = '${userId}'`,
    );
    const [count, amount] = row.split("|");
    expect(count).toBe("1");
    expect(Number(amount)).toBe(199);
  });
});
