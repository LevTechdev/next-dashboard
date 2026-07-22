import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import ProductsPage from "../page";

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

const mockProductsData = {
  products: [
    { id: "1", name: "Widget Pro", description: "High-quality widget", price: 29.99, costPrice: 15.00, stock: 50, sku: "WGT-001", categoryId: "cat1", category: { name: "Widgets" } },
    { id: "2", name: "Gadget X", description: "Next-gen gadget", price: 49.99, costPrice: 25.00, stock: 5, sku: "GDG-002", categoryId: "cat2", category: { name: "Gadgets" } },
    { id: "3", name: "Old Model", description: "Discontinued", price: 9.99, costPrice: 8.00, stock: 0, sku: "OLD-003" },
  ],
  categories: [
    { id: "cat1", name: "Widgets" },
    { id: "cat2", name: "Gadgets" },
  ],
};

const loadedState = {
  data: mockProductsData,
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

describe("Products Page", () => {
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
    render(<ProductsPage />);
    expect(screen.getAllByText("Product Management").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Manage your product catalog and inventory")).toBeInTheDocument();
  });

  it("renders the Add Product button", () => {
    render(<ProductsPage />);
    expect(screen.getByText("Add Product")).toBeInTheDocument();
  });

  it("renders the search input", () => {
    render(<ProductsPage />);
    expect(screen.getByPlaceholderText("Search...")).toBeInTheDocument();
  });

  it("renders table headers", () => {
    render(<ProductsPage />);
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getAllByText("Category").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Price").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Cost Price")).toBeInTheDocument();
    expect(screen.getAllByText("Filter").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Stock").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("SKU")).toBeInTheDocument();
  });

  it("renders product names in the table", () => {
    render(<ProductsPage />);
    expect(screen.getByText("Widget Pro")).toBeInTheDocument();
    expect(screen.getByText("Gadget X")).toBeInTheDocument();
  });

  it("renders stock badges", () => {
    render(<ProductsPage />);
    expect(screen.getByText("In Stock (50)")).toBeInTheDocument();
    expect(screen.getByText("Low Stock (5)")).toBeInTheDocument();
    expect(screen.getByText("Out of Stock")).toBeInTheDocument();
  });
});
