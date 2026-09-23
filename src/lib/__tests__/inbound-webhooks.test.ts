import { describe, it, expect } from "vitest";
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

  it("enqueues, retries, and purges failed webhooks in DLQ store", () => {
    const entry = enqueueDlq({
      platform: "tiktok",
      event: "order.paid",
      headers: { "x-sig": "bad" },
      payload: { test: true },
      errorMessage: "Test verification failure",
    });

    expect(entry.id).toBeDefined();
    expect(entry.status).toBe("FAILED");

    const retryRes = retryDlqEntry(entry.id);
    expect(retryRes.success).toBe(true);
    expect(retryRes.entry?.status).toBe("RESOLVED");

    const purged = purgeDlqEntry(entry.id);
    expect(purged).toBe(true);
  });

  describe("delivery health: automatic retry scheduling", () => {
    const cleanup = (id: string) => purgeDlqEntry(id);

    it("marks transient failures RETRYING and permanent ones FAILED", () => {
      const transient = enqueueDlq({
        platform: "shopify",
        event: "order.inbound",
        headers: {},
        payload: { ok: 1 },
        errorMessage: "Timeout connecting to upstream",
        transient: true,
      });
      expect(transient.status).toBe("RETRYING");
      expect(transient.nextRetryAt).toBeDefined();
      cleanup(transient.id);

      const permanent = enqueueDlq({
        platform: "shopify",
        event: "order.inbound",
        headers: {},
        payload: { ok: 2 },
        errorMessage: "Bad HMAC signature",
      });
      expect(permanent.status).toBe("FAILED");
      cleanup(permanent.id);
    });

    it("resolves due entries when the dispatcher succeeds", async () => {
      const entry = enqueueDlq({
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
      saveDlqEntries(
        getDlqEntries().map((e) =>
          e.id === entry.id ? { ...e, nextRetryAt: due.toISOString() } : e,
        ),
      );

      const result = await processDueRetries(async () => true);
      const after = getDlqEntries().find((e) => e.id === entry.id);
      expect(result.attempted).toBeGreaterThanOrEqual(1);
      expect(after?.status).toBe("RESOLVED");
      cleanup(entry.id);
    });

    it("schedules capped exponential backoff and promotes to terminal FAILED after MAX_ATTEMPTS", async () => {
      expect(backoffDelay(1)).toBe(5 * 60_000);
      expect(backoffDelay(2)).toBe(10 * 60_000);
      expect(backoffDelay(9)).toBe(30 * 60_000); // capped

      const entry = enqueueDlq({
        platform: "woocommerce",
        event: "order.inbound",
        headers: {},
        payload: { exhaust: true },
        errorMessage: "Upstream 503",
        transient: true,
      });
      const { saveDlqEntries } = await import("@/lib/webhook-dlq-store");
      // Fast-forward: retryCount already at the last attempt and due now.
      saveDlqEntries(
        getDlqEntries().map((e) =>
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
      const after = getDlqEntries().find((e) => e.id === entry.id);
      expect(after?.retryCount).toBe(MAX_ATTEMPTS);
      expect(after?.status).toBe("FAILED");
      expect(isExhausted(after!)).toBe(true);
      expect(after?.nextRetryAt).toBeUndefined();
      cleanup(entry.id);
    });

    it("scheduleRetry re-arms a FAILED entry for the next sweep", async () => {
      const entry = enqueueDlq({
        platform: "tiktok",
        event: "order.inbound",
        headers: {},
        payload: { rearm: true },
        errorMessage: "Wants a manual replay",
      });
      const result = scheduleRetry(entry.id);
      expect(result.success).toBe(true);
      expect(result.entry?.status).toBe("RETRYING");
      // Due immediately — a sweep dispatches it right away.
      expect(new Date(result.entry!.nextRetryAt!).getTime()).toBeLessThanOrEqual(Date.now());
      cleanup(entry.id);

      expect(scheduleRetry("missing-id").success).toBe(false);
    });
  });
});
