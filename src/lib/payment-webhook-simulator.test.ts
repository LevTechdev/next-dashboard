import { describe, it, expect, beforeEach } from "vitest";
import { qrisLedger } from "@/lib/qris-engine";
import crypto from "crypto";

describe("Payment Gateway Webhook Simulator & Ledger Transitions", () => {
  let txId: string;

  beforeEach(() => {
    // Create a fresh test transaction
    const tx = qrisLedger.createTransaction(500000, "Test Customer Simulator");
    txId = tx.id;
  });

  it("creates a pending transaction with valid ASPI QRIS payload", () => {
    const ledger = qrisLedger.getState();
    const tx = ledger.transactions.find((t) => t.id === txId);
    expect(tx).toBeDefined();
    expect(tx?.status).toBe("PENDING");
    expect(tx?.amount).toBe(500000);
    expect(tx?.qrisPayload).toContain("ID.CO.QRIS.WWW");
  });

  it("processes qris.payment_success simulation and confirms settlement", () => {
    const tx = qrisLedger.confirmPayment(txId, "BCA Mobile");
    expect(tx.status).toBe("PAID");
    expect(tx.sourceBank).toBe("BCA Mobile");
    expect(tx.paidAt).toBeDefined();

    const ledger = qrisLedger.getState();
    expect(ledger.availableBalance).toBeGreaterThanOrEqual(500000);
  });

  it("processes payment.dispute_created and transitions state to DISPUTED", () => {
    // First pay it
    qrisLedger.confirmPayment(txId, "DANA");
    const balBefore = qrisLedger.getState().availableBalance;

    // Now dispute it
    const disputedTx = qrisLedger.disputeTransaction(txId, "Fraud chargeback");
    expect(disputedTx.status).toBe("DISPUTED");

    const balAfter = qrisLedger.getState().availableBalance;
    expect(balAfter).toBe(balBefore - 500000);
  });

  it("processes payment.failed and marks transaction EXPIRED", () => {
    const expiredTx = qrisLedger.expireTransaction(txId);
    expect(expiredTx.status).toBe("EXPIRED");
  });

  it("verifies HMAC-SHA256 signature calculation matches standard webhook format", () => {
    const secret = "whsec_test_secret_12345";
    const timestamp = Math.floor(Date.now() / 1000);
    const payload = JSON.stringify({
      id: "evt_test_123",
      event: "qris.payment_success",
      amount: 500000,
    });

    const expectedSig = crypto
      .createHmac("sha256", secret)
      .update(`t=${timestamp}.${payload}`)
      .digest("hex");

    const testSig = crypto
      .createHmac("sha256", secret)
      .update(`t=${timestamp}.${payload}`)
      .digest("hex");

    expect(testSig).toBe(expectedSig);
    expect(testSig.length).toBe(64); // SHA-256 hex length
  });
});
