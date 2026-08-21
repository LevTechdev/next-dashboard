import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// The shared setup (setup.ts) replaces @/lib/utils' cn with a plain class
// joiner. This file undoes that so the REAL tailwind-merge `cn` runs: the
// keepMounted mode's whole design hinges on twMerge's conflict resolution
// (contentClassName must REPLACE conflicting base classes — e.g.
// transition-[grid-template-rows] → transition-all), which a join-only mock
// cannot exercise. keepMounted renders no framer-motion at all, so the mocked
// framer-motion in setup.ts is irrelevant here.
vi.unmock("@/lib/utils");

import { AnimatedDisclosure } from "../animated-disclosure";

const REGION_ID = "keep-mounted-region";

describe("AnimatedDisclosure keepMounted grid-rows tween", () => {
  it("runs the full closed → open → closed lifecycle, never unmounting", () => {
    const onToggle = vi.fn();
    const { rerender } = render(
      <AnimatedDisclosure
        keepMounted
        open={false}
        onToggle={onToggle}
        trigger="More info"
        contentId={REGION_ID}
      >
        <p>Body</p>
      </AnimatedDisclosure>,
    );

    const wrapper = document.getElementById(REGION_ID)!;
    const button = screen.getByRole("button", { name: "More info" });
    expect(button).toHaveAttribute("aria-controls", REGION_ID);

    // ── Closed: grid tween clipped to 0fr, body stays in the DOM (the whole
    //    point of keepMounted — SSR/SEO surfaces) ─────────────────────────
    expect(wrapper).toHaveClass("grid");
    expect(wrapper).toHaveClass("grid-rows-[0fr]");
    expect(wrapper).toHaveClass("transition-[grid-template-rows]");
    expect(wrapper).toHaveClass("duration-300");
    expect(wrapper).toHaveClass("ease-in-out");
    expect(screen.getByText("Body")).toBeInTheDocument();
    expect(button).toHaveAttribute("aria-expanded", "false");

    // ── Open: the tween target flips to 1fr; body stays mounted ─────────
    rerender(
      <AnimatedDisclosure
        keepMounted
        open
        onToggle={onToggle}
        trigger="More info"
        contentId={REGION_ID}
      >
        <p>Body</p>
      </AnimatedDisclosure>,
    );
    expect(wrapper).toHaveClass("grid-rows-[1fr]");
    expect(wrapper).not.toHaveClass("grid-rows-[0fr]");
    expect(screen.getByText("Body")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "More info" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );

    // ── Close: clipped to 0fr again — still never unmounted ─────────────
    rerender(
      <AnimatedDisclosure
        keepMounted
        open={false}
        onToggle={onToggle}
        trigger="More info"
        contentId={REGION_ID}
      >
        <p>Body</p>
      </AnimatedDisclosure>,
    );
    expect(wrapper).toHaveClass("grid-rows-[0fr]");
    expect(screen.getByText("Body")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "More info" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("lets contentClassName override the base tween utility via tailwind-merge (FAQ accordion pattern)", () => {
    render(
      <AnimatedDisclosure
        keepMounted
        open={false}
        onToggle={vi.fn()}
        trigger="More info"
        contentId={REGION_ID}
        contentClassName="transition-all border-l-2"
      >
        <p>Body</p>
      </AnimatedDisclosure>,
    );

    const wrapper = document.getElementById(REGION_ID)!;

    // contentClassName comes last in cn(), so twMerge drops the base
    // transition-[grid-template-rows] in favor of transition-all — the FAQ
    // accordion relies on this so its accent border/background color tweens
    // alongside the height tween.
    expect(wrapper).toHaveClass("transition-all");
    expect(wrapper).not.toHaveClass("transition-[grid-template-rows]");
    expect(wrapper).toHaveClass("border-l-2");

    // The grid-rows tween and its reduced-motion escape hatch survive the
    // merge (motion-reduce: is a modifier, so twMerge keeps it alongside
    // transition-all).
    expect(wrapper).toHaveClass("grid-rows-[0fr]");
    expect(wrapper).toHaveClass("duration-300");
    expect(wrapper).toHaveClass("motion-reduce:transition-none");
  });
});
