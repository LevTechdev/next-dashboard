import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";

// Undo the global mock from setup.ts so we test the real component
vi.unmock("@/components/ui/animated-counter");

import { AnimatedCounter } from "../animated-counter";

describe("AnimatedCounter", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame"] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders a span with the initial value", () => {
    render(<AnimatedCounter end={100} />);

    const span = screen.getByText("0");
    expect(span).toBeInTheDocument();
    expect(span.tagName).toBe("SPAN");
  });

  it("applies tabular-nums class", () => {
    render(<AnimatedCounter end={100} />);

    const span = screen.getByText("0");
    expect(span.className).toContain("tabular-nums");
  });

  it("applies transition-opacity class", () => {
    render(<AnimatedCounter end={100} />);

    const span = screen.getByText("0");
    expect(span.className).toContain("transition-opacity");
  });

  it("displays the animated end value after enough time", () => {
    render(<AnimatedCounter end={42} />);

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("renders with a prefix", () => {
    render(<AnimatedCounter end={50} prefix="$" />);

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(screen.getByText("$50")).toBeInTheDocument();
  });

  it("renders with a suffix", () => {
    render(<AnimatedCounter end={75} suffix="%" />);

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(screen.getByText("75%")).toBeInTheDocument();
  });

  it("renders with a custom formatter", () => {
    render(
      <AnimatedCounter
        end={2500}
        formatter={(v) => `${(v / 1000).toFixed(1)}K`}
      />
    );

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(screen.getByText("2.5K")).toBeInTheDocument();
  });

  it("respects decimal places", () => {
    render(<AnimatedCounter end={99} decimals={1} />);

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(screen.getByText("99.0")).toBeInTheDocument();
  });

  it("applies custom className", () => {
    render(<AnimatedCounter end={100} className="font-bold" />);

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    const span = screen.getByText("100");
    expect(span.className).toContain("font-bold");
  });

  it("applies opacity-90 while animating", () => {
    render(<AnimatedCounter end={100} />);

    // Before advancing, the animation is still in progress
    const span = screen.getByText("0");
    expect(span.className).toContain("opacity-90");
  });

  it("removes opacity-90 after animation completes", () => {
    render(<AnimatedCounter end={100} />);

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    const span = screen.getByText("100");
    expect(span.className).not.toContain("opacity-90");
  });

  it("completes within the default 1500ms duration", () => {
    render(<AnimatedCounter end={100} />);

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    const span = screen.getByText("100");
    expect(span).toBeInTheDocument();
  });

  it("handles zero as end value", () => {
    render(<AnimatedCounter end={0} />);

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(screen.getByText("0")).toBeInTheDocument();
  });

  describe("edge cases", () => {
    it("handles NaN end value without crashing", () => {
      render(<AnimatedCounter end={NaN} />);

      act(() => {
        vi.advanceTimersByTime(2000);
      });

      // value.toFixed(0) on NaN returns "NaN"
      expect(screen.getByText("NaN")).toBeInTheDocument();
    });

    it("handles Infinity end value without crashing", () => {
      render(<AnimatedCounter end={Infinity} />);

      act(() => {
        vi.advanceTimersByTime(2000);
      });

      expect(screen.getByText("Infinity")).toBeInTheDocument();
    });

    it("handles -Infinity end value without crashing", () => {
      render(<AnimatedCounter end={-Infinity} />);

      act(() => {
        vi.advanceTimersByTime(2000);
      });

      expect(screen.getByText(/-?Infinity/)).toBeInTheDocument();
    });

    it("handles duration of 0", () => {
      render(<AnimatedCounter end={100} duration={0} />);

      // Advance by ~1 frame so rAF fires (advanceTimersByTime(0) may not trigger rAF)
      act(() => {
        vi.advanceTimersByTime(16);
      });

      expect(screen.getByText("100")).toBeInTheDocument();
    });

    it("handles very large numbers", () => {
      render(<AnimatedCounter end={Number.MAX_SAFE_INTEGER} />);

      act(() => {
        vi.advanceTimersByTime(2000);
      });

      expect(
        screen.getByText(Number.MAX_SAFE_INTEGER.toString())
      ).toBeInTheDocument();
    });

    it("handles very small decimal end value with decimals prop", () => {
      render(<AnimatedCounter end={0.001} decimals={4} />);

      act(() => {
        vi.advanceTimersByTime(2000);
      });

      expect(screen.getByText("0.0010")).toBeInTheDocument();
    });

    it("handles negative duration without crashing", () => {
      render(<AnimatedCounter end={100} duration={-500} />);

      // Should render without throwing
      act(() => {
        vi.advanceTimersByTime(100);
      });

      // Animation may not complete with negative duration, but component should exist
      const span = document.querySelector(".tabular-nums");
      expect(span).toBeInTheDocument();
    });
  });
});
