/**
 * Performance Marketing & Unit Economics Math Engine
 *
 * Core Formulas:
 * 1. ROAS (Return on Ad Spend):
 *    ROAS = Total Revenue / Ad Spend
 *    or Target Margin Multiplier = ROAS / Target Margin Multiplier
 *
 * 2. Break-Even ROAS:
 *    Break-Even ROAS = 1 / Gross Margin % = Price / (Price - COGS)
 *
 * 3. CPA / CAC (Cost Per Acquisition / Customer Acquisition Cost):
 *    CPA = Ad Spend / Conversions = CPC / Conversion Rate
 *
 * 4. MVP (Minimum Viable Price / Target Price for Target Profit per Order):
 *    Target Price = (COGS + CPA + Target Profit per Order) / (1 - Variable Fee %)
 *
 * 5. Contribution Margin & Acquisition Flow-down:
 *    Contribution Margin = Revenue - Ad Spend - Total COGS - Variable Fees
 */

export interface UnitEconomicsInput {
  price: number;
  cogs: number;
  adSpend: number;
  conversions: number;
  totalRevenue?: number;
  cpc?: number;
  conversionRate?: number; // as decimal e.g. 0.03 for 3%
  variableFeePercent?: number; // as decimal e.g. 0.029 for 2.9%
  targetProfitPerOrder?: number;
}

export interface UnitEconomicsResult {
  roas: number; // e.g. 4.2x
  grossMarginPercent: number; // e.g. 0.65 (65%)
  grossProfitPerUnit: number;
  breakEvenROAS: number; // e.g. 1.54x
  cpa: number; // e.g. $25.00
  targetPriceMVP: number; // e.g. $78.50
  contributionMarginDollars: number;
  contributionMarginPercent: number;
  isViable: boolean;
  status: "HIGHLY_PROFITABLE" | "BREAK_EVEN" | "UNPROFITABLE";
  recommendations: string[];
}

export interface FunnelFlowdownInput {
  impressions: number;
  ctr: number; // click-through-rate as decimal (e.g. 0.02 = 2%)
  cpc: number; // cost per click (e.g. $0.75)
  conversionRate: number; // visit to purchase rate (e.g. 0.035 = 3.5%)
  aov: number; // average order value / price (e.g. $120)
  unitCogs: number; // cost of goods sold per order (e.g. $36)
  variableFeePercent?: number; // payment gateway + platform fee (e.g. 0.03 = 3%)
  targetProfitPerOrder?: number; // e.g. $25
}

export interface FunnelFlowdownResult {
  clicks: number;
  adSpend: number;
  conversions: number;
  cpa: number;
  revenue: number;
  totalCogs: number;
  variableFees: number;
  contributionMargin: number;
  contributionMarginPercent: number;
  roas: number;
  breakEvenROAS: number;
  targetPriceMVP: number;
  status: "HIGHLY_PROFITABLE" | "BREAK_EVEN" | "UNPROFITABLE";
}

/**
 * 1. Calculate Return on Ad Spend (ROAS)
 * ROAS = Total Revenue / Ad Spend
 */
export function calculateROAS(totalRevenue: number, adSpend: number): number {
  if (adSpend <= 0) return totalRevenue > 0 ? 999 : 0;
  return Number((totalRevenue / adSpend).toFixed(2));
}

/**
 * 2. Calculate Break-Even ROAS
 * Break-Even ROAS = 1 / Gross Margin % = Price / (Price - COGS)
 */
export function calculateBreakEvenROAS(price: number, cogs: number): number {
  const margin = price - cogs;
  if (margin <= 0) return 999; // impossible to break even if COGS >= Price
  return Number((price / margin).toFixed(2));
}

/**
 * 3. Calculate CPA (Cost per Acquisition)
 * CPA = Ad Spend / Conversions = CPC / Conversion Rate
 */
export function calculateCPA(adSpend: number, conversions: number): number {
  if (conversions <= 0) return adSpend;
  return Number((adSpend / conversions).toFixed(2));
}

export function calculateCPAFromCPC(cpc: number, conversionRate: number): number {
  if (conversionRate <= 0) return 999;
  return Number((cpc / conversionRate).toFixed(2));
}

/**
 * 4. Calculate MVP (Minimum Viable Price / Target Price for Target Profit)
 * Target Price = (COGS + CPA + Target Profit per Order) / (1 - Variable Fee %)
 */
export function calculateTargetPriceMVP(
  cogs: number,
  cpa: number,
  targetProfitPerOrder: number = 0,
  variableFeePercent: number = 0.03,
): number {
  const numerator = cogs + cpa + targetProfitPerOrder;
  const denominator = 1 - variableFeePercent;
  if (denominator <= 0) return numerator;
  return Number((numerator / denominator).toFixed(2));
}

/**
 * Full Unit Economics Calculation
 */
export function calculateUnitEconomics(input: UnitEconomicsInput): UnitEconomicsResult {
  const {
    price,
    cogs,
    adSpend,
    conversions,
    variableFeePercent = 0.03,
    targetProfitPerOrder = 15,
  } = input;

  const totalRevenue = input.totalRevenue ?? (conversions > 0 ? conversions * price : price);
  const roas = calculateROAS(totalRevenue, adSpend);
  const grossProfitPerUnit = Math.max(0, price - cogs);
  const grossMarginPercent = price > 0 ? grossProfitPerUnit / price : 0;
  const breakEvenROAS = calculateBreakEvenROAS(price, cogs);

  const cpa =
    conversions > 0
      ? calculateCPA(adSpend, conversions)
      : input.cpc && input.conversionRate
        ? calculateCPAFromCPC(input.cpc, input.conversionRate)
        : adSpend;

  const targetPriceMVP = calculateTargetPriceMVP(
    cogs,
    cpa,
    targetProfitPerOrder,
    variableFeePercent,
  );

  const totalCogs = cogs * (conversions || 1);
  const variableFees = totalRevenue * variableFeePercent;
  const contributionMarginDollars = Number(
    (totalRevenue - adSpend - totalCogs - variableFees).toFixed(2),
  );
  const contributionMarginPercent =
    totalRevenue > 0 ? Number(((contributionMarginDollars / totalRevenue) * 100).toFixed(1)) : 0;

  const isViable = roas >= breakEvenROAS && contributionMarginDollars > 0;

  let status: UnitEconomicsResult["status"] = "UNPROFITABLE";
  if (roas >= breakEvenROAS * 1.3 && contributionMarginPercent >= 15) {
    status = "HIGHLY_PROFITABLE";
  } else if (roas >= breakEvenROAS && contributionMarginDollars >= 0) {
    status = "BREAK_EVEN";
  }

  const recommendations: string[] = [];
  if (roas < breakEvenROAS) {
    recommendations.push(
      `Current ROAS (${roas}x) is below your Break-Even threshold (${breakEvenROAS}x). You are losing money on paid acquisition.`,
    );
    if (price < targetPriceMVP) {
      recommendations.push(
        `Consider increasing average selling price from $${price.toFixed(2)} toward the MVP target price of $${targetPriceMVP.toFixed(2)} to cover acquisition costs.`,
      );
    }
  } else {
    recommendations.push(
      `Healthy unit economics: current ROAS (${roas}x) exceeds Break-Even (${breakEvenROAS}x) by ${Number((roas - breakEvenROAS).toFixed(2))}x.`,
    );
    recommendations.push(
      `Contribution margin of $${contributionMarginDollars.toLocaleString()} (${contributionMarginPercent}%) supports scaling ad budgets safely.`,
    );
  }

  return {
    roas,
    grossMarginPercent: Number((grossMarginPercent * 100).toFixed(1)),
    grossProfitPerUnit,
    breakEvenROAS,
    cpa,
    targetPriceMVP,
    contributionMarginDollars,
    contributionMarginPercent,
    isViable,
    status,
    recommendations,
  };
}

/**
 * 5. Model Full Acquisition Flow-Down
 */
export function modelAcquisitionFlowdown(input: FunnelFlowdownInput): FunnelFlowdownResult {
  const {
    impressions,
    ctr,
    cpc,
    conversionRate,
    aov,
    unitCogs,
    variableFeePercent = 0.03,
    targetProfitPerOrder = 20,
  } = input;

  const clicks = Math.round(impressions * ctr);
  const adSpend = Number((clicks * cpc).toFixed(2));
  const conversions = Math.round(clicks * conversionRate);
  const cpa = conversions > 0 ? Number((adSpend / conversions).toFixed(2)) : adSpend;
  const revenue = Number((conversions * aov).toFixed(2));
  const totalCogs = Number((conversions * unitCogs).toFixed(2));
  const variableFees = Number((revenue * variableFeePercent).toFixed(2));
  const contributionMargin = Number((revenue - adSpend - totalCogs - variableFees).toFixed(2));
  const contributionMarginPercent =
    revenue > 0 ? Number(((contributionMargin / revenue) * 100).toFixed(1)) : 0;

  const roas = calculateROAS(revenue, adSpend);
  const breakEvenROAS = calculateBreakEvenROAS(aov, unitCogs);
  const targetPriceMVP = calculateTargetPriceMVP(
    unitCogs,
    cpa,
    targetProfitPerOrder,
    variableFeePercent,
  );

  let status: FunnelFlowdownResult["status"] = "UNPROFITABLE";
  if (roas >= breakEvenROAS * 1.25 && contributionMargin > 0) {
    status = "HIGHLY_PROFITABLE";
  } else if (roas >= breakEvenROAS && contributionMargin >= 0) {
    status = "BREAK_EVEN";
  }

  return {
    clicks,
    adSpend,
    conversions,
    cpa,
    revenue,
    totalCogs,
    variableFees,
    contributionMargin,
    contributionMarginPercent,
    roas,
    breakEvenROAS,
    targetPriceMVP,
    status,
  };
}
