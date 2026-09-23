import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createWinBackDiscountProposal,
  createReplenishmentPoProposal,
  executeCopilotAction,
} from "@/lib/ai/copilot-proposals";
import { prisma } from "@/lib/db";

vi.mock("@/lib/db", () => ({
  prisma: {
    discount: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockImplementation(({ data }) =>
        Promise.resolve({
          id: "disc-test-123",
          code: data.code,
          name: data.name,
          value: data.value,
          isActive: true,
        }),
      ),
    },
    activityLog: {
      create: vi.fn().mockResolvedValue({ id: "log-1" }),
    },
  },
}));

describe("Copilot Action Proposals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("generates a valid win-back discount proposal", () => {
    const proposal = createWinBackDiscountProposal({ discountPercent: 20, customerCount: 8 });
    expect(proposal.type).toBe("CREATE_DISCOUNT");
    expect(proposal.payload.value).toBe(20);
    expect(proposal.status).toBe("pending");
    expect(proposal.title).toContain("20%");
  });

  it("generates a valid replenishment purchase order proposal", () => {
    const proposal = createReplenishmentPoProposal({
      supplierId: "sup-001",
      warehouseId: "wh-jkt",
    });
    expect(proposal.type).toBe("CREATE_PURCHASE_ORDER");
    expect(proposal.payload.supplierId).toBe("sup-001");
    expect(proposal.payload.items.length).toBeGreaterThan(0);
    expect(proposal.status).toBe("pending");
  });

  it("executes discount proposal and persists to database", async () => {
    const proposal = createWinBackDiscountProposal({ discountPercent: 15, code: "TESTDISC" });
    const result = await executeCopilotAction(proposal, "default", "user-test");
    expect(result.success).toBe(true);
    expect(result.resultId).toBe("disc-test-123");
    expect(prisma.discount.create).toHaveBeenCalled();
  });

  it("executes purchase order proposal", async () => {
    const proposal = createReplenishmentPoProposal();
    const result = await executeCopilotAction(proposal, "default", "user-test");
    expect(result.success).toBe(true);
    expect(result.resultId).toBeDefined();
    expect(result.message).toContain("Purchase Order");
  });
});
