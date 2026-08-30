import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import CustomersPage from "../page";

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
  {
    id: "1",
    name: "Alice Johnson",
    email: "alice@test.com",
    phone: "+1-555-0101",
    city: "New York",
    segment: "VIP",
    totalSpent: 15000,
    createdAt: "2024-01-15",
    lastOrderDate: "2024-06-28",
  },
  {
    id: "2",
    name: "Bob Williams",
    email: "bob@test.com",
    phone: "+1-555-0102",
    city: "Los Angeles",
    segment: "REGULAR",
    totalSpent: 3200,
    createdAt: "2024-03-20",
    lastOrderDate: "2024-06-15",
  },
  {
    id: "3",
    name: "Charlie Brown",
    email: "charlie@test.com",
    segment: "NEW",
    totalSpent: 0,
    createdAt: "2024-07-01",
  },
];

const loadedState = {
  data: mockCustomers,
  loading: false,
  lastUpdated: new Date(),
  isRefreshing: false,
  refresh: vi.fn(),
  error: null,
};

const makeCustomers = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    id: String(i + 1),
    name: `Customer ${i + 1}`,
    email: `customer${i + 1}@test.com`,
    phone: `+1-555-01${String(i + 1).padStart(2, "0")}`,
    city: "Jakarta",
    segment: "REGULAR",
    totalSpent: 100 + i,
    createdAt: "2024-07-01",
  }));

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

  it("paginates the customer table with page controls", () => {
    (useRealtimeData as any).mockReturnValue({ ...loadedState, data: makeCustomers(12) });
    render(<CustomersPage />);

    // Page 1 shows the first 10 rows; the 11th is not rendered yet.
    expect(screen.getByText("Customer 1")).toBeInTheDocument();
    expect(screen.getByText("Customer 10")).toBeInTheDocument();
    expect(screen.queryByText("Customer 11")).not.toBeInTheDocument();
    expect(screen.getByText("Showing 1–10 of 12")).toBeInTheDocument();

    // Jump to page 2: tail rows render, range updates, page 1 rows unmount.
    fireEvent.click(screen.getByRole("button", { name: "2" }));
    expect(screen.getByText("Customer 11")).toBeInTheDocument();
    expect(screen.getByText("Customer 12")).toBeInTheDocument();
    expect(screen.queryByText("Customer 1")).not.toBeInTheDocument();
    expect(screen.getByText("Showing 11–12 of 12")).toBeInTheDocument();

    // Previous returns to page 1.
    fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    expect(screen.getByText("Customer 1")).toBeInTheDocument();
    expect(screen.getByText("Showing 1–10 of 12")).toBeInTheDocument();
  });

  it("resets to page 1 when the search query changes", () => {
    (useRealtimeData as any).mockReturnValue({ ...loadedState, data: makeCustomers(12) });
    render(<CustomersPage />);

    fireEvent.click(screen.getByRole("button", { name: "2" }));
    expect(screen.getByText("Showing 11–12 of 12")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Search customers..."), {
      target: { value: "Customer 11" },
    });
    expect(screen.getByText("Showing 1–1 of 1")).toBeInTheDocument();
    expect(screen.getByText("Customer 11")).toBeInTheDocument();
  });
});
