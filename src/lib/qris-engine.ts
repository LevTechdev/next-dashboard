/**
 * Standalone EMVCo & ASPI QRIS Payment Engine & Income Payout Ledger
 *
 * Compliant with ASPI (Asosiasi Sistem Pembayaran Indonesia) QRIS Merchant-Presented Mode:
 * - EMVCo Tag-Length-Value (TLV) payload formatting
 * - CRC-16-CCITT (polynomial 0x1021, initial value 0xFFFF) checksum
 * - Autonomous in-memory transaction and multi-channel disbursement ledger
 * - Supported withdrawal channels: DANA, Bank Transfer (BCA, Mandiri, BRI, BNI), Visa/Mastercard OCT, Alipay, LinkAja
 */

import { EventEmitter } from "events";

const globalForEmitter = global as unknown as { qrisEmitterSingleton?: EventEmitter };
export const qrisEmitter = globalForEmitter.qrisEmitterSingleton ?? new EventEmitter();
qrisEmitter.setMaxListeners(100);
if (process.env.NODE_ENV !== "production") globalForEmitter.qrisEmitterSingleton = qrisEmitter;

export interface QrisTransaction {
  id: string;
  invoiceNumber: string;
  amount: number;
  currency: "IDR";
  customerName: string;
  sourceBank: string;
  status: "PENDING" | "PAID" | "EXPIRED" | "DISPUTED";
  qrisPayload: string;
  createdAt: string;
  paidAt?: string;
  rrn: string; // Retrieval Reference Number
}

export type WithdrawalMethod = "dana" | "bank_transfer" | "card_oct" | "alipay" | "linkaja";

export interface WithdrawalDisbursement {
  id: string;
  disbursementNumber: string;
  method: WithdrawalMethod;
  destinationName: string;
  destinationAccount: string;
  bankCode?: string;
  cardType?: "visa" | "mastercard";
  grossAmount: number;
  fee: number;
  netAmount: number;
  status: "COMPLETED" | "PROCESSING" | "FAILED";
  referenceNumber: string;
  timestamp: string;
  notes?: string;
  destinationCurrency?: "IDR" | "USD" | "CNY";
  fxRate?: number;
  destinationAmount?: number;
}

export interface QrisLedgerState {
  availableBalance: number;
  pendingBalance: number;
  totalWithdrawn: number;
  totalInbound: number;
  transactions: QrisTransaction[];
  disbursements: WithdrawalDisbursement[];
}

/**
 * Calculate CRC16-CCITT checksum for EMVCo QR code standard.
 * Polynomial: 0x1021, Initial: 0xFFFF
 */
export function calculateCRC16(data: string): string {
  let crc = 0xffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/**
 * Format an EMVCo Tag-Length-Value element.
 * E.g. Tag "00", Value "01" -> "000201"
 */
export function formatTLV(tag: string, value: string): string {
  const lengthStr = value.length.toString().padStart(2, "0");
  return `${tag}${lengthStr}${value}`;
}

/**
 * Generate full ASPI QRIS Dynamic Payload compliant with Bank Indonesia guidelines.
 */
export function generateQrisPayload(params: {
  amount: number;
  invoiceNumber: string;
  merchantName?: string;
  merchantCity?: string;
  postalCode?: string;
  nmid?: string;
}): string {
  const {
    amount,
    invoiceNumber,
    merchantName = "NEXUS COMMERCE STORE",
    merchantCity = "JAKARTA PUSAT",
    postalCode = "10110",
    nmid = "ID1020030040050",
  } = params;

  // Tag 00: Payload Format Indicator
  let payload = formatTLV("00", "01");

  // Tag 01: Point of Initiation Method (12 = Dynamic, 11 = Static)
  payload += formatTLV("01", "12");

  // Tag 26: Merchant Account Information - Acquirer Domain
  // Subtag 00: Reverse Domain / GUI, Subtag 01: 18-digit National PAN, Subtag 02: Merchant ID, Subtag 03: Criteria
  const tag26_00 = formatTLV("00", "IDS.CO.QRIS.WWW");
  const tag26_01 = formatTLV("01", "936000140000000001"); // 18-digit ASPI Acquirer Switch PAN (BCA/BI-FAST)
  const tag26_02 = formatTLV("02", nmid);
  const tag26_03 = formatTLV("03", "UMI"); // Usaha Mikro (SME)
  payload += formatTLV("26", tag26_00 + tag26_01 + tag26_02 + tag26_03);

  // Tag 51: ASPI Domestic Central Repository (Required by BCA, Mandiri, BRI, BNI & E-Wallets)
  // Subtag 00: Globally Unique Identifier, Subtag 02: NMID, Subtag 03: Criteria
  const tag51_00 = formatTLV("00", "ID.CO.QRIS.WWW");
  const tag51_02 = formatTLV("02", nmid);
  const tag51_03 = formatTLV("03", "UMI");
  payload += formatTLV("51", tag51_00 + tag51_02 + tag51_03);

  // Tag 52: Merchant Category Code (5411 = Grocery / Retail)
  payload += formatTLV("52", "5411");

  // Tag 53: Transaction Currency (360 = IDR)
  payload += formatTLV("53", "360");

  // Tag 54: Transaction Amount
  payload += formatTLV("54", Math.round(amount).toString());

  // Tag 58: Country Code (ID)
  payload += formatTLV("58", "ID");

  // Tag 59: Merchant Name (Up to 25 chars)
  payload += formatTLV("59", merchantName.slice(0, 25).toUpperCase());

  // Tag 60: Merchant City (Up to 15 chars)
  payload += formatTLV("60", merchantCity.slice(0, 15).toUpperCase());

  // Tag 61: Postal Code
  payload += formatTLV("61", postalCode);

  // Tag 62: Additional Data Field Template (Invoice number, reference, terminal)
  const tag62_01 = formatTLV("01", invoiceNumber.slice(0, 25));
  const tag62_05 = formatTLV("05", invoiceNumber.slice(-8));
  const tag62_07 = formatTLV("07", "A01");
  payload += formatTLV("62", tag62_01 + tag62_05 + tag62_07);

  // Tag 63: CRC checksum placeholder
  const payloadToHash = payload + "6304";
  const checksum = calculateCRC16(payloadToHash);

  return payloadToHash + checksum;
}

// ════════════════════════════════════════════════════════════════════════════
// In-Memory Persistent Ledger Singleton
// ════════════════════════════════════════════════════════════════════════════

const INITIAL_TRANSACTIONS: QrisTransaction[] = [
  {
    id: "tx-qris-101",
    invoiceNumber: "INV-QR-2026-001",
    amount: 175000,
    currency: "IDR",
    customerName: "Budi Santoso",
    sourceBank: "BCA Mobile",
    status: "PAID",
    qrisPayload: generateQrisPayload({ amount: 175000, invoiceNumber: "INV-QR-2026-001" }),
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    paidAt: new Date(Date.now() - 3600000 * 2 + 45000).toISOString(),
    rrn: "829301928472",
  },
  {
    id: "tx-qris-102",
    invoiceNumber: "INV-QR-2026-002",
    amount: 450000,
    currency: "IDR",
    customerName: "Siti Rahma",
    sourceBank: "Mandiri Livin",
    status: "PAID",
    qrisPayload: generateQrisPayload({ amount: 450000, invoiceNumber: "INV-QR-2026-002" }),
    createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
    paidAt: new Date(Date.now() - 3600000 * 5 + 32000).toISOString(),
    rrn: "918273645281",
  },
  {
    id: "tx-qris-103",
    invoiceNumber: "INV-QR-2026-003",
    amount: 89000,
    currency: "IDR",
    customerName: "Agus Pratama",
    sourceBank: "DANA",
    status: "PAID",
    qrisPayload: generateQrisPayload({ amount: 89000, invoiceNumber: "INV-QR-2026-003" }),
    createdAt: new Date(Date.now() - 3600000 * 9).toISOString(),
    paidAt: new Date(Date.now() - 3600000 * 9 + 18000).toISOString(),
    rrn: "728192039481",
  },
  {
    id: "tx-qris-104",
    invoiceNumber: "INV-QR-2026-004",
    amount: 1250000,
    currency: "IDR",
    customerName: "Dewi Lestari",
    sourceBank: "BRImo",
    status: "PAID",
    qrisPayload: generateQrisPayload({ amount: 1250000, invoiceNumber: "INV-QR-2026-004" }),
    createdAt: new Date(Date.now() - 3600000 * 14).toISOString(),
    paidAt: new Date(Date.now() - 3600000 * 14 + 50000).toISOString(),
    rrn: "617283940192",
  },
];

const INITIAL_DISBURSEMENTS: WithdrawalDisbursement[] = [
  {
    id: "wd-001",
    disbursementNumber: "WD-2026-0901",
    method: "dana",
    destinationName: "Store Owner (Primary)",
    destinationAccount: "0812-8899-2311",
    grossAmount: 2500000,
    fee: 0,
    netAmount: 2500000,
    status: "COMPLETED",
    referenceNumber: "DANA-DISB-8839102",
    timestamp: new Date(Date.now() - 3600000 * 24 * 3).toISOString(),
    notes: "Weekly income payout to DANA wallet",
  },
  {
    id: "wd-002",
    disbursementNumber: "WD-2026-0902",
    method: "bank_transfer",
    destinationName: "PT NEXT COMMERCE GROUP",
    destinationAccount: "5270-192-881",
    bankCode: "BCA",
    grossAmount: 10000000,
    fee: 2500,
    netAmount: 9997500,
    status: "COMPLETED",
    referenceNumber: "BI-FAST-9920194821",
    timestamp: new Date(Date.now() - 3600000 * 24 * 7).toISOString(),
    notes: "Corporate operational distribution",
  },
];

class QrisLedger {
  private availableBalance: number = 18750000;
  private pendingBalance: number = 0;
  private totalWithdrawn: number = 12500000;
  private totalInbound: number = 31250000;
  private transactions: QrisTransaction[] = [...INITIAL_TRANSACTIONS];
  private disbursements: WithdrawalDisbursement[] = [...INITIAL_DISBURSEMENTS];

  public getState(): QrisLedgerState {
    return {
      availableBalance: this.availableBalance,
      pendingBalance: this.pendingBalance,
      totalWithdrawn: this.totalWithdrawn,
      totalInbound: this.totalInbound,
      transactions: [...this.transactions],
      disbursements: [...this.disbursements],
    };
  }

  public createTransaction(
    amount: number,
    customerName: string = "Walk-in Customer",
  ): QrisTransaction {
    const id = `tx-qris-${Date.now().toString(36)}`;
    const invoiceNumber = `INV-QR-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const qrisPayload = generateQrisPayload({ amount, invoiceNumber });
    const rrn = Math.floor(100000000000 + Math.random() * 900000000000).toString();

    const tx: QrisTransaction = {
      id,
      invoiceNumber,
      amount,
      currency: "IDR",
      customerName,
      sourceBank: "Pending Scan",
      status: "PENDING",
      qrisPayload,
      createdAt: new Date().toISOString(),
      rrn,
    };

    this.pendingBalance += amount;
    this.transactions.unshift(tx);
    qrisEmitter.emit("transaction_created", tx);
    return tx;
  }

  public confirmPayment(transactionId: string, sourceBank: string = "BCA Mobile"): QrisTransaction {
    const tx = this.transactions.find((t) => t.id === transactionId);
    if (!tx) throw new Error("Transaction not found");

    if (tx.status === "PAID") return tx;

    tx.status = "PAID";
    tx.paidAt = new Date().toISOString();
    tx.sourceBank = sourceBank;

    this.pendingBalance = Math.max(0, this.pendingBalance - tx.amount);
    this.availableBalance += tx.amount;
    this.totalInbound += tx.amount;

    qrisEmitter.emit("payment_confirmed", {
      type: "PAYMENT_CONFIRMED",
      transaction: tx,
      availableBalance: this.availableBalance,
      pendingBalance: this.pendingBalance,
    });

    return tx;
  }

  public disputeTransaction(
    transactionId: string,
    reason: string = "Customer chargeback dispute",
  ): QrisTransaction {
    const tx = this.transactions.find((t) => t.id === transactionId);
    if (!tx) throw new Error("Transaction not found");

    if (tx.status === "DISPUTED") return tx;

    if (tx.status === "PAID") {
      this.availableBalance = Math.max(0, this.availableBalance - tx.amount);
    } else if (tx.status === "PENDING") {
      this.pendingBalance = Math.max(0, this.pendingBalance - tx.amount);
    }

    tx.status = "DISPUTED";
    qrisEmitter.emit("transaction_disputed", {
      type: "TRANSACTION_DISPUTED",
      transaction: tx,
      reason,
      availableBalance: this.availableBalance,
      pendingBalance: this.pendingBalance,
    });

    return tx;
  }

  public expireTransaction(transactionId: string): QrisTransaction {
    const tx = this.transactions.find((t) => t.id === transactionId);
    if (!tx) throw new Error("Transaction not found");

    if (tx.status === "EXPIRED") return tx;

    if (tx.status === "PENDING") {
      this.pendingBalance = Math.max(0, this.pendingBalance - tx.amount);
    }

    tx.status = "EXPIRED";
    qrisEmitter.emit("transaction_expired", {
      type: "TRANSACTION_EXPIRED",
      transaction: tx,
      availableBalance: this.availableBalance,
      pendingBalance: this.pendingBalance,
    });

    return tx;
  }

  public withdraw(params: {
    method: WithdrawalMethod;
    destinationName: string;
    destinationAccount: string;
    amount: number | string;
    bankCode?: string;
    cardType?: "visa" | "mastercard";
    notes?: string;
  }): WithdrawalDisbursement {
    const { method, destinationName, destinationAccount, amount, bankCode, cardType, notes } =
      params;

    const numericAmount =
      typeof amount === "string" ? Number(String(amount).replace(/[^0-9]/g, "")) : Number(amount);

    if (isNaN(numericAmount) || numericAmount <= 0) {
      throw new Error("Withdrawal amount must be greater than zero");
    }
    if (numericAmount > this.availableBalance) {
      throw new Error(
        `Insufficient balance. Available: Rp ${this.availableBalance.toLocaleString("id-ID")}`,
      );
    }

    // Dynamic fee model (e-wallets Rp 0, standard bank transfer Rp 2,500 BI-FAST, Card OCT Rp 5,000)
    let fee = 0;
    if (method === "bank_transfer") fee = 2500;
    if (method === "card_oct") fee = 5000;
    if (method === "alipay") fee = 3500;

    const netAmount = numericAmount - fee;
    if (netAmount <= 0)
      throw new Error("Net withdrawal amount must be greater than zero after fees");

    const id = `wd-${Date.now().toString(36)}`;
    const disbursementNumber = `WD-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;
    const refPrefix =
      method === "dana"
        ? "DANA"
        : method === "card_oct"
          ? "OCT"
          : method === "alipay"
            ? "ALIPAY"
            : "BIFAST";
    const referenceNumber = `${refPrefix}-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;

    let destinationCurrency: "IDR" | "USD" | "CNY" = "IDR";
    let fxRate = 1.0;
    let destinationAmount = netAmount;

    if (method === "card_oct") {
      destinationCurrency = "USD";
      fxRate = Number((1 / 15850).toFixed(6));
      destinationAmount = Number((netAmount / 15850).toFixed(2));
    } else if (method === "alipay") {
      destinationCurrency = "CNY";
      fxRate = Number((1 / 2192).toFixed(6));
      destinationAmount = Number((netAmount / 2192).toFixed(2));
    }

    const disbursement: WithdrawalDisbursement = {
      id,
      disbursementNumber,
      method,
      destinationName,
      destinationAccount,
      bankCode,
      cardType,
      grossAmount: numericAmount,
      fee,
      netAmount,
      status: "COMPLETED",
      referenceNumber,
      timestamp: new Date().toISOString(),
      notes: notes || `Withdrawal via ${method.replace("_", " ").toUpperCase()}`,
      destinationCurrency,
      fxRate,
      destinationAmount,
    };

    this.availableBalance -= numericAmount;
    this.totalWithdrawn += numericAmount;
    this.disbursements.unshift(disbursement);

    qrisEmitter.emit("withdrawal_completed", {
      type: "WITHDRAWAL_COMPLETED",
      disbursement,
      availableBalance: this.availableBalance,
    });

    return disbursement;
  }
}

// Global process singleton to persist between Next.js hot reloads
const globalForQris = global as unknown as { qrisLedgerSingleton?: QrisLedger };
export const qrisLedger = globalForQris.qrisLedgerSingleton ?? new QrisLedger();
if (process.env.NODE_ENV !== "production") globalForQris.qrisLedgerSingleton = qrisLedger;
