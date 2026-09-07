/**
 * Smart Inventory Replenishment & Supply Chain Math Engine
 *
 * Core formulas:
 * - Sales Velocity (units/day) = Units Sold over Lookback Window / Lookback Days
 * - Days of Inventory (DOI) = Current Stock / Sales Velocity
 * - Reorder Point (ROP) = (Lead Time Days + Safety Stock Days) * Sales Velocity
 * - Suggested Reorder Quantity = max(MOQ, ceil(ROP * Safety Multiplier - Current Stock))
 */

export interface ProductReplenishmentMetrics {
  productId: string;
  name: string;
  sku: string;
  stock: number;
  price: number;
  costPrice: number;
  category: string;
  unitsSold30d: number;
  salesVelocity: number; // units per day
  daysOfInventory: number;
  leadTimeDays: number;
  safetyStockDays: number;
  reorderPoint: number;
  reorderNeeded: boolean;
  suggestedReorderQty: number;
  stockoutRisk: "CRITICAL" | "WARNING" | "HEALTHY";
  supplier: {
    id: string;
    name: string;
    email: string;
    moq: number;
    leadTimeDays: number;
  };
}

export interface PurchaseOrderItem {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplierId: string;
  supplierName: string;
  supplierEmail: string;
  status: "DRAFT" | "ISSUED" | "RECEIVED" | "CANCELLED";
  items: PurchaseOrderItem[];
  totalAmount: number;
  warehouseId: string;
  warehouseName: string;
  leadTimeDays: number;
  issueDate: string;
  expectedDeliveryDate: string;
  receivedDate?: string | null;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WarehouseAllocation {
  id: string;
  code: string;
  name: string;
  city: string;
  country: string;
  allocationPercent: number;
  totalStockUnits: number;
  capacityUnits: number;
  utilizationRate: number;
  channelDistribution: {
    onlineStorePercent: number;
    tiktokShopPercent: number;
    shopeePercent: number;
    posRetailPercent: number;
  };
}

/** Default Warehouses */
export const DEFAULT_WAREHOUSES: WarehouseAllocation[] = [
  {
    id: "wh-jkt",
    code: "WH-JKT",
    name: "Jakarta Central Fulfillment Center",
    city: "Jakarta",
    country: "Indonesia",
    allocationPercent: 55,
    totalStockUnits: 8250,
    capacityUnits: 12000,
    utilizationRate: 68.75,
    channelDistribution: {
      onlineStorePercent: 40,
      tiktokShopPercent: 35,
      shopeePercent: 20,
      posRetailPercent: 5,
    },
  },
  {
    id: "wh-sub",
    code: "WH-SUB",
    name: "Surabaya Regional Logistics Depot",
    city: "Surabaya",
    country: "Indonesia",
    allocationPercent: 30,
    totalStockUnits: 4500,
    capacityUnits: 8000,
    utilizationRate: 56.25,
    channelDistribution: {
      onlineStorePercent: 50,
      tiktokShopPercent: 25,
      shopeePercent: 20,
      posRetailPercent: 5,
    },
  },
  {
    id: "wh-sgp",
    code: "WH-SGP",
    name: "Singapore Cross-Border SEA Depot",
    city: "Singapore",
    country: "Singapore",
    allocationPercent: 15,
    totalStockUnits: 2250,
    capacityUnits: 5000,
    utilizationRate: 45.0,
    channelDistribution: {
      onlineStorePercent: 60,
      tiktokShopPercent: 15,
      shopeePercent: 25,
      posRetailPercent: 0,
    },
  },
];

/** Default Verified Suppliers */
export const VERIFIED_SUPPLIERS = [
  {
    id: "sup-001",
    name: "Apex Manufacturing Ltd.",
    email: "supply@apexmanufacture.com",
    phone: "+62 21 555-8921",
    leadTimeDays: 7,
    moq: 50,
  },
  {
    id: "sup-002",
    name: "Pacific Textiles & Apparel",
    email: "orders@pacifictextiles.id",
    phone: "+62 31 777-1044",
    leadTimeDays: 14,
    moq: 100,
  },
  {
    id: "sup-003",
    name: "Nexus Electronics & Hardware",
    email: "sales@nexuselec.sg",
    phone: "+65 6789-2233",
    leadTimeDays: 10,
    moq: 25,
  },
];

/**
 * Calculates daily sales velocity from units sold over a day window.
 */
export function calculateSalesVelocity(unitsSold: number, days = 30): number {
  if (days <= 0) return 0;
  return Number((Math.max(0, unitsSold) / days).toFixed(2));
}

/**
 * Calculates Days of Inventory (DOI) remaining before stockout.
 */
export function calculateDaysOfInventory(stock: number, salesVelocity: number): number {
  if (stock <= 0) return 0;
  if (salesVelocity <= 0) return 999; // Infinite / stagnant stock
  return Math.round(stock / salesVelocity);
}

/**
 * Computes the Reorder Point (ROP) = (leadTimeDays + safetyStockDays) * salesVelocity
 */
export function calculateReorderPoint(
  salesVelocity: number,
  leadTimeDays = 7,
  safetyStockDays = 5,
): number {
  if (salesVelocity <= 0) return 0;
  return Math.ceil((leadTimeDays + safetyStockDays) * salesVelocity);
}

/**
 * Assesses the Stockout Risk Level.
 */
export function assessStockoutRisk(
  stock: number,
  daysOfInventory: number,
  leadTimeDays = 7,
): "CRITICAL" | "WARNING" | "HEALTHY" {
  if (stock <= 0 || daysOfInventory <= 3) {
    return "CRITICAL";
  }
  if (daysOfInventory <= leadTimeDays) {
    return "WARNING";
  }
  return "HEALTHY";
}

/**
 * Computes suggested reorder quantity.
 */
export function calculateSuggestedReorderQty(
  currentStock: number,
  reorderPoint: number,
  moq = 50,
  safetyMultiplier = 1.5,
): number {
  const targetBuffer = Math.ceil(reorderPoint * safetyMultiplier);
  const needed = targetBuffer - currentStock;
  if (needed <= 0) return 0;
  return Math.max(moq, Math.ceil(needed / 10) * 10);
}

/**
 * Generates an auto-incrementing PO number.
 */
export function generatePoNumber(sequenceIndex: number): string {
  const year = new Date().getFullYear();
  const padded = String(sequenceIndex).padStart(4, "0");
  return `PO-${year}-${padded}`;
}
