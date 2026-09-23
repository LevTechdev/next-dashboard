import fs from "fs";
import path from "path";
import { identifyAccountInput, AccountDetectionResult } from "./account-validator";
import { getBankByCode, getBankByName } from "./indonesian-banks";

export interface Beneficiary {
  id: string;
  accountNumber: string;
  maskedAccount: string;
  accountName: string;
  channel: "dana" | "bank_transfer" | "card_oct" | "alipay" | "linkaja";
  bankCode?: string;
  bankName?: string;
  cardType?: "visa" | "mastercard" | "gpn";
  cardTier?: string;
  verified: boolean;
  favorite: boolean;
  lastUsedAt: string;
  totalDisbursed: number;
}

const DATA_FILE = path.join(process.cwd(), "data", "beneficiaries.json");

let memoryCache: Beneficiary[] | null = null;

function loadStore(): Beneficiary[] {
  if (memoryCache) return memoryCache;
  try {
    if (fs.existsSync(DATA_FILE)) {
      const content = fs.readFileSync(DATA_FILE, "utf-8");
      memoryCache = JSON.parse(content);
      return memoryCache || [];
    }
  } catch (e) {
    console.error("Failed to read beneficiaries.json:", e);
  }
  memoryCache = [];
  return memoryCache;
}

function persistStore(list: Beneficiary[]) {
  memoryCache = list;
  try {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(list, null, 2), "utf-8");
  } catch (e) {
    console.error("Failed to persist beneficiaries.json:", e);
  }
}

export function listBeneficiaries(search?: string): Beneficiary[] {
  const all = loadStore();
  if (!search) return all;
  const q = search.toLowerCase().trim();
  return all.filter(
    (b) =>
      b.accountName.toLowerCase().includes(q) ||
      b.accountNumber.includes(q) ||
      (b.bankName && b.bankName.toLowerCase().includes(q)),
  );
}

export function findBeneficiaryByNumber(accountNumber: string): Beneficiary | undefined {
  const clean = accountNumber.replace(/[\s-]/g, "");
  return loadStore().find((b) => b.accountNumber.replace(/[\s-]/g, "") === clean);
}

export function recordBeneficiaryDisbursement(accountNumber: string, amount: number) {
  const clean = accountNumber.replace(/[\s-]/g, "");
  const all = loadStore();
  const index = all.findIndex((b) => b.accountNumber.replace(/[\s-]/g, "") === clean);
  if (index >= 0) {
    all[index].lastUsedAt = new Date().toISOString();
    all[index].totalDisbursed = (all[index].totalDisbursed || 0) + amount;
    persistStore([...all]);
  }
}

export interface InquiryResult {
  success: boolean;
  accountNumber: string;
  accountName: string;
  registeredName: string;
  bankName: string;
  channel: string;
  verified: boolean;
  detection: AccountDetectionResult;
}

/**
 * Real-time simulated account name inquiry resolver matching Bank Indonesia SNAP / BI-FAST standard.
 */
export async function inquireAccountName(
  accountNumber: string,
  channel?: string,
  bankCode?: string,
): Promise<InquiryResult> {
  const detection = identifyAccountInput(accountNumber, channel || bankCode);
  const existing = findBeneficiaryByNumber(accountNumber);

  if (existing) {
    return {
      success: true,
      accountNumber: existing.accountNumber,
      accountName: existing.accountName,
      registeredName: existing.accountName,
      bankName: existing.bankName || detection.provider,
      channel: existing.channel,
      verified: true,
      detection,
    };
  }

  // Simulated Bank Network Directory based on realistic patterns
  let resolvedName = "Pengguna Terverifikasi";
  const digits = accountNumber.replace(/\D/g, "");

  if (detection.type === "e_wallet") {
    if (detection.brand === "dana") resolvedName = "Siti Rahmawati (DANA Premium)";
    else if (detection.brand === "gopay") resolvedName = "Rian Pratama (GoPay Plus)";
    else if (detection.brand === "ovo") resolvedName = "Dewi Lestari (OVO Premier)";
    else if (detection.brand === "linkaja") resolvedName = "Ahmad Hidayat (LinkAja Full)";
    else resolvedName = "Pengguna E-Wallet";
  } else if (detection.type === "bank_card") {
    resolvedName = "HENDRA WIJAYA (CARDHOLDER)";
  } else if (detection.type === "bank_account") {
    const bank = (bankCode && getBankByCode(bankCode)) || detection.bank || getBankByCode("014");
    resolvedName = bank ? `${bank.shortName} - Budi Santoso` : "Budi Santoso";
  } else if (detection.type === "alipay") {
    resolvedName = "Zhang Wei (Alipay Cross-Border)";
  }

  return {
    success: detection.isValid,
    accountNumber,
    accountName: resolvedName,
    registeredName: resolvedName,
    bankName: detection.provider,
    channel: channel || detection.type,
    verified: detection.isValid,
    detection,
  };
}
