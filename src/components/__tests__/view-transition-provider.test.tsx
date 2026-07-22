import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import {
  ViewTransitionProvider,
  useViewTransition,
} from "../view-transition-provider";

// ── Mock next/navigation ─────────────────────────────────────────────────
// We override the global setup mock so we can spy on router.push/replace
const mockPush = vi.fn();
const mockReplace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
  usePathname: () => "/current-page",
}));

// ── ViewTransitionProvider mock (already exported, we test it directly) ──

// ── Helper component exposed to consumers ────────────────────────────────
function TestConsumer() {
  const { push, replace, isSupported } = useViewTransition();
  return (
    <div>
      <span data-testid="supported">{String(isSupported)}</span>

      <button data-testid="btn-push" onClick={() => push("/target")}>
        Push
      </button>
      <button data-testid="btn-replace" onClick={() => replace("/target")}>
        Replace
      </button>
      <button
        data-testid="btn-push-same"
        onClick={() => push("/current-page")}
      >
        Push Same
      </button>
      <button
        data-testid="btn-replace-same"
        onClick={() => replace("/current-page")}
      >
        Replace Same
      </button>

      <a href="/other-page" data-testid="link-internal">
        Internal
      </a>
      <a href="https://external.com" data-testid="link-external">
        External
      </a>
      <a href="/other-page" target="_blank" data-testid="link-blank">
        Blank
      </a>
      <a href="/other-page" download data-testid="link-download">
        Download
      </a>
      <a href="/other-page" rel="external" data-testid="link-rel-external">
        Rel External
      </a>
    </div>
  );
}

function renderProvider() {
  return render(
    <ViewTransitionProvider>
      <TestConsumer />
    </ViewTransitionProvider>
  );
}

describe("ViewTransitionProvider", () => {
  let mockStartViewTransition: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Ensure startViewTransition is NOT defined by default (simulating
    // an unsupported browser / jsdom environment). We only set it in
    // tests that specifically need it.
    if ("startViewTransition" in document) {
      delete (document as any).startViewTransition;
    }

    mockStartViewTransition = vi.fn((callback: () => void) => {
      callback();
    });
  });

  afterEach(() => {
    // Restore document.startViewTransition to undefined
    if ("startViewTransition" in document) {
      delete (document as any).startViewTransition;
    }
  });

  // ── isSupported detection ──────────────────────────────────────────────

  describe("isSupported detection", () => {
    it("returns isSupported=false when startViewTransition is undefined", async () => {
      renderProvider();

      await waitFor(() => {
        expect(screen.getByTestId("supported")).toHaveTextContent("false");
      });
    });

    it("returns isSupported=true when startViewTransition is defined", async () => {
      Object.defineProperty(document, "startViewTransition", {
        value: mockStartViewTransition,
        writable: true,
        configurable: true,
      });

      renderProvider();

      await waitFor(() => {
        expect(screen.getByTestId("supported")).toHaveTextContent("true");
      });
    });
  });

  // ── Fallback navigation (startViewTransition undefined) ────────────────

  describe("fallback navigation (startViewTransition undefined)", () => {
    it("calls router.push directly when push() is invoked", async () => {
      renderProvider();

      fireEvent.click(screen.getByTestId("btn-push"));

      expect(mockPush).toHaveBeenCalledWith("/target");
      expect(mockPush).toHaveBeenCalledTimes(1);
      // No native View Transition was attempted
      expect(
        "startViewTransition" in document
      ).toBeFalsy();
    });

    it("calls router.replace directly when replace() is invoked", async () => {
      renderProvider();

      fireEvent.click(screen.getByTestId("btn-replace"));

      expect(mockReplace).toHaveBeenCalledWith("/target");
      expect(mockReplace).toHaveBeenCalledTimes(1);
    });

    it("does NOT attach a global click handler", async () => {
      const addSpy = vi.spyOn(document, "addEventListener");

      renderProvider();

      // The useEffect returns early when !isSupported, so no click handler
      // should be registered. Note: other code may attach other listeners,
      // but none with "click" and { capture: true }.
      const clickHandlerCalls = addSpy.mock.calls.filter(
        ([type, _handler, options]) =>
          type === "click" &&
          typeof options === "object" &&
          (options as AddEventListenerOptions).capture === true
      );

      expect(clickHandlerCalls).toHaveLength(0);
      addSpy.mockRestore();
    });
  });

  // ── Transition navigation (startViewTransition defined) ────────────────

  describe("transition navigation (startViewTransition defined)", () => {
    beforeEach(() => {
      Object.defineProperty(document, "startViewTransition", {
        value: mockStartViewTransition,
        writable: true,
        configurable: true,
      });
    });

    it("wraps push() in startViewTransition", async () => {
      renderProvider();

      fireEvent.click(screen.getByTestId("btn-push"));

      expect(mockStartViewTransition).toHaveBeenCalledTimes(1);
      expect(mockPush).toHaveBeenCalledWith("/target");
    });

    it("wraps replace() in startViewTransition", async () => {
      renderProvider();

      fireEvent.click(screen.getByTestId("btn-replace"));

      expect(mockStartViewTransition).toHaveBeenCalledTimes(1);
      expect(mockReplace).toHaveBeenCalledWith("/target");
    });

    it("does NOT navigate when push() is called with the current pathname", async () => {
      renderProvider();

      fireEvent.click(screen.getByTestId("btn-push-same"));

      expect(mockStartViewTransition).not.toHaveBeenCalled();
      expect(mockPush).not.toHaveBeenCalled();
    });

    it("does NOT navigate when replace() is called with the current pathname", async () => {
      renderProvider();

      fireEvent.click(screen.getByTestId("btn-replace-same"));

      expect(mockStartViewTransition).not.toHaveBeenCalled();
      expect(mockReplace).not.toHaveBeenCalled();
    });
  });

  // ── Global click handler ──────────────────────────────────────────────

  describe("global click handler", () => {
    it("does NOT intercept internal link clicks when unsupported", async () => {
      renderProvider();

      // Click an internal link — the handler isn't registered, so
      // no navigation function should be called.
      fireEvent.click(screen.getByTestId("link-internal"));

      expect(mockPush).not.toHaveBeenCalled();
      expect(mockReplace).not.toHaveBeenCalled();
    });

    it("intercepts internal link clicks when supported, via startViewTransition", async () => {
      Object.defineProperty(document, "startViewTransition", {
        value: mockStartViewTransition,
        writable: true,
        configurable: true,
      });

      renderProvider();

      await waitFor(() => {
        expect(screen.getByTestId("supported")).toHaveTextContent("true");
      });

      fireEvent.click(screen.getByTestId("link-internal"));

      // The click handler should have intercepted and called
      // startViewTransition, which in turn calls router.push
      expect(mockStartViewTransition).toHaveBeenCalledTimes(1);
      expect(mockPush).toHaveBeenCalledWith("/other-page");
    });

    it("does NOT intercept external-origin links", async () => {
      Object.defineProperty(document, "startViewTransition", {
        value: mockStartViewTransition,
        writable: true,
        configurable: true,
      });

      renderProvider();

      await waitFor(() => {
        expect(screen.getByTestId("supported")).toHaveTextContent("true");
      });

      // External link should not be intercepted
      fireEvent.click(screen.getByTestId("link-external"));
      expect(mockPush).not.toHaveBeenCalled();
      expect(mockStartViewTransition).not.toHaveBeenCalled();
    });

    it("does NOT intercept target=_blank links", async () => {
      Object.defineProperty(document, "startViewTransition", {
        value: mockStartViewTransition,
        writable: true,
        configurable: true,
      });

      renderProvider();

      await waitFor(() => {
        expect(screen.getByTestId("supported")).toHaveTextContent("true");
      });

      fireEvent.click(screen.getByTestId("link-blank"));
      expect(mockPush).not.toHaveBeenCalled();
      expect(mockStartViewTransition).not.toHaveBeenCalled();
    });

    it("does NOT intercept links with download attribute", async () => {
      Object.defineProperty(document, "startViewTransition", {
        value: mockStartViewTransition,
        writable: true,
        configurable: true,
      });

      renderProvider();

      await waitFor(() => {
        expect(screen.getByTestId("supported")).toHaveTextContent("true");
      });

      fireEvent.click(screen.getByTestId("link-download"));
      expect(mockPush).not.toHaveBeenCalled();
      expect(mockStartViewTransition).not.toHaveBeenCalled();
    });

    it("does NOT intercept links with rel=external", async () => {
      Object.defineProperty(document, "startViewTransition", {
        value: mockStartViewTransition,
        writable: true,
        configurable: true,
      });

      renderProvider();

      await waitFor(() => {
        expect(screen.getByTestId("supported")).toHaveTextContent("true");
      });

      fireEvent.click(screen.getByTestId("link-rel-external"));
      expect(mockPush).not.toHaveBeenCalled();
      expect(mockStartViewTransition).not.toHaveBeenCalled();
    });

    it("cleans up the click handler on unmount", async () => {
      const removeSpy = vi.spyOn(document, "removeEventListener");

      Object.defineProperty(document, "startViewTransition", {
        value: mockStartViewTransition,
        writable: true,
        configurable: true,
      });

      const { unmount } = renderProvider();

      unmount();

      // The cleanup should remove the click handler
      const cleanupCalls = removeSpy.mock.calls.filter(
        ([type, _handler, options]) =>
          type === "click" &&
          typeof options === "object" &&
          (options as AddEventListenerOptions).capture === true
      );

      expect(cleanupCalls).toHaveLength(1);
      removeSpy.mockRestore();
    });
  });
});
