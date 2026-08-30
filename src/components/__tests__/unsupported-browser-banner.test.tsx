import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import UnsupportedBrowserBanner from "../unsupported-browser-banner";

// ── Mock useViewTransition ─────────────────────────────────────────────────
const mockUseViewTransition = vi.fn();

vi.mock("@/components/view-transition-provider", () => ({
  useViewTransition: () => mockUseViewTransition(),
}));

const DISMISSED_KEY = "codebuff-vt-banner-dismissed";

describe("UnsupportedBrowserBanner", () => {
  beforeEach(() => {
    localStorage.clear();
    // Default: API not supported, not dismissed
    mockUseViewTransition.mockReturnValue({ isSupported: false });
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  // ── Hydration guard (verified implicitly by the supported-browser test) ─

  it("renders nothing when View Transitions ARE supported", async () => {
    mockUseViewTransition.mockReturnValue({ isSupported: true });

    const { container } = render(<UnsupportedBrowserBanner />);
    // After mount, useEffect sets mounted=true, but isSupported is also true → null
    await waitFor(() => {
      expect(container.innerHTML).toBe("");
    });
  });

  // ── Banner appearance ────────────────────────────────────────────────

  it("renders the banner when VT is not supported and not dismissed", async () => {
    render(<UnsupportedBrowserBanner />);

    // After mount, the useEffect fires which sets mounted=true and reads localStorage
    await waitFor(() => {
      expect(screen.getByText(/Smooth page transitions aren.t supported/i)).toBeInTheDocument();
    });

    // Key content is present
    expect(screen.getByText("Chrome 111+")).toBeInTheDocument();
    expect(screen.getByText("Firefox 128+")).toBeInTheDocument();
    expect(screen.getByText("Safari 18+")).toBeInTheDocument();
    expect(screen.getByText("Edge 111+")).toBeInTheDocument();
    expect(screen.getByText("Opera 97+")).toBeInTheDocument();

    // Warning icon and dismiss button
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByLabelText("Dismiss notification")).toBeInTheDocument();
  });

  // ── localStorage persistence ─────────────────────────────────────────

  it("does NOT show the banner when previously dismissed in localStorage", async () => {
    localStorage.setItem(DISMISSED_KEY, "true");

    const { container } = render(<UnsupportedBrowserBanner />);

    await waitFor(() => {
      expect(container.innerHTML).toBe("");
    });
  });

  it("dismisses the banner on button click and writes to localStorage", async () => {
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem");

    render(<UnsupportedBrowserBanner />);

    // Wait for banner to appear
    await waitFor(() => {
      expect(screen.getByLabelText("Dismiss notification")).toBeInTheDocument();
    });

    // Click dismiss button
    fireEvent.click(screen.getByLabelText("Dismiss notification"));

    // Banner should disappear
    await waitFor(() => {
      expect(
        screen.queryByText(/Smooth page transitions aren.t supported/i),
      ).not.toBeInTheDocument();
    });

    // localStorage was written
    expect(setItemSpy).toHaveBeenCalledWith(DISMISSED_KEY, "true");
  });

  // ── localStorage.getItem blocked ───────────────────────────────────

  it("shows the banner when localStorage.getItem is blocked", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("localStorage access denied");
    });

    render(<UnsupportedBrowserBanner />);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(screen.getByText(/Smooth page transitions aren.t supported/i)).toBeInTheDocument();
    });

    vi.restoreAllMocks();
  });

  // ── Dismiss button handles localStorage setItem error ────────────────

  it("dismisses the banner even when localStorage.setItem throws", async () => {
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("localStorage quota exceeded");
    });

    render(<UnsupportedBrowserBanner />);

    await waitFor(() => {
      expect(screen.getByLabelText("Dismiss notification")).toBeInTheDocument();
    });

    // Should not throw
    expect(() => {
      fireEvent.click(screen.getByLabelText("Dismiss notification"));
    }).not.toThrow();

    // Banner should disappear
    await waitFor(() => {
      expect(
        screen.queryByText(/Smooth page transitions aren.t supported/i),
      ).not.toBeInTheDocument();
    });

    setItemSpy.mockRestore();
  });

  // ── Re-rendering after dismissal ─────────────────────────────────────

  it("stays dismissed after dismissing and re-rendering (reads from localStorage)", async () => {
    render(<UnsupportedBrowserBanner />);

    await waitFor(() => {
      expect(screen.getByLabelText("Dismiss notification")).toBeInTheDocument();
    });

    // Dismiss — writes "true" to localStorage
    fireEvent.click(screen.getByLabelText("Dismiss notification"));

    await waitFor(() => {
      expect(
        screen.queryByText(/Smooth page transitions aren.t supported/i),
      ).not.toBeInTheDocument();
    });

    // Verify localStorage was written
    expect(localStorage.getItem(DISMISSED_KEY)).toBe("true");

    // Simulate a new visit (new component instance reads from localStorage)
    const { container: container2 } = render(<UnsupportedBrowserBanner />);

    await waitFor(() => {
      expect(container2.innerHTML).toBe("");
    });
  });

  it("shows the banner again after localStorage is cleared", async () => {
    // First visit: dismiss
    render(<UnsupportedBrowserBanner />);

    await waitFor(() => {
      expect(screen.getByLabelText("Dismiss notification")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText("Dismiss notification"));

    await waitFor(() => {
      expect(
        screen.queryByText(/Smooth page transitions aren.t supported/i),
      ).not.toBeInTheDocument();
    });

    // Clear localStorage (simulates user clearing site data)
    localStorage.removeItem(DISMISSED_KEY);

    // New component instance should show the banner again
    render(<UnsupportedBrowserBanner />);

    await waitFor(() => {
      expect(screen.getByText(/Smooth page transitions aren.t supported/i)).toBeInTheDocument();
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
  });
});
