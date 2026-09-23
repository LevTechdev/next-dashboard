import { prisma } from "@/lib/db";
import {
  calculateSalesVelocity,
  calculateDaysOfInventory,
  calculateReorderPoint,
  assessStockoutRisk,
  calculateSuggestedReorderQty,
  VERIFIED_SUPPLIERS,
} from "@/lib/inventory-replenishment";
import { createPurchaseOrder } from "@/lib/purchase-orders-store";

/**
 * Inventory auto-reorder — drafts a purchase order when active stock falls
 * to/below its reorder point (velocity-based, same math as the
 * replenishment API).
 *
 * Runs as a scheduler job (daily-ish cadence via the hourly auto-payout
 * slot or every tick — cheap: one aggregate + one findMany). Idempotent
 * per product per cycle: a ledger of productId → last PO cycle prevents
 * duplicate POs when the same product stays below its reorder point for
 * days. Persisted like the DLQ/auto-payout stores so route bundles and
 * restarts share state.
 *
 * Drafts carry status DRAFT — a human issues them from the purchase-orders
 * page; nothing is sent to suppliers automatically.
 */

/** Trigger a draft PO when stock <= reorderPoint and risk != HEALTHY. */
export const AUTO_REORDER_MIN_RISK: "CRITICAL" | "WARNING" =
  (process.env.AUTO_REORDER_MIN_RISK as "CRITICAL" | "WARNING") || "WARNING";

/** One PO per product per this many days. */
export const AUTO_REORDER_COOLDOWN_DAYS = Number(process.env.AUTO_REORDER_COOLDOWN_DAYS ?? "7");

/** JSON ledger: productId → ISO timestamp of the last auto-draft. */
const LEDGER_PATH = "data/auto-reorder-ledger.json";

function readLedger(): Record<string, string> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require("node:fs") as typeof import("node:fs");
    if (!fs.existsSync(LEDGER_PATH)) return {};
    return JSON.parse(fs.readFileSync(LEDGER_PATH, "utf-8")) as Record<string, string>;
  } catch {
    return {};
  }
}

function writeLedgerEntry(productId: string, at: string): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require("node:fs") as typeof import("node:fs");
    const all = readLedger();
    all[productId] = at;
    fs.writeFileSync(LEDGER_PATH, JSON.stringify(all, null, 2));
  } catch {
    // Best-effort persistence.
  }
}

export interface AutoReorderResult {
  evaluated: number;
  drafted: number;
  drafts: Array<{
    productId: string;
    productName: string;
    poId: string;
    qty: number;
    risk: string;
  }>;
  skippedByCooldown: number;
}

export async function runAutoReorder(
  now = new Date(),
  /** Test/admin escape hatch: ignore the per-product cooldown ledger so a
   * deterministic set of drafts can be produced on demand (e2e specs, the
   * admin run route with { force: true }). The ledger is not written on a
   * forced run. */
  options: { force?: boolean } = {},
): Promise<AutoReorderResult> {
  const ledger = options.force ? {} : readLedger();
  const cooldownMs = AUTO_REORDER_COOLDOWN_DAYS * 86_400_000;

  const products = await prisma.product.findMany({
    where: { isActive: true },
    include: {
      orderItems: {
        select: { quantity: true, order: { select: { createdAt: true } } },
      },
    },
    orderBy: { stock: "asc" },
  });

  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86_400_000);
  const result: AutoReorderResult = { evaluated: 0, drafted: 0, drafts: [], skippedByCooldown: 0 };

  // Group drafts by supplier so one PO covers several low products.
  const draftsBySupplier = new Map<
    string,
    Array<{
      productId: string;
      productName: string;
      sku: string;
      quantity: number;
      unitCost: number;
      risk: string;
    }>
  >();

  products.forEach((prod, index) => {
    result.evaluated++;
    const unitsSold30d =
      (prod.orderItems as any[])
        .filter((oi) => oi.order && new Date(oi.order.createdAt) >= thirtyDaysAgo)
        .reduce((sum: number, oi: any) => sum + oi.quantity, 0) ||
      Math.max(8, Math.round((prod.price % 30) + 12));

    const salesVelocity = calculateSalesVelocity(unitsSold30d, 30);
    const daysOfInventory = calculateDaysOfInventory(prod.stock, salesVelocity);
    const supplier = VERIFIED_SUPPLIERS[index % VERIFIED_SUPPLIERS.length];
    const reorderPoint = calculateReorderPoint(salesVelocity, supplier.leadTimeDays, 5);
    const stockoutRisk = assessStockoutRisk(prod.stock, daysOfInventory, supplier.leadTimeDays);

    if (prod.stock > reorderPoint) return;
    if (
      stockoutRisk === "HEALTHY" ||
      (stockoutRisk === "WARNING" && AUTO_REORDER_MIN_RISK === "CRITICAL")
    )
      return;

    const last = ledger[prod.id];
    if (last && now.getTime() - new Date(last).getTime() < cooldownMs) {
      result.skippedByCooldown++;
      return;
    }

    const qty = calculateSuggestedReorderQty(prod.stock, reorderPoint, supplier.moq, 1.5);
    const bucket = draftsBySupplier.get(supplier.id) ?? [];
    bucket.push({
      productId: prod.id,
      productName: prod.name,
      sku: prod.sku || "SKU-" + prod.id.slice(-6).toUpperCase(),
      quantity: qty,
      unitCost: prod.costPrice || Math.round(prod.price * 0.6),
      risk: stockoutRisk,
    });
    draftsBySupplier.set(supplier.id, bucket);
  });

  for (const [supplierId, items] of draftsBySupplier) {
    const po = createPurchaseOrder({
      supplierId,
      items: items.map(({ risk: _risk, ...item }) => item),
      notes: `Auto-drafted by inventory auto-reorder (reorder point reached).`,
      status: "DRAFT",
    });
    for (const item of items) {
      // A forced run skips the ledger entirely so repeated test runs stay
      // deterministic (the normal path records the cooldown).
      if (!options.force) writeLedgerEntry(item.productId, now.toISOString());
      result.drafts.push({
        productId: item.productId,
        productName: item.productName,
        poId: po.id,
        qty: item.quantity,
        risk: item.risk,
      });
    }
    result.drafted++;
  }

  return result;
}
