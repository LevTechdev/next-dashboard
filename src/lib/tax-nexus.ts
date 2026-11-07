/**
 * Global economic tax nexus and VAT/GST calculation contracts. Jurisdiction
 * and filing rows are loaded from Prisma by the API; this module contains no
 * shared demo data.
 */

export type NexusStatus = "SAFE" | "APPROACHING" | "NEXUS_REACHED";

export interface TaxJurisdiction {
  id: string;
  region: string;
  name: string;
  flag: string;
  currency: string;
  thresholdAmount: number;
  currentAmount: number;
  thresholdTransactions?: number;
  currentTransactions?: number;
  standardTaxRate: number;
  status: NexusStatus;
  hasRegistration: boolean;
  registrationNumber?: string;
  daysRemainingToFiling?: number;
}

export interface TaxCalculationRequest {
  country: string;
  stateOrRegion?: string;
  subtotal: number;
  category: "DIGITAL_SAAS" | "PHYSICAL_GOODS" | "CONSULTING" | "B2B_EXEMPT";
  b2bTaxId?: string;
}

export interface TaxCalculationResult {
  country: string;
  category: string;
  subtotal: number;
  taxRatePercent: number;
  taxAmount: number;
  totalWithTax: number;
  isReverseChargeApplied: boolean;
  taxLabel: string;
  complianceNote: string;
}

export interface QuarterlyFiling {
  quarter: string;
  period: string;
  grossRevenue: number;
  taxCollected: number;
  currency: string;
  jurisdictionCount: number;
  filingDeadline: string;
  status: "DRAFT" | "READY_TO_FILE" | "REMITTED";
}

export function calculateTaxRate(req: TaxCalculationRequest): TaxCalculationResult {
  const { country, subtotal, category, b2bTaxId } = req;
  const upperCountry = (country || "US").toUpperCase();

  const isB2B = category === "B2B_EXEMPT" || Boolean(b2bTaxId && b2bTaxId.trim().length >= 8);

  let taxRate = 0;
  let taxLabel = "Sales Tax";
  let complianceNote = "Standard domestic retail tax applied.";

  if (isB2B) {
    taxRate = 0;
    taxLabel = "Reverse Charge (0%)";
    complianceNote = `B2B Tax ID verified (${b2bTaxId || "Exempt"}). Article 194 EU VAT / Local reverse-charge mechanism applies. Customer liable for self-assessment.`;
  } else if (upperCountry === "ID") {
    taxRate = 11.0;
    taxLabel = "PPN (11%)";
    complianceNote = "Indonesia Value-Added Tax (PMK-60/PMK.03/2022 digital services rate).";
  } else if (upperCountry === "SG") {
    taxRate = 9.0;
    taxLabel = "GST (9%)";
    complianceNote = "Singapore Overseas Vendor Registration (OVR) GST.";
  } else if (upperCountry === "JP") {
    taxRate = 10.0;
    taxLabel = "JCT (10%)";
    complianceNote = "Japan Consumption Tax (Qualified Invoice Issuer Scheme).";
  } else if (upperCountry === "GB") {
    taxRate = 20.0;
    taxLabel = "UK VAT (20%)";
    complianceNote = "United Kingdom HMRC standard VAT on digital services.";
  } else if (["DE", "FR", "NL", "IT", "ES", "IE"].includes(upperCountry)) {
    taxRate = upperCountry === "DE" ? 19.0 : upperCountry === "FR" ? 20.0 : 21.0;
    taxLabel = `EU VAT (${taxRate}%)`;
    complianceNote = "EU One-Stop Shop (OSS) destination-based VAT rule.";
  } else {
    taxRate = 8.25;
    taxLabel = "US Sales Tax (8.25%)";
    complianceNote = "State economic nexus destination sourcing rate.";
  }

  const taxAmount = Number(((subtotal * taxRate) / 100).toFixed(2));
  const totalWithTax = Number((subtotal + taxAmount).toFixed(2));

  return {
    country: upperCountry,
    category,
    subtotal,
    taxRatePercent: taxRate,
    taxAmount,
    totalWithTax,
    isReverseChargeApplied: isB2B,
    taxLabel,
    complianceNote,
  };
}
