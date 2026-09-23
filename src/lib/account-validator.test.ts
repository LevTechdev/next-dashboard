import { describe, it, expect } from "vitest";
import {
  validateLuhn,
  detectCardBrand,
  detectCardTier,
  detectIndonesianCarrier,
  formatIndonesianPhone,
  formatCardNumber,
  identifyAccountInput,
} from "./account-validator";

describe("Account & Card Validator", () => {
  describe("Luhn Checksum Algorithm", () => {
    it("validates authentic bank cards with correct checksums", () => {
      // Standard test card numbers (Luhn compliant)
      expect(validateLuhn("4532015112830366")).toBe(true);
      expect(validateLuhn("5425233430109903")).toBe(true);
      expect(validateLuhn("4532 0151 1283 0366")).toBe(true);
    });

    it("rejects invalid card numbers with corrupted checksums", () => {
      expect(validateLuhn("4532015112830367")).toBe(false);
      expect(validateLuhn("5425233430109900")).toBe(false);
      expect(validateLuhn("1234")).toBe(false);
    });
  });

  describe("Card Brand & Tier Detection", () => {
    it("identifies card brands by BIN prefix", () => {
      expect(detectCardBrand("4000123456789010")).toBe("visa");
      expect(detectCardBrand("5425233430109903")).toBe("mastercard");
      expect(detectCardBrand("6013000000000000")).toBe("gpn");
      expect(detectCardBrand("3528000000000000")).toBe("jcb");
      expect(detectCardBrand("9999000000000000")).toBe("unknown");
    });

    it("detects card tiers appropriately", () => {
      expect(detectCardTier("6013000000000000")).toBe("gpn_national");
      expect(detectCardTier("4000010000000000")).toBe("black_signature");
      expect(detectCardTier("4000200000000000")).toBe("platinum");
      expect(detectCardTier("4000110000000000")).toBe("gold");
      expect(detectCardTier("4000120000000000")).toBe("classic");
    });
  });

  describe("Carrier & E-Wallet Detection", () => {
    it("detects Indonesian telecommunication carriers from prefix", () => {
      expect(detectIndonesianCarrier("08123456789")?.name).toBe("Telkomsel");
      expect(detectIndonesianCarrier("08151234567")?.name).toBe("Indosat Ooredoo");
      expect(detectIndonesianCarrier("08181234567")?.name).toBe("XL Axiata");
      expect(detectIndonesianCarrier("08961234567")?.name).toBe("Tri (3)");
      expect(detectIndonesianCarrier("08811234567")?.name).toBe("Smartfren");
    });

    it("formats Indonesian phone numbers cleanly with hyphens", () => {
      expect(formatIndonesianPhone("08123456789")).toBe("0812-3456-789");
      expect(formatIndonesianPhone("+6281234567890")).toBe("0812-3456-7890");
    });

    it("formats 16-digit bank cards in 4-digit groups", () => {
      expect(formatCardNumber("4000123456789010")).toBe("4000 1234 5678 9010");
    });
  });

  describe("Unified identifyAccountInput Engine", () => {
    it("identifies DANA/e-wallet mobile numbers", () => {
      const result = identifyAccountInput("081287654321", "dana");
      expect(result.type).toBe("e_wallet");
      expect(result.provider).toContain("DANA");
      expect(result.carrier).toBe("Telkomsel");
      expect(result.isValid).toBe(true);
    });

    it("identifies 16-digit bank cards with Luhn check", () => {
      const result = identifyAccountInput("4532 0151 1283 0366");
      expect(result.type).toBe("bank_card");
      expect(result.provider).toContain("Visa");
      expect(result.isValid).toBe(true);
    });

    it("identifies Indonesian bank accounts and matches clearing code", () => {
      const bcaResult = identifyAccountInput("1234567890", "BCA");
      expect(bcaResult.type).toBe("bank_account");
      expect(bcaResult.provider).toContain("Bank Central Asia");
      expect(bcaResult.isValid).toBe(true);

      const mandiriResult = identifyAccountInput("1234567890123", "008");
      expect(mandiriResult.type).toBe("bank_account");
      expect(mandiriResult.provider).toContain("Mandiri");
      expect(mandiriResult.isValid).toBe(true);
    });

    it("identifies Alipay email accounts", () => {
      const result = identifyAccountInput("merchant@alipay.com");
      expect(result.type).toBe("alipay");
      expect(result.provider).toContain("Alipay");
      expect(result.isValid).toBe(true);
    });
  });
});
