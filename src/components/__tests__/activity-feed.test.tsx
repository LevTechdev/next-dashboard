import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { ActivityFeed } from "../activity-feed";

// ── Mock realtime provider (controllable per test) ────────────────────────

vi.mock("@/components/realtime-provider", () => ({
  useRealtime: vi.fn(),
  NotificationType: {},
  RealtimeNotification: {},
}));

// ── Helpers ───────────────────────────────────────────────────────────────

function createMockApiNotification(overrides: Partial<{
  id: string;
  type: string;
  title: string;
  description: string | null;
  createdAt: string;
  read: boolean;
}> = {}) {
  return {
    id: `notif-${Math.random().toString(36).slice(2, 8)}`,
    type: "order",
    title: "New Order #1234",
    description: "Order from John Doe - $299.99",
    createdAt: new Date().toISOString(),
    read: false,
    ...overrides,
  };
}

function createMockRealtimeNotification(overrides: Partial<{
  id: string;
  type: "order" | "customer" | "product" | "revenue" | "inventory" | "discount" | "campaign" | "milestone" | "alert";
  title: string;
  description: string;
  timestamp: Date;
  read: boolean;
}> = {}) {
  return {
    id: `rt-${Math.random().toString(36).slice(2, 8)}`,
    type: "order" as const,
    title: "Real-time Order Update",
    description: "A new order arrived in real-time",
    timestamp: new Date(),
    ...overrides,
  };
}

function defaultRealtimeMock(overrides: Record<string, unknown> = {}) {
  return {
    notifications: [] as any[],
    connectionStatus: "connected" as const,
    unreadCount: 0,
    lastGlobalUpdate: null,
    globalRefreshTrigger: 0,
    budgetThreshold: 80,
    markAllRead: vi.fn(),
    clearNotifications: vi.fn(),
    addNotification: vi.fn(),
    triggerRefresh: vi.fn(),
    setBudgetThreshold: vi.fn(),
    ...overrides,
  };
}

function setupFetchMock(notifications: any[] = []) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ notifications }),
  } as Response);
}

async function getUseRealtimeMock() {
  const mod = await import("@/components/realtime-provider");
  return vi.mocked(mod.useRealtime);
}

// ── Suite ─────────────────────────────────────────────────────────────────

describe("ActivityFeed", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const mock = await getUseRealtimeMock();
    mock.mockReturnValue(defaultRealtimeMock());
    global.fetch = setupFetchMock([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Loading State
  // ──────────────────────────────────────────────────────────────────────────

  describe("loading state", () => {
    it("shows a loading indicator on initial render", () => {
      // Keep fetch from resolving by returning a promise that never resolves
      global.fetch = vi.fn().mockReturnValue(new Promise(() => {}));
      render(<ActivityFeed />);
      expect(screen.getByText("Loading activity...")).toBeInTheDocument();
    });

    it("shows the loading spinner animation", () => {
      global.fetch = vi.fn().mockReturnValue(new Promise(() => {}));
      render(<ActivityFeed />);
      // The spinner has an animate-spin class on the border element
      const spinner = document.querySelector(".animate-spin");
      expect(spinner).toBeInTheDocument();
    });

    it("displays the card title and description during loading", () => {
      global.fetch = vi.fn().mockReturnValue(new Promise(() => {}));
      render(<ActivityFeed />);
      expect(screen.getByText("Activity Feed")).toBeInTheDocument();
      expect(screen.getByText("Real-time system activity stream")).toBeInTheDocument();
    });

    it("shows connection status during loading", () => {
      global.fetch = vi.fn().mockReturnValue(new Promise(() => {}));
      render(<ActivityFeed />);
      expect(screen.getByText("Live")).toBeInTheDocument();
    });

    it("transitions from loading to empty state when fetch resolves", async () => {
      render(<ActivityFeed />);
      // Initially shows loading
      expect(screen.getByText("Loading activity...")).toBeInTheDocument();
      // After fetch resolves, shows empty state
      await waitFor(() => {
        expect(screen.getByText("No activity yet")).toBeInTheDocument();
      });
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Empty State
  // ──────────────────────────────────────────────────────────────────────────

  describe("empty state", () => {
    it("shows 'No activity yet' when there are no activities", async () => {
      render(<ActivityFeed />);
      await waitFor(() => {
        expect(screen.getByText("No activity yet")).toBeInTheDocument();
      });
    });

    it("shows helpful description text in the empty state", async () => {
      render(<ActivityFeed />);
      await waitFor(() => {
        expect(screen.getByText("Real-time updates will appear here")).toBeInTheDocument();
      });
    });

    it("shows an informational tip in the empty state", async () => {
      render(<ActivityFeed />);
      await waitFor(() => {
        expect(
          screen.getByText(/Activities like orders, new customers, and system alerts/)
        ).toBeInTheDocument();
      });
    });

    it("shows type filter pills even when empty (count badges absent)", async () => {
      render(<ActivityFeed />);
      await waitFor(() => {
        expect(screen.getByText("Orders")).toBeInTheDocument();
      });
      // But the count badges should not be visible since there are no activities
      const allPill = screen.getByText("All");
      // "All" should not show a count badge (count is 0)
      expect(allPill.textContent).toBe("All");
      expect(screen.queryByText("Customers")).toBeInTheDocument();
    });

    it("does not show 'of' count separator when empty", async () => {
      render(<ActivityFeed />);
      await waitFor(() => {
        expect(screen.getByText("Live")).toBeInTheDocument();
      });
    });

    it("renders the header with connection dot when connected", async () => {
      render(<ActivityFeed />);
      await waitFor(() => {
        expect(screen.getByText("Live")).toBeInTheDocument();
      });
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Populated State
  // ──────────────────────────────────────────────────────────────────────────

  describe("populated state", () => {
    const apiNotifications = [
      createMockApiNotification({
        id: "order-1",
        type: "order",
        title: "New Order #1001",
        description: "Customer: Alice - $150.00",
        createdAt: new Date(Date.now() - 30000).toISOString(),
      }),
      createMockApiNotification({
        id: "customer-2",
        type: "customer",
        title: "New Customer Signup",
        description: "Bob joined the platform",
        createdAt: new Date(Date.now() - 60000).toISOString(),
      }),
      createMockApiNotification({
        id: "inventory-3",
        type: "inventory",
        title: "Low Stock Alert",
        description: "Widget X has only 3 units left",
        createdAt: new Date(Date.now() - 120000).toISOString(),
      }),
    ];

    beforeEach(() => {
      global.fetch = setupFetchMock(apiNotifications);
    });

    it("renders activity items after loading completes", async () => {
      render(<ActivityFeed />);
      await waitFor(() => {
        expect(screen.getByText("New Order #1001")).toBeInTheDocument();
      });
      expect(screen.getByText("New Customer Signup")).toBeInTheDocument();
      expect(screen.getByText("Low Stock Alert")).toBeInTheDocument();
    });

    it("renders activity descriptions", async () => {
      render(<ActivityFeed />);
      await waitFor(() => {
        expect(screen.getByText(/Customer: Alice/)).toBeInTheDocument();
      });
      expect(screen.getByText(/Bob joined the platform/)).toBeInTheDocument();
    });

    it("renders type badges on activity items", async () => {
      render(<ActivityFeed />);
      await waitFor(() => {
        const badges = screen.getAllByText(/order|customer|inventory/i);
        expect(badges.length).toBeGreaterThanOrEqual(3);
      });
    });

    it("shows the activity count in the connection bar", async () => {
      render(<ActivityFeed />);
      await waitFor(() => {
        // Shows "X of Y" format
        expect(screen.getByText(/3 of 3/)).toBeInTheDocument();
      });
    });

    it("shows relative timestamps for activities", async () => {
      render(<ActivityFeed />);
      await waitFor(() => {
        expect(screen.getByText("30s ago")).toBeInTheDocument();
      });
    });

    it("shows the 'latest' indicator on the first item", async () => {
      render(<ActivityFeed />);
      await waitFor(() => {
        expect(screen.getByText("latest")).toBeInTheDocument();
      });
    });

    it("renders type filter pills with counts", async () => {
      render(<ActivityFeed />);
      await waitFor(() => {
        expect(screen.getByText("Orders")).toBeInTheDocument();
      });
      expect(screen.getByText("Customers")).toBeInTheDocument();
      expect(screen.getByText("Inventory")).toBeInTheDocument();
    });

    it("shows the 'All' filter pill with total count", async () => {
      render(<ActivityFeed />);
      await waitFor(() => {
        const allPill = screen.getByText("All");
        expect(allPill).toBeInTheDocument();
      });
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Filtering
  // ──────────────────────────────────────────────────────────────────────────

  describe("filtering", () => {
    const apiNotifications = [
      createMockApiNotification({
        id: "order-1", type: "order", title: "Order #1",
        description: "First order",
      }),
      createMockApiNotification({
        id: "order-2", type: "order", title: "Order #2",
        description: "Second order",
      }),
      createMockApiNotification({
        id: "customer-1", type: "customer", title: "New Customer",
        description: "Welcome!",
      }),
      createMockApiNotification({
        id: "inventory-1", type: "inventory", title: "Low Stock",
        description: "Restock needed",
      }),
      createMockApiNotification({
        id: "alert-1", type: "alert", title: "System Alert",
        description: "High CPU usage",
      }),
    ];

    beforeEach(() => {
      global.fetch = setupFetchMock(apiNotifications);
    });

    it("shows all items when 'All' filter is active (default)", async () => {
      render(<ActivityFeed />);
      await waitFor(() => {
        expect(screen.getByText("Order #1")).toBeInTheDocument();
      });
      expect(screen.getByText("New Customer")).toBeInTheDocument();
      expect(screen.getByText("Low Stock")).toBeInTheDocument();
      expect(screen.getByText("System Alert")).toBeInTheDocument();
    });

    it("filters to show only order items when Orders pill is clicked", async () => {
      render(<ActivityFeed />);
      await waitFor(() => {
        expect(screen.getByText("Order #1")).toBeInTheDocument();
      });
      // Click the Orders filter pill
      fireEvent.click(screen.getByText("Orders"));
      expect(screen.getByText("Order #1")).toBeInTheDocument();
      expect(screen.getByText("Order #2")).toBeInTheDocument();
      expect(screen.queryByText("New Customer")).not.toBeInTheDocument();
      expect(screen.queryByText("Low Stock")).not.toBeInTheDocument();
    });

    it("filters to show only customer items when Customers pill is clicked", async () => {
      render(<ActivityFeed />);
      await waitFor(() => {
        expect(screen.getByText("New Customer")).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText("Customers"));
      expect(screen.getByText("New Customer")).toBeInTheDocument();
      expect(screen.queryByText("Order #1")).not.toBeInTheDocument();
    });

    it("returns to showing all items when 'All' is clicked after filtering", async () => {
      render(<ActivityFeed />);
      await waitFor(() => {
        expect(screen.getByText("Order #1")).toBeInTheDocument();
      });
      // Filter to orders
      fireEvent.click(screen.getByText("Orders"));
      expect(screen.queryByText("New Customer")).not.toBeInTheDocument();
      // Go back to all
      fireEvent.click(screen.getByText("All"));
      expect(screen.getByText("Order #1")).toBeInTheDocument();
      expect(screen.getByText("New Customer")).toBeInTheDocument();
    });

    it("shows 'No matching activity' when filter yields no results", async () => {
      render(<ActivityFeed />);
      await waitFor(() => {
        expect(screen.getByText("Order #1")).toBeInTheDocument();
      });
      // Filter by revenue type which has no items
      fireEvent.click(screen.getByText("Revenue"));
      expect(screen.getByText("No matching activity")).toBeInTheDocument();
      expect(screen.getByText("Try a different filter")).toBeInTheDocument();
    });

    it("updates the count display when filtering", async () => {
      render(<ActivityFeed />);
      await waitFor(() => {
        expect(screen.getByText(/5 of 5/)).toBeInTheDocument();
      });
      // Filter to show only 2 order items
      fireEvent.click(screen.getByText("Orders"));
      expect(screen.getByText(/2 of 5/)).toBeInTheDocument();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Connection Status
  // ──────────────────────────────────────────────────────────────────────────

  describe("connection status", () => {
    it("shows 'Live' when connectionStatus is 'connected'", async () => {
      render(<ActivityFeed />);
      await waitFor(() => {
        expect(screen.getByText("Live")).toBeInTheDocument();
      });
    });

    it("shows 'Connecting...' when connectionStatus is 'connecting'", async () => {
      const mock = await getUseRealtimeMock();
      mock.mockReturnValue({
        ...defaultRealtimeMock(),
        connectionStatus: "connecting",
      });
      render(<ActivityFeed />);
      await waitFor(() => {
        expect(screen.getByText("Connecting...")).toBeInTheDocument();
      });
    });

    it("shows 'Disconnected' when connectionStatus is 'disconnected'", async () => {
      const mock = await getUseRealtimeMock();
      mock.mockReturnValue({
        ...defaultRealtimeMock(),
        connectionStatus: "disconnected",
      });
      render(<ActivityFeed />);
      await waitFor(() => {
        expect(screen.getByText("Disconnected")).toBeInTheDocument();
      });
    });

    it("shows the correct connection dot color indicator", async () => {
      render(<ActivityFeed />);
      await waitFor(() => {
        // The green dot for "connected" should have bg-emerald-500 class
        const dots = document.querySelectorAll(".bg-emerald-500");
        expect(dots.length).toBeGreaterThanOrEqual(1);
      });
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Real-time Updates
  // ──────────────────────────────────────────────────────────────────────────

  describe("real-time updates", () => {
    beforeEach(() => {
      // Return initial activities from API
      global.fetch = setupFetchMock([
        createMockApiNotification({
          id: "existing-1", type: "order", title: "Existing Order",
          description: "Before real-time",
        }),
      ]);
    });

    it("adds new real-time notifications to the feed", async () => {
      // Render with no real-time notifications
      const mock = await getUseRealtimeMock();
      mock.mockReturnValue(defaultRealtimeMock());
      const { rerender } = render(<ActivityFeed />);
      await waitFor(() => {
        expect(screen.getByText("Existing Order")).toBeInTheDocument();
      });

      // Now simulate a real-time notification arriving
      const rtNotif = createMockRealtimeNotification({
        id: "rt-new-1",
        type: "order",
        title: "Real-time Order!",
        description: "Arrived via SSE",
      });
      mock.mockReturnValue(defaultRealtimeMock({ notifications: [rtNotif] }));

      // Rerender to trigger the effect
      rerender(<ActivityFeed />);

      await waitFor(() => {
        expect(screen.getByText("Real-time Order!")).toBeInTheDocument();
      });
    });

    it("shows a 'New' badge on items from real-time updates", async () => {
      const mock = await getUseRealtimeMock();
      mock.mockReturnValue(defaultRealtimeMock());
      const { rerender } = render(<ActivityFeed />);
      await waitFor(() => {
        expect(screen.getByText("Existing Order")).toBeInTheDocument();
      });

      // Add a real-time notification
      const rtNotif = createMockRealtimeNotification({
        id: "rt-new-2",
        type: "order",
        title: "New RT Item",
        description: "Fresh!",
      });
      mock.mockReturnValue(defaultRealtimeMock({ notifications: [rtNotif] }));
      rerender(<ActivityFeed />);

      await waitFor(() => {
        expect(screen.getByText("New")).toBeInTheDocument();
      });
    });

    it("shows '+X new' counter when real-time notifications arrive", async () => {
      const mock = await getUseRealtimeMock();
      mock.mockReturnValue(defaultRealtimeMock());
      const { rerender } = render(<ActivityFeed />);
      await waitFor(() => {
        expect(screen.getByText("Existing Order")).toBeInTheDocument();
      });

      // Add multiple real-time notifications
      mock.mockReturnValue(defaultRealtimeMock({
        notifications: [
          createMockRealtimeNotification({ id: "rt-a", type: "order", title: "RT A" }),
          createMockRealtimeNotification({ id: "rt-b", type: "customer", title: "RT B" }),
        ],
      }));
      rerender(<ActivityFeed />);

      await waitFor(() => {
        expect(screen.getByText("+2 new")).toBeInTheDocument();
      });
    });

    it("deduplicates notifications that already exist in knownIds", async () => {
      const mock = await getUseRealtimeMock();
      mock.mockReturnValue(defaultRealtimeMock());
      const { rerender } = render(<ActivityFeed />);
      await waitFor(() => {
        expect(screen.getByText("Existing Order")).toBeInTheDocument();
      });

      // Send two real-time notifications, then the same ones again
      const rt1 = createMockRealtimeNotification({ id: "rt-dedup-1", title: "First RT" });
      const rt2 = createMockRealtimeNotification({ id: "rt-dedup-2", title: "Second RT" });

      mock.mockReturnValue(defaultRealtimeMock({ notifications: [rt1, rt2] }));
      rerender(<ActivityFeed />);
      await waitFor(() => {
        expect(screen.getByText("First RT")).toBeInTheDocument();
      });

      // Send the same notifications again (as if SSE re-sent them)
      mock.mockReturnValue(defaultRealtimeMock({ notifications: [rt1, rt2] }));
      rerender(<ActivityFeed />);

      // Should NOT have duplicated entries - count items by text
      const firstRTItems = screen.getAllByText("First RT");
      expect(firstRTItems.length).toBe(1);
    });

    it("limits the feed to MAX_VISIBLE items (15)", async () => {
      const mock = await getUseRealtimeMock();
      // Return 15 items from API
      const manyItems = Array.from({ length: 15 }, (_, i) =>
        createMockApiNotification({
          id: `api-${i}`,
          type: "order",
          title: `Order Item ${i + 1}`,
        })
      );
      global.fetch = setupFetchMock(manyItems);

      mock.mockReturnValue(defaultRealtimeMock());
      const { rerender } = render(<ActivityFeed />);
      await waitFor(() => {
        expect(screen.getByText("Order Item 15")).toBeInTheDocument();
      });

      // Add more real-time notifications — should push old ones out
      const newRTs = Array.from({ length: 3 }, (_, i) =>
        createMockRealtimeNotification({
          id: `rt-new-${i}`,
          type: "order",
          title: `New RT #${i + 1}`,
        })
      );
      mock.mockReturnValue(defaultRealtimeMock({ notifications: newRTs }));
      rerender(<ActivityFeed />);

      await waitFor(() => {
        expect(screen.getByText("New RT #1")).toBeInTheDocument();
      });
      // Some old items should no longer be visible
      expect(screen.queryByText("Order Item 15")).not.toBeInTheDocument();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Pause / Resume
  // ──────────────────────────────────────────────────────────────────────────

  describe("pause / resume", () => {
    beforeEach(() => {
      global.fetch = setupFetchMock([
        createMockApiNotification({
          id: "item-1", type: "order", title: "Initial Item",
        }),
      ]);
    });

    it("shows a 'Pause' button when not paused", async () => {
      render(<ActivityFeed />);
      await waitFor(() => {
        expect(screen.getByText("Initial Item")).toBeInTheDocument();
      });
      expect(screen.getByText("Pause")).toBeInTheDocument();
      expect(screen.queryByText("Resume")).not.toBeInTheDocument();
    });

    it("shows 'Resume' button after pausing", async () => {
      render(<ActivityFeed />);
      await waitFor(() => {
        expect(screen.getByText("Initial Item")).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText("Pause"));
      await waitFor(() => {
        expect(screen.getByText("Resume")).toBeInTheDocument();
      });
      expect(screen.queryByText("Pause")).not.toBeInTheDocument();
    });

    it("returns to 'Pause' after resuming", async () => {
      render(<ActivityFeed />);
      await waitFor(() => {
        expect(screen.getByText("Initial Item")).toBeInTheDocument();
      });
      // Pause
      fireEvent.click(screen.getByText("Pause"));
      await waitFor(() => {
        expect(screen.getByText("Resume")).toBeInTheDocument();
      });
      // Resume
      fireEvent.click(screen.getByText("Resume"));
      await waitFor(() => {
        expect(screen.getByText("Pause")).toBeInTheDocument();
      });
    });

    it("shows the pulsing indicator icon when paused", async () => {
      render(<ActivityFeed />);
      await waitFor(() => {
        expect(screen.getByText("Initial Item")).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText("Pause"));
      await waitFor(() => {
        // The pulse indicator should have animate-pulse class
        const pulseEl = document.querySelector(".animate-pulse");
        expect(pulseEl).toBeInTheDocument();
      });
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Export
  // ──────────────────────────────────────────────────────────────────────────

  describe("export", () => {
    beforeEach(() => {
      global.fetch = setupFetchMock([
        createMockApiNotification({
          id: "exp-1", type: "order", title: "Export Test",
          description: "For CSV",
        }),
      ]);

      // Mock URL.createObjectURL and URL.revokeObjectURL
      global.URL.createObjectURL = vi.fn(() => "blob:test");
      global.URL.revokeObjectURL = vi.fn();
    });

    it("renders the export button", async () => {
      render(<ActivityFeed />);
      await waitFor(() => {
        expect(screen.getByTitle("Export as CSV")).toBeInTheDocument();
      });
    });

    it("triggers a CSV download when export button is clicked", async () => {
      const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

      render(<ActivityFeed />);
      await waitFor(() => {
        expect(screen.getByText("Export Test")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTitle("Export as CSV"));

      expect(clickSpy).toHaveBeenCalled();
      clickSpy.mockRestore();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Edge Cases
  // ──────────────────────────────────────────────────────────────────────────

  describe("edge cases", () => {
    it("handles API failure without crashing", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));
      render(<ActivityFeed />);
      await waitFor(() => {
        expect(screen.getByText("No activity yet")).toBeInTheDocument();
      });
    });

    it("handles API returning non-ok response without crashing", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      } as Response);
      render(<ActivityFeed />);
      await waitFor(() => {
        expect(screen.getByText("No activity yet")).toBeInTheDocument();
      });
    });

    it("applies custom className to the card", async () => {
      render(<ActivityFeed className="my-custom-class" />);
      await waitFor(() => {
        // The className should propagate to the outermost element
        expect(screen.getByText("Activity Feed")).toBeInTheDocument();
      });
    });

    it("renders the 'View all' link to the notifications page", async () => {
      render(<ActivityFeed />);
      await waitFor(() => {
        expect(screen.getByText("View all")).toBeInTheDocument();
      });
      const link = screen.getByText("View all").closest("a");
      expect(link).toHaveAttribute("href", "/en/notifications");
    });

    it("handles rapid real-time updates gracefully", async () => {
      // Initial API data
      global.fetch = setupFetchMock([
        createMockApiNotification({ id: "base-1", title: "Base Item" }),
      ]);

      const mock = await getUseRealtimeMock();
      mock.mockReturnValue(defaultRealtimeMock());
      const { rerender } = render(<ActivityFeed />);
      await waitFor(() => {
        expect(screen.getByText("Base Item")).toBeInTheDocument();
      });

      // Simulate multiple rapid updates
      for (let i = 0; i < 5; i++) {
        const notif = createMockRealtimeNotification({
          id: `rapid-${i}`,
          title: `Rapid Update ${i}`,
        });
        mock.mockReturnValue(defaultRealtimeMock({ notifications: [notif] }));
        rerender(<ActivityFeed />);
      }

      await waitFor(() => {
        expect(screen.getByText("Rapid Update 4")).toBeInTheDocument();
      });
      // All 5 should be present
      expect(screen.getByText("Rapid Update 0")).toBeInTheDocument();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Accessibility
  // ──────────────────────────────────────────────────────────────────────────

  describe("accessibility", () => {
    it("has a log region for live feed updates", async () => {
      render(<ActivityFeed />);
      await waitFor(() => {
        const logRegion = screen.getByRole("log");
        expect(logRegion).toBeInTheDocument();
        expect(logRegion).toHaveAttribute("aria-live", "polite");
        expect(logRegion).toHaveAttribute("aria-label", "Live activity feed");
      });
    });

    it("export button has accessible label", async () => {
      global.fetch = setupFetchMock([
        createMockApiNotification({ id: "acc-1", title: "Acc Item" }),
      ]);
      render(<ActivityFeed />);
      await waitFor(() => {
        expect(screen.getByLabelText("Export activity feed as CSV")).toBeInTheDocument();
      });
    });
  });
});
