import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import DiscountsPage from "../page";

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

// Mock useAuth
vi.mock("@/hooks/use-auth", () => ({
  useAuth: vi.fn(),
}));

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: () => "/en/discounts",
  useParams: () => ({ locale: "en" }),
}));

import { useAuth } from "@/hooks/use-auth";

const mockUser = {
  user: { name: "Admin", email: "admin@test.com", role: "ADMIN" },
  isLoading: false,
  error: null,
  isAuthenticated: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  (useAuth as any).mockReturnValue(mockUser);
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () =>
      Promise.resolve([
        {
          id: "1",
          code: "SAVE20",
          name: "Summer Sale",
          type: "PERCENTAGE",
          value: 20,
          minPurchase: 50,
          maxUses: 100,
          usedCount: 45,
          startsAt: "2024-01-01",
          endsAt: "2024-12-31",
          isActive: true,
        },
        {
          id: "2",
          code: "FLAT10",
          name: "Flat Discount",
          type: "FIXED",
          value: 10,
          minPurchase: 0,
          maxUses: 50,
          usedCount: 50,
          startsAt: "2024-01-01",
          endsAt: "2024-06-30",
          isActive: false,
        },
      ]),
  } as Response);
});

describe("Discounts Page", () => {
  it("renders the page heading", async () => {
    render(<DiscountsPage />);
    await waitFor(() => {});
    expect(screen.getByText("Discounts & Coupons")).toBeInTheDocument();
    expect(screen.getByText("Create and manage discount codes and promotions")).toBeInTheDocument();
  });

  it("renders the Add Discount button", async () => {
    render(<DiscountsPage />);
    await waitFor(() => {});
    expect(screen.getByText("Add Discount")).toBeInTheDocument();
  });

  it("renders table headers", async () => {
    render(<DiscountsPage />);
    await waitFor(() => {});
    expect(screen.getByText("Code")).toBeInTheDocument();
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Type")).toBeInTheDocument();
    expect(screen.getByText("Value")).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();
  });
});
