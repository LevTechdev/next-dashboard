import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { NotificationPanel } from "../notification-panel";

// Mock realtime provider
vi.mock("@/components/realtime-provider", () => ({
  useRealtime: vi.fn(() => ({
    notifications: [],
    unreadCount: 0,
    markAllRead: vi.fn(),
    clearNotifications: vi.fn(),
    addNotification: vi.fn(),
    connectionStatus: "connected",
    budgetThreshold: 80,
    setBudgetThreshold: vi.fn(),
    globalRefreshTrigger: 0,
    lastGlobalUpdate: null,
    triggerRefresh: vi.fn(),
  })),
}));

describe("NotificationPanel", () => {
  it("renders the notification bell button", () => {
    render(<NotificationPanel />);
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThanOrEqual(1);
  });

  it("does not show the panel by default", () => {
    render(<NotificationPanel />);
    expect(screen.queryByText("Notifications")).not.toBeInTheDocument();
    expect(screen.queryByText("No notifications yet")).not.toBeInTheDocument();
  });
});
