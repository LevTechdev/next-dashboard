import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { advanceAnimation, useAnimationTimers } from "@/test-utils/animation-test-utils";

// The shared test setup (setup.ts) mocks framer-motion for the whole suite.
// This file undoes that mock so the lifecycle — including the real
// AnimatePresence exit, which keeps the region mounted while it collapses and
// only unmounts it once the tween finishes — is exercised against the actual
// animation library, not the div-passthrough stub.
vi.unmock("framer-motion");

const { mockPrefersReducedMotion } = vi.hoisted(() => ({
  mockPrefersReducedMotion: vi.fn(() => false),
}));

vi.mock("@/hooks/use-prefers-reduced-motion", () => ({
  usePrefersReducedMotion: mockPrefersReducedMotion,
}));

import { AnimatedDisclosure } from "../animated-disclosure";

// The enter/exit transition in animated-disclosure.tsx is 0.25s. These budgets
// comfortably cover it plus a few rAF frames of startup lag.
const ANIMATION_BUDGET_MS = 500;
const MID_EXIT_MS = 120;

describe("AnimatedDisclosure lifecycle with real framer-motion", () => {
  useAnimationTimers();

  beforeEach(() => {
    mockPrefersReducedMotion.mockReturnValue(false);
  });

  it("re-runs the enter tween on every open and repeats the exit-unmount across cycles", async () => {
    const onToggle = vi.fn();
    const { rerender } = render(
      <AnimatedDisclosure open={false} onToggle={onToggle} trigger="More info">
        <p>Hidden body</p>
      </AnimatedDisclosure>,
    );

    // ── Closed: nothing mounted, trigger reports collapsed ──────────────
    expect(screen.queryByText("Hidden body")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "More info" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );

    // ── Open: region mounts hidden (framer-motion's initial styles) ─────
    rerender(
      <AnimatedDisclosure open={true} onToggle={onToggle} trigger="More info">
        <p>Hidden body</p>
      </AnimatedDisclosure>,
    );
    const region = screen.getByText("Hidden body").parentElement!;
    expect(region).toBeInTheDocument();
    expect(region).toHaveStyle({ opacity: "0" });
    expect(screen.getByRole("button", { name: "More info" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );

    // ── Enter animation completes: region fully visible ────────────────
    await advanceAnimation(ANIMATION_BUDGET_MS);
    expect(region).toHaveStyle({ opacity: "1" });
    expect(region).toHaveStyle({ height: "auto" });

    // ── Close: aria flips immediately, but the region is KEPT MOUNTED
    //    while the exit animation collapses it (AnimatePresence contract) ─
    rerender(
      <AnimatedDisclosure open={false} onToggle={onToggle} trigger="More info">
        <p>Hidden body</p>
      </AnimatedDisclosure>,
    );
    expect(screen.getByRole("button", { name: "More info" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.getByText("Hidden body")).toBeInTheDocument();

    // ── Mid-exit: the tween is genuinely running (opacity strictly in
    //    between — not yet collapsed, not yet removed) ──────────────────
    await advanceAnimation(MID_EXIT_MS);
    const midOpacity = parseFloat(region.style.opacity);
    expect(midOpacity).toBeGreaterThan(0);
    expect(midOpacity).toBeLessThan(1);

    // ── Exit finishes: AnimatePresence finally unmounts the region ─────
    await advanceAnimation(ANIMATION_BUDGET_MS);
    expect(screen.queryByText("Hidden body")).not.toBeInTheDocument();

    // ── Reopen: a SECOND enter tween runs. AnimatePresence initial={false}
    //    only skips the FIRST appearance, so re-entering the exit path must
    //    mount a fresh region and animate it in from hidden again ────────
    rerender(
      <AnimatedDisclosure open={true} onToggle={onToggle} trigger="More info">
        <p>Hidden body</p>
      </AnimatedDisclosure>,
    );
    const region2 = screen.getByText("Hidden body").parentElement!;
    expect(region2).toBeInTheDocument();
    expect(region2).not.toBe(region); // genuinely remounted, not reused
    expect(region2).toHaveStyle({ opacity: "0" });
    expect(screen.getByRole("button", { name: "More info" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );

    // Second enter completes: fully visible again.
    await advanceAnimation(ANIMATION_BUDGET_MS);
    expect(region2).toHaveStyle({ opacity: "1" });
    expect(region2).toHaveStyle({ height: "auto" });

    // ── Second collapse: same exit-unmount contract as the first ────────
    rerender(
      <AnimatedDisclosure open={false} onToggle={onToggle} trigger="More info">
        <p>Hidden body</p>
      </AnimatedDisclosure>,
    );
    expect(screen.getByRole("button", { name: "More info" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.getByText("Hidden body")).toBeInTheDocument(); // still mounted mid-exit

    await advanceAnimation(ANIMATION_BUDGET_MS);
    expect(screen.queryByText("Hidden body")).not.toBeInTheDocument(); // unmounted again
  });
});
