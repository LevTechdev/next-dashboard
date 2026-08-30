import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import ReportsPage from "../page";

// Mock lucide-react icons used by the page
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
  stats: {
    totalRevenue: 124000,
    totalOrders: 2847,
    totalCustomers: 1250,
    totalProducts: 342,
    revenueGrowth: 12.5,
    ordersGrowth: 8.3,
    customersGrowth: 15.2,
    productsGrowth: 5.1,
  },
  salesByChannel: [{ name: "Online Store", value: 65000, color: "#6366f1" }],
  revenueData: [{ month: "Jan", revenue: 10000 }],
  topProducts: [{ id: "1", name: "Widget Pro", price: 29.99, orderCount: 145 }],
};

const mockOrders = [
  {
    id: "1",
    grandTotal: 29.99,
    status: "COMPLETED",
    createdAt: "2026-08-01",
    customer: { name: "Test" },
  },
];

const mockCustomers = [
  { id: "1", name: "Test Customer", email: "test@test.com", createdAt: "2026-08-01" },
];

const makeLoadedState = (data: any) => ({
  data,
  loading: false,
  lastUpdated: new Date(),
  isRefreshing: false,
  refresh: vi.fn(),
  error: null,
});

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
    (useRealtimeData as any)
      .mockReturnValueOnce(makeLoadedState(mockData))
      .mockReturnValueOnce(makeLoadedState(mockOrders))
      .mockReturnValueOnce(makeLoadedState(mockCustomers));
    render(<ReportsPage />);
    expect(screen.getByText("Reports")).toBeInTheDocument();
    expect(screen.getByText("Generate and view business reports")).toBeInTheDocument();
  });

  it("renders the date range filter", () => {
    (useRealtimeData as any)
      .mockReturnValueOnce(makeLoadedState(mockData))
      .mockReturnValueOnce(makeLoadedState(mockOrders))
      .mockReturnValueOnce(makeLoadedState(mockCustomers));
    render(<ReportsPage />);
    expect(screen.getByText("Date Range")).toBeInTheDocument();
  });

  it("renders the report tabs", () => {
    (useRealtimeData as any)
      .mockReturnValueOnce(makeLoadedState(mockData))
      .mockReturnValueOnce(makeLoadedState(mockOrders))
      .mockReturnValueOnce(makeLoadedState(mockCustomers));
    render(<ReportsPage />);
    expect(screen.getByText("Overview")).toBeInTheDocument();
  });

  it("renders sales metrics with correct i18n keys", () => {
    (useRealtimeData as any)
      .mockReturnValueOnce(makeLoadedState(mockData))
      .mockReturnValueOnce(makeLoadedState(mockOrders))
      .mockReturnValueOnce(makeLoadedState(mockCustomers));
    render(<ReportsPage />);
    // The reports page uses reports.* i18n keys, not dashboard.*
    expect(screen.getByText("Revenue in range")).toBeInTheDocument();
    expect(screen.getByText("Orders in range")).toBeInTheDocument();
    expect(screen.getByText("New customers in range")).toBeInTheDocument();
  });
});
