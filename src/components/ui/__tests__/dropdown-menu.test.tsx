import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../dropdown-menu";

describe("DropdownMenu", () => {
  beforeEach(() => {
    // jsdom gap: Radix's trigger pointerdown handler calls hasPointerCapture
    // on the event target (the same reason the Select test stubs it).
    Element.prototype.hasPointerCapture = vi.fn(() => false);
  });

  it("renders the content as a scroll-capped viewport with the thin scrollbar", () => {
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Actions</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Rename</DropdownMenuItem>
          <DropdownMenuItem>Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    // Radix opens the menu on pointerdown (then the click lands).
    const trigger = screen.getByRole("button", { name: "Actions" });
    fireEvent.pointerDown(trigger);
    fireEvent.click(trigger);

    // The content portals into the body. Long menus scroll internally instead
    // of growing past the viewport: the max-height cap, overflow-y-auto, and
    // the app's thin-scrollbar utility (4px WebKit bar + scrollbar-width:
    // thin) — the same treatment as every other scroll area in the app.
    const content = document.querySelector("[data-radix-menu-content]");
    expect(content).not.toBeNull();
    expect(content).toHaveClass("max-h-[70vh]");
    expect(content).toHaveClass("overflow-y-auto");
    expect(content).toHaveClass("scrollbar-thin");
    expect(content).toHaveClass("rounded-xl");

    // Items render inside it.
    expect(screen.getByRole("menuitem", { name: "Rename" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Delete" })).toBeInTheDocument();
  });

  it("merges a caller className onto the content alongside the scroll cap", () => {
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Actions</DropdownMenuTrigger>
        <DropdownMenuContent className="min-w-[12rem]">
          <DropdownMenuItem>Rename</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    const trigger = screen.getByRole("button", { name: "Actions" });
    fireEvent.pointerDown(trigger);
    fireEvent.click(trigger);

    const content = document.querySelector("[data-radix-menu-content]");
    // Caller classes sit alongside the base — nothing is dropped.
    expect(content).toHaveClass("min-w-[12rem]");
    expect(content).toHaveClass("scrollbar-thin");
    expect(content).toHaveClass("overflow-y-auto");
  });
});
