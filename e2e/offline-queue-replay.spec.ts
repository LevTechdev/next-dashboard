import { test, expect } from "@playwright/test";
import { loginAs, FETCH_GATED } from "./helpers";

/**
 * Offline queue — durable outbox end to end.
 *
 * Scenario: the admin marks a PENDING order PROCESSING while the browser is
 * offline. The mutation must NOT hit the network (it would fail) — it lands
 * in the IndexedDB outbox and the offline banner shows the pending badge.
 * On reconnect the queue flushes: the badge drains and the order's status is
 * actually PROCESSING on the server.
 *
 * Offline simulation: Playwright's context.setOffline(true) — it flips
 * navigator.onLine and fails real socket sends, exactly the condition the
 * enqueueAndFlush branch checks. The final assertions re-fetch the order
 * through the API to prove server-side state, not just UI optimism.
 */

test.describe("offline order queue", () => {
  let orderId: string;
  let orderNumber: string;

  test.beforeEach(async ({ page }) => {
    await loginAs(page);

    // A PENDING order to work with (created through the API, session-scoped).
    // page.request (not the `request` fixture) — it shares the login cookie jar.
    const listRes = await page.request.get("/api/orders?status=PENDING&take=1");
    expect(listRes.ok()).toBeTruthy();
    const list = await listRes.json();
    const pending = Array.isArray(list)
      ? list.find((o: { status?: string }) => o.status === "PENDING")
      : list?.orders?.find((o: { status?: string }) => o.status === "PENDING");

    if (pending) {
      orderId = pending.id;
      orderNumber = pending.orderNumber;
    } else {
      // No PENDING seed order in a reachable state — create one from the first product.
      const productsRes = await page.request.get("/api/products?take=1");
      expect(productsRes.ok()).toBeTruthy();
      const products = await productsRes.json();
      const product = Array.isArray(products) ? products[0] : products?.products?.[0];
      expect(product, "seed data must contain at least one product").toBeTruthy();
      const createRes = await page.request.post("/api/orders", {
        data: {
          customerId: null,
          channel: "WHATSAPP",
          status: "PENDING",
          items: [{ productId: product.id, quantity: 1, price: 25000 }],
        },
      });
      expect(createRes.ok()).toBeTruthy();
      const created = await createRes.json();
      const order = created.order ?? created;
      orderId = order.id;
      orderNumber = order.orderNumber;
    }

    // Clean slate for the outbox so counts are deterministic.
    await page.goto("/en/dashboard");
    await page.evaluate(async () => {
      const dbs = await indexedDB.databases();
      const q = dbs.find((d) => d.name?.includes("offline-queue"));
      if (q?.name) {
        indexedDB.deleteDatabase(q.name);
      }
    });
  });

  test("queues the mutation offline, shows the pending badge, and replays on reconnect", async ({
    page,
  }) => {
    await page.goto("/en/orders");
    // Search scopes the table to exactly our order (the unfiltered list is
    // paginated newest-first, so the picked order may sit on a later page).
    const searchBox = page.getByPlaceholder("Search...");
    await expect(searchBox).toBeVisible(FETCH_GATED);
    await searchBox.fill(orderNumber);
    await expect(page.getByRole("link", { name: `#${orderNumber}` })).toBeVisible(FETCH_GATED);

    // ── Go offline ──────────────────────────────────────────────────────
    await page.context().setOffline(true);

    // The offline banner appears (navigator.onLine flipped).
    await expect(page.getByTestId("offline-banner")).toBeVisible({ timeout: 10_000 });

    // Queue the status change while offline: PENDING → PROCESSING.
    const row = page.locator("tr", { has: page.getByRole("link", { name: `#${orderNumber}` }) });
    await row
      .getByRole("button", { name: /process|proses|処理|处理/i })
      .first()
      .click();

    // The queue toast confirms the local save (no network involved).
    await expect(page.getByText(/saved offline|disimpan offline/i)).toBeVisible({
      timeout: 10_000,
    });

    // The pending badge shows exactly 1 queued mutation.
    await expect(page.getByTestId("offline-queue-count")).toHaveText("1");

    // ── Server state must still be PENDING (nothing leaked online) ──────
    await page.context().setOffline(false);
    // Back online — banner disappears and the flush runs. The synced toast
    // is too transient (~4s) to pin reliably behind argon2 fetch latency;
    // the deterministic proof is the badge draining + the server status.
    await expect(page.getByTestId("offline-banner")).toBeHidden({ timeout: 10_000 });

    // Badge drains to zero (element disappears when count is 0) — this only
    // happens after flushQueue successfully replayed the mutation.
    await expect(page.getByTestId("offline-queue-count")).toHaveCount(0, {
      timeout: 30_000,
    });

    // ── Server-side proof: the PUT actually landed ──────────────────────
    const res = await page.request.get(`/api/orders/${orderId}`);
    expect(res.ok()).toBeTruthy();
    const order = await res.json();
    const serverStatus = order.status ?? order.order?.status;
    expect(serverStatus).toBe("PROCESSING");

    // And the table catches up on its next realtime poll (15s interval) —
    // keep the search scoped so the row is guaranteed to be on page 1.
    const tableRow = page.locator("tr", {
      has: page.getByRole("link", { name: `#${orderNumber}` }),
    });
    await expect(tableRow).toContainText("PROCESSING", { timeout: 30_000 });
  });

  test("offline indicator stays hidden while online with an empty queue", async ({ page }) => {
    await page.goto("/en/orders");
    await expect(page.getByTestId("offline-banner")).toHaveCount(0);
    await expect(page.getByTestId("offline-queue-count")).toHaveCount(0);
  });
});
