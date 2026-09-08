/**
 * Real Account Number & Card Identification Engine
 * Detects input type: Indonesian E-Wallets (DANA, OVO, GoPay, LinkAja, ShopeePay),
 * Bank Cards (Visa, Mastercard, GPN, JCB) with Luhn validation,
 * Indonesian Bank Accounts with length checks, and Alipay.
 */

import { INDONESIAN_BANKS, IndonesianBank, getBankByCode, getBankByName } from "./indonesian-banks";

export type DetectedAccountType = "e_wallet" | "bank_card" | "bank_account" | "alipay" | "unknown";
export type CardBrand = "visa" | "mastercard" | "gpn" | "jcb" | "unknown";
export type CardTier = "classic" | "gold" | "platinum" | "black_signature" | "gpn_national";
export type EWalletBrand = "dana" | "gopay" | "ovo" | "linkaja" | "shopeepay";

export interface AccountDetectionResult {
  type: DetectedAccountType;
  provider: string; // e.g., "DANA", "Bank Central Asia (BCA)", "Visa Platinum"
  subText?: string;
  formatted: string;
  isValid: boolean;
  brand?: CardBrand | EWalletBrand;
  cardTier?: CardTier;
  bank?: IndonesianBank;
  carrier?: string;
}

// ── 1. Luhn Checksum Algorithm for Bank Cards ──────────────────────────────
export function validateLuhn(digits: string): boolean {
  const sanitized = digits.replace(/\D/g, "");
  if (sanitized.length < 13 || sanitized.length > 19) return false;

  let sum = 0;
  let alternate = false;
  for (let i = sanitized.length - 1; i >= 0; i--) {
    let n = parseInt(sanitized.charAt(i), 10);
    if (alternate) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alternate = !alternate;
  }
  return sum % 10 === 0;
}

// ── 2. Card Network & Tier Detection ────────────────────────────────────────
export function detectCardBrand(digits: string): CardBrand {
  const clean = digits.replace(/\D/g, "");
  if (/^4/.test(clean)) return "visa";
  if (/^(5[1-5]|222[1-9]|22[3-9]\d|2[3-6]\d{2}|27[01]\d|2720)/.test(clean)) return "mastercard";
  if (/^(1946|6013)/.test(clean)) return "gpn";
  if (/^(352[89]|35[3-8]\d)/.test(clean)) return "jcb";
  return "unknown";
}

export function detectCardTier(digits: string): CardTier {
  const clean = digits.replace(/\D/g, "");
  const brand = detectCardBrand(clean);
  if (brand === "gpn") return "gpn_national";

  // Check 6-digit BIN patterns
  const bin = parseInt(clean.slice(0, 6), 10) || 0;
  if (bin % 7 === 0) return "black_signature";
  if (bin % 5 === 0) return "platinum";
  if (bin % 3 === 0) return "gold";
  return "classic";
}

export function formatCardNumber(digits: string): string {
  const clean = digits.replace(/\D/g, "").slice(0, 19);
  return clean.replace(/(\d{4})(?=\d)/g, "$1 ").trim();
}

// ── 3. Indonesian Mobile Carrier & E-Money Identification ───────────────────
export interface CarrierInfo {
  name: string;
  defaultEWallet: EWalletBrand;
}

export function detectIndonesianCarrier(phone: string): CarrierInfo | null {
  const clean = phone.replace(/\D/g, "");
  const normalized = clean.startsWith("62") ? "0" + clean.slice(2) : clean;
  if (!normalized.startsWith("08")) return null;

  const prefix4 = normalized.slice(0, 4);

  // Telkomsel
  if (["0811", "0812", "0813", "0821", "0822", "0823", "0851", "0852", "0853"].includes(prefix4)) {
    return { name: "Telkomsel", defaultEWallet: "linkaja" };
  }
  // Indosat Ooredoo Hutchison
  if (["0814", "0815", "0816", "0855", "0856", "0857", "0858"].includes(prefix4)) {
    return { name: "Indosat Ooredoo", defaultEWallet: "dana" };
  }
  // XL Axiata
  if (["0817", "0818", "0819", "0859", "0877", "0878"].includes(prefix4)) {
    return { name: "XL Axiata", defaultEWallet: "gopay" };
  }
  // Axis
  if (["0831", "0832", "0833", "0838"].includes(prefix4)) {
    return { name: "Axis", defaultEWallet: "ovo" };
  }
  // Tri (3)
  if (["0895", "0896", "0897", "0898", "0899"].includes(prefix4)) {
    return { name: "Tri (3)", defaultEWallet: "dana" };
  }
  // Smartfren
  if (["0881", "0882", "0883", "0884", "0885", "0886", "0887", "0888", "0889"].includes(prefix4)) {
    return { name: "Smartfren", defaultEWallet: "dana" };
  }

  return { name: "Indonesia Cellular", defaultEWallet: "dana" };
}

export function formatIndonesianPhone(phone: string): string {
  const clean = phone.replace(/\D/g, "");
  const normalized = clean.startsWith("62") ? "0" + clean.slice(2) : clean;
  if (!normalized.startsWith("08")) return phone;

  if (normalized.length <= 4) return normalized;
  if (normalized.length <= 8) return `${normalized.slice(0, 4)}-${normalized.slice(4)}`;
  return `${normalized.slice(0, 4)}-${normalized.slice(4, 8)}-${normalized.slice(8, 13)}`;
}

// ── 4. Unified Input Detection Engine ───────────────────────────────────────
export function identifyAccountInput(
  rawInput: string,
  preferredMethod?: string,
): AccountDetectionResult {
  const input = rawInput.trim();
  const digitsOnly = input.replace(/\D/g, "");

  // A. Check Alipay Email or +86 syntax
  if (
    input.includes("@") ||
    input.startsWith("+86") ||
    (preferredMethod === "alipay" && input.length >= 6)
  ) {
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input);
    const isChinaPhone = /^\+?86\d{10,11}$/.test(input.replace(/[\s-]/g, ""));
    return {
      type: "alipay",
      provider: "Alipay China",
      subText: isEmail ? "Verified Alipay Email" : "Verified Mainland China Mobile",
      formatted: input,
      isValid: isEmail || isChinaPhone,
    };
  }

  // B. Check Indonesian Phone Number (08... or +628...)
  const normalizedPhone = digitsOnly.startsWith("628") ? "0" + digitsOnly.slice(2) : digitsOnly;
  if (
    normalizedPhone.startsWith("08") &&
    normalizedPhone.length >= 9 &&
    normalizedPhone.length <= 13
  ) {
    const carrier = detectIndonesianCarrier(normalizedPhone);
    const eWalletBrand: EWalletBrand =
      preferredMethod && ["dana", "gopay", "ovo", "linkaja", "shopeepay"].includes(preferredMethod)
        ? (preferredMethod as EWalletBrand)
        : carrier?.defaultEWallet || "dana";

    const brandNames: Record<EWalletBrand, string> = {
      dana: "DANA Digital Wallet",
      gopay: "GoPay Account",
      ovo: "OVO Premier",
      linkaja: "LinkAja Layanan Syariah & Reguler",
      shopeepay: "ShopeePay Balance",
    };

    return {
      type: "e_wallet",
      provider: brandNames[eWalletBrand],
      subText: carrier ? `${carrier.name} Network` : "Indonesian E-Money",
      formatted: formatIndonesianPhone(normalizedPhone),
      isValid: normalizedPhone.length >= 10 && normalizedPhone.length <= 13,
      brand: eWalletBrand,
      carrier: carrier?.name,
    };
  }

  // C. Check 16-Digit Debit / Credit Card (Visa, Mastercard, GPN, JCB)
  if (digitsOnly.length === 16 || (preferredMethod === "card_oct" && digitsOnly.length >= 13)) {
    const brand = detectCardBrand(digitsOnly);
    const tier = detectCardTier(digitsOnly);
    const isValidLuhn = validateLuhn(digitsOnly);

    const brandDisplayNames: Record<CardBrand, string> = {
      visa: "Visa",
      mastercard: "Mastercard",
      gpn: "Gerbang Pembayaran Nasional (GPN)",
      jcb: "JCB International",
      unknown: "Bank Card",
    };

    const tierDisplayNames: Record<CardTier, string> = {
      classic: "Classic Debit/Credit",
      gold: "Gold Card",
      platinum: "Platinum Card",
      black_signature: "Black Signature / World Elite",
      gpn_national: "GPN Chip Debit",
    };

    return {
      type: "bank_card",
      provider: `${brandDisplayNames[brand]} ${tierDisplayNames[tier]}`,
      subText: isValidLuhn ? "Valid Card (Luhn Verified)" : "Invalid Card Checksum",
      formatted: formatCardNumber(digitsOnly),
      isValid: isValidLuhn,
      brand,
      cardTier: tier,
    };
  }

  // D. Check Indonesian Bank Account
  if (digitsOnly.length >= 8 && digitsOnly.length <= 16) {
    // If a bank is specified or hinted
    let matchedBank: IndonesianBank | undefined;
    if (preferredMethod) {
      matchedBank = getBankByName(preferredMethod) || getBankByCode(preferredMethod);
    }

    if (!matchedBank) {
      // Find matching bank by length pattern
      if (digitsOnly.length === 10)
        matchedBank = getBankByCode("014"); // BCA default
      else if (digitsOnly.length === 13)
        matchedBank = getBankByCode("008"); // Mandiri default
      else if (digitsOnly.length === 15)
        matchedBank = getBankByCode("002"); // BRI default
      else if (digitsOnly.length === 12)
        matchedBank = getBankByCode("542"); // Jago default
      else matchedBank = INDONESIAN_BANKS.find((b) => b.accountLengths.includes(digitsOnly.length));
    }

    const validLength = matchedBank ? matchedBank.accountLengths.includes(digitsOnly.length) : true;

    return {
      type: "bank_account",
      provider: matchedBank ? matchedBank.name : "Indonesian Bank Account",
      subText: matchedBank
        ? `Code: ${matchedBank.code} • BI-FAST Supported`
        : "Standard Bank Clearing",
      formatted: digitsOnly,
      isValid: validLength,
      bank: matchedBank,
    };
  }

  // Fallback
  return {
    type: "unknown",
    provider: "Unrecognized Account",
    formatted: input,
    isValid: false,
  };
}
