import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import NotificationsPage from "../page";

// Ensure real implementations are used for icon modules
vi.mock("lucide-react", async () => {
  const actual = await vi.importActual("lucide-react");
  return actual;
});

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: () => "/en/notifications",
  useParams: () => ({ locale: "en" }),
}));

describe("Notifications Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          notifications: [],
          unreadCount: 0,
          typeCounts: {},
        }),
    } as Response);
  });

  it("renders the page heading", async () => {
    render(<NotificationsPage />);
    await waitFor(() => {});
    expect(screen.getByText("Notification Center")).toBeInTheDocument();
    expect(screen.getByText("Notifications")).toBeInTheDocument();
  });

  it("renders tab navigation", async () => {
    render(<NotificationsPage />);
    await waitFor(() => {});
    expect(screen.getByText("Inbox")).toBeInTheDocument();
    expect(screen.getByText("Alert Rules")).toBeInTheDocument();
    expect(screen.getByText("Email Preferences")).toBeInTheDocument();
  });
});
