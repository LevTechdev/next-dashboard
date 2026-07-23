import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import MarketingPage from "../page";

// Ensure real implementations are used for icon/ui modules
vi.mock("lucide-react", async () => {
  const actual = await vi.importActual("lucide-react");
  return actual;
});

// Mock useAuth
vi.mock("@/hooks/use-auth", () => ({
  useAuth: vi.fn(),
}));

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: () => "/en/marketing",
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
          name: "Summer Sale 2024",
          type: "EMAIL",
          channel: "email",
          budget: 5000,
          spent: 3200,
          status: "ACTIVE",
        },
        {
          id: "2",
          name: "Social Blast",
          type: "SOCIAL",
          channel: "instagram",
          budget: 2000,
          spent: 2100,
          status: "ACTIVE",
        },
      ]),
  } as Response);
});

describe("Marketing Page", () => {
  it("renders the page heading", async () => {
    render(<MarketingPage />);
    await waitFor(() => {});
    expect(screen.getByText("Marketing Campaigns")).toBeInTheDocument();
    expect(screen.getByText("Manage your marketing campaigns across channels")).toBeInTheDocument();
  });

  it("renders the Add Campaign button", async () => {
    render(<MarketingPage />);
    await waitFor(() => {});
    expect(screen.getByText("Add Campaign")).toBeInTheDocument();
  });

  it("renders table headers", async () => {
    render(<MarketingPage />);
    await waitFor(() => {});
    expect(screen.getByText("Campaign Name")).toBeInTheDocument();
    expect(screen.getByText("Type")).toBeInTheDocument();
    expect(screen.getByText("Channel")).toBeInTheDocument();
    expect(screen.getByText("Budget")).toBeInTheDocument();
    expect(screen.getByText("Spent")).toBeInTheDocument();
    expect(screen.getByText("ROI")).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();
  });
});
