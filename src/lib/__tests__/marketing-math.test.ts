import { describe, it, expect } from "vitest";
import {
  calculateROAS,
  calculateBreakEvenROAS,
  calculateCPA,
  calculateCPAFromCPC,
  calculateTargetPriceMVP,
  calculateUnitEconomics,
  modelAcquisitionFlowdown,
} from "../marketing-math";

describe("Performance Marketing & Unit Economics Math Engine", () => {
  it("calculates ROAS accurately (Revenue / Ad Spend)", () => {
    // $10,000 revenue with $2,500 ad spend = 4.0x ROAS
    expect(calculateROAS(10000, 2500)).toBe(4.0);
    // Edge cases
    expect(calculateROAS(1000, 0)).toBe(999);
    expect(calculateROAS(0, 500)).toBe(0);
  });

  it("calculates Break-Even ROAS = 1 / Gross Margin % = Price / (Price - COGS)", () => {
    // Price $100, COGS $40 -> Gross Profit $60 -> Margin 60% (0.6)
    // Break-Even ROAS = 100 / 60 = 1.67x
    expect(calculateBreakEvenROAS(100, 40)).toBe(1.67);

    // Price $50, COGS $25 -> Margin 50% -> BE ROAS = 2.0x
    expect(calculateBreakEvenROAS(50, 25)).toBe(2.0);

    // Price $100, COGS $100 -> Impossible to break even (999)
    expect(calculateBreakEvenROAS(100, 100)).toBe(999);
  });

  it("calculates CPA = Ad Spend / Conversions or CPC / CVR", () => {
    // $1,000 spend / 40 orders = $25 CPA
    expect(calculateCPA(1000, 40)).toBe(25);

    // CPC $0.75 / CVR 3% (0.03) = $25 CPA
    expect(calculateCPAFromCPC(0.75, 0.03)).toBe(25);
  });

  it("calculates MVP Target Price = (COGS + CPA + Target Profit) / (1 - Variable Fee %)", () => {
    // COGS = $30, CPA = $20, Target Profit = $15, Variable Fee = 5% (0.05)
    // Numerator = 30 + 20 + 15 = 65
    // Denominator = 1 - 0.05 = 0.95
    // Target Price = 65 / 0.95 = 68.42
    expect(calculateTargetPriceMVP(30, 20, 15, 0.05)).toBe(68.42);

    // 0 profit, 0 fee -> Price equals COGS + CPA
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

    expect(res.roas).toBe(4.0); // 80 * 120 = 9600 / 2400 = 4.0
    expect(res.breakEvenROAS).toBe(1.43); // 120 / (120 - 36) = 1.43
    expect(res.cpa).toBe(30); // 2400 / 80 = 30
    expect(res.isViable).toBe(true);
    expect(res.status).toBe("HIGHLY_PROFITABLE");
    expect(res.contributionMarginDollars).toBeGreaterThan(0);
  });

  it("models full acquisition flow-down to contribution margin", () => {
    const funnel = modelAcquisitionFlowdown({
      impressions: 100000,
      ctr: 0.02, // 2,000 clicks
      cpc: 0.8, // $1,600 ad spend
      conversionRate: 0.03, // 60 conversions
      aov: 95, // $5,700 gross revenue
      unitCogs: 28, // $1,680 total cogs
      variableFeePercent: 0.03, // $171 variable fees
      targetProfitPerOrder: 20,
    });

    expect(funnel.clicks).toBe(2000);
    expect(funnel.adSpend).toBe(1600);
    expect(funnel.conversions).toBe(60);
    expect(funnel.revenue).toBe(5700);
    expect(funnel.roas).toBe(3.56);
    expect(funnel.contributionMargin).toBe(2249); // 5700 - 1600 - 1680 - 171
    expect(funnel.status).toBe("HIGHLY_PROFITABLE");
  });
});
