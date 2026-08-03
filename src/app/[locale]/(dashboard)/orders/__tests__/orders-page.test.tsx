import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import OrdersPage from "../page";

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

import { useRealtimeData } from "@/hooks/use-realtime-data";

const mockOrders = [
  {
    id: "1",
    orderNumber: "ORD-001",
    grandTotal: 249.99,
    totalAmount: 229.99,
    shippingAmount: 20,
    discountAmount: 0,
    taxAmount: 0,
    status: "PENDING",
    paymentStatus: "UNPAID",
    paymentMethod: "credit_card",
    createdAt: "2024-07-01T10:00:00Z",
    updatedAt: "2024-07-01T10:00:00Z",
    customer: { name: "John Doe", email: "john@test.com" },
    channel: { name: "Online Store" },
    items: [{ id: "1", name: "Widget", quantity: 2, price: 50, total: 100 }],
  },
  {
    id: "2",
    orderNumber: "ORD-002",
    grandTotal: 149.99,
    totalAmount: 139.99,
    shippingAmount: 10,
    discountAmount: 0,
    taxAmount: 0,
    status: "DELIVERED",
    paymentStatus: "PAID",
    paymentMethod: "paypal",
    createdAt: "2024-07-01T09:00:00Z",
    updatedAt: "2024-07-01T15:00:00Z",
    customer: { name: "Jane Smith" },
    channel: { name: "Shopify" },
    items: [{ id: "2", name: "Gadget", quantity: 1, price: 139.99, total: 139.99 }],
  },
];

const loadedState = {
  data: mockOrders,
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

describe("Orders Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders loading state", () => {
    (useRealtimeData as any).mockReturnValue(loadingState);
    const { container } = render(<OrdersPage />);
    expect(container.querySelector("div")).toBeInTheDocument();
  });

  it("renders the page heading with data", () => {
    (useRealtimeData as any).mockReturnValue(loadedState);
    render(<OrdersPage />);
    expect(screen.getByText("Order Management")).toBeInTheDocument();
    expect(screen.getByText("Track and manage all orders")).toBeInTheDocument();
  });

  it("renders the search input", () => {
    (useRealtimeData as any).mockReturnValue(loadedState);
    render(<OrdersPage />);
    expect(screen.getByPlaceholderText("Search...")).toBeInTheDocument();
  });

  it("renders table headers", () => {
    (useRealtimeData as any).mockReturnValue(loadedState);
    render(<OrdersPage />);
    expect(screen.getByText("Order #")).toBeInTheDocument();
    expect(screen.getByText("Customer")).toBeInTheDocument();
    expect(screen.getByText("Channel")).toBeInTheDocument();
    expect(screen.getByText("Items")).toBeInTheDocument();
    expect(screen.getByText("Total")).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();
    expect(screen.getByText("Payment")).toBeInTheDocument();
    expect(screen.getByText("Date")).toBeInTheDocument();
    expect(screen.getByText("Actions")).toBeInTheDocument();
  });

  it("renders order data in the table", () => {
    (useRealtimeData as any).mockReturnValue(loadedState);
    render(<OrdersPage />);
    expect(screen.getByText("#ORD-001")).toBeInTheDocument();
    expect(screen.getByText("#ORD-002")).toBeInTheDocument();
    expect(screen.getByText("John Doe")).toBeInTheDocument();
    expect(screen.getByText("Jane Smith")).toBeInTheDocument();
  });

  it("renders the Export button", () => {
    (useRealtimeData as any).mockReturnValue(loadedState);
    render(<OrdersPage />);
    expect(screen.getByText("Export")).toBeInTheDocument();
  });
});
