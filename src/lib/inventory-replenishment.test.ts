import { describe, it, expect } from "vitest";
import {
  calculateSalesVelocity,
  calculateDaysOfInventory,
  calculateReorderPoint,
  assessStockoutRisk,
  calculateSuggestedReorderQty,
  generatePoNumber,
} from "./inventory-replenishment";

describe("Inventory Replenishment & Supply Chain Math", () => {
  it("calculates sales velocity correctly", () => {
    expect(calculateSalesVelocity(90, 30)).toBe(3.0);
    expect(calculateSalesVelocity(45, 30)).toBe(1.5);
    expect(calculateSalesVelocity(0, 30)).toBe(0);
    expect(calculateSalesVelocity(50, 0)).toBe(0);
  });

  it("calculates days of inventory (DOI)", () => {
    expect(calculateDaysOfInventory(30, 3)).toBe(10);
    expect(calculateDaysOfInventory(0, 3)).toBe(0);
    expect(calculateDaysOfInventory(100, 0)).toBe(999);
  });

  it("calculates reorder point (ROP)", () => {
    // 3 units/day * (7 lead + 5 safety = 12) = 36 units
    expect(calculateReorderPoint(3, 7, 5)).toBe(36);
    expect(calculateReorderPoint(0, 7, 5)).toBe(0);
  });

  it("assesses stockout risk properly", () => {
    expect(assessStockoutRisk(0, 0, 7)).toBe("CRITICAL");
    expect(assessStockoutRisk(5, 2, 7)).toBe("CRITICAL");
    expect(assessStockoutRisk(20, 6, 7)).toBe("WARNING");
    expect(assessStockoutRisk(100, 30, 7)).toBe("HEALTHY");
  });

  it("calculates suggested reorder quantity respecting MOQ", () => {
    // Current stock: 10, ROP: 36, Target: 36 * 1.5 = 54, Needed: 44. MOQ = 50 -> returns 50
    expect(calculateSuggestedReorderQty(10, 36, 50, 1.5)).toBe(50);

    // Current stock: 5, ROP: 60, Target: 90, Needed: 85 -> rounded to 90
    expect(calculateSuggestedReorderQty(5, 60, 50, 1.5)).toBe(90);

    // Stock exceeds target -> 0
    expect(calculateSuggestedReorderQty(100, 36, 50, 1.5)).toBe(0);
  });

  it("formats PO numbers correctly", () => {
    const year = new Date().getFullYear();
    expect(generatePoNumber(1)).toBe(`PO-${year}-0001`);
    expect(generatePoNumber(125)).toBe(`PO-${year}-0125`);
  });
});
