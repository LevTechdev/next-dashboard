import { describe, it, expect } from "vitest";
import { calculateCRC16, formatTLV, generateQrisPayload, qrisLedger } from "./qris-engine";

describe("QRIS Engine & Checksum", () => {
  it("computes standard CRC16-CCITT checksum", () => {
    const payloadWithoutCrc =
      "00020101021253033605802ID5919NEXUS COMMERCE STORE6013JAKARTA PUSAT6304";
    const crc = calculateCRC16(payloadWithoutCrc);
    expect(crc).toMatch(/^[0-9A-F]{4}$/);
  });

  it("formats Tag-Length-Value correctly", () => {
    expect(formatTLV("00", "01")).toBe("000201");
    expect(formatTLV("53", "360")).toBe("5303360");
  });

  it("generates a valid EMVCo / ASPI dynamic QRIS payload with Tag 26 and Tag 51", () => {
    const payload = generateQrisPayload({
      amount: 75000,
      invoiceNumber: "INV-2026-TEST",
      nmid: "ID1020030040050",
    });

    expect(payload.startsWith("000201")).toBe(true);
    expect(payload).toContain("26"); // Acquirer info tag
    expect(payload).toContain("936000140000000001"); // ASPI National Acquirer Switch PAN
    expect(payload).toContain("51"); // ASPI Domestic Central Repository tag
    expect(payload).toContain("ID.CO.QRIS.WWW"); // ASPI Reverse Domain
    expect(payload).toContain("ID1020030040050"); // NMID
    expect(payload).toContain("5303360"); // Currency IDR
    expect(payload).toContain("540575000"); // Amount 75000
    expect(payload).toContain("5802ID"); // Country ID
    expect(payload).toContain("6304"); // Checksum tag
    expect(payload.length).toBeGreaterThan(150);
  });
});

describe("QRIS Ledger & Payout Workflow", () => {
  it("tracks dynamic transactions and clears them into available balance", () => {
    const initial = qrisLedger.getState();
    const tx = qrisLedger.createTransaction(120000, "Jane Doe");

    expect(tx.status).toBe("PENDING");
    expect(tx.amount).toBe(120000);
    expect(qrisLedger.getState().pendingBalance).toBe(initial.pendingBalance + 120000);

    const paidTx = qrisLedger.confirmPayment(tx.id, "BCA Mobile");
    expect(paidTx.status).toBe("PAID");
    expect(paidTx.sourceBank).toBe("BCA Mobile");
    expect(qrisLedger.getState().availableBalance).toBe(initial.availableBalance + 120000);
  });

  it("processes DANA instant withdrawal and adjusts ledger", () => {
    const initial = qrisLedger.getState();
    const amount = 50000;

    const disb = qrisLedger.withdraw({
      method: "dana",
      destinationName: "Budi",
      destinationAccount: "0812345678",
      amount,
    });

    expect(disb.status).toBe("COMPLETED");
    expect(disb.fee).toBe(0); // DANA fee free
    expect(disb.netAmount).toBe(50000);
    expect(qrisLedger.getState().availableBalance).toBe(initial.availableBalance - amount);
  });

  it("processes Bank Transfer with BI-FAST fee", () => {
    const initial = qrisLedger.getState();
    const amount = 100000;

    const disb = qrisLedger.withdraw({
      method: "bank_transfer",
      destinationName: "PT Nexus",
      destinationAccount: "5270192881",
      bankCode: "BCA",
      amount,
    });

    expect(disb.fee).toBe(2500);
    expect(disb.netAmount).toBe(97500);
    expect(qrisLedger.getState().availableBalance).toBe(initial.availableBalance - amount);
  });

  it("handles string formatted amounts correctly (e.g. 500.000)", () => {
    const initial = qrisLedger.getState();
    const disb = qrisLedger.withdraw({
      method: "dana",
      destinationName: "Test String Amount",
      destinationAccount: "081299990000",
      amount: "50.000",
    });

    expect(disb.grossAmount).toBe(50000);
    expect(disb.netAmount).toBe(50000);
    expect(qrisLedger.getState().availableBalance).toBe(initial.availableBalance - 50000);
  });

  it("rejects withdrawals exceeding available balance", () => {
    const currentBalance = qrisLedger.getState().availableBalance;
    expect(() =>
      qrisLedger.withdraw({
        method: "dana",
        destinationName: "Overflow",
        destinationAccount: "0812345678",
        amount: currentBalance + 100000000,
      }),
    ).toThrow(/insufficient balance/i);
  });
});
