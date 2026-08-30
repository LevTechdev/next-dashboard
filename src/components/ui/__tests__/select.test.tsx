import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../select";

describe("Select", () => {
  beforeEach(() => {
    // jsdom gap: Radix's trigger pointerdown handler calls hasPointerCapture
    // on the event target (the same reason other Radix tests stub
    // scrollIntoView).
    Element.prototype.hasPointerCapture = vi.fn(() => false);
  });

  it("opens a dropdown whose viewport carries the thin-scrollbar class", () => {
    render(
      <Select>
        <SelectTrigger>
          <SelectValue placeholder="Pick" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="a">Option A</SelectItem>
          <SelectItem value="b">Option B</SelectItem>
        </SelectContent>
      </Select>,
    );

    // Radix opens the trigger on pointerdown (then the click lands).
    const trigger = screen.getByRole("combobox");
    fireEvent.pointerDown(trigger);
    fireEvent.click(trigger);

    // The dropdown portals into the body; its viewport is the scroll container
    // (overflow-y: auto from Radix) and carries the app's thin-scrollbar
    // utility — the same scrollbar-thin treatment as every other scroll area.
    const viewport = document.querySelector("[data-radix-select-viewport]");
    expect(viewport).not.toBeNull();
    expect(viewport).toHaveClass("p-1");
    expect(viewport).toHaveClass("scrollbar-thin");

    // Items render inside it.
    expect(screen.getByRole("option", { name: "Option A" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Option B" })).toBeInTheDocument();
  });
});
