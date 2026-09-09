// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { CashierPosNumpad } from "./cashier-pos-numpad";
import { MerchantSettlementReconciliation } from "./merchant-settlement-reconciliation";
import { DisputeResolutionCenter } from "./dispute-resolution-center";
import { QrisPaymentSystem } from "./qris-payment-system";

// Mock next-intl
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, params?: any) => {
    if (params) return `${key}:${JSON.stringify(params)}`;
    return key;
  },
  useLocale: () => "en",
}));

// Mock useAppearance hook
vi.mock("@/hooks/use-appearance", () => ({
  useAppearance: () => ({
    settings: {
      accent: "blue",
      customColor: "#0284c7",
      mode: "system",
    },
    updateSettings: vi.fn(),
  }),
}));

// Mock Currency provider
vi.mock("@/components/currency-provider", () => ({
  useCurrency: () => ({
    currency: "IDR",
    formatMoney: (val: number) => `Rp ${val.toLocaleString("id-ID")}`,
  }),
}));

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

// Mock qrcode
vi.mock("qrcode", () => ({
  default: {
    toDataURL: vi.fn().mockResolvedValue("data:image/png;base64,mockqrdata"),
  },
}));

describe("Commerce Features Suite", () => {
  describe("Cashier POS Quick-Numpad Terminal", () => {
    it("renders numpad buttons and zero initial balance", () => {
      render(<CashierPosNumpad />);
      expect(screen.getByText("Cashier POS Quick-Numpad Terminal")).toBeInTheDocument();
      expect(screen.getByText("7")).toBeInTheDocument();
      expect(screen.getByText("8")).toBeInTheDocument();
      expect(screen.getByText("9")).toBeInTheDocument();
      expect(screen.getByText("CLR")).toBeInTheDocument();
      expect(screen.getByText("DEL")).toBeInTheDocument();
      expect(screen.getByText("Charge & Generate QRIS")).toBeInTheDocument();
    });

    it("updates amount upon clicking digits and preset chips", async () => {
      render(<CashierPosNumpad />);

      // Click preset chip 50K
      const chip50k = screen.getByText("50K");
      fireEvent.click(chip50k);
      expect(screen.getByText("50.000")).toBeInTheDocument();

      // Click numpad digit 0
      const btn0 = screen.getByText("0");
      fireEvent.click(btn0);
      expect(screen.getByText("500.000")).toBeInTheDocument();

      // Click CLR
      const btnClr = screen.getByText("CLR");
      fireEvent.click(btnClr);
      expect(screen.getAllByText("0").length).toBeGreaterThanOrEqual(1);
    });

    it("generates dynamic QRIS when Charge button is clicked", async () => {
      render(<CashierPosNumpad />);
      const chip100k = screen.getByText("100K");
      fireEvent.click(chip100k);

      const chargeBtn = screen.getByText("Charge & Generate QRIS");
      fireEvent.click(chargeBtn);

      await waitFor(() => {
        expect(screen.getByText("QRIS DYNAMIC")).toBeInTheDocument();
        expect(screen.getByText("Simulate Customer Payment")).toBeInTheDocument();
      });
    });
  });

  describe("Merchant Settlement Reconciliation & Multi-Channel Payouts", () => {
    it("renders settlement reconciliation table and KPI cards", () => {
      render(<MerchantSettlementReconciliation />);
      expect(
        screen.getByText("Merchant Settlement Reconciliation & Multi-Channel Payouts")
      ).toBeInTheDocument();
      expect(screen.getByText("Gross Inbound Volume")).toBeInTheDocument();
      expect(screen.getByText("BI QRIS MDR Withheld")).toBeInTheDocument();
      expect(screen.getByText("Net Merchant Payout")).toBeInTheDocument();
      expect(screen.getByText("Export CSV")).toBeInTheDocument();
    });

    it("displays settlement batches with BI-FAST clearing channels", () => {
      render(<MerchantSettlementReconciliation />);
      expect(screen.getByText("BATCH-20260908-01")).toBeInTheDocument();
      expect(screen.getByText("Disburse BI-FAST")).toBeInTheDocument();
    });

    it("triggers disburse action on ready batch", async () => {
      render(<MerchantSettlementReconciliation />);
      const disburseBtn = screen.getByText("Disburse BI-FAST");
      fireEvent.click(disburseBtn);

      await waitFor(() => {
        expect(disburseBtn.closest("button")).toBeDisabled();
      });
    });
  });

  describe("Dispute & Chargeback Resolution Center", () => {
    it("renders dispute queue and held escrow balance KPI", () => {
      render(<DisputeResolutionCenter />);
      expect(
        screen.getByText("Dispute & Chargeback Resolution Center")
      ).toBeInTheDocument();
      expect(screen.getByText("Escrow Funds Held")).toBeInTheDocument();
      expect(screen.getAllByText("Action Required").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("Under Bank Review")).toBeInTheDocument();
      expect(screen.getByText("Cases Won / Protected")).toBeInTheDocument();
    });

    it("allows opening evidence modal for dispute contestation", async () => {
      render(<DisputeResolutionCenter />);
      const contestBtn = screen.getByText("Contest");
      fireEvent.click(contestBtn);

      await waitFor(() => {
        expect(screen.getByText(/Submit Dispute Evidence/i)).toBeInTheDocument();
        expect(screen.getByText("Submit Contest Evidence")).toBeInTheDocument();
      });
    });
  });
  describe("QRIS Payment System & Bank Selection (Zero Duplicate Keys)", () => {
    beforeEach(() => {
      class MockResizeObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
      }
      global.ResizeObserver = MockResizeObserver as any;
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ transactions: [], disbursements: [] }),
      } as any);
      class MockEventSource {
        addEventListener() {}
        close() {}
      }
      (global as any).EventSource = MockEventSource;
    });

    it("renders QrisPaymentSystem without throwing duplicate key errors for BCA or other banks", () => {
      const consoleErrorSpy = vi.spyOn(console, "error");
      render(<QrisPaymentSystem />);
      expect(screen.getByText("heroTitle")).toBeInTheDocument();

      // Ensure no duplicate key warning was logged
      const duplicateKeyWarnings = consoleErrorSpy.mock.calls.filter((call) =>
        call.some((arg) => typeof arg === "string" && arg.includes("Encountered two children with the same key"))
      );
      expect(duplicateKeyWarnings).toHaveLength(0);
      consoleErrorSpy.mockRestore();
    });

    it("opens Withdraw Store Income modal and renders bank selector without duplicate BCA key", () => {
      const consoleErrorSpy = vi.spyOn(console, "error");
      render(<QrisPaymentSystem />);
      const withdrawBtns = screen.getAllByText("withdrawBtn");
      fireEvent.click(withdrawBtns[0]);

      // Switch to bank_transfer channel
      const bankTab = screen.getByRole("tab", { name: /Bank/i });
      fireEvent.click(bankTab);

      // Verify no duplicate key error
      const duplicateKeyWarnings = consoleErrorSpy.mock.calls.filter((call) =>
        call.some((arg) => typeof arg === "string" && arg.includes("Encountered two children with the same key"))
      );
      expect(duplicateKeyWarnings).toHaveLength(0);
      consoleErrorSpy.mockRestore();
    });

    it("applies theme-default colors instead of hardcoded red to QRIS generator and standee", () => {
      render(<QrisPaymentSystem />);
      const generateBtn = screen.getByRole("button", { name: /Generate New Dynamic QRIS/i });
      expect(generateBtn.className).toContain("bg-primary");
      expect(generateBtn.className).not.toContain("bg-red-600");

      const qrisHeading = screen.getByRole("heading", { name: "QRIS", level: 3 });
      expect(qrisHeading.className).toContain("text-foreground");
      expect(qrisHeading.className).not.toContain("text-red-600");

      const subtitle = screen.getByText(/Quick Response Code Indonesia Standard/i);
      expect(subtitle.className).not.toContain("text-red-600");
    });
  });
});
