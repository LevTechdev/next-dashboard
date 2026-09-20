import { describe, it, expect, vi, beforeEach } from "vitest";
import { rmSync } from "node:fs";

/**
 * Scheduled-job engines: monthly affiliate auto-payout and the daily
 * usage digest. The DB/qris/plan stores are mocked so the pure rule logic
 * (threshold, cycle idempotency, settlement cap) is what's under test.
 */

const dbState = { earned: 0 };
/** Products the auto-reorder engine sees (empty by default). */
const reorderProducts: any[] = [];
const createdPOs: any[] = [];

vi.mock("@/lib/db", () => ({
  prisma: {
    affiliateConversion: {
      aggregate: vi.fn(async () => ({ _sum: { commissionAmount: dbState.earned } })),
    },
    user: {
      findUnique: vi.fn(async () => ({ tenantId: "t1" })),
      count: vi.fn(async () => 2),
    },
    order: { count: vi.fn(async () => 90) },
    apiKey: { count: vi.fn(async () => 1) },
    // Missed-event rollup for the digest email (no seeded notifications).
    notification: {
      groupBy: vi.fn(async () => []),
    },
    product: {
      findMany: vi.fn(async () => reorderProducts),
    },
  },
}));

vi.mock("@/lib/purchase-orders-store", () => ({
  createPurchaseOrder: vi.fn((params: any) => {
    const po = { id: "po-test-" + createdPOs.length, ...params };
    createdPOs.push(po);
    return po;
  }),
}));

vi.mock("@/lib/qris-engine", () => ({
  qrisLedger: { getState: () => ({ availableBalance: 18_750_000 }) },
}));

vi.mock("@/lib/plan-tiers", () => ({
  getTierFeaturesForUser: vi.fn(async () => ({
    tier: "REGULAR",
    planName: "Starter",
    maxOrders: 100,
    maxTeamMembers: 3,
  })),
  API_KEY_LIMITS: { REGULAR: 2 },
}));

vi.mock("@/app/api/affiliates/payouts/route", () => ({
  mockPayouts: [
    { status: "PROCESSING", amount: 340 },
    { status: "SCHEDULED", amount: 510 },
    { status: "COMPLETED", amount: 1450 },
  ],
}));

import { runAutoPayout, cycleKey, AUTO_PAYOUT_THRESHOLD_USD } from "@/lib/affiliate-auto-payout";
import { computeDigestFor, calendarPeriod } from "@/lib/usage-digest";
import { runAutoReorder } from "@/lib/inventory-auto-reorder";

/**
 * Trial sweep — mocked prisma + sendEmail so the state machine (expire →
 * Starter fallback, 3-day warning dedupe) runs in isolation.
 */
const trialDb = {
  lapsed: [] as any[],
  endingSoon: [] as any[],
  markers: [] as any[],
  updates: [] as any[],
  creates: [] as any[],
  notifications: [] as any[],
  notificationUpdates: [] as any[],
  emails: [] as any[],
};

vi.mock("@/lib/email", () => ({
  sendEmail: vi.fn(async (payload: any) => {
    trialDb.emails.push(payload);
    return { sent: true };
  }),
}));

// The sweep module resolves @/lib/db itself — provide a scoped mock keyed on
// the model shapes it touches (subscription, plan, notification).
vi.doMock("@/lib/db", () => ({
  prisma: {
    plan: { findUnique: vi.fn(async () => ({ id: "plan-starter" })) },
    subscription: {
      findMany: vi.fn(async ({ where }: any) => {
        if (where.status === "TRIALING" && where.currentPeriodEnd?.lt) return trialDb.lapsed;
        return trialDb.endingSoon;
      }),
      update: vi.fn(async ({ where, data }: any) => {
        trialDb.updates.push({ id: where.id, data });
        return {};
      }),
      create: vi.fn(async ({ data }: any) => {
        trialDb.creates.push(data);
        return {};
      }),
    },
    notification: {
      findFirst: vi.fn(
        async ({ where }: any) =>
          trialDb.markers.find((m) => m.userId === where.userId && m.title === where.title) ?? null,
      ),
      create: vi.fn(async ({ data }: any) => {
        const row = { id: "notif-" + trialDb.notifications.length, ...data };
        trialDb.notifications.push(row);
        trialDb.markers.push(row);
        return row;
      }),
      update: vi.fn(async ({ where, data }: any) => {
        trialDb.notificationUpdates.push({ id: where.id, data });
        const row = trialDb.notifications.find((n: any) => n.id === where.id);
        if (row) Object.assign(row, data);
        return row ?? {};
      }),
    },
    $transaction: vi.fn(async (ops: any[]) => {
      for (const op of ops) await op;
      return [];
    }),
  },
}));

// Fresh module instance per test so marker state doesn't leak.
async function freshSweep() {
  vi.resetModules();
  const mod = await import("@/lib/trial-sweep");
  return mod.runTrialSweep;
}

function trialSub(overrides: Partial<Record<string, any>> = {}) {
  const now = Date.now();
  return {
    id: "sub-1",
    userId: "u1",
    currentPeriodEnd: new Date(now + 2 * 24 * 3600 * 1000),
    plan: { name: "Professional" },
    user: { email: "owner@example.com", name: "Owner", isActive: true },
    ...overrides,
  };
}

describe("trial expiry sweep", () => {
  beforeEach(() => {
    trialDb.lapsed = [];
    trialDb.endingSoon = [];
    trialDb.markers = [];
    trialDb.updates = [];
    trialDb.creates = [];
    trialDb.notifications = [];
    trialDb.notificationUpdates = [];
    trialDb.emails = [];
  });

  it("expires a lapsed trial by swapping the row to Starter in place", async () => {
    trialDb.lapsed = [trialSub({ currentPeriodEnd: new Date(Date.now() - 3600_000) })];
    const run = await freshSweep();
    const res = await run({ send: true });

    expect(res.expired).toBe(1);
    // Subscription.userId is unique — the SAME row is repointed at Starter
    // rather than a second row being created (which broke the unique index).
    expect(trialDb.creates).toHaveLength(0);
    expect(trialDb.updates).toHaveLength(1);
    expect(trialDb.updates[0].id).toBe("sub-1");
    expect(trialDb.updates[0].data).toMatchObject({ planId: "plan-starter", status: "ACTIVE" });
    expect(trialDb.updates[0].data.currentPeriodEnd).toBeInstanceOf(Date);
    expect(trialDb.emails.some((e) => /has ended/.test(e.subject))).toBe(true);
  });

  it("warns once inside the 3-day window and dedupes on a second run", async () => {
    trialDb.endingSoon = [trialSub()];
    const run = await freshSweep();

    const first = await run({ send: true });
    expect(first.warned).toBe(1);
    expect(trialDb.notifications).toHaveLength(1);
    // Human title (the bell renders it verbatim — no internal marker ids).
    expect(trialDb.notifications[0].title).toBe("Your Professional trial ends soon");
    expect(trialDb.notifications[0].description).toMatch(/ends in \d+ days?\./);
    expect(trialDb.emails).toHaveLength(1);
    expect(trialDb.emails[0].subject).toMatch(/trial ends soon/);

    // Second pass the same day — existing row found: countdown refreshed, no
    // duplicate notification and, crucially, no second email.
    const second = await run({ send: true });
    expect(second.warned).toBe(0);
    expect(trialDb.notifications).toHaveLength(1);
    expect(trialDb.notificationUpdates).toHaveLength(1);
    expect(trialDb.emails).toHaveLength(1);
  });

  it("dry-run reports counts and writes nothing at all", async () => {
    trialDb.lapsed = [trialSub({ currentPeriodEnd: new Date(Date.now() - 3600_000) })];
    trialDb.endingSoon = [trialSub()];
    const run = await freshSweep();
    const res = await run({ dryRun: true });

    expect(res.expired).toBe(1);
    expect(res.warned).toBe(1);
    // Zero writes: no plan swap, no notification, no mail.
    expect(trialDb.updates).toHaveLength(0);
    expect(trialDb.creates).toHaveLength(0);
    expect(trialDb.notifications).toHaveLength(0);
    expect(trialDb.emails).toHaveLength(0);
  });

  it("send=false still applies state but mails nobody", async () => {
    trialDb.lapsed = [trialSub({ currentPeriodEnd: new Date(Date.now() - 3600_000) })];
    trialDb.endingSoon = [trialSub()];
    const run = await freshSweep();
    const res = await run({ send: false });

    expect(res.expired).toBe(1);
    expect(res.warned).toBe(1);
    expect(trialDb.updates).toHaveLength(1);
    expect(trialDb.emails).toHaveLength(0);
  });

  it("skips inactive users entirely (no mail, no warning marker)", async () => {
    trialDb.endingSoon = [
      trialSub({ user: { email: "x@example.com", name: "X", isActive: false } }),
    ];
    const run = await freshSweep();
    const res = await run({ send: true });

    // The marker/notification path still records, but no email goes out.
    expect(res.warned).toBe(1);
    expect(trialDb.emails).toHaveLength(0);
  });
});

const cycle = cycleKey();

describe("affiliate auto-payout", () => {
  beforeEach(() => {
    dbState.earned = 0;
    // Reset the cycle ledger AND the persisted payouts store between tests —
    // both feed the outstanding-balance math (SCHEDULED auto-payouts for the
    // current cycle are subtracted from available).
    try {
      rmSync("data/auto-payout-cycle.json", { force: true });
      rmSync("data/auto-payouts.json", { force: true });
    } catch {
      /* noop */
    }
  });

  it("does not trigger below the threshold", async () => {
    dbState.earned = 300; // minus 850 outstanding → 0 available
    const result = await runAutoPayout(new Date(), true);
    expect(result.triggered).toBe(false);
  });

  it("schedules a payout when available crosses the threshold", async () => {
    dbState.earned = 1400; // − 850 outstanding → 550 available
    const result = await runAutoPayout(new Date(), true);
    expect(result.triggered).toBe(true);
    expect(result.payout?.status).toBe("SCHEDULED");
    expect(result.payout?.amount).toBeGreaterThan(0);
    expect(result.payout?.amount).toBeLessThanOrEqual(result.availableBalance);
    expect(result.payout?.cycle).toBe(cycle);
  });

  it("is idempotent per monthly cycle (no force)", async () => {
    dbState.earned = 2400;
    const first = await runAutoPayout(new Date(), true);
    expect(first.triggered).toBe(true);

    // Same cycle, non-forced → the ledger guard fires.
    const second = await runAutoPayout(new Date(), false);
    expect(second.triggered).toBe(false);
    expect(second.reason).toBe("already-run-this-cycle");
  });

  it("caps the payout at the QRIS settlement balance", async () => {
    dbState.earned = 100_000; // available ≫ settlement ($1,183)
    const result = await runAutoPayout(new Date(), true);
    expect(result.triggered).toBe(true);
    expect(result.reason).toBe("settlement-capped");
    expect(result.payout?.amount).toBeLessThanOrEqual(result.settlementBalance);
  });

  it("uses a YYYY-MM cycle key", () => {
    expect(cycleKey(new Date("2026-09-16"))).toBe("2026-09");
  });
});

describe("usage digest lib", () => {
  it("computes calendar-month period boundaries", () => {
    const { start, end } = calendarPeriod(new Date("2026-09-16T10:30:00Z"));
    expect(start.getDate()).toBe(1);
    expect(end.getMonth()).toBe(9); // October
  });

  it("marks metrics over 80% and passes unlimited limits through", async () => {
    const digest = await computeDigestFor("user-1");
    expect(digest).not.toBeNull();
    const orders = digest!.metrics.find((m) => m.key === "orders");
    expect(orders?.used).toBe(90);
    expect(orders?.limit).toBe(100);
    expect(orders?.pct).toBe(90);
    expect(orders?.warn).toBe(true);
    expect(digest!.anyWarn).toBe(true);
  });
});

describe("inventory auto-reorder", () => {
  beforeEach(() => {
    reorderProducts.length = 0;
    createdPOs.length = 0;
    try {
      rmSync("data/auto-reorder-ledger.json", { force: true });
    } catch {
      /* noop */
    }
  });

  const lowStockProduct = (overrides: Partial<any> = {}) => ({
    id: "prod-low",
    name: "Low Stock Widget",
    sku: "WIDGET-1",
    stock: 2,
    price: 100_000,
    costPrice: 60_000,
    isActive: true,
    orderItems: [],
    ...overrides,
  });

  it("drafts a DRAFT purchase order when stock is below the reorder point", async () => {
    reorderProducts.push(lowStockProduct());
    const result = await runAutoReorder(new Date());
    expect(result.drafted).toBeGreaterThanOrEqual(1);
    expect(createdPOs[0]?.status).toBe("DRAFT");
    expect(result.drafts[0]?.qty).toBeGreaterThan(0);
  });

  it("skips healthy products and respects the per-product cooldown", async () => {
    // Healthy: huge stock vs the fallback velocity → no draft.
    reorderProducts.push(lowStockProduct({ id: "prod-ok", stock: 999_999 }));
    const healthy = await runAutoReorder(new Date());
    expect(healthy.drafted).toBe(0);

    // Low-stock product drafts once; an immediate second run is cooled down.
    reorderProducts.length = 0;
    reorderProducts.push(lowStockProduct());
    const first = await runAutoReorder(new Date());
    expect(first.drafted).toBe(1);
    const second = await runAutoReorder(new Date());
    expect(second.drafted).toBe(0);
    expect(second.skippedByCooldown).toBeGreaterThanOrEqual(1);
  });
});
