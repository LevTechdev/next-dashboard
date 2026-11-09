import { describe, it, expect, vi } from "vitest";
import crypto from "crypto";
import {
  verifyShopifySignature,
  verifyTikTokSignature,
  verifyShopeeSignature,
  verifyWooCommerceSignature,
  normalizeInboundOrder,
  PLATFORM_SECRETS,
} from "@/lib/inbound-webhooks";
import { getDlqEntries, enqueueDlq, retryDlqEntry, purgeDlqEntry } from "@/lib/webhook-dlq-store";
import {
  processDueRetries,
  scheduleRetry,
  isExhausted,
  MAX_ATTEMPTS,
  backoffDelay,
} from "@/lib/webhook-retry";

// In-memory stand-in for the WebhookDlqEntry table so this stays a store test
// without requiring a database.
const { dlqRows } = vi.hoisted(() => ({ dlqRows: new Map<string, any>() }));

vi.mock("@/lib/db", () => ({
  prisma: {
    webhookDlqEntry: {
      create: async ({ data }: any) => {
        const row = { ...data };
        dlqRows.set(row.id, row);
        return row;
      },
      findMany: async ({ where }: any = {}) =>
        [...dlqRows.values()]
          .filter((row) => !where?.tenantId || row.tenantId === where.tenantId)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
      findUnique: async ({ where }: any) => dlqRows.get(where.id) ?? null,
      findFirst: async ({ where }: any) => {
        const row = dlqRows.get(where.id);
        if (!row) return null;
        if (where.tenantId && row.tenantId !== where.tenantId) return null;
        return row;
      },
      update: async ({ where, data }: any) => {
        const row = dlqRows.get(where.id);
        if (!row) throw new Error("DLQ entry not found");
        for (const [key, value] of Object.entries(data)) {
          if (value && typeof value === "object" && "increment" in (value as any)) {
            row[key] += (value as any).increment;
          } else {
            row[key] = value;
          }
        }
        return row;
      },
      deleteMany: async ({ where }: any) => {
        let count = 0;
        for (const [id, row] of dlqRows) {
          if (where.id && id !== where.id) continue;
          if (where.tenantId && row.tenantId !== where.tenantId) continue;
          dlqRows.delete(id);
          count += 1;
        }
        return { count };
      },
      upsert: async ({ where, create, update }: any) => {
        const existing = dlqRows.get(where.id);
        if (existing) {
          Object.assign(existing, update);
          return existing;
        }
        const row = { ...create };
        dlqRows.set(row.id, row);
        return row;
      },
    },
    $transaction: async (ops: Promise<unknown>[]) => Promise.all(ops),
  },
}));

describe("Omnichannel Inbound Webhooks Verification & Normalization", () => {
  it("verifies valid and rejects invalid Shopify HMAC-SHA256 signatures", () => {
    const rawBody = JSON.stringify({ id: 12345, total_price: 150000 });
    const secret = PLATFORM_SECRETS.shopify;
    const validSig = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("base64");

    expect(verifyShopifySignature(rawBody, validSig, secret)).toBe(true);
    expect(verifyShopifySignature(rawBody, "invalid_signature", secret)).toBe(false);
    expect(verifyShopifySignature(rawBody, null, secret)).toBe(false);
  });

  it("verifies valid and rejects invalid TikTok signatures", () => {
    const rawBody = JSON.stringify({ order_id: "88291" });
    const secret = PLATFORM_SECRETS.tiktok;
    const validSig = crypto
      .createHmac("sha256", secret)
      .update(secret + rawBody, "utf8")
      .digest("hex");

    expect(verifyTikTokSignature(rawBody, validSig, secret)).toBe(true);
    expect(verifyTikTokSignature(rawBody, "bad_hex_signature", secret)).toBe(false);
  });

  it("verifies Shopee and WooCommerce signatures", () => {
    const rawBody = JSON.stringify({ order_sn: "SHP-123" });
    const shopeeSecret = PLATFORM_SECRETS.shopee;
    const shopeeSig = crypto
      .createHmac("sha256", shopeeSecret)
      .update(rawBody, "utf8")
      .digest("hex");
    expect(verifyShopeeSignature(rawBody, shopeeSig, shopeeSecret)).toBe(true);

    const wcSecret = PLATFORM_SECRETS.woocommerce;
    const wcSig = crypto.createHmac("sha256", wcSecret).update(rawBody, "utf8").digest("base64");
    expect(verifyWooCommerceSignature(rawBody, wcSig, wcSecret)).toBe(true);
  });

  it("normalizes diverse vendor order structures into a uniform schema", () => {
    const shopifyOrder = normalizeInboundOrder("shopify", {
      id: 991823,
      name: "#SHPF-9918",
      total_price: 320000,
      currency: "IDR",
      financial_status: "paid",
      customer: { first_name: "Anita", last_name: "Dewi", email: "anita@domain.com" },
      line_items: [{ title: "Silk Scarf", sku: "SCRF-01", quantity: 2, price: 160000 }],
    });
    expect(shopifyOrder.platform).toBe("shopify");
    expect(shopifyOrder.orderNumber).toBe("#SHPF-9918");
    expect(shopifyOrder.grandTotal).toBe(320000);
    expect(shopifyOrder.paymentStatus).toBe("PAID");

    const tiktokOrder = normalizeInboundOrder("tiktok", {
      order_id: "7729103",
      recipient_address: { name: "Budi Santoso", city: "Jakarta" },
      payment_info: { total_amount: 195000, currency: "IDR" },
      item_list: [
        { product_name: "Vintage Jeans", sku_id: "JEAN-01", quantity: 1, sale_price: 195000 },
      ],
    });
    expect(tiktokOrder.platform).toBe("tiktok");
    expect(tiktokOrder.customerName).toBe("Budi Santoso");
    expect(tiktokOrder.totalAmount).toBe(195000);
  });

  it("enqueues, retries, and purges failed webhooks in DLQ store", async () => {
    const entry = await enqueueDlq({
      platform: "tiktok",
      event: "order.paid",
      headers: { "x-sig": "bad" },
      payload: { test: true },
      errorMessage: "Test verification failure",
    });

    expect(entry.id).toBeDefined();
    expect(entry.status).toBe("FAILED");

    const retryRes = await retryDlqEntry(entry.id);
    expect(retryRes.success).toBe(true);
    expect(retryRes.entry?.status).toBe("RESOLVED");

    const purged = await purgeDlqEntry(entry.id);
    expect(purged).toBe(true);
  });

  describe("delivery health: automatic retry scheduling", () => {
    const cleanup = async (id: string) => {
      await purgeDlqEntry(id);
    };

    it("marks transient failures RETRYING and permanent ones FAILED", async () => {
      const transient = await enqueueDlq({
        platform: "shopify",
        event: "order.inbound",
        headers: {},
        payload: { ok: 1 },
        errorMessage: "Timeout connecting to upstream",
        transient: true,
      });
      expect(transient.status).toBe("RETRYING");
      expect(transient.nextRetryAt).toBeDefined();
      await cleanup(transient.id);

      const permanent = await enqueueDlq({
        platform: "shopify",
        event: "order.inbound",
        headers: {},
        payload: { ok: 2 },
        errorMessage: "Bad HMAC signature",
      });
      expect(permanent.status).toBe("FAILED");
      await cleanup(permanent.id);
    });

    it("resolves due entries when the dispatcher succeeds", async () => {
      const entry = await enqueueDlq({
        platform: "shopee",
        event: "order.inbound",
        headers: {},
        payload: { sweep: true },
        errorMessage: "Transient DB error",
        transient: true,
      });
      // Force due: nextRetryAt in the past.
      const due = new Date(Date.now() - 1000);
      const { saveDlqEntries } = await import("@/lib/webhook-dlq-store");
      await saveDlqEntries(
        (await getDlqEntries()).map((e) =>
          e.id === entry.id ? { ...e, nextRetryAt: due.toISOString() } : e,
        ),
      );

      const result = await processDueRetries(async () => true);
      const after = (await getDlqEntries()).find((e) => e.id === entry.id);
      expect(result.attempted).toBeGreaterThanOrEqual(1);
      expect(after?.status).toBe("RESOLVED");
      await cleanup(entry.id);
    });

    it("schedules capped exponential backoff and promotes to terminal FAILED after MAX_ATTEMPTS", async () => {
      expect(backoffDelay(1)).toBe(5 * 60_000);
      expect(backoffDelay(2)).toBe(10 * 60_000);
      expect(backoffDelay(9)).toBe(30 * 60_000); // capped

      const entry = await enqueueDlq({
        platform: "woocommerce",
        event: "order.inbound",
        headers: {},
        payload: { exhaust: true },
        errorMessage: "Upstream 503",
        transient: true,
      });
      const { saveDlqEntries } = await import("@/lib/webhook-dlq-store");
      // Fast-forward: retryCount already at the last attempt and due now.
      await saveDlqEntries(
        (await getDlqEntries()).map((e) =>
          e.id === entry.id
            ? {
                ...e,
                retryCount: MAX_ATTEMPTS - 1,
                nextRetryAt: new Date(Date.now() - 1000).toISOString(),
              }
            : e,
        ),
      );

      await processDueRetries(async () => false);
      const after = (await getDlqEntries()).find((e) => e.id === entry.id);
      expect(after?.retryCount).toBe(MAX_ATTEMPTS);
      expect(after?.status).toBe("FAILED");
      expect(isExhausted(after!)).toBe(true);
      expect(after?.nextRetryAt).toBeUndefined();
      await cleanup(entry.id);
    });

    it("scheduleRetry re-arms a FAILED entry for the next sweep", async () => {
      const entry = await enqueueDlq({
        platform: "tiktok",
        event: "order.inbound",
        headers: {},
        payload: { rearm: true },
        errorMessage: "Wants a manual replay",
      });
      const result = await scheduleRetry(entry.id);
      expect(result.success).toBe(true);
      expect(result.entry?.status).toBe("RETRYING");
      // Due immediately — a sweep dispatches it right away.
      expect(new Date(result.entry!.nextRetryAt!).getTime()).toBeLessThanOrEqual(Date.now());
      await cleanup(entry.id);

      expect((await scheduleRetry("missing-id")).success).toBe(false);
    });
  });
});
