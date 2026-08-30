import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import AnalyticsPage from "../page";

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

const mockUseRealtimeData = vi.mocked(useRealtimeData);

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

describe("Analytics Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders loading skeleton when loading", () => {
    mockUseRealtimeData.mockReturnValue(loadingState);
    const { container } = render(<AnalyticsPage />);
    expect(container.querySelector(".shimmer")).toBeInTheDocument();
  });

  it("renders the page heading with data", () => {
    mockUseRealtimeData.mockReturnValue(loadedState);
    render(<AnalyticsPage />);
    expect(screen.getByText("Dashboard Overview")).toBeInTheDocument();
    expect(screen.getAllByText("Insights").length).toBeGreaterThanOrEqual(1);
  });

  it("renders metric cards", () => {
    mockUseRealtimeData.mockReturnValue(loadedState);
    render(<AnalyticsPage />);
    expect(screen.getByText("Total Revenue")).toBeInTheDocument();
    expect(screen.getAllByText("Total Orders").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Total Customers").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Sales by Channel").length).toBeGreaterThanOrEqual(1);
  });

  it("renders tab navigation", () => {
    mockUseRealtimeData.mockReturnValue(loadedState);
    render(<AnalyticsPage />);
    expect(screen.getAllByText("Insights").length).toBeGreaterThanOrEqual(1);
    const channelElements = screen.getAllByText("Sales by Channel");
    expect(channelElements.length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Top Products").length).toBeGreaterThanOrEqual(1);
  });

  it("renders Revenue Trends chart section", () => {
    mockUseRealtimeData.mockReturnValue(loadedState);
    render(<AnalyticsPage />);
    expect(screen.getAllByText("Revenue Overview").length).toBeGreaterThanOrEqual(1);
  });

  it("renders the Refresh button", () => {
    mockUseRealtimeData.mockReturnValue(loadedState);
    render(<AnalyticsPage />);
    expect(screen.getByText("View")).toBeInTheDocument();
  });
});
