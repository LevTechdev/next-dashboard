import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import PageProgressBar from "../page-progress-bar";

// ── Track pathname for dynamic changes ──
let mockPathname = "/initial";

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}));

describe("PageProgressBar", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockPathname = "/initial";
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── Initial state ─────────────────────────────────────────────────────

  it("renders nothing on initial mount (no pathname change yet)", () => {
    const { container } = render(<PageProgressBar />);

    // No progress bar visible initially
    expect(container.innerHTML).toBe("");
  });

  // ── Pathname change triggers progress bar ────────────────────────────

  it("shows progress bar when pathname changes", () => {
    // Render with initial pathname
    const { rerender } = render(<PageProgressBar />);

    // Change pathname
    mockPathname = "/new-page";
    rerender(<PageProgressBar />);

    // Progress bar should appear
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
    expect(screen.getByLabelText("Page loading")).toBeInTheDocument();
  });

  it("completes and hides after the duration + 300ms fade", () => {
    const { rerender } = render(<PageProgressBar duration={600} />);

    // Trigger pathname change
    mockPathname = "/another-page";
    rerender(<PageProgressBar duration={600} />);

    // Bar is visible
    expect(screen.getByRole("progressbar")).toBeInTheDocument();

    // Advance past the indeterminate duration (600ms)
    act(() => {
      vi.advanceTimersByTime(600);
    });

    // After duration, completing state is set (width: 100%, transition to fade)
    // The element is still in DOM until 300ms more

    // Advance past the completion fade (300ms)
    act(() => {
      vi.advanceTimersByTime(300);
    });

    // Bar should now be hidden
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  // ── Custom duration ───────────────────────────────────────────────────

  it("uses custom duration for the indeterminate animation", () => {
    const { rerender } = render(<PageProgressBar duration={200} />);

    mockPathname = "/fast-page";
    rerender(<PageProgressBar duration={200} />);

    // Bar is visible
    expect(screen.getByRole("progressbar")).toBeInTheDocument();

    // Advance past the shorter custom duration
    act(() => {
      vi.advanceTimersByTime(200);
    });

    // After duration, completing starts
    // Advance completion fade
    act(() => {
      vi.advanceTimersByTime(300);
    });

    // Bar should be hidden
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  // ── Consecutive navigations reset timer ───────────────────────────────

  it("resets the progress bar on consecutive pathname changes", () => {
    const { rerender } = render(<PageProgressBar duration={600} />);

    // First navigation
    mockPathname = "/page-1";
    rerender(<PageProgressBar duration={600} />);

    expect(screen.getByRole("progressbar")).toBeInTheDocument();

    // Navigate again before first completes
    mockPathname = "/page-2";
    rerender(<PageProgressBar duration={600} />);

    // Bar should still be visible (timer was reset)
    expect(screen.getByRole("progressbar")).toBeInTheDocument();

    // Complete the second navigation
    act(() => {
      vi.advanceTimersByTime(600);
    });
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  // ── Accessibility attributes ──────────────────────────────────────────

  it("has correct aria attributes", () => {
    const { rerender } = render(<PageProgressBar />);

    mockPathname = "/accessible";
    rerender(<PageProgressBar />);

    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-label", "Page loading");
    expect(bar).toHaveAttribute("aria-valuemin", "0");
    expect(bar).toHaveAttribute("aria-valuemax", "100");
  });

  // ── Cleanup on unmount ────────────────────────────────────────────────

  it("cleans up timers on unmount", () => {
    const { rerender, unmount } = render(<PageProgressBar />);

    mockPathname = "/cleanup";
    rerender(<PageProgressBar />);

    expect(screen.getByRole("progressbar")).toBeInTheDocument();

    // Unmount while bar is visible
    unmount();

    // No error should occur
    act(() => {
      vi.advanceTimersByTime(1000);
    });
  });

  it("cleans up previous timer on pathname change", () => {
    const { rerender } = render(<PageProgressBar />);

    mockPathname = "/page-a";
    rerender(<PageProgressBar />);

    // Navigate again quickly - old timer is cleared
    mockPathname = "/page-b";
    rerender(<PageProgressBar />);

    // Complete second navigation
    act(() => {
      vi.advanceTimersByTime(600);
    });
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });
});
