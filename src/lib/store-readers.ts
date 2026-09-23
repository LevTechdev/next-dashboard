/**
 * Read-only loaders for the operational stores backed by Prisma.
 *
 * Kept separate from the write-path stores so the health endpoint (and tests
 * that mock the DB client) never loads the write path transitively. Every
 * loader is defensive: a DB failure surfaces as null/[] rather than throwing,
 * and rows are converted into the exact JSON shapes the legacy stores served
 * (ISO date strings, optional-null collapsed to undefined) so all existing
 * consumers — API routes, PDF/invoice renderers, SSE payloads — keep working.
 */

import { prisma } from "@/lib/db";

/** Date | null → ISO string | undefined (JSON-store shape). */
function iso(d: Date | null | undefined): string | undefined {
  return d ? d.toISOString() : undefined;
}

// ─── QRIS ledger ─────────────────────────────────────────────────────────────

export async function loadQrisLedgerSnapshot(): Promise<{
  availableBalance: number;
  pendingBalance: number;
  totalWithdrawn: number;
  totalInbound: number;
  transactions: Record<string, unknown>[];
  disbursements: Record<string, unknown>[];
} | null> {
  try {
    const [balances, txRows, disbRows] = await Promise.all([
      prisma.qrisLedgerBalance.findUnique({ where: { id: "singleton" } }),
      prisma.qrisTransaction.findMany({ orderBy: { seq: "desc" } }),
      prisma.qrisDisbursement.findMany({ orderBy: { seq: "desc" } }),
    ]);
    if (!balances) return null;
    return {
      availableBalance: balances.availableBalance,
      pendingBalance: balances.pendingBalance,
      totalWithdrawn: balances.totalWithdrawn,
      totalInbound: balances.totalInbound,
      transactions: txRows.map((t) => ({
        id: t.id,
        invoiceNumber: t.invoiceNumber,
        amount: t.amount,
        currency: t.currency,
        customerName: t.customerName,
        sourceBank: t.sourceBank,
        status: t.status,
        qrisPayload: t.qrisPayload,
        createdAt: t.createdAt.toISOString(),
        paidAt: iso(t.paidAt),
        rrn: t.rrn,
      })),
      disbursements: disbRows.map((d) => ({
        id: d.id,
        disbursementNumber: d.disbursementNumber,
        method: d.method,
        destinationName: d.destinationName,
        destinationAccount: d.destinationAccount,
        bankCode: d.bankCode ?? undefined,
        cardType: d.cardType ?? undefined,
        grossAmount: d.grossAmount,
        fee: d.fee,
        netAmount: d.netAmount,
        status: d.status,
        referenceNumber: d.referenceNumber,
        timestamp: d.timestamp.toISOString(),
        notes: d.notes ?? undefined,
        destinationCurrency: d.destinationCurrency ?? undefined,
        fxRate: d.fxRate ?? undefined,
        destinationAmount: d.destinationAmount ?? undefined,
      })),
    };
  } catch {
    return null;
  }
}

// ─── Purchase orders ─────────────────────────────────────────────────────────

export async function loadPurchaseOrders(): Promise<Record<string, unknown>[]> {
  try {
    const rows = await prisma.purchaseOrder.findMany({
      orderBy: { seq: "desc" },
      include: { items: true },
    });
    return rows.map((p) => ({
      id: p.id,
      poNumber: p.poNumber,
      supplierId: p.supplierId,
      supplierName: p.supplierName,
      supplierEmail: p.supplierEmail,
      status: p.status,
      items: p.items.map((it) => ({
        productId: it.productId,
        productName: it.productName,
        sku: it.sku,
        quantity: it.quantity,
        unitCost: it.unitCost,
        totalCost: it.totalCost,
      })),
      totalAmount: p.totalAmount,
      warehouseId: p.warehouseId,
      warehouseName: p.warehouseName,
      leadTimeDays: p.leadTimeDays,
      issueDate: p.issueDate.toISOString(),
      expectedDeliveryDate: p.expectedDeliveryDate.toISOString(),
      receivedDate: p.receivedDate ? p.receivedDate.toISOString() : null,
      notes: p.notes ?? undefined,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    }));
  } catch {
    return [];
  }
}

// ─── Tenant branding ─────────────────────────────────────────────────────────

export async function loadTenantBrandingMap(): Promise<Record<string, unknown>> {
  try {
    const rows = await prisma.tenantBranding.findMany();
    const map: Record<string, unknown> = {};
    for (const b of rows) {
      map[b.tenantId] = {
        tenantId: b.tenantId,
        brandName: b.brandName,
        customDomain: b.customDomain,
        domainStatus: b.domainStatus,
        cnameTarget: b.cnameTarget,
        sslActive: b.sslActive,
        logoUrl: b.logoUrl,
        faviconUrl: b.faviconUrl,
        primaryColor: b.primaryColor,
        accentColor: b.accentColor,
        invoiceHeaderNote: b.invoiceHeaderNote,
        invoiceFooterNote: b.invoiceFooterNote,
        invoiceAddress: b.invoiceAddress,
        taxId: b.taxId,
        emailDigestSubject: b.emailDigestSubject,
        updatedAt: b.updatedAt.toISOString(),
      };
    }
    return map;
  } catch {
    return {};
  }
}

// ─── Inventory snapshots ─────────────────────────────────────────────────────

export async function loadInventorySnapshots(): Promise<{ date: string; value: number }[]> {
  try {
    const rows = await prisma.inventorySnapshot.findMany({ orderBy: { date: "asc" } });
    return rows.map((s) => ({ date: s.date, value: s.value }));
  } catch {
    return [];
  }
}

// ─── Beneficiaries ───────────────────────────────────────────────────────────

export async function loadBeneficiaries(): Promise<Record<string, unknown>[]> {
  try {
    const rows = await prisma.beneficiary.findMany({ orderBy: { lastUsedAt: "desc" } });
    return rows.map((b) => ({
      id: b.id,
      accountNumber: b.accountNumber,
      maskedAccount: b.maskedAccount,
      accountName: b.accountName,
      channel: b.channel,
      bankCode: b.bankCode ?? undefined,
      bankName: b.bankName ?? undefined,
      cardType: b.cardType ?? undefined,
      cardTier: b.cardTier ?? undefined,
      verified: b.verified,
      favorite: b.favorite,
      lastUsedAt: b.lastUsedAt.toISOString(),
      totalDisbursed: b.totalDisbursed,
    }));
  } catch {
    return [];
  }
}

// ─── Webhook DLQ ─────────────────────────────────────────────────────────────

function asJsonObject(value: unknown): Record<string, unknown> {
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return (value as Record<string, unknown>) ?? {};
}

export async function loadDlqEntries(): Promise<Record<string, unknown>[]> {
  try {
    const rows = await prisma.webhookDlqEntry.findMany({ orderBy: { seq: "desc" } });
    return rows.map((d) => ({
      id: d.id,
      platform: d.platform,
      event: d.event,
      headers: asJsonObject(d.headers),
      payload: asJsonObject(d.payload),
      errorMessage: d.errorMessage,
      retryCount: d.retryCount,
      maxRetries: d.maxRetries,
      status: d.status,
      createdAt: d.createdAt.toISOString(),
      lastAttemptAt: d.lastAttemptAt.toISOString(),
      nextRetryAt: iso(d.nextRetryAt),
    }));
  } catch {
    return [];
  }
}

// ─── Chat alerts ─────────────────────────────────────────────────────────────

export interface ChatConfigShape {
  channels: Record<string, unknown>[];
  rules: Record<string, unknown> | null;
  deliveries: Record<string, unknown>[];
}

export async function loadChatConfig(): Promise<ChatConfigShape | null> {
  try {
    const [channelRows, rulesRow, deliveryRows] = await Promise.all([
      prisma.chatChannel.findMany({ orderBy: { createdAt: "asc" } }),
      prisma.chatAlertRule.findUnique({ where: { id: "singleton" } }),
      prisma.chatDeliveryLog.findMany({ orderBy: { seq: "desc" } }),
    ]);
    return {
      channels: channelRows.map((c) => ({
        id: c.id,
        name: c.name,
        platform: c.platform,
        webhookUrl: c.webhookUrl,
        channelName: c.channelName,
        avatarUrl: c.avatarUrl ?? undefined,
        enabledEvents: [...c.enabledEvents],
        status: c.status,
        lastPingAt: c.lastPingAt ? c.lastPingAt.toISOString() : null,
        lastStatus: c.lastStatus,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
      })),
      rules: rulesRow
        ? {
            stockoutDoiThreshold: rulesRow.stockoutDoiThreshold,
            vipOrderMinAmount: rulesRow.vipOrderMinAmount,
            paymentAlertsEnabled: rulesRow.paymentAlertsEnabled,
            dailyDigestTime: rulesRow.dailyDigestTime,
            dailyDigestEnabled: rulesRow.dailyDigestEnabled,
          }
        : null,
      deliveries: deliveryRows.map((d) => ({
        id: d.id,
        channelId: d.channelId,
        platform: d.platform,
        event: d.event,
        status: d.status,
        statusCode: d.statusCode,
        durationMs: d.durationMs,
        payloadPreview: d.payloadPreview,
        responseText: d.responseText ?? undefined,
        createdAt: d.createdAt.toISOString(),
      })),
    };
  } catch {
    return null;
  }
}
