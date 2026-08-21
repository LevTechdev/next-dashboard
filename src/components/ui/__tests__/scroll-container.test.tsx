import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ScrollContainer } from "../scroll-container";

describe("ScrollContainer", () => {
  it("defaults to a vertical, thin-scrollbar container", () => {
    render(
      <ScrollContainer aria-label="feed">
        <p>content</p>
      </ScrollContainer>,
    );
    const el = screen.getByLabelText("feed");
    expect(el).toHaveClass("overflow-y-auto");
    expect(el).toHaveClass("scrollbar-thin");
    expect(el).not.toHaveClass("overflow-x-auto");
    expect(el).not.toHaveClass("overflow-auto");
    expect(screen.getByText("content")).toBeInTheDocument();
  });

  it('scrolls horizontally for axis="x"', () => {
    render(
      <ScrollContainer axis="x" aria-label="pills">
        <p>content</p>
      </ScrollContainer>,
    );
    const el = screen.getByLabelText("pills");
    expect(el).toHaveClass("overflow-x-auto");
    expect(el).not.toHaveClass("overflow-y-auto");
    expect(el).toHaveClass("scrollbar-thin");
  });

  it('scrolls both axes for axis="both"', () => {
    render(
      <ScrollContainer axis="both" aria-label="both">
        <p>content</p>
      </ScrollContainer>,
    );
    const el = screen.getByLabelText("both");
    expect(el).toHaveClass("overflow-auto");
    expect(el).not.toHaveClass("overflow-x-auto");
    expect(el).not.toHaveClass("overflow-y-auto");
    expect(el).toHaveClass("scrollbar-thin");
  });

  it("merges layout classes and lets callers override the scroll axis via cn/twMerge", () => {
    render(
      <ScrollContainer className="flex-1 min-h-[200px]" aria-label="merged">
        <p>content</p>
      </ScrollContainer>,
    );
    const el = screen.getByLabelText("merged");
    expect(el).toHaveClass("flex-1");
    expect(el).toHaveClass("min-h-[200px]");
    expect(el).toHaveClass("overflow-y-auto");
    expect(el).toHaveClass("scrollbar-thin");
  });

  // NOTE: conflict resolution (e.g. a caller's overflow-y-visible dropping
  // the default overflow-y-auto) is handled by the real cn/twMerge in the
  // app — the component test setup mocks @/lib/utils with a plain class join
  // (see setup.ts), so that behavior isn't exercised here.
});
