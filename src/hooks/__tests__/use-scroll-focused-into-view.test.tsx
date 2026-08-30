import { describe, it, expect, vi } from "vitest";
import { useRef } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { useScrollFocusedIntoView } from "../use-scroll-focused-into-view";

function Harness() {
  const ref = useRef<HTMLDivElement>(null);
  useScrollFocusedIntoView(ref);
  return (
    <div ref={ref} data-testid="row">
      <button>One</button>
      <button>Two</button>
    </div>
  );
}

// jsdom doesn't implement scrollIntoView — stub it and assert the calls.
function withScrollIntoViewStub<T>(fn: () => T): T {
  const scrollIntoView = vi.fn();
  const original = Element.prototype.scrollIntoView;
  Element.prototype.scrollIntoView = scrollIntoView;
  try {
    return fn();
  } finally {
    Element.prototype.scrollIntoView = original;
  }
}

describe("useScrollFocusedIntoView", () => {
  it("scrolls a focused child into view with the default nearest/smooth options", () => {
    withScrollIntoViewStub(() => {
      render(<Harness />);
      fireEvent.focusIn(screen.getByRole("button", { name: "Two" }));
      expect(Element.prototype.scrollIntoView).toHaveBeenCalledTimes(1);
      expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({
        block: "nearest",
        inline: "nearest",
        behavior: "smooth",
      });
    });
  });

  it("ignores focus landing on the container itself", () => {
    withScrollIntoViewStub(() => {
      render(<Harness />);
      fireEvent.focusIn(screen.getByTestId("row"));
      expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
    });
  });

  it("ignores focus outside the container", () => {
    withScrollIntoViewStub(() => {
      render(<Harness />);
      fireEvent.focusIn(document.body);
      expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
    });
  });

  it("passes custom options through", () => {
    function CustomOptionsHarness() {
      const ref = useRef<HTMLDivElement>(null);
      useScrollFocusedIntoView(ref, { block: "start", inline: "start", behavior: "auto" });
      return (
        <div ref={ref}>
          <button>One</button>
        </div>
      );
    }
    withScrollIntoViewStub(() => {
      render(<CustomOptionsHarness />);
      fireEvent.focusIn(screen.getByRole("button", { name: "One" }));
      expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({
        block: "start",
        inline: "start",
        behavior: "auto",
      });
    });
  });

  it("does not throw when scrollIntoView is unavailable (jsdom without stub)", () => {
    render(<Harness />);
    expect(() => fireEvent.focusIn(screen.getByRole("button", { name: "Two" }))).not.toThrow();
  });
});
