import fs from "fs";
import path from "path";
import {
  PurchaseOrder,
  generatePoNumber,
  VERIFIED_SUPPLIERS,
  DEFAULT_WAREHOUSES,
} from "./inventory-replenishment";

const DATA_DIR = path.join(process.cwd(), "data");
const PO_FILE = path.join(DATA_DIR, "purchase-orders.json");

const SEED_POS: PurchaseOrder[] = [
  {
    id: "po-seed-001",
    poNumber: "PO-2026-0001",
    supplierId: "sup-001",
    supplierName: "Apex Manufacturing Ltd.",
    supplierEmail: "supply@apexmanufacture.com",
    status: "ISSUED",
    items: [
      {
        productId: "prod-001",
        productName: "Classic Oxford Cotton Shirt",
        sku: "SHIRT-OXF-001",
        quantity: 150,
        unitCost: 125000,
        totalCost: 18750000,
      },
      {
        productId: "prod-002",
        productName: "Slim Chino Trousers",
        sku: "PANT-CHN-002",
        quantity: 80,
        unitCost: 175000,
        totalCost: 14000000,
      },
    ],
    totalAmount: 32750000,
    warehouseId: "wh-jkt",
    warehouseName: "Jakarta Central Fulfillment Center",
    leadTimeDays: 7,
    issueDate: new Date(Date.now() - 3 * 86400000).toISOString(),
    expectedDeliveryDate: new Date(Date.now() + 4 * 86400000).toISOString(),
    notes: "Expedited shipping requested for festive season restock.",
    createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
  },
  {
    id: "po-seed-002",
    poNumber: "PO-2026-0002",
    supplierId: "sup-002",
    supplierName: "Pacific Textiles & Apparel",
    supplierEmail: "orders@pacifictextiles.id",
    status: "RECEIVED",
    items: [
      {
        productId: "prod-003",
        productName: "Merino Wool Crewneck",
        sku: "KNIT-MRN-003",
        quantity: 100,
        unitCost: 250000,
        totalCost: 25000000,
      },
    ],
    totalAmount: 25000000,
    warehouseId: "wh-sub",
    warehouseName: "Surabaya Regional Logistics Depot",
    leadTimeDays: 14,
    issueDate: new Date(Date.now() - 16 * 86400000).toISOString(),
    expectedDeliveryDate: new Date(Date.now() - 2 * 86400000).toISOString(),
    receivedDate: new Date(Date.now() - 2 * 86400000).toISOString(),
    notes: "Received in full at Surabaya gate 4.",
    createdAt: new Date(Date.now() - 16 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
];

let inMemoryPOs: PurchaseOrder[] | null = null;

function ensureFile(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(PO_FILE)) {
    fs.writeFileSync(PO_FILE, JSON.stringify(SEED_POS, null, 2), "utf8");
  }
}

export function getPurchaseOrders(): PurchaseOrder[] {
  try {
    ensureFile();
    const raw = fs.readFileSync(PO_FILE, "utf8");
    inMemoryPOs = JSON.parse(raw);
    return inMemoryPOs!;
  } catch {
    return inMemoryPOs ?? SEED_POS;
  }
}

export function savePurchaseOrders(orders: PurchaseOrder[]): void {
  inMemoryPOs = orders;
  try {
    ensureFile();
    fs.writeFileSync(PO_FILE, JSON.stringify(orders, null, 2), "utf8");
  } catch (err) {
    console.error("Failed to write purchase orders file:", err);
  }
}

export function getPurchaseOrderById(id: string): PurchaseOrder | null {
  const all = getPurchaseOrders();
  return all.find((p) => p.id === id || p.poNumber === id) ?? null;
}

export function createPurchaseOrder(params: {
  supplierId: string;
  items: Array<{
    productId: string;
    productName: string;
    sku: string;
    quantity: number;
    unitCost: number;
  }>;
  warehouseId?: string;
  notes?: string;
}): PurchaseOrder {
  const all = getPurchaseOrders();
  const supplier =
    VERIFIED_SUPPLIERS.find((s) => s.id === params.supplierId) || VERIFIED_SUPPLIERS[0];
  const warehouse =
    DEFAULT_WAREHOUSES.find((w) => w.id === params.warehouseId) || DEFAULT_WAREHOUSES[0];
  const poItems = params.items.map((item) => ({
    ...item,
    totalCost: item.quantity * item.unitCost,
  }));
  const totalAmount = poItems.reduce((sum, item) => sum + item.totalCost, 0);
  const now = new Date();
  const expectedDate = new Date(now.getTime() + supplier.leadTimeDays * 86400000);

  const newOrder: PurchaseOrder = {
    id: "po-" + Date.now().toString(36) + "-" + Math.random().toString(36).substring(2, 6),
    poNumber: generatePoNumber(all.length + 1),
    supplierId: supplier.id,
    supplierName: supplier.name,
    supplierEmail: supplier.email,
    status: "ISSUED",
    items: poItems,
    totalAmount,
    warehouseId: warehouse.id,
    warehouseName: warehouse.name,
    leadTimeDays: supplier.leadTimeDays,
    issueDate: now.toISOString(),
    expectedDeliveryDate: expectedDate.toISOString(),
    notes: params.notes || "",
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  all.unshift(newOrder);
  savePurchaseOrders(all);
  return newOrder;
}

export function updatePurchaseOrderStatus(
  id: string,
  status: "DRAFT" | "ISSUED" | "RECEIVED" | "CANCELLED",
): PurchaseOrder | null {
  const all = getPurchaseOrders();
  const idx = all.findIndex((p) => p.id === id || p.poNumber === id);
  if (idx === -1) return null;

  const updated: PurchaseOrder = {
    ...all[idx],
    status,
    updatedAt: new Date().toISOString(),
    ...(status === "RECEIVED" ? { receivedDate: new Date().toISOString() } : {}),
  };

  all[idx] = updated;
  savePurchaseOrders(all);
  return updated;
}
