import { prisma } from "@/lib/db";
import {
  type PurchaseOrder,
  type PurchaseOrderItem,
  generatePoNumber,
  VERIFIED_SUPPLIERS,
  DEFAULT_WAREHOUSES,
} from "./inventory-replenishment";

type PoRow = {
  id: string;
  poNumber: string;
  supplierId: string;
  supplierName: string;
  supplierEmail: string;
  status: string;
  totalAmount: number;
  warehouseId: string;
  warehouseName: string;
  leadTimeDays: number;
  issueDate: Date;
  expectedDeliveryDate: Date;
  receivedDate: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  items: Array<{
    productId: string;
    productName: string;
    sku: string;
    quantity: number;
    unitCost: number;
    totalCost: number;
  }>;
};

function mapOrder(row: PoRow): PurchaseOrder {
  return {
    id: row.id,
    poNumber: row.poNumber,
    supplierId: row.supplierId,
    supplierName: row.supplierName,
    supplierEmail: row.supplierEmail,
    status: row.status as PurchaseOrder["status"],
    items: row.items.map((item): PurchaseOrderItem => ({
      productId: item.productId,
      productName: item.productName,
      sku: item.sku,
      quantity: item.quantity,
      unitCost: item.unitCost,
      totalCost: item.totalCost,
    })),
    totalAmount: row.totalAmount,
    warehouseId: row.warehouseId,
    warehouseName: row.warehouseName,
    leadTimeDays: row.leadTimeDays,
    issueDate: row.issueDate.toISOString(),
    expectedDeliveryDate: row.expectedDeliveryDate.toISOString(),
    receivedDate: row.receivedDate?.toISOString() ?? null,
    notes: row.notes ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 86_400_000);
}

function daysAhead(days: number): Date {
  return new Date(Date.now() + days * 86_400_000);
}

/** Seed the two demo POs once per workspace, mirroring the old JSON seed. */
async function seedOrders(tenantId: string) {
  const count = await prisma.purchaseOrder.count({ where: { tenantId } });
  if (count > 0) return;

  const supplier1 = VERIFIED_SUPPLIERS[0] ?? {
    id: "sup-001",
    name: "Apex Manufacturing Ltd.",
    email: "supply@apexmanufacture.com",
    leadTimeDays: 7,
  };
  const supplier2 = VERIFIED_SUPPLIERS[1] ?? supplier1;
  const warehouse1 = DEFAULT_WAREHOUSES[0];
  const warehouse2 = DEFAULT_WAREHOUSES[1] ?? warehouse1;

  const seeds = [
    {
      id: `po-seed-1-${tenantId}`,
      poNumber: "PO-2026-0001",
      supplierId: supplier1.id,
      supplierName: supplier1.name,
      supplierEmail: supplier1.email,
      status: "ISSUED",
      totalAmount: 32_750_000,
      warehouseId: warehouse1.id,
      warehouseName: warehouse1.name,
      leadTimeDays: supplier1.leadTimeDays,
      issueDate: daysAgo(3),
      expectedDeliveryDate: daysAhead(4),
      receivedDate: null as Date | null,
      notes: "Expedited shipping requested for festive season restock.",
      createdAt: daysAgo(3),
      updatedAt: daysAgo(3),
      items: [
        {
          productId: "prod-001",
          productName: "Classic Oxford Cotton Shirt",
          sku: "SHIRT-OXF-001",
          quantity: 150,
          unitCost: 125_000,
          totalCost: 18_750_000,
        },
        {
          productId: "prod-002",
          productName: "Slim Chino Trousers",
          sku: "PANT-CHN-002",
          quantity: 80,
          unitCost: 175_000,
          totalCost: 14_000_000,
        },
      ],
    },
    {
      id: `po-seed-2-${tenantId}`,
      poNumber: "PO-2026-0002",
      supplierId: supplier2.id,
      supplierName: supplier2.name,
      supplierEmail: supplier2.email,
      status: "RECEIVED",
      totalAmount: 25_000_000,
      warehouseId: warehouse2.id,
      warehouseName: warehouse2.name,
      leadTimeDays: supplier2.leadTimeDays,
      issueDate: daysAgo(16),
      expectedDeliveryDate: daysAgo(2),
      receivedDate: daysAgo(2) as Date | null,
      notes: "Received in full at Surabaya gate 4.",
      createdAt: daysAgo(16),
      updatedAt: daysAgo(2),
      items: [
        {
          productId: "prod-003",
          productName: "Merino Wool Crewneck",
          sku: "KNIT-MRN-003",
          quantity: 100,
          unitCost: 250_000,
          totalCost: 25_000_000,
        },
      ],
    },
  ];

  for (const seed of seeds) {
    await prisma.purchaseOrder.create({
      data: {
        id: seed.id,
        tenantId,
        poNumber: seed.poNumber,
        supplierId: seed.supplierId,
        supplierName: seed.supplierName,
        supplierEmail: seed.supplierEmail,
        status: seed.status,
        totalAmount: seed.totalAmount,
        warehouseId: seed.warehouseId,
        warehouseName: seed.warehouseName,
        leadTimeDays: seed.leadTimeDays,
        issueDate: seed.issueDate,
        expectedDeliveryDate: seed.expectedDeliveryDate,
        receivedDate: seed.receivedDate,
        notes: seed.notes,
        createdAt: seed.createdAt,
        updatedAt: seed.updatedAt,
        items: { create: seed.items },
      },
    });
  }
}

export async function getPurchaseOrders(tenantId: string): Promise<PurchaseOrder[]> {
  await seedOrders(tenantId);
  const rows = await prisma.purchaseOrder.findMany({
    where: { tenantId },
    include: { items: true },
    orderBy: { issueDate: "desc" },
  });
  return rows.map(mapOrder);
}

export async function getPurchaseOrderById(
  tenantId: string,
  id: string,
): Promise<PurchaseOrder | null> {
  await seedOrders(tenantId);
  const row = await prisma.purchaseOrder.findFirst({
    where: { tenantId, OR: [{ id }, { poNumber: id }] },
    include: { items: true },
  });
  return row ? mapOrder(row) : null;
}

export async function createPurchaseOrder(params: {
  tenantId: string;
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
  /** DRAFT for auto-generated POs awaiting human review (default ISSUED). */
  status?: "DRAFT" | "ISSUED";
}): Promise<PurchaseOrder> {
  const supplier =
    VERIFIED_SUPPLIERS.find((s) => s.id === params.supplierId) ?? VERIFIED_SUPPLIERS[0];
  const warehouse =
    DEFAULT_WAREHOUSES.find((w) => w.id === params.warehouseId) ?? DEFAULT_WAREHOUSES[0];
  const poItems = params.items.map((item) => ({
    productId: item.productId,
    productName: item.productName,
    sku: item.sku,
    quantity: item.quantity,
    unitCost: item.unitCost,
    totalCost: item.quantity * item.unitCost,
  }));
  const totalAmount = poItems.reduce((sum, item) => sum + item.totalCost, 0);
  const now = new Date();

  const count = await prisma.purchaseOrder.count({ where: { tenantId: params.tenantId } });
  let sequence = count + 1;
  let poNumber = generatePoNumber(sequence);
  for (let attempt = 0; attempt < 100; attempt++) {
    const clash = await prisma.purchaseOrder.findUnique({
      where: {
        tenantId_poNumber: { tenantId: params.tenantId, poNumber },
      },
      select: { id: true },
    });
    if (!clash) break;
    sequence += 1;
    poNumber = generatePoNumber(sequence);
  }

  const created = await prisma.purchaseOrder.create({
    data: {
      id: "po-" + Date.now().toString(36) + "-" + Math.random().toString(36).substring(2, 6),
      tenantId: params.tenantId,
      poNumber,
      supplierId: supplier.id,
      supplierName: supplier.name,
      supplierEmail: supplier.email,
      status: params.status ?? "ISSUED",
      totalAmount,
      warehouseId: warehouse.id,
      warehouseName: warehouse.name,
      leadTimeDays: supplier.leadTimeDays,
      issueDate: now,
      expectedDeliveryDate: new Date(now.getTime() + supplier.leadTimeDays * 86_400_000),
      notes: params.notes || "",
      createdAt: now,
      updatedAt: now,
      items: { create: poItems },
    },
    include: { items: true },
  });

  return mapOrder(created);
}

export async function updatePurchaseOrderStatus(
  tenantId: string,
  id: string,
  status: "DRAFT" | "ISSUED" | "RECEIVED" | "CANCELLED",
): Promise<PurchaseOrder | null> {
  const existing = await prisma.purchaseOrder.findFirst({
    where: { tenantId, OR: [{ id }, { poNumber: id }] },
  });
  if (!existing) return null;

  const updated = await prisma.purchaseOrder.update({
    where: { id: existing.id },
    data: {
      status,
      updatedAt: new Date(),
      ...(status === "RECEIVED" ? { receivedDate: new Date() } : {}),
    },
    include: { items: true },
  });

  return mapOrder(updated);
}
