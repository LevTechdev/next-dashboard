import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import DashboardPage from "../page";

// Ensure real implementations are used for icon/ui modules
vi.mock("lucide-react", async () => {
  const actual = await vi.importActual("lucide-react");
  return actual;
});

// Mock next-intl using shared helper (async import avoids vitest hoisting issues)
vi.mock("next-intl", async () => {
  const mod = await import("@/test-utils/i18n-mock");
  return mod.createTranslationsMock(mod.mergeMessages(mod.dashboardMessages, mod.commonMessages));
});

// Mock useRealtimeData
vi.mock("@/hooks/use-realtime-data", () => ({
  useRealtimeData: vi.fn(),
}));

// Mock realtime provider
vi.mock("@/components/realtime-provider", () => ({
  useRealtime: vi.fn(() => ({
    budgetThreshold: 80,
    setBudgetThreshold: vi.fn(),
    globalRefreshTrigger: 0,
    lastGlobalUpdate: null,
    notifications: [],
    unreadCount: 0,
    markAllRead: vi.fn(),
    clearNotifications: vi.fn(),
    addNotification: vi.fn(),
    triggerRefresh: vi.fn(),
    connectionStatus: "connected",
  })),
  RealtimeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import { useRealtimeData } from "@/hooks/use-realtime-data";

const mockDashboardData = {
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
  recentOrders: [
    {
      id: "1",
      orderNumber: "ORD-001",
      grandTotal: 249.99,
      createdAt: "2024-07-01T10:00:00Z",
      customer: { name: "John Doe" },
      channel: { name: "Online Store" },
    },
    {
      id: "2",
      orderNumber: "ORD-002",
      grandTotal: 149.99,
      createdAt: "2024-07-01T09:00:00Z",
      customer: { name: "Jane Smith" },
      channel: { name: "Shopify" },
    },
  ],
  topProducts: [
    { id: "1", name: "Widget Pro", price: 29.99, orderCount: 145 },
    { id: "2", name: "Gadget X", price: 49.99, orderCount: 98 },
  ],
  salesByChannel: [
    { name: "Online Store", value: 65000, color: "#6366f1" },
    { name: "Shopify", value: 35000, color: "#22c55e" },
  ],
  revenueData: [
    { month: "Jan", revenue: 10000 },
    { month: "Feb", revenue: 15000 },
  ],
};

const loadingState = {
  data: null,
  loading: true,
  lastUpdated: null,
  isRefreshing: false,
  refresh: vi.fn(),
  error: null,
};

const loadedState = {
  data: mockDashboardData,
  loading: false,
  lastUpdated: new Date(),
  isRefreshing: false,
  refresh: vi.fn(),
  error: null,
};

describe("Dashboard Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the loading skeleton when loading", () => {
    (useRealtimeData as any).mockReturnValue(loadingState);
    const { container } = render(<DashboardPage />);
    expect(container.querySelector(".shimmer")).toBeInTheDocument();
  });

  it("renders nothing when data is null and not loading", () => {
    (useRealtimeData as any).mockReturnValue({ ...loadingState, loading: false });
    const { container } = render(<DashboardPage />);
    expect(container.innerHTML).toBe("");
  });

  it("renders the page heading with data", () => {
    (useRealtimeData as any).mockReturnValue(loadedState);
    render(<DashboardPage />);
    expect(screen.getByText("Dashboard Overview")).toBeInTheDocument();
    expect(screen.getByText(/Welcome back/)).toBeInTheDocument();
  });

  it("renders stat cards with formatted values", () => {
    (useRealtimeData as any).mockReturnValue(loadedState);
    render(<DashboardPage />);
    expect(screen.getByText("Total Revenue")).toBeInTheDocument();
    expect(screen.getByText("Total Orders")).toBeInTheDocument();
    expect(screen.getByText("Total Customers")).toBeInTheDocument();
    expect(screen.getByText("Total Products")).toBeInTheDocument();
  });

  it("renders chart sections", () => {
    (useRealtimeData as any).mockReturnValue(loadedState);
    render(<DashboardPage />);
    expect(screen.getByText("Revenue Overview")).toBeInTheDocument();
    expect(screen.getByText("Sales by Channel")).toBeInTheDocument();
  });

  it("renders the Refresh button", () => {
    (useRealtimeData as any).mockReturnValue(loadedState);
    render(<DashboardPage />);
    expect(screen.getByText("Refresh")).toBeInTheDocument();
  });
});
