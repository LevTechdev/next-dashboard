import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ProductsPage from "../page";

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

const mockProductsData = {
  products: [
    {
      id: "1",
      name: "Widget Pro",
      description: "High-quality widget",
      price: 29.99,
      costPrice: 15.0,
      stock: 50,
      sku: "WGT-001",
      categoryId: "cat1",
      category: { name: "Widgets" },
    },
    {
      id: "2",
      name: "Gadget X",
      description: "Next-gen gadget",
      price: 49.99,
      costPrice: 25.0,
      stock: 5,
      sku: "GDG-002",
      categoryId: "cat2",
      category: { name: "Gadgets" },
    },
    {
      id: "3",
      name: "Old Model",
      description: "Discontinued",
      price: 9.99,
      costPrice: 8.0,
      stock: 0,
      sku: "OLD-003",
    },
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

const makeProducts = (count: number) => ({
  products: Array.from({ length: count }, (_, i) => ({
    id: String(i + 1),
    name: `Product ${i + 1}`,
    description: `Product ${i + 1} description`,
    price: 10 + i,
    costPrice: 5 + i,
    stock: 20,
    sku: `SKU-${String(i + 1).padStart(3, "0")}`,
    categoryId: "cat1",
    category: { name: "Widgets" },
  })),
  categories: [{ id: "cat1", name: "Widgets" }],
});

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

  it("paginates the product table with page controls", () => {
    (useRealtimeData as any).mockReturnValue({ ...loadedState, data: makeProducts(12) });
    render(<ProductsPage />);

    // Page 1 shows the first 10 rows; the 11th is not rendered yet.
    expect(screen.getByText("Product 1")).toBeInTheDocument();
    expect(screen.getByText("Product 10")).toBeInTheDocument();
    expect(screen.queryByText("Product 11")).not.toBeInTheDocument();
    expect(screen.getByText("Showing 1–10 of 12")).toBeInTheDocument();

    // Jump to page 2: tail rows render, range updates, page 1 rows unmount.
    fireEvent.click(screen.getByRole("button", { name: "2" }));
    expect(screen.getByText("Product 11")).toBeInTheDocument();
    expect(screen.getByText("Product 12")).toBeInTheDocument();
    expect(screen.queryByText("Product 1")).not.toBeInTheDocument();
    expect(screen.getByText("Showing 11–12 of 12")).toBeInTheDocument();

    // Previous returns to page 1.
    fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    expect(screen.getByText("Product 1")).toBeInTheDocument();
    expect(screen.getByText("Showing 1–10 of 12")).toBeInTheDocument();
  });

  it("resets to page 1 when the search query changes", () => {
    (useRealtimeData as any).mockReturnValue({ ...loadedState, data: makeProducts(12) });
    render(<ProductsPage />);

    fireEvent.click(screen.getByRole("button", { name: "2" }));
    expect(screen.getByText("Showing 11–12 of 12")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Search..."), {
      target: { value: "Product 11" },
    });
    expect(screen.getByText("Showing 1–1 of 1")).toBeInTheDocument();
    expect(screen.getByText("Product 11")).toBeInTheDocument();
  });
});
