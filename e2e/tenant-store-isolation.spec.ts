import { test, expect, type APIRequestContext } from "@playwright/test";
import { seedTenantStoreIsolation } from "../scripts/seed-tenant-store-isolation";

/**
 * Two-workspace isolation proof for the stores migrated off data/*.json:
 * QRIS ledger, beneficiaries, purchase orders, chat alerts, inventory
 * snapshots, scheduled reports, and inbound webhook DLQ.
 *
 * Both workspaces are created by scripts/seed-tenant-store-isolation.ts. Every
 * test authenticates as a real ADMIN in each workspace and talks to the same
 * production API routes the dashboard uses. Cross-tenant detail reads and
 * mutations must fail closed (404/400/false) and must not alter the owner's row.
 */

interface Fixture {
  a: { email: string; password: string };
  b: { email: string; password: string };
  ids: {
    qrisTxA: string;
    qrisTxB: string;
    beneficiaryA: string;
    beneficiaryB: string;
    purchaseOrderA: string;
    purchaseOrderB: string;
    chatChannelA: string;
    chatChannelB: string;
    chatDeliveryA: string;
    chatDeliveryB: string;
    dlqA: string;
    dlqB: string;
  };
  values: {
    qrisBalanceA: number;
    qrisBalanceB: number;
    inventoryA: number;
    inventoryB: number;
  };
}

let fixture: Fixture;

test.beforeAll(async () => {
  // Seed in-process rather than spawning tsx: the fixture is deterministic and
  // this avoids the Windows child-process faults that made worker retries fail.
  fixture = (await seedTenantStoreIsolation()) as unknown as Fixture;
  expect(fixture.a.email).toMatch(/@/);
});

async function loginToken(
  request: APIRequestContext,
  email: string,
  password: string,
): Promise<string> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const res = await request.post("/api/auth/login", { data: { email, password } });
    if (res.ok()) {
      const body = (await res.json()) as { token?: string };
      expect(body.token).toBeTruthy();
      return body.token as string;
    }
    if (res.status() !== 429) {
      throw new Error(`login failed for ${email}: ${res.status()} ${await res.text()}`);
    }
    const retryAfter = Number(res.headers()["retry-after"]) || 30;
    await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000 + 500));
  }
  throw new Error(`login throttled twice for ${email}`);
}

function auth(token: string) {
  return { Authorization: `Bearer ${token}` };
}

test("each workspace reads only its own rows from every migrated store", async ({ request }) => {
  const [tokenA, tokenB] = await Promise.all([
    loginToken(request, fixture.a.email, fixture.a.password),
    loginToken(request, fixture.b.email, fixture.b.password),
  ]);
  const ids = fixture.ids;

  const [qrisA, qrisB] = await Promise.all([
    request.get("/api/billing/qris", { headers: auth(tokenA) }),
    request.get("/api/billing/qris", { headers: auth(tokenB) }),
  ]);
  expect(qrisA.status()).toBe(200);
  expect(qrisB.status()).toBe(200);
  const qrisABody = await qrisA.json();
  const qrisBBody = await qrisB.json();
  expect(qrisABody.availableBalance).toBe(fixture.values.qrisBalanceA);
  expect(qrisBBody.availableBalance).toBe(fixture.values.qrisBalanceB);
  expect(qrisABody.transactions.map((tx: { id: string }) => tx.id)).toContain(ids.qrisTxA);
  expect(qrisABody.transactions.map((tx: { id: string }) => tx.id)).not.toContain(ids.qrisTxB);
  expect(qrisBBody.transactions.map((tx: { id: string }) => tx.id)).toContain(ids.qrisTxB);
  expect(qrisBBody.transactions.map((tx: { id: string }) => tx.id)).not.toContain(ids.qrisTxA);

  const [benA, benB] = await Promise.all([
    request.get("/api/billing/beneficiaries", { headers: auth(tokenA) }),
    request.get("/api/billing/beneficiaries", { headers: auth(tokenB) }),
  ]);
  const benABody = await benA.json();
  const benBBody = await benB.json();
  expect(benABody.beneficiaries.map((b: { id: string }) => b.id)).toEqual([ids.beneficiaryA]);
  expect(benBBody.beneficiaries.map((b: { id: string }) => b.id)).toEqual([ids.beneficiaryB]);

  const [poA, poB] = await Promise.all([
    request.get("/api/inventory/purchase-orders", { headers: auth(tokenA) }),
    request.get("/api/inventory/purchase-orders", { headers: auth(tokenB) }),
  ]);
  const poABody = await poA.json();
  const poBBody = await poB.json();
  expect(poABody.orders.map((po: { id: string }) => po.id)).toEqual([ids.purchaseOrderA]);
  expect(poBBody.orders.map((po: { id: string }) => po.id)).toEqual([ids.purchaseOrderB]);

  const [chatA, chatB] = await Promise.all([
    request.get("/api/integrations/chat-alerts", { headers: auth(tokenA) }),
    request.get("/api/integrations/chat-alerts", { headers: auth(tokenB) }),
  ]);
  expect(chatA.status()).toBe(200);
  expect(chatB.status()).toBe(200);
  const chatABody = await chatA.json();
  const chatBBody = await chatB.json();
  expect(chatABody.channels.map((c: { id: string }) => c.id)).toEqual([ids.chatChannelA]);
  expect(chatBBody.channels.map((c: { id: string }) => c.id)).toEqual([ids.chatChannelB]);
  expect(chatABody.deliveries.map((d: { id: string }) => d.id)).toContain(ids.chatDeliveryA);
  expect(chatABody.deliveries.map((d: { id: string }) => d.id)).not.toContain(ids.chatDeliveryB);
  expect(chatBBody.deliveries.map((d: { id: string }) => d.id)).toContain(ids.chatDeliveryB);
  expect(chatBBody.deliveries.map((d: { id: string }) => d.id)).not.toContain(ids.chatDeliveryA);

  const [reportA, reportB] = await Promise.all([
    request.get("/api/reports/scheduled", { headers: auth(tokenA) }),
    request.get("/api/reports/scheduled", { headers: auth(tokenB) }),
  ]);
  const reportABody = await reportA.json();
  const reportBBody = await reportB.json();
  expect(reportABody.schedule.recipients).toEqual(["tenant-a-reports@example.com"]);
  expect(reportBBody.schedule.recipients).toEqual(["tenant-b-reports@example.com"]);

  const [dlqA, dlqB] = await Promise.all([
    request.get("/api/webhooks/inbound/dlq", { headers: auth(tokenA) }),
    request.get("/api/webhooks/inbound/dlq", { headers: auth(tokenB) }),
  ]);
  const dlqABody = await dlqA.json();
  const dlqBBody = await dlqB.json();
  expect(dlqABody.entries.map((e: { id: string }) => e.id)).toContain(ids.dlqA);
  expect(dlqABody.entries.map((e: { id: string }) => e.id)).not.toContain(ids.dlqB);
  expect(dlqBBody.entries.map((e: { id: string }) => e.id)).toContain(ids.dlqB);
  expect(dlqBBody.entries.map((e: { id: string }) => e.id)).not.toContain(ids.dlqA);

  const [valueA, valueB] = await Promise.all([
    request.get("/api/products?includeCategories=true&includeValue=true", {
      headers: auth(tokenA),
    }),
    request.get("/api/products?includeCategories=true&includeValue=true", {
      headers: auth(tokenB),
    }),
  ]);
  const valueABody = await valueA.json();
  const valueBBody = await valueB.json();
  expect(valueABody.trends.valuation).toEqual([fixture.values.inventoryA]);
  expect(valueBBody.trends.valuation).toEqual([fixture.values.inventoryB]);
});

test("cross-workspace mutations fail closed and leave the owner's row intact", async ({
  request,
}) => {
  const [tokenA, tokenB] = await Promise.all([
    loginToken(request, fixture.a.email, fixture.a.password),
    loginToken(request, fixture.b.email, fixture.b.password),
  ]);
  const ids = fixture.ids;

  // QRIS: workspace B cannot confirm workspace A's pending transaction.
  const qrisCross = await request.patch("/api/billing/qris", {
    headers: auth(tokenB),
    data: { transactionId: ids.qrisTxA, sourceBank: "Cross Tenant Bank" },
  });
  expect(qrisCross.status()).toBe(400);
  const qrisA = await request.get("/api/billing/qris", { headers: auth(tokenA) });
  const qrisABody = await qrisA.json();
  expect(qrisABody.transactions.find((tx: { id: string }) => tx.id === ids.qrisTxA)?.status).toBe(
    "PENDING",
  );

  // Purchase orders: detail read and status mutation both fail closed.
  const poRead = await request.get(`/api/inventory/purchase-orders/${ids.purchaseOrderA}`, {
    headers: auth(tokenB),
  });
  expect(poRead.status()).toBe(404);
  const poPatch = await request.patch(`/api/inventory/purchase-orders/${ids.purchaseOrderA}`, {
    headers: auth(tokenB),
    data: { status: "CANCELLED" },
  });
  expect(poPatch.status()).toBe(404);
  const poA = await request.get(`/api/inventory/purchase-orders/${ids.purchaseOrderA}`, {
    headers: auth(tokenA),
  });
  expect((await poA.json()).status).toBe("ISSUED");

  // Chat alerts: deleting another workspace's channel is a 404, and the old
  // id-based upsert cannot overwrite it either (it creates a B channel).
  const chatDelete = await request.delete(`/api/integrations/chat-alerts?id=${ids.chatChannelA}`, {
    headers: auth(tokenB),
  });
  expect(chatDelete.status()).toBe(404);
  const chatUpsert = await request.post("/api/integrations/chat-alerts", {
    headers: auth(tokenB),
    data: {
      id: ids.chatChannelA,
      name: "Hijacked Channel",
      platform: "slack",
      webhookUrl: "https://example.com/hooks/hijack",
      channelName: "#hijack",
      enabledEvents: ["stockout"],
    },
  });
  expect(chatUpsert.status()).toBe(200);
  expect((await chatUpsert.json()).channel.id).not.toBe(ids.chatChannelA);
  const chatA = await request.get("/api/integrations/chat-alerts", { headers: auth(tokenA) });
  const chatABody = await chatA.json();
  const channelA = chatABody.channels.find((c: { id: string }) => c.id === ids.chatChannelA);
  expect(channelA?.name).toBe("Tenant A Operations");

  // DLQ: discarding another workspace's entry reports not found and retains it.
  const dlqDiscard = await request.post("/api/webhooks/inbound/dlq", {
    headers: auth(tokenB),
    data: { action: "discard", id: ids.dlqA },
  });
  expect(dlqDiscard.status()).toBe(200);
  expect((await dlqDiscard.json()).ok).toBe(false);
  const dlqA = await request.get("/api/webhooks/inbound/dlq", { headers: auth(tokenA) });
  expect((await dlqA.json()).entries.map((e: { id: string }) => e.id)).toContain(ids.dlqA);

  // Scheduled reports: B can update only B. A's recipients remain untouched.
  const reportUpdate = await request.post("/api/reports/scheduled", {
    headers: auth(tokenB),
    data: { recipients: ["tenant-b-updated@example.com"], frequency: "DAILY" },
  });
  expect(reportUpdate.status()).toBe(200);
  const reportA = await request.get("/api/reports/scheduled", { headers: auth(tokenA) });
  expect((await reportA.json()).schedule.recipients).toEqual(["tenant-a-reports@example.com"]);
});
