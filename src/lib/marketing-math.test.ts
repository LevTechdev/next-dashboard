import { describe, it, expect } from "vitest";
import {
  calculateROAS,
  calculateBreakEvenROAS,
  calculateCPA,
  calculateCPAFromCPC,
  calculateTargetPriceMVP,
  calculateUnitEconomics,
  modelAcquisitionFlowdown,
} from "./marketing-math";

describe("Performance Marketing & Unit Economics Math Engine", () => {
  it("calculates ROAS accurately (Revenue / Ad Spend)", () => {
    expect(calculateROAS(10000, 2500)).toBe(4.0);
    expect(calculateROAS(1000, 0)).toBe(999);
    expect(calculateROAS(0, 500)).toBe(0);
  });

  it("calculates Break-Even ROAS = 1 / Gross Margin % = Price / (Price - COGS)", () => {
    expect(calculateBreakEvenROAS(100, 40)).toBe(1.67);
    expect(calculateBreakEvenROAS(50, 25)).toBe(2.0);
    expect(calculateBreakEvenROAS(100, 100)).toBe(999);
  });

  it("calculates CPA = Ad Spend / Conversions or CPC / CVR", () => {
    expect(calculateCPA(1000, 40)).toBe(25);
    expect(calculateCPAFromCPC(0.75, 0.03)).toBe(25);
  });

  it("calculates MVP Target Price = (COGS + CPA + Target Profit) / (1 - Variable Fee %)", () => {
    expect(calculateTargetPriceMVP(30, 20, 15, 0.05)).toBe(68.42);
    expect(calculateTargetPriceMVP(40, 10, 0, 0)).toBe(50);
  });

  it("computes full unit economics with viability status", () => {
    const res = calculateUnitEconomics({
      price: 120,
      cogs: 36,
      adSpend: 2400,
      conversions: 80,
      variableFeePercent: 0.03,
      targetProfitPerOrder: 25,
    });

    expect(res.roas).toBe(4.0);
    expect(res.breakEvenROAS).toBe(1.43);
    expect(res.cpa).toBe(30);
    expect(res.isViable).toBe(true);
    expect(res.status).toBe("HIGHLY_PROFITABLE");
    expect(res.contributionMarginDollars).toBeGreaterThan(0);
  });

  it("models full acquisition flow-down to contribution margin", () => {
    const funnel = modelAcquisitionFlowdown({
      impressions: 100000,
      ctr: 0.02,
      cpc: 0.8,
      conversionRate: 0.03,
      aov: 95,
      unitCogs: 28,
      variableFeePercent: 0.03,
      targetProfitPerOrder: 20,
    });

    expect(funnel.clicks).toBe(2000);
    expect(funnel.adSpend).toBe(1600);
    expect(funnel.conversions).toBe(60);
    expect(funnel.revenue).toBe(5700);
    expect(funnel.roas).toBe(3.56);
    expect(funnel.contributionMargin).toBe(2249);
    expect(funnel.status).toBe("HIGHLY_PROFITABLE");
  });
});
