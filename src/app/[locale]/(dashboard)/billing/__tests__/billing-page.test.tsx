import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import BillingPage from "../page";

// Ensure real implementations are used for icon/ui modules
vi.mock("lucide-react", async () => {
  const actual = await vi.importActual("lucide-react");
  return actual;
});

// Mock confirm provider (page uses useConfirm for confirm dialogs)
vi.mock("@/components/ui/confirm-provider", () => ({
  useConfirm: vi.fn(() => vi.fn().mockResolvedValue(true)),
  ConfirmProvider: ({ children }: { children: any }) => <>{children}</>,
}));

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: () => "/en/billing",
  useParams: () => ({ locale: "en" }),
}));

describe("Billing Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          subscription: null,
          invoices: [],
          totals: { totalPaid: 0, totalInvoices: 0 },
        }),
    } as Response);
  });

  it("renders the page heading", async () => {
    render(<BillingPage />);
    await waitFor(() => {});
    expect(screen.getByText("Subscription & Billing")).toBeInTheDocument();
    expect(
      screen.getByText("Manage your plan, view invoices, and update payment information"),
    ).toBeInTheDocument();
  });

  it("renders tab navigation", async () => {
    render(<BillingPage />);
    await waitFor(() => {});
    expect(screen.getByText("Overview")).toBeInTheDocument();
    expect(screen.getByText("Plans")).toBeInTheDocument();
    expect(screen.getByText("Invoices")).toBeInTheDocument();
    expect(screen.getByText("Payment")).toBeInTheDocument();
  });

  it("renders the Overview tab with no plan state", async () => {
    render(<BillingPage />);
    expect(await screen.findByText("No Active Plan")).toBeInTheDocument();
    expect(screen.getByText("Choose a plan to get started")).toBeInTheDocument();
  });
});
