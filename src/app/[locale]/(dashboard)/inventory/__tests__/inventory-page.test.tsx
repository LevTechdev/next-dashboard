import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

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

describe("Inventory Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve([
          { id: "1", name: "Widget Pro", sku: "WGT-001", price: 29.99, stock: 50 },
          { id: "2", name: "Gadget X", sku: "GDG-002", price: 49.99, stock: 5 },
          { id: "3", name: "Old Model", sku: "OLD-003", price: 9.99, stock: 0 },
        ]),
    } as Response);
  });

  it("renders the page heading", async () => {
    render(<InventoryPage />);
    await waitFor(() => {});
    expect(screen.getByText("Inventory Management")).toBeInTheDocument();
    expect(screen.getByText("Track stock levels and inventory movements")).toBeInTheDocument();
  });

  it("renders stock summary cards", async () => {
    render(<InventoryPage />);
    await waitFor(() => {});
    expect(screen.queryAllByText("In Stock").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryAllByText("Low Stock").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryAllByText("Out of Stock").length).toBeGreaterThanOrEqual(1);
  });

  it("renders the search input", async () => {
    render(<InventoryPage />);
    await waitFor(() => {});
    expect(screen.getByPlaceholderText("Search...")).toBeInTheDocument();
  });

  it("renders table headers", async () => {
    render(<InventoryPage />);
    await waitFor(() => {});
    expect(screen.getByText("Product")).toBeInTheDocument();
    expect(screen.getByText("SKU")).toBeInTheDocument();
    expect(screen.getAllByText("Price").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryAllByText("Current Stock").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Status")).toBeInTheDocument();
  });
});
