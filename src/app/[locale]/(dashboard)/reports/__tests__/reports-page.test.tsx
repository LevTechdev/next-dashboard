import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import ReportsPage from "../page";

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

const mockData = {
  stats: { totalRevenue: 124000, totalOrders: 2847, totalCustomers: 1250, totalProducts: 342, revenueGrowth: 12.5, ordersGrowth: 8.3, customersGrowth: 15.2, productsGrowth: 5.1 },
  salesByChannel: [{ name: "Online Store", value: 65000, color: "#6366f1" }],
  revenueData: [{ month: "Jan", revenue: 10000 }],
  topProducts: [{ id: "1", name: "Widget Pro", price: 29.99, orderCount: 145 }],
};

const loadedState = {
  data: mockData,
  loading: false,
  lastUpdated: new Date(),
  isRefreshing: false,
  refresh: vi.fn(),
  error: null,
};

const loadingState = {
  data: null,
  loading: true,
  lastUpdated: null,
  isRefreshing: false,
  refresh: vi.fn(),
  error: null,
};

describe("Reports Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders loading skeleton when loading", () => {
    (useRealtimeData as any).mockReturnValue(loadingState);
    const { container } = render(<ReportsPage />);
    expect(container.querySelector(".shimmer")).toBeInTheDocument();
  });

  it("renders the page heading with data", () => {
    (useRealtimeData as any).mockReturnValue(loadedState);
    render(<ReportsPage />);
    expect(screen.getByText("Reports")).toBeInTheDocument();
    expect(screen.getByText("Generate and view business reports")).toBeInTheDocument();
  });

  it("renders report type tabs", () => {
    (useRealtimeData as any).mockReturnValue(loadedState);
    render(<ReportsPage />);
    expect(screen.getByText("Sales Report")).toBeInTheDocument();
    expect(screen.getByText("Customer Report")).toBeInTheDocument();
    expect(screen.getByText("Product Report")).toBeInTheDocument();
  });

  it("renders the Export Report button", () => {
    (useRealtimeData as any).mockReturnValue(loadedState);
    render(<ReportsPage />);
    expect(screen.getByText("Export Report")).toBeInTheDocument();
  });

  it("renders sales metrics", () => {
    (useRealtimeData as any).mockReturnValue(loadedState);
    render(<ReportsPage />);
    expect(screen.getByText("Total Revenue")).toBeInTheDocument();
    expect(screen.getByText("Total Orders")).toBeInTheDocument();
    expect(screen.getByText("Avg Order Value")).toBeInTheDocument();
  });
});
