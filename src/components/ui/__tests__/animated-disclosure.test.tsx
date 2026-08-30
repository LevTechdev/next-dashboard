import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AnimatedDisclosure } from "../animated-disclosure";
import { ChevronDown } from "lucide-react";

const { mockPrefersReducedMotion } = vi.hoisted(() => ({
  mockPrefersReducedMotion: vi.fn(() => false),
}));

vi.mock("@/hooks/use-prefers-reduced-motion", () => ({
  usePrefersReducedMotion: mockPrefersReducedMotion,
}));

beforeEach(() => {
  mockPrefersReducedMotion.mockReturnValue(false);
});

// The shared setup mocks framer-motion (motion.div -> plain div, AnimatePresence
// -> passthrough), so assertions focus on the disclosure contract: the trigger
// button, aria wiring, and open/closed content mounting.

describe("AnimatedDisclosure", () => {
  it("renders the trigger button with aria-expanded=false and no content when closed", () => {
    const onToggle = vi.fn();
    render(
      <AnimatedDisclosure open={false} onToggle={onToggle} trigger="More info">
        <p>Hidden body</p>
      </AnimatedDisclosure>,
    );

    const button = screen.getByRole("button", { name: "More info" });
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(button).toHaveAttribute("aria-controls");
    expect(screen.queryByText("Hidden body")).not.toBeInTheDocument();
  });

  it("calls onToggle when the trigger is clicked and shows content when open", () => {
    const onToggle = vi.fn();
    const { rerender } = render(
      <AnimatedDisclosure open={false} onToggle={onToggle} trigger="More info">
        <p>Hidden body</p>
      </AnimatedDisclosure>,
    );

    fireEvent.click(screen.getByRole("button", { name: "More info" }));
    expect(onToggle).toHaveBeenCalledTimes(1);

    rerender(
      <AnimatedDisclosure open={true} onToggle={onToggle} trigger="More info">
        <p>Hidden body</p>
      </AnimatedDisclosure>,
    );

    expect(screen.getByRole("button", { name: "More info" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByText("Hidden body")).toBeInTheDocument();
  });

  it("points aria-controls at the content region id", () => {
    render(
      <AnimatedDisclosure open={true} onToggle={vi.fn()} trigger="More info" contentId="my-region">
        <p>Body</p>
      </AnimatedDisclosure>,
    );

    const button = screen.getByRole("button", { name: "More info" });
    expect(button).toHaveAttribute("aria-controls", "my-region");
    expect(document.getElementById("my-region")).toBeInTheDocument();
  });

  it("passes the open state to a render-prop trigger (e.g. chevron rotation)", () => {
    const { rerender } = render(
      <AnimatedDisclosure
        open={false}
        onToggle={vi.fn()}
        trigger={({ open }) => (
          <>
            <span>Why?</span>
            <ChevronDown data-testid="chevron" className={open ? "rotate-180" : ""} />
          </>
        )}
      >
        <p>Because.</p>
      </AnimatedDisclosure>,
    );

    expect(screen.getByTestId("chevron").getAttribute("class")).not.toContain("rotate-180");

    rerender(
      <AnimatedDisclosure
        open={true}
        onToggle={vi.fn()}
        trigger={({ open }) => (
          <>
            <span>Why?</span>
            <ChevronDown data-testid="chevron" className={open ? "rotate-180" : ""} />
          </>
        )}
      >
        <p>Because.</p>
      </AnimatedDisclosure>,
    );

    expect(screen.getByTestId("chevron").getAttribute("class")).toContain("rotate-180");
  });

  it("hides the trigger button entirely when the render-prop returns null, keeping the content", () => {
    render(
      <AnimatedDisclosure open={true} onToggle={vi.fn()} trigger={() => null}>
        <p>Still visible</p>
      </AnimatedDisclosure>,
    );

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByText("Still visible")).toBeInTheDocument();
  });

  it("renders content-only (no trigger passed) and honors contentClassName", () => {
    render(
      <AnimatedDisclosure open={true} onToggle={vi.fn()} contentClassName="mt-4">
        <p>Details</p>
      </AnimatedDisclosure>,
    );

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    const wrapper = screen.getByText("Details").parentElement;
    expect(wrapper).toHaveClass("mt-4");
    expect(wrapper).toHaveClass("overflow-hidden");
  });

  it("applies triggerClassName to the trigger button", () => {
    render(
      <AnimatedDisclosure
        open={false}
        onToggle={vi.fn()}
        trigger="More info"
        triggerClassName="w-full text-left"
      >
        <p>Body</p>
      </AnimatedDisclosure>,
    );

    expect(screen.getByRole("button", { name: "More info" })).toHaveClass("w-full");
    expect(screen.getByRole("button", { name: "More info" })).toHaveClass("text-left");
  });

  it("skips the height tween and snaps open/closed when reduced motion is requested", () => {
    mockPrefersReducedMotion.mockReturnValue(true);
    const { rerender } = render(
      <AnimatedDisclosure open={false} onToggle={vi.fn()} trigger="More info">
        <p>Body</p>
      </AnimatedDisclosure>,
    );

    // Closed: no content region at all (nothing to animate in/out).
    expect(screen.queryByText("Body")).not.toBeInTheDocument();

    rerender(
      <AnimatedDisclosure open={true} onToggle={vi.fn()} trigger="More info">
        <p>Body</p>
      </AnimatedDisclosure>,
    );

    // Open: the content mounts instantly in a plain (non-animated) region.
    const wrapper = screen.getByText("Body").parentElement;
    expect(wrapper).toHaveAttribute("data-reduced-motion", "true");
    expect(screen.getByRole("button", { name: "More info" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );

    // Close: unmounts instantly (no AnimatePresence exit to wait through).
    rerender(
      <AnimatedDisclosure open={false} onToggle={vi.fn()} trigger="More info">
        <p>Body</p>
      </AnimatedDisclosure>,
    );
    expect(screen.queryByText("Body")).not.toBeInTheDocument();
  });

  it("uses the animated region by default (no reduced motion)", () => {
    render(
      <AnimatedDisclosure open={true} onToggle={vi.fn()} trigger="More info">
        <p>Body</p>
      </AnimatedDisclosure>,
    );

    expect(screen.getByText("Body").parentElement).not.toHaveAttribute("data-reduced-motion");
  });
});

describe("AnimatedDisclosure keepMounted mode", () => {
  it("keeps content in the DOM when closed, clipped with a grid-rows tween (SSR-friendly)", () => {
    render(
      <AnimatedDisclosure keepMounted open={false} onToggle={vi.fn()} trigger="More info">
        <p>Always in DOM</p>
      </AnimatedDisclosure>,
    );

    // The body is present even while collapsed — the whole point of the mode.
    expect(screen.getByText("Always in DOM")).toBeInTheDocument();

    const button = screen.getByRole("button", { name: "More info" });
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(button).toHaveAttribute("aria-controls");

    // The tweened wrapper clips the body to zero rows (grid-rows-[0fr]).
    const clip = screen.getByText("Always in DOM").parentElement;
    expect(clip).toHaveClass("overflow-hidden");
    const wrapper = clip?.parentElement;
    expect(wrapper).toHaveClass("grid-rows-[0fr]");
    expect(wrapper).toHaveAttribute("id", button.getAttribute("aria-controls"));
  });

  it("switches the tween to grid-rows-[1fr] when open and stays mounted on close", () => {
    const { rerender } = render(
      <AnimatedDisclosure keepMounted open={false} onToggle={vi.fn()} trigger="More info">
        <p>Body</p>
      </AnimatedDisclosure>,
    );

    rerender(
      <AnimatedDisclosure keepMounted open={true} onToggle={vi.fn()} trigger="More info">
        <p>Body</p>
      </AnimatedDisclosure>,
    );
    const wrapper = screen.getByText("Body").parentElement?.parentElement;
    expect(wrapper).toHaveClass("grid-rows-[1fr]");
    expect(screen.getByRole("button", { name: "More info" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );

    rerender(
      <AnimatedDisclosure keepMounted open={false} onToggle={vi.fn()} trigger="More info">
        <p>Body</p>
      </AnimatedDisclosure>,
    );
    // Never unmounted — content still present, just clipped again.
    expect(screen.getByText("Body")).toBeInTheDocument();
    expect(wrapper).toHaveClass("grid-rows-[0fr]");
  });

  it("applies contentClassName to the grid wrapper and disables the tween under reduced motion", () => {
    mockPrefersReducedMotion.mockReturnValue(true);
    render(
      <AnimatedDisclosure
        keepMounted
        open={false}
        onToggle={vi.fn()}
        trigger="More info"
        contentClassName="border-l-2 border-neutral-300 transition-all"
      >
        <p>Body</p>
      </AnimatedDisclosure>,
    );

    const wrapper = screen.getByText("Body").parentElement?.parentElement;
    expect(wrapper).toHaveClass("border-l-2");
    expect(wrapper).toHaveClass("grid");
    // Pure-CSS reduced-motion handling: the tween is disabled, not the
    // mounting — content stays in the DOM for SSR/SEO either way.
    expect(wrapper).toHaveClass("motion-reduce:transition-none");
    expect(screen.getByText("Body")).toBeInTheDocument();
  });
});
