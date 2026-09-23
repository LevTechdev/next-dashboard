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

// next/navigation — the ?month= deep-link filter reads useSearchParams. The
// component re-renders after suspension, so the router mocks must be stable.
const mockRouterReplace = vi.fn();
const mockSearchParams = new URLSearchParams();
vi.mock("next/navigation", () => ({
  usePathname: () => "/en/analytics",
  useParams: () => ({ locale: "en" }),
  useSearchParams: () => mockSearchParams,
  useRouter: () => ({ push: vi.fn(), replace: mockRouterReplace }),
}));

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

const ordersState = {
  data: [],
  loading: false,
  lastUpdated: new Date(),
  isRefreshing: false,
  refresh: vi.fn(),
  error: null,
};

// The page polls two endpoints — /api/dashboard for the KPIs and /api/orders
// for the funnel/geo breakdown, and React StrictMode double-invokes effects,
// so calls are served by URL instead of a one-shot queue (a Once-queue starves
// on re-render and the destructure crashes on undefined).
function mockRealtimeData() {
  mockUseRealtimeData.mockImplementation((url: string) =>
    url === "/api/dashboard" ? loadedState : ordersState,
  );
}

describe("Analytics Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-install the stable URL-based implementation after clearAllMocks.
    mockRealtimeData();
  });

  it("renders loading skeleton when loading", () => {
    mockUseRealtimeData.mockImplementation((url: string) =>
      url === "/api/dashboard" ? loadingState : ordersState,
    );
    const { container } = render(<AnalyticsPage />);
    expect(container.querySelector(".shimmer")).toBeInTheDocument();
  });

  it("renders the page heading with data", () => {
    mockRealtimeData();
    render(<AnalyticsPage />);
    expect(screen.getByText("Analytics")).toBeInTheDocument();
    expect(screen.getByText(/revenue trends/i)).toBeInTheDocument();
  });

  it("renders metric cards", () => {
    mockRealtimeData();
    render(<AnalyticsPage />);
    expect(screen.getByText("Total Revenue")).toBeInTheDocument();
    expect(screen.getAllByText("Total Orders").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Total Customers").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Sales by Channel").length).toBeGreaterThanOrEqual(1);
  });

  it("renders tab navigation", () => {
    mockRealtimeData();
    render(<AnalyticsPage />);
    expect(screen.getByText(/revenue trends/i)).toBeInTheDocument();
    const channelElements = screen.getAllByText("Sales by Channel");
    expect(channelElements.length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Top Products").length).toBeGreaterThanOrEqual(1);
  });

  it("renders Revenue Trends chart section", () => {
    mockRealtimeData();
    render(<AnalyticsPage />);
    expect(screen.getAllByText("Revenue Overview").length).toBeGreaterThanOrEqual(1);
  });

  it("renders the Refresh button", () => {
    mockRealtimeData();
    render(<AnalyticsPage />);
    expect(screen.getByText("View")).toBeInTheDocument();
  });
});
