import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

import InventoryPage from "../page";

// Ensure real implementations are used for icon/ui modules
vi.mock("lucide-react", async () => {
  const actual = await vi.importActual("lucide-react");
  return actual;
});

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: () => "/en/inventory",
  useParams: () => ({ locale: "en" }),
}));

// The PO table now calls useConfirm for the bulk-issue flow — provide the
// provider context the page expects.
vi.mock("@/components/ui/confirm-provider", () => ({
  useConfirm: () => async () => true,
}));

describe("Inventory Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // The page polls several endpoints; route each to its expected shape.
    global.fetch = vi.fn().mockImplementation((url: string) => {
      const json = (data: unknown) =>
        Promise.resolve({ ok: true, json: () => Promise.resolve(data) } as unknown as Response);

      if (String(url).includes("/api/products")) {
        return json({
          products: [
            {
              id: "1",
              name: "Widget Pro",
              sku: "WGT-001",
              price: 29.99,
              costPrice: 12,
              stock: 50,
              category: null,
              categoryId: null,
            },
            {
              id: "2",
              name: "Gadget X",
              sku: "GDG-002",
              price: 49.99,
              costPrice: 20,
              stock: 5,
              category: null,
              categoryId: null,
            },
            {
              id: "3",
              name: "Old Model",
              sku: "OLD-003",
              price: 9.99,
              costPrice: 4,
              stock: 0,
              category: null,
              categoryId: null,
            },
          ],
          categories: [],
          totalValue: 100000,
          lowStockCount: 1,
          outOfStockCount: 1,
          inStockCount: 1,
        });
      }
      if (String(url).includes("/api/inventory/replenishment")) {
        return json({ items: [], summary: {} });
      }
      if (String(url).includes("/api/inventory/purchase-orders")) {
        return json({ orders: [], summary: null });
      }
      if (String(url).includes("/api/inventory/warehouses")) {
        return json({ warehouses: [] });
      }
      return json({});
    });
  });

  it("renders the page heading", async () => {
    render(<InventoryPage />);
    expect(await screen.findByText("Inventory Management")).toBeInTheDocument();
    expect(screen.getByText("Track stock levels and inventory movements")).toBeInTheDocument();
  });

  it("renders stock summary cards", async () => {
    render(<InventoryPage />);
    expect((await screen.findAllByText("In Stock")).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Low Stock").length).toBeGreaterThanOrEqual(1);
    // "Out of Stock" exists only in the product-table row badges (there is no
    // such summary card), so wait for the table render instead of asserting
    // synchronously — the sync form raced the fetch and failed ~50% of CI runs.
    expect((await screen.findAllByText("Out of Stock")).length).toBeGreaterThanOrEqual(1);
  });

  it("renders the search input", async () => {
    render(<InventoryPage />);
    expect(
      await screen.findByPlaceholderText("Search products by name or SKU..."),
    ).toBeInTheDocument();
  });

  it("renders table headers", async () => {
    render(<InventoryPage />);
    await screen.findByText("Widget Pro");
    expect(screen.getByText("SKU")).toBeInTheDocument();
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Category")).toBeInTheDocument();
    expect(screen.getAllByText("Price").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Stock")).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();
  });
});
