import { prisma } from "../src/lib/db";
import bcrypt from "bcryptjs";

/**
 * Deterministic two-workspace fixture for e2e/tenant-store-isolation.spec.ts.
 *
 * Every migrated store gets one marker row per workspace. The marker ids are
 * stable and cleared on each run, so the spec can prove reads never cross the
 * tenant boundary and that cross-tenant mutations are rejected.
 *
 * Both workspaces are dedicated to this fixture (never the default workspace),
 * which also keeps QRIS's in-process ledger cache from hiding a database leak.
 */

const TENANT_A_SLUG = "tenant-stores-a";
const TENANT_B_SLUG = "tenant-stores-b";
const PASSWORD = "StoreIso#2026-xQ7";

export const STORE_ISOLATION = {
  a: {
    email: "store-isolation-a@example.com",
    password: PASSWORD,
    tenantSlug: TENANT_A_SLUG,
  },
  b: {
    email: "store-isolation-b@example.com",
    password: PASSWORD,
    tenantSlug: TENANT_B_SLUG,
  },
  ids: {
    qrisTxA: "iso-store-a-tx",
    qrisTxB: "iso-store-b-tx",
    qrisWdA: "ISO-A-WD",
    qrisWdB: "ISO-B-WD",
    beneficiaryA: "iso-store-a-beneficiary",
    beneficiaryB: "iso-store-b-beneficiary",
    purchaseOrderA: "iso-store-a-po",
    purchaseOrderB: "iso-store-b-po",
    chatChannelA: "iso-store-a-channel",
    chatChannelB: "iso-store-b-channel",
    chatDeliveryA: "iso-store-a-delivery",
    chatDeliveryB: "iso-store-b-delivery",
    dlqA: "iso-store-a-dlq",
    dlqB: "iso-store-b-dlq",
  },
  values: {
    qrisBalanceA: 12_345_600,
    qrisBalanceB: 98_765_400,
    inventoryA: 123_456_789,
    inventoryB: 987_654_321,
  },
} as const;

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

export async function seedTenantStoreIsolation() {
  const passwordHash = bcrypt.hashSync(PASSWORD, 10);

  const tenantA = await prisma.tenant.upsert({
    where: { slug: TENANT_A_SLUG },
    update: { name: "Store Isolation A" },
    create: { name: "Store Isolation A", slug: TENANT_A_SLUG },
  });
  const tenantB = await prisma.tenant.upsert({
    where: { slug: TENANT_B_SLUG },
    update: { name: "Store Isolation B" },
    create: { name: "Store Isolation B", slug: TENANT_B_SLUG },
  });

  for (const [tenantId, email, name] of [
    [tenantA.id, STORE_ISOLATION.a.email, "Store Isolation A"],
    [tenantB.id, STORE_ISOLATION.b.email, "Store Isolation B"],
  ] as const) {
    await prisma.user.upsert({
      where: { email },
      update: {
        name,
        password: passwordHash,
        passwordAlgo: "bcrypt",
        role: "ADMIN",
        isActive: true,
        tenantId,
      },
      create: {
        name,
        email,
        password: passwordHash,
        passwordAlgo: "bcrypt",
        role: "ADMIN",
        isActive: true,
        tenantId,
      },
    });
  }

  const tenantIds = [tenantA.id, tenantB.id];
  const {
    qrisTxA,
    qrisTxB,
    qrisWdA,
    qrisWdB,
    beneficiaryA,
    beneficiaryB,
    purchaseOrderA,
    purchaseOrderB,
    chatChannelA,
    chatChannelB,
    chatDeliveryA,
    chatDeliveryB,
    dlqA,
    dlqB,
  } = STORE_ISOLATION.ids;

  // Clear only this fixture's rows so repeated runs stay deterministic.
  await prisma.purchaseOrder.deleteMany({
    where: { id: { in: [purchaseOrderA, purchaseOrderB] } },
  });
  await prisma.beneficiary.deleteMany({ where: { id: { in: [beneficiaryA, beneficiaryB] } } });
  await prisma.inventorySnapshot.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.reportSchedule.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.webhookDlqEntry.deleteMany({ where: { id: { in: [dlqA, dlqB] } } });
  // The cross-tenant mutation test creates a channel for B, so clear every
  // chat row owned by these dedicated workspaces, not just the marker ids.
  await prisma.chatDeliveryLog.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.chatChannel.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.chatAlertRule.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.qrisTransaction.deleteMany({ where: { id: { in: [qrisTxA, qrisTxB] } } });
  await prisma.qrisDisbursement.deleteMany({
    where: { disbursementNumber: { in: [qrisWdA, qrisWdB] } },
  });
  await prisma.qrisLedgerBalance.deleteMany({ where: { tenantId: { in: tenantIds } } });

  const now = new Date();
  const today = dayKey(now);

  await prisma.qrisLedgerBalance.createMany({
    data: [
      {
        tenantId: tenantA.id,
        availableBalance: STORE_ISOLATION.values.qrisBalanceA,
        pendingBalance: 0,
        totalWithdrawn: 0,
        totalInbound: STORE_ISOLATION.values.qrisBalanceA,
      },
      {
        tenantId: tenantB.id,
        availableBalance: STORE_ISOLATION.values.qrisBalanceB,
        pendingBalance: 0,
        totalWithdrawn: 0,
        totalInbound: STORE_ISOLATION.values.qrisBalanceB,
      },
    ],
  });

  await prisma.qrisTransaction.createMany({
    data: [
      {
        id: qrisTxA,
        tenantId: tenantA.id,
        invoiceNumber: "INV-ISO-A",
        amount: 123_456,
        customerName: "Tenant A Customer",
        sourceBank: "BCA Mobile",
        status: "PENDING",
        qrisPayload: "ISO-A-QRIS",
        rrn: "111111111111",
        createdAt: now,
      },
      {
        id: qrisTxB,
        tenantId: tenantB.id,
        invoiceNumber: "INV-ISO-B",
        amount: 654_321,
        customerName: "Tenant B Customer",
        sourceBank: "Mandiri Livin",
        status: "PENDING",
        qrisPayload: "ISO-B-QRIS",
        rrn: "222222222222",
        createdAt: now,
      },
    ],
  });

  await prisma.qrisDisbursement.createMany({
    data: [
      {
        id: "iso-store-a-disbursement",
        tenantId: tenantA.id,
        disbursementNumber: qrisWdA,
        method: "dana",
        destinationName: "Tenant A Beneficiary",
        destinationAccount: "081200000001",
        grossAmount: 50_000,
        fee: 0,
        netAmount: 50_000,
        status: "COMPLETED",
        referenceNumber: "ISO-A-REF",
        timestamp: now,
      },
      {
        id: "iso-store-b-disbursement",
        tenantId: tenantB.id,
        disbursementNumber: qrisWdB,
        method: "bank_transfer",
        destinationName: "Tenant B Beneficiary",
        destinationAccount: "081200000002",
        bankCode: "BCA",
        grossAmount: 75_000,
        fee: 2_500,
        netAmount: 72_500,
        status: "COMPLETED",
        referenceNumber: "ISO-B-REF",
        timestamp: now,
      },
    ],
  });

  await prisma.beneficiary.createMany({
    data: [
      {
        id: beneficiaryA,
        tenantId: tenantA.id,
        accountNumber: "1111111111",
        maskedAccount: "****1111",
        accountName: "Tenant A Beneficiary",
        channel: "dana",
        verified: true,
        favorite: false,
        lastUsedAt: now,
        totalDisbursed: 50_000,
      },
      {
        id: beneficiaryB,
        tenantId: tenantB.id,
        accountNumber: "2222222222",
        maskedAccount: "****2222",
        accountName: "Tenant B Beneficiary",
        channel: "bank_transfer",
        bankCode: "BCA",
        bankName: "Bank Central Asia",
        verified: true,
        favorite: true,
        lastUsedAt: now,
        totalDisbursed: 75_000,
      },
    ],
  });

  await prisma.purchaseOrder.create({
    data: {
      id: purchaseOrderA,
      tenantId: tenantA.id,
      poNumber: "PO-ISO-A",
      supplierId: "supplier-a",
      supplierName: "Tenant A Supplier",
      supplierEmail: "supplier-a@example.com",
      status: "ISSUED",
      totalAmount: 1_000,
      warehouseId: "wh-a",
      warehouseName: "Tenant A Warehouse",
      leadTimeDays: 3,
      issueDate: now,
      expectedDeliveryDate: new Date(now.getTime() + 86_400_000),
      createdAt: now,
      updatedAt: now,
      items: {
        create: [
          {
            productId: "product-a",
            productName: "Tenant A Product",
            sku: "ISO-A-SKU",
            quantity: 1,
            unitCost: 1_000,
            totalCost: 1_000,
          },
        ],
      },
    },
  });
  await prisma.purchaseOrder.create({
    data: {
      id: purchaseOrderB,
      tenantId: tenantB.id,
      poNumber: "PO-ISO-B",
      supplierId: "supplier-b",
      supplierName: "Tenant B Supplier",
      supplierEmail: "supplier-b@example.com",
      status: "ISSUED",
      totalAmount: 2_000,
      warehouseId: "wh-b",
      warehouseName: "Tenant B Warehouse",
      leadTimeDays: 5,
      issueDate: now,
      expectedDeliveryDate: new Date(now.getTime() + 172_800_000),
      createdAt: now,
      updatedAt: now,
      items: {
        create: [
          {
            productId: "product-b",
            productName: "Tenant B Product",
            sku: "ISO-B-SKU",
            quantity: 2,
            unitCost: 1_000,
            totalCost: 2_000,
          },
        ],
      },
    },
  });

  await prisma.inventorySnapshot.createMany({
    data: [
      { tenantId: tenantA.id, date: today, value: STORE_ISOLATION.values.inventoryA },
      { tenantId: tenantB.id, date: today, value: STORE_ISOLATION.values.inventoryB },
    ],
  });

  await prisma.reportSchedule.createMany({
    data: [
      {
        tenantId: tenantA.id,
        frequency: "WEEKLY",
        recipients: ["tenant-a-reports@example.com"],
        metrics: { gmv: true, topProducts: true, forecast: false, channelBreakdown: true },
        isActive: true,
        timeOfDay: "08:00",
      },
      {
        tenantId: tenantB.id,
        frequency: "MONTHLY",
        recipients: ["tenant-b-reports@example.com"],
        metrics: { gmv: true, topProducts: false, forecast: true, channelBreakdown: false },
        isActive: false,
        timeOfDay: "09:30",
      },
    ],
  });

  await prisma.webhookDlqEntry.createMany({
    data: [
      {
        id: dlqA,
        tenantId: tenantA.id,
        platform: "shopify",
        event: "orders.create",
        headers: { "x-isolation-tenant": "a" },
        payload: { marker: "tenant-a-payload" },
        errorMessage: "Tenant A signature failure",
        status: "FAILED",
        transient: false,
        createdAt: now,
        lastAttemptAt: now,
      },
      {
        id: dlqB,
        tenantId: tenantB.id,
        platform: "tiktok",
        event: "order.created",
        headers: { "x-isolation-tenant": "b" },
        payload: { marker: "tenant-b-payload" },
        errorMessage: "Tenant B signature failure",
        status: "FAILED",
        transient: false,
        createdAt: now,
        lastAttemptAt: now,
      },
    ],
  });

  await prisma.chatChannel.createMany({
    data: [
      {
        id: chatChannelA,
        tenantId: tenantA.id,
        name: "Tenant A Operations",
        platform: "slack",
        webhookUrl: "https://example.com/hooks/tenant-a",
        channelName: "#tenant-a",
        enabledEvents: ["stockout"],
        status: "ACTIVE",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: chatChannelB,
        tenantId: tenantB.id,
        name: "Tenant B Finance",
        platform: "discord",
        webhookUrl: "https://example.com/hooks/tenant-b",
        channelName: "#tenant-b",
        enabledEvents: ["vip_order"],
        status: "ACTIVE",
        createdAt: now,
        updatedAt: now,
      },
    ],
  });

  await prisma.chatAlertRule.createMany({
    data: [
      {
        tenantId: tenantA.id,
        stockoutDoiThreshold: 7,
        vipOrderMinAmount: 500,
        dailyDigestTime: "09:00",
        dailyDigestEnabled: true,
      },
      {
        tenantId: tenantB.id,
        stockoutDoiThreshold: 14,
        vipOrderMinAmount: 1_000,
        dailyDigestTime: "17:00",
        dailyDigestEnabled: false,
      },
    ],
  });

  await prisma.chatDeliveryLog.createMany({
    data: [
      {
        id: chatDeliveryA,
        tenantId: tenantA.id,
        channelId: chatChannelA,
        platform: "slack",
        event: "stockout",
        status: "SIMULATED",
        statusCode: 200,
        durationMs: 42,
        payloadPreview: "tenant-a-delivery",
        createdAt: now,
      },
      {
        id: chatDeliveryB,
        tenantId: tenantB.id,
        channelId: chatChannelB,
        platform: "discord",
        event: "vip_order",
        status: "SIMULATED",
        statusCode: 200,
        durationMs: 43,
        payloadPreview: "tenant-b-delivery",
        createdAt: now,
      },
    ],
  });

  return {
    ...STORE_ISOLATION,
    tenantAId: tenantA.id,
    tenantBId: tenantB.id,
    inventoryDay: today,
  };
}

// Compatible with both direct tsx execution and Playwright importing this
// module: no import.meta, which is not available in the test runner's CJS
// transform.
const isMain = process.argv[1]?.includes("seed-tenant-store-isolation");
if (isMain) {
  seedTenantStoreIsolation()
    .then((result) => console.log(JSON.stringify(result)))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
