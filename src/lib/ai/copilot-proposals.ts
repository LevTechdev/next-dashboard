import { prisma } from "@/lib/db";
import { createPurchaseOrder } from "@/lib/purchase-orders-store";

export type CopilotActionType =
  "CREATE_DISCOUNT" | "CREATE_PURCHASE_ORDER" | "TRIGGER_ALERT" | "EXPORT_REPORT";

export interface CopilotActionProposal {
  id: string;
  type: CopilotActionType;
  title: string;
  description: string;
  estimatedImpact: string;
  payload: Record<string, any>;
  status: "pending" | "executed" | "cancelled";
  createdAt: string;
}

/**
 * Creates a structured Win-Back discount proposal for at-risk customers.
 */
export function createWinBackDiscountProposal(params?: {
  discountPercent?: number;
  customerCount?: number;
  code?: string;
}): CopilotActionProposal {
  const percent = params?.discountPercent || 15;
  const count = params?.customerCount || 5;
  const code =
    params?.code || `WINBACK${percent}-${Date.now().toString(36).slice(-4).toUpperCase()}`;

  return {
    id: `prop-disc-${Date.now().toString(36)}`,
    type: "CREATE_DISCOUNT",
    title: `Launch ${percent}% VIP Win-Back Discount (${code})`,
    description: `Automated campaign targeted at ${count} high-value customers at risk of churning. Grants ${percent}% off valid for 14 days.`,
    estimatedImpact: `Est. \$2,400 recovered revenue; ~18% reactivation conversion.`,
    payload: {
      code,
      name: `VIP Win-Back Special (${percent}% OFF)`,
      description: `Targeted re-engagement voucher for inactive high-LTV accounts`,
      type: "PERCENTAGE",
      value: percent,
      minPurchase: 50,
      durationDays: 14,
    },
    status: "pending",
    createdAt: new Date().toISOString(),
  };
}

/**
 * Creates a structured Replenishment PO proposal for low stock items.
 */
export function createReplenishmentPoProposal(params?: {
  supplierId?: string;
  items?: Array<{
    productId: string;
    productName: string;
    sku: string;
    quantity: number;
    unitCost: number;
  }>;
  warehouseId?: string;
}): CopilotActionProposal {
  const items = params?.items || [
    {
      productId: "prod-001",
      productName: "Classic Oxford Cotton Shirt",
      sku: "SHIRT-OXF-001",
      quantity: 150,
      unitCost: 125000,
    },
  ];
  const totalUnits = items.reduce((sum, i) => sum + i.quantity, 0);

  return {
    id: `prop-po-${Date.now().toString(36)}`,
    type: "CREATE_PURCHASE_ORDER",
    title: `Issue Replenishment PO for ${totalUnits} Units`,
    description: `Restock critical low-stock items (<7 DOI) via Apex Manufacturing to prevent imminent stockout.`,
    estimatedImpact: `Prevents \$4,200 in projected lost sales over the next 3 weeks.`,
    payload: {
      supplierId: params?.supplierId || "sup-001",
      warehouseId: params?.warehouseId || "wh-jkt",
      items,
      notes: "Auto-generated via Autonomous AI Executive Copilot replenishment alert.",
    },
    status: "pending",
    createdAt: new Date().toISOString(),
  };
}

/**
 * Executes an approved action proposal inside PostgreSQL / JSON store.
 */
export async function executeCopilotAction(
  proposal: CopilotActionProposal,
  tenantId: string | null,
  userId: string,
): Promise<{ success: boolean; message: string; resultId?: string; details?: any }> {
  const { type, payload } = proposal;

  if (type === "CREATE_DISCOUNT") {
    const startsAt = new Date();
    const endsAt = new Date(Date.now() + (payload.durationDays || 14) * 86400000);

    // Ensure code uniqueness
    let finalCode = (payload.code as string).toUpperCase();
    const existing = await prisma.discount.findUnique({ where: { code: finalCode } });
    if (existing) {
      finalCode = `${finalCode}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    }

    const discount = await prisma.discount.create({
      data: {
        code: finalCode,
        name: payload.name || "AI Generated Discount",
        description: payload.description || "Executive Copilot Action Proposal",
        type: payload.type || "PERCENTAGE",
        value: Number(payload.value) || 15,
        minPurchase: Number(payload.minPurchase) || 0,
        startsAt,
        endsAt,
        isActive: true,
        tenantId,
      },
    });

    await prisma.activityLog.create({
      data: {
        action: "AI_COPILOT_ACTION",
        entity: "Discount",
        entityId: discount.id,
        details: `Executed AI proposal: Created discount ${discount.code} (${discount.value}%)`,
        tenantId,
        userId,
      },
    });

    return {
      success: true,
      message: `Discount ${discount.code} created successfully!`,
      resultId: discount.id,
      details: discount,
    };
  }

  if (type === "CREATE_PURCHASE_ORDER") {
    const po = createPurchaseOrder({
      supplierId: payload.supplierId || "sup-001",
      warehouseId: payload.warehouseId || "wh-jkt",
      items: payload.items || [],
      notes: payload.notes || "Executed via AI Executive Copilot",
    });

    await prisma.activityLog.create({
      data: {
        action: "AI_COPILOT_ACTION",
        entity: "PurchaseOrder",
        entityId: po.id,
        details: `Executed AI proposal: Created Purchase Order ${po.poNumber} for ${po.supplierName}`,
        tenantId,
        userId,
      },
    });

    return {
      success: true,
      message: `Purchase Order ${po.poNumber} created and issued!`,
      resultId: po.id,
      details: po,
    };
  }

  // Fallback for alerts or reports
  await prisma.activityLog.create({
    data: {
      action: "AI_COPILOT_ACTION",
      entity: "ActionProposal",
      entityId: proposal.id,
      details: `Executed AI proposal: ${proposal.title}`,
      tenantId,
      userId,
    },
  });

  return {
    success: true,
    message: `Action proposal executed successfully!`,
    resultId: proposal.id,
  };
}
