import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Textarea } from "../textarea";

describe("Textarea", () => {
  it("carries the shared base styling plus the thin-scrollbar class", () => {
    render(<Textarea aria-label="notes" />);
    const el = screen.getByLabelText("notes");

    // The shared base styling (ui/textarea.tsx, merged through cn).
    expect(el).toHaveClass("flex");
    expect(el).toHaveClass("min-h-[80px]");
    expect(el).toHaveClass("w-full");
    expect(el).toHaveClass("rounded-md");
    expect(el).toHaveClass("border");
    expect(el).toHaveClass("border-input");
    expect(el).toHaveClass("bg-background");
    expect(el).toHaveClass("px-3");
    expect(el).toHaveClass("py-2");
    expect(el).toHaveClass("text-base");
    expect(el).toHaveClass("md:text-sm");
    expect(el).toHaveClass("placeholder:text-muted-foreground");
    expect(el).toHaveClass("focus-visible:outline-none");
    expect(el).toHaveClass("focus-visible:ring-2");
    expect(el).toHaveClass("disabled:cursor-not-allowed");
    expect(el).toHaveClass("disabled:opacity-50");

    // The thin-scrollbar pin: every Textarea is a scroll surface once content
    // overflows its height, so it ships the .scrollbar-thin utility (4px
    // WebKit bar + scrollbar-width: thin) instead of the chunky default.
    expect(el).toHaveClass("scrollbar-thin");
  });

  it("merges a caller className and forwards textarea props", () => {
    const ref = vi.fn();
    render(
      <Textarea
        ref={ref}
        className="max-h-24 resize-none"
        placeholder="Type here..."
        disabled
        rows={3}
      />,
    );

    const el = screen.getByPlaceholderText("Type here...");
    // Caller classes sit alongside the base (no base class is dropped).
    expect(el).toHaveClass("max-h-24");
    expect(el).toHaveClass("resize-none");
    expect(el).toHaveClass("scrollbar-thin");
    expect(el).toHaveClass("w-full");

    // Props land on the underlying element, and the ref receives it.
    expect(el).toBeDisabled();
    expect(el).toHaveAttribute("rows", "3");
    expect(ref).toHaveBeenCalledWith(el);
  });
});
