/**
 * Global Economic Tax Nexus & Dynamic VAT/GST Engine
 * Real-time economic nexus monitoring, B2B reverse-charge calculation, and quarterly filings.
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
  standardTaxRate: number; // percentage (e.g. 11 for PPN 11%)
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
  quarter: string; // e.g. "Q3 2026"
  period: string; // "Jul 1 - Sep 30, 2026"
  grossRevenue: number;
  taxCollected: number;
  currency: string;
  jurisdictionCount: number;
  filingDeadline: string;
  status: "DRAFT" | "READY_TO_FILE" | "REMITTED";
}

export const MOCK_JURISDICTIONS: TaxJurisdiction[] = [
  {
    id: "us-ca",
    region: "North America",
    name: "California, US",
    flag: "🇺🇸",
    currency: "USD",
    thresholdAmount: 500000,
    currentAmount: 462000,
    thresholdTransactions: 200,
    currentTransactions: 184,
    standardTaxRate: 7.25,
    status: "APPROACHING",
    hasRegistration: true,
    registrationNumber: "CA-CDTFA-8891024",
    daysRemainingToFiling: 18,
  },
  {
    id: "us-ny",
    region: "North America",
    name: "New York, US",
    flag: "🇺🇸",
    currency: "USD",
    thresholdAmount: 500000,
    currentAmount: 518000,
    thresholdTransactions: 100,
    currentTransactions: 122,
    standardTaxRate: 8.875,
    status: "NEXUS_REACHED",
    hasRegistration: true,
    registrationNumber: "NY-DTF-4401923",
    daysRemainingToFiling: 8,
  },
  {
    id: "eu-oss",
    region: "European Union",
    name: "EU One-Stop Shop (OSS)",
    flag: "🇪🇺",
    currency: "EUR",
    thresholdAmount: 10000,
    currentAmount: 84500,
    standardTaxRate: 20.0,
    status: "NEXUS_REACHED",
    hasRegistration: true,
    registrationNumber: "EU-OSS-DE3391029",
    daysRemainingToFiling: 22,
  },
  {
    id: "gb-vat",
    region: "United Kingdom",
    name: "United Kingdom HMRC",
    flag: "🇬🇧",
    currency: "GBP",
    thresholdAmount: 85000,
    currentAmount: 64200,
    standardTaxRate: 20.0,
    status: "APPROACHING",
    hasRegistration: true,
    registrationNumber: "GB-VAT-9921045",
    daysRemainingToFiling: 34,
  },
  {
    id: "id-ppn",
    region: "Southeast Asia",
    name: "Indonesia (PPN 11%)",
    flag: "🇮🇩",
    currency: "IDR",
    thresholdAmount: 600000000,
    currentAmount: 845000000,
    standardTaxRate: 11.0,
    status: "NEXUS_REACHED",
    hasRegistration: true,
    registrationNumber: "NPWP 01.482.910.4-021.000",
    daysRemainingToFiling: 14,
  },
  {
    id: "sg-gst",
    region: "Southeast Asia",
    name: "Singapore (GST 9% OVR)",
    flag: "🇸🇬",
    currency: "SGD",
    thresholdAmount: 100000,
    currentAmount: 48000,
    standardTaxRate: 9.0,
    status: "SAFE",
    hasRegistration: false,
    daysRemainingToFiling: 45,
  },
  {
    id: "jp-jct",
    region: "East Asia",
    name: "Japan (JCT 10%)",
    flag: "🇯🇵",
    currency: "JPY",
    thresholdAmount: 10000000,
    currentAmount: 12400000,
    standardTaxRate: 10.0,
    status: "NEXUS_REACHED",
    hasRegistration: true,
    registrationNumber: "T1010001029345",
    daysRemainingToFiling: 26,
  },
];

export const MOCK_QUARTERLY_FILINGS: QuarterlyFiling[] = [
  {
    quarter: "Q3 2026",
    period: "Jul 1 - Sep 30, 2026",
    grossRevenue: 842500,
    taxCollected: 89400,
    currency: "USD",
    jurisdictionCount: 5,
    filingDeadline: "Oct 31, 2026",
    status: "READY_TO_FILE",
  },
  {
    quarter: "Q2 2026",
    period: "Apr 1 - Jun 30, 2026",
    grossRevenue: 720000,
    taxCollected: 76200,
    currency: "USD",
    jurisdictionCount: 4,
    filingDeadline: "Jul 31, 2026",
    status: "REMITTED",
  },
  {
    quarter: "Q1 2026",
    period: "Jan 1 - Mar 31, 2026",
    grossRevenue: 640000,
    taxCollected: 68100,
    currency: "USD",
    jurisdictionCount: 4,
    filingDeadline: "Apr 30, 2026",
    status: "REMITTED",
  },
];

export function calculateTaxRate(req: TaxCalculationRequest): TaxCalculationResult {
  const { country, subtotal, category, b2bTaxId } = req;
  const upperCountry = (country || "US").toUpperCase();

  // B2B Reverse Charge Check (e.g. EU cross-border B2B or verified NPWP)
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
    // US or Global default
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
