import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import CustomersPage from "../page";

// Ensure real implementations are used for icon/ui modules
vi.mock("lucide-react", async () => {
  const actual = await vi.importActual("lucide-react");
  return actual;
});

// Mock useRealtimeData
vi.mock("@/hooks/use-realtime-data", () => ({
  useRealtimeData: vi.fn(),
}));

// Mock useAuth
vi.mock("@/hooks/use-auth", () => ({
  useAuth: vi.fn(),
}));

import { useRealtimeData } from "@/hooks/use-realtime-data";
import { useAuth } from "@/hooks/use-auth";

const mockCustomers = [
  { id: "1", name: "Alice Johnson", email: "alice@test.com", phone: "+1-555-0101", city: "New York", segment: "VIP", totalSpent: 15000, createdAt: "2024-01-15", lastOrderDate: "2024-06-28" },
  { id: "2", name: "Bob Williams", email: "bob@test.com", phone: "+1-555-0102", city: "Los Angeles", segment: "REGULAR", totalSpent: 3200, createdAt: "2024-03-20", lastOrderDate: "2024-06-15" },
  { id: "3", name: "Charlie Brown", email: "charlie@test.com", segment: "NEW", totalSpent: 0, createdAt: "2024-07-01" },
];

const loadedState = {
  data: mockCustomers,
  loading: false,
  lastUpdated: new Date(),
  isRefreshing: false,
  refresh: vi.fn(),
  error: null,
};

const mockUser = {
  user: { name: "Admin", email: "admin@test.com", role: "ADMIN" },
  isLoading: false,
  error: null,
  isAuthenticated: true,
};

describe("Customers Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useRealtimeData as any).mockReturnValue(loadedState);
    (useAuth as any).mockReturnValue(mockUser);
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    } as Response);
  });

  it("renders the page heading", () => {
    render(<CustomersPage />);
    expect(screen.getAllByText("Customer Management").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("View and manage your customer base")).toBeInTheDocument();
  });

  it("renders the Add Customer button", () => {
    render(<CustomersPage />);
    expect(screen.getByText("Add Customer")).toBeInTheDocument();
  });

  it("renders the search input", () => {
    render(<CustomersPage />);
    expect(screen.getByPlaceholderText("Search customers...")).toBeInTheDocument();
  });

  it("renders table headers", () => {
    render(<CustomersPage />);
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("City")).toBeInTheDocument();
    expect(screen.getByText("Segment")).toBeInTheDocument();
    expect(screen.getAllByText("Total Spent").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Orders").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Last Order")).toBeInTheDocument();
    expect(screen.getByText("Actions")).toBeInTheDocument();
    // Contact column uses tcommon("filter") which resolves to "Filter" (also used elsewhere)
    expect(screen.getAllByText("Filter").length).toBeGreaterThanOrEqual(1);
  });

  it("renders customer data in the table", () => {
    render(<CustomersPage />);
    expect(screen.getByText("Alice Johnson")).toBeInTheDocument();
    expect(screen.getByText("Bob Williams")).toBeInTheDocument();
  });
});
