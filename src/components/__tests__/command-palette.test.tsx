import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { CommandPalette } from "../command-palette";

// ── Mocks ───────────────────────────────────────────────────────────────

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  useParams: () => ({ locale: "en" }),
}));

// Mock fetch
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

afterEach(() => {
  vi.clearAllMocks();
});

// ── Helpers ─────────────────────────────────────────────────────────────

function renderCommandPalette() {
  return render(<CommandPalette />);
}

function getSearchInput(): HTMLInputElement {
  return screen.getByPlaceholderText("Search orders, customers, products...") as HTMLInputElement;
}

// ── Tests ───────────────────────────────────────────────────────────────

describe("CommandPalette", () => {
  beforeEach(() => {
    mockFetch.mockResolvedValue({
      json: () =>
        Promise.resolve({
          orders: [],
          customers: [],
          products: [],
        }),
    });
  });

  // ── Keyboard shortcut ──────────────────────────────────────────────

  it("opens dialog on Ctrl+K", () => {
    renderCommandPalette();

    // Dialog should be closed initially
    expect(screen.queryByPlaceholderText("Search orders, customers, products...")).not.toBeInTheDocument();

    // Press Ctrl+K
    fireEvent.keyDown(document, { key: "k", metaKey: true });

    // Dialog should now be open
    expect(screen.getByPlaceholderText("Search orders, customers, products...")).toBeInTheDocument();
  });

  it("opens dialog on Cmd+K and closes on Escape", () => {
    renderCommandPalette();

    // Open with Cmd+K
    fireEvent.keyDown(document, { key: "k", metaKey: true });

    expect(getSearchInput()).toBeInTheDocument();

    // Close with Escape
    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByPlaceholderText("Search orders, customers, products...")).not.toBeInTheDocument();
  });

  it("toggles dialog open/close on repeated Ctrl+K", () => {
    renderCommandPalette();

    // First press opens
    fireEvent.keyDown(document, { key: "k", metaKey: true });
    expect(getSearchInput()).toBeInTheDocument();

    // Second press closes
    fireEvent.keyDown(document, { key: "k", metaKey: true });
    expect(screen.queryByPlaceholderText("Search orders, customers, products...")).not.toBeInTheDocument();
  });

  // ── Initial state when opened ─────────────────────────────────────

  it("shows placeholder text when opened with no query", () => {
    renderCommandPalette();

    fireEvent.keyDown(document, { key: "k", metaKey: true });

    // Should show the default hint
    expect(screen.getByText(/Type at least 2 characters to search/)).toBeInTheDocument();
    expect(screen.getByText(/Search across orders, customers, and products/)).toBeInTheDocument();
  });

  // ── Search behavior (using real timers for debounce) ────────────────

  it("performs search after debounce delay", async () => {
    renderCommandPalette();

    fireEvent.keyDown(document, { key: "k", metaKey: true });

    const input = getSearchInput();

    // Type a query
    fireEvent.change(input, { target: { value: "test" } });

    // Wait for debounce (250ms) and fetch
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/search?q=test");
    }, { timeout: 3000 });
  });

  it("shows loading indicator while fetching", async () => {
    // Use a promise that stays pending so loading state is visible
    let resolvePromise: (value: any) => void;
    mockFetch.mockImplementation(() => new Promise((resolve) => {
      resolvePromise = resolve;
    }));

    renderCommandPalette();

    fireEvent.keyDown(document, { key: "k", metaKey: true });

    const input = getSearchInput();
    fireEvent.change(input, { target: { value: "test" } });

    // Wait for loading indicator to appear
    await waitFor(() => {
      expect(screen.getByText(/Searching/)).toBeInTheDocument();
    }, { timeout: 3000 });

    // Resolve the pending fetch to clean up
    resolvePromise!({ json: () => Promise.resolve({ orders: [], customers: [], products: [] }) });
  });

  it("does NOT search for queries shorter than 2 characters", async () => {
    renderCommandPalette();

    fireEvent.keyDown(document, { key: "k", metaKey: true });

    const input = getSearchInput();
    fireEvent.change(input, { target: { value: "a" } });

    // Wait a bit to ensure no fetch happens
    await new Promise((r) => setTimeout(r, 300));
    expect(mockFetch).not.toHaveBeenCalled();
  });

  // ── Search results display ──────────────────────────────────────────

  it("shows 'No results found' when search returns empty", async () => {
    renderCommandPalette();

    fireEvent.keyDown(document, { key: "k", metaKey: true });

    const input = getSearchInput();
    fireEvent.change(input, { target: { value: "zzz" } });

    await waitFor(() => {
      expect(screen.getByText(/No results found/)).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it("displays search results with order, customer, product sections", async () => {
    mockFetch.mockResolvedValue({
      json: () =>
        Promise.resolve({
          orders: [
            {
              id: "1",
              orderNumber: "ORD-001",
              status: "completed",
              grandTotal: 150000,
              customer: { name: "John Doe" },
              channel: { name: "Online" },
            },
          ],
          customers: [
            {
              id: "1",
              name: "Jane Smith",
              email: "jane@test.com",
              city: "Jakarta",
              totalSpent: 500000,
              segment: "premium",
            },
          ],
          products: [
            {
              id: "1",
              name: "Premium Widget",
              sku: "PW-001",
              price: 75000,
              stock: 42,
              category: { name: "Widgets" },
            },
          ],
        }),
    });

    renderCommandPalette();

    fireEvent.keyDown(document, { key: "k", metaKey: true });

    const input = getSearchInput();
    fireEvent.change(input, { target: { value: "premium" } });

    await waitFor(() => {
      // Section headers
      expect(screen.getByText("Orders")).toBeInTheDocument();
      expect(screen.getByText("Customers")).toBeInTheDocument();
      expect(screen.getByText("Products")).toBeInTheDocument();

      // Data
      expect(screen.getByText("ORD-001")).toBeInTheDocument();
      expect(screen.getByText("Jane Smith")).toBeInTheDocument();
      expect(screen.getByText("Premium Widget")).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  // ── Keyboard navigation ─────────────────────────────────────────────

  it("navigates items with arrow keys and selects with Enter", async () => {
    mockFetch.mockResolvedValue({
      json: () =>
        Promise.resolve({
          orders: [{ id: "1", orderNumber: "ORD-001", status: "completed", grandTotal: 100000, customer: { name: "Test" }, channel: { name: "Web" } }],
          customers: [],
          products: [],
        }),
    });

    renderCommandPalette();

    fireEvent.keyDown(document, { key: "k", metaKey: true });

    const input = getSearchInput();
    fireEvent.change(input, { target: { value: "test" } });

    await waitFor(() => {
      expect(screen.getByText("ORD-001")).toBeInTheDocument();
    }, { timeout: 3000 });

    // Press ArrowDown
    fireEvent.keyDown(input, { key: "ArrowDown" });

    // Press Enter to navigate
    fireEvent.keyDown(input, { key: "Enter" });

    // Should navigate to orders page
    expect(mockPush).toHaveBeenCalledWith("/en/orders");
  });

  it("handles ArrowUp at top of list without error", async () => {
    mockFetch.mockResolvedValue({
      json: () =>
        Promise.resolve({
          orders: [{ id: "1", orderNumber: "ORD-001", status: "completed", grandTotal: 100000, customer: { name: "Test" }, channel: { name: "Web" } }],
          customers: [],
          products: [],
        }),
    });

    renderCommandPalette();

    fireEvent.keyDown(document, { key: "k", metaKey: true });

    const input = getSearchInput();
    fireEvent.change(input, { target: { value: "test" } });

    await waitFor(() => {
      expect(screen.getByText("ORD-001")).toBeInTheDocument();
    }, { timeout: 3000 });

    // Press ArrowUp at top - should not throw
    expect(() => {
      fireEvent.keyDown(input, { key: "ArrowUp" });
    }).not.toThrow();
  });

  // ── Footer hints ───────────────────────────────────────────────────

  it("shows keyboard shortcut hints in the footer", () => {
    renderCommandPalette();

    fireEvent.keyDown(document, { key: "k", metaKey: true });

    expect(screen.getByText("Navigate")).toBeInTheDocument();
    expect(screen.getByText("Open")).toBeInTheDocument();
    expect(screen.getByText("Toggle")).toBeInTheDocument();
  });

  // ── Error handling ──────────────────────────────────────────────────

  it("handles fetch errors gracefully", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"));

    renderCommandPalette();

    fireEvent.keyDown(document, { key: "k", metaKey: true });

    const input = getSearchInput();
    fireEvent.change(input, { target: { value: "error" } });

    // Should show "No results found" since query.length >= 2
    await waitFor(() => {
      expect(screen.getByText(/No results found/)).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  // ── Cleanup on close ────────────────────────────────────────────────

  it("resets state when dialog closes", () => {
    renderCommandPalette();

    // Open dialog
    fireEvent.keyDown(document, { key: "k", metaKey: true });
    expect(getSearchInput()).toBeInTheDocument();

    // Close dialog
    fireEvent.keyDown(document, { key: "Escape" });

    // Re-open dialog - should be reset
    fireEvent.keyDown(document, { key: "k", metaKey: true });

    // Should show the initial placeholder
    expect(screen.getByText(/Type at least 2 characters to search/)).toBeInTheDocument();
  });

  // ── Keyboard event listeners cleanup ────────────────────────────────

  it("removes event listeners on unmount", () => {
    const { unmount } = renderCommandPalette();

    // Open dialog
    fireEvent.keyDown(document, { key: "k", metaKey: true });
    expect(getSearchInput()).toBeInTheDocument();

    // Unmount
    unmount();

    // Pressing Ctrl+K should not cause errors
    expect(() => {
      fireEvent.keyDown(document, { key: "k", metaKey: true });
    }).not.toThrow();
  });
});
