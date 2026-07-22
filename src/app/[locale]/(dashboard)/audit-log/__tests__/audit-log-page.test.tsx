import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import AuditLogPage from "../page";

// Ensure real implementations are used for icon/ui modules
vi.mock("lucide-react", async () => {
  const actual = await vi.importActual("lucide-react");
  return actual;
});

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: () => "/en/audit-log",
  useParams: () => ({ locale: "en" }),
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

describe("Audit Log Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          logs: [
            { id: "1", action: "USER_LOGIN", entity: "user", details: "Admin logged in", user: { name: "Admin", role: "ADMIN" }, createdAt: "2024-07-01T10:00:00Z", formattedDate: "Jul 1, 2024" },
            { id: "2", action: "ORDER_CREATE", entity: "order", details: "Order #1234 created", user: { name: "Staff", role: "STAFF" }, createdAt: "2024-07-01T11:00:00Z", formattedDate: "Jul 1, 2024" },
          ],
          pagination: { page: 1, limit: 25, total: 2, totalPages: 1 },
        }),
    } as Response);
  });

  it("renders the page heading", async () => {
    render(<AuditLogPage />);
    await waitFor(() => {});
    expect(screen.getByText("Audit Log")).toBeInTheDocument();
  });

  it("renders the search input", async () => {
    render(<AuditLogPage />);
    await waitFor(() => {});
    expect(screen.getByPlaceholderText("Search...")).toBeInTheDocument();
  });

  it("renders action buttons", async () => {
    render(<AuditLogPage />);
    await waitFor(() => {});
    expect(screen.getByText("Export Logs")).toBeInTheDocument();
  });
});
