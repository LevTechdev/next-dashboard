import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import SalesPage from "../page";

// Ensure real implementations are used for icon/ui modules
vi.mock("lucide-react", async () => {
  const actual = await vi.importActual("lucide-react");
  return actual;
});

// Mock useRealtimeData
vi.mock("@/hooks/use-realtime-data", () => ({
  useRealtimeData: vi.fn(),
}));

import { useRealtimeData } from "@/hooks/use-realtime-data";

const mockOrders = [
  { id: "1", orderNumber: "ORD-001", grandTotal: 249.99, status: "PENDING", paymentStatus: "UNPAID", createdAt: "2024-07-01T10:00:00Z", customer: { name: "John Doe" }, channel: { name: "Online Store" } },
  { id: "2", orderNumber: "ORD-002", grandTotal: 149.99, status: "DELIVERED", paymentStatus: "PAID", createdAt: "2024-07-01T09:00:00Z", customer: { name: "Jane Smith" }, channel: { name: "Shopify" } },
];

const loadedState = {
  data: mockOrders,
  loading: false,
  lastUpdated: new Date(),
  isRefreshing: false,
  refresh: vi.fn(),
  error: null,
};

describe("Sales Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useRealtimeData as any).mockReturnValue(loadedState);
  });

  it("renders the page heading", () => {
    render(<SalesPage />);
    expect(screen.getByText("Sales Management")).toBeInTheDocument();
    expect(screen.getByText("Manage and track all sales across channels")).toBeInTheDocument();
  });

  it("renders stat cards", () => {
    render(<SalesPage />);
    expect(screen.getByText("Total Sales")).toBeInTheDocument();
    expect(screen.getByText("Total Orders")).toBeInTheDocument();
    expect(screen.getByText("Avg Order Value")).toBeInTheDocument();
    expect(screen.getByText("Conversion Rate")).toBeInTheDocument();
  });

  it("renders filter dropdowns", () => {
    render(<SalesPage />);
    expect(screen.getByText("All Channels")).toBeInTheDocument();
    expect(screen.getByText("All")).toBeInTheDocument();
  });

  it("renders table headers", () => {
    render(<SalesPage />);
    expect(screen.getByText("Orders List")).toBeInTheDocument();
    expect(screen.getByText("Amount")).toBeInTheDocument();
    expect(screen.getByText("Date")).toBeInTheDocument();
  });

  it("renders order data", () => {
    render(<SalesPage />);
    expect(screen.getByText("#ORD-001")).toBeInTheDocument();
    expect(screen.getByText("#ORD-002")).toBeInTheDocument();
  });
});
