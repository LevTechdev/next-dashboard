import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { RealtimeIndicator } from "../realtime-indicator";

describe("RealtimeIndicator", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── Live state (default) ──────────────────────────────────────────────

  it("renders 'Live' when lastUpdated is null", () => {
    render(<RealtimeIndicator lastUpdated={null} />);

    expect(screen.getByText("Live")).toBeInTheDocument();
  });

  it("renders 'Live' with 'Just now' when updated within 5 seconds", () => {
    const now = new Date();
    render(<RealtimeIndicator lastUpdated={now} />);

    expect(screen.getByText(/Live/)).toBeInTheDocument();
    expect(screen.getByText(/Updated Just now/)).toBeInTheDocument();
  });

  it("renders seconds ago when updated 10 seconds ago", () => {
    const past = new Date(Date.now() - 10000);
    render(<RealtimeIndicator lastUpdated={past} />);

    expect(screen.getByText(/Updated 10s ago/)).toBeInTheDocument();
  });

  it("renders minutes ago when updated 2 minutes ago", () => {
    const past = new Date(Date.now() - 120000);
    render(<RealtimeIndicator lastUpdated={past} />);

    expect(screen.getByText(/Updated 2m ago/)).toBeInTheDocument();
  });

  it("renders hours ago when updated 2 hours ago", () => {
    const past = new Date(Date.now() - 7200000);
    render(<RealtimeIndicator lastUpdated={past} />);

    expect(screen.getByText(/Updated 2h ago/)).toBeInTheDocument();
  });

  it("updates the time ago text every 5 seconds", () => {
    const past = new Date(Date.now() - 5000);
    render(<RealtimeIndicator lastUpdated={past} />);

    // Initially shows 5s ago
    expect(screen.getByText(/Updated 5s ago/)).toBeInTheDocument();

    // Advance 5 seconds
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(screen.getByText(/Updated 10s ago/)).toBeInTheDocument();
  });

  // ── Refreshing state ──────────────────────────────────────────────

  it("shows 'Updating...' when isRefreshing is true", () => {
    render(<RealtimeIndicator lastUpdated={new Date()} isRefreshing={true} />);

    expect(screen.getByText("Updating...")).toBeInTheDocument();
  });

  // ── Error state ───────────────────────────────────────────────────────

  it("shows 'Disconnected' when error is present", () => {
    render(<RealtimeIndicator lastUpdated={new Date()} error={new Error("Connection lost")} />);

    expect(screen.getByText("Disconnected")).toBeInTheDocument();
  });

  it("renders with error styling when error is present", () => {
    const { container } = render(
      <RealtimeIndicator lastUpdated={new Date()} error={new Error("Network error")} />,
    );

    // The container should have text-red classes
    const root = container.firstChild as HTMLElement;
    expect(root.className).toContain("text-red");
  });

  it("renders with success styling when no error", () => {
    const { container } = render(<RealtimeIndicator lastUpdated={new Date()} />);

    const root = container.firstChild as HTMLElement;
    expect(root.className).toContain("text-emerald");
  });

  // ── Combined states ───────────────────────────────────────────────────

  it("prioritizes error over refreshing when both are set", () => {
    render(
      <RealtimeIndicator lastUpdated={new Date()} isRefreshing={true} error={new Error("Fail")} />,
    );

    // Error should take priority: shows "Disconnected" not "Updating..."
    expect(screen.getByText("Disconnected")).toBeInTheDocument();
    expect(screen.queryByText("Updating...")).not.toBeInTheDocument();
  });

  // ── Custom className ──────────────────────────────────────────────────

  it("applies custom className", () => {
    const { container } = render(
      <RealtimeIndicator lastUpdated={new Date()} className="custom-indicator" />,
    );

    const root = container.firstChild as HTMLElement;
    expect(root.className).toContain("custom-indicator");
  });

  // ── Cleanup timer on unmount ──────────────────────────────────────────

  it("cleans up the interval timer on unmount", () => {
    const { unmount } = render(<RealtimeIndicator lastUpdated={new Date()} />);

    unmount();

    // After unmounting, advancing time should not throw
    expect(() => {
      act(() => {
        vi.advanceTimersByTime(10000);
      });
    }).not.toThrow();
  });

  // ── Clears timeAgo when lastUpdated becomes null ──────────────────────

  it("clears timeAgo text when lastUpdated becomes null", () => {
    const { rerender } = render(<RealtimeIndicator lastUpdated={new Date()} />);

    expect(screen.getByText(/Updated/)).toBeInTheDocument();

    // Rerender with null
    rerender(<RealtimeIndicator lastUpdated={null} />);

    expect(screen.getByText("Live")).toBeInTheDocument();
    expect(screen.queryByText(/Updated/)).not.toBeInTheDocument();
  });
});
