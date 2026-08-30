import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// The shared setup (setup.ts) replaces @/lib/utils' cn with a plain class
// joiner. This file undoes that so the REAL tailwind-merge `cn` runs: the
// TabsList's responsive handling depends on twMerge's conflict resolution
// (caller className must REPLACE the base w-full/md:w-auto/justify-* classes
// per breakpoint), which a join-only mock cannot exercise. No framer-motion
// or other mocked modules are involved in rendering tabs.
vi.unmock("@/lib/utils");

import { Tabs, TabsList, TabsTrigger, TabsContent } from "../tabs";

function renderTabs(listClassName?: string) {
  render(
    <Tabs defaultValue="a">
      <TabsList className={listClassName}>
        <TabsTrigger value="a">Tab A</TabsTrigger>
        <TabsTrigger value="b">Tab B</TabsTrigger>
      </TabsList>
      <TabsContent value="a">Content A</TabsContent>
      <TabsContent value="b">Content B</TabsContent>
    </Tabs>,
  );
  return screen.getByRole("tablist");
}

describe("TabsList responsive classes", () => {
  it("carries the base responsive handling by default", () => {
    const tablist = renderTabs();

    // Pill chrome.
    expect(tablist).toHaveClass("inline-flex");
    expect(tablist).toHaveClass("h-10");

    // The responsive contract: full-width, left-aligned, internally
    // scrollable below md; centered shrink-to-fit pill from md up.
    expect(tablist).toHaveClass("w-full");
    expect(tablist).toHaveClass("md:w-auto");
    expect(tablist).toHaveClass("justify-start");
    expect(tablist).toHaveClass("md:justify-center");
    expect(tablist).toHaveClass("overflow-x-auto");

    // No native scrollbar inside the menu (the .scrollbar-none utility in
    // globals.css hides it on WebKit + Firefox); a tiny progress line
    // replaces it.
    expect(tablist).toHaveClass("relative");
    expect(tablist).toHaveClass("scrollbar-none");
  });

  it("merges non-conflicting caller classes alongside the base", () => {
    const tablist = renderTabs("p-2");

    expect(tablist).toHaveClass("p-2");
    // Nothing conflicting, so every base class survives the merge.
    expect(tablist).toHaveClass("w-full");
    expect(tablist).toHaveClass("md:w-auto");
    expect(tablist).toHaveClass("overflow-x-auto");
  });

  it("lets caller className override per breakpoint via tailwind-merge (orders pattern)", () => {
    // orders/page.tsx passes md:w-full md:justify-start to keep the bar
    // full-width on desktop too; twMerge must REPLACE the base md:w-auto /
    // md:justify-center rather than appending.
    const tablist = renderTabs("md:w-full md:justify-start");

    expect(tablist).toHaveClass("md:w-full");
    expect(tablist).toHaveClass("md:justify-start");
    expect(tablist).not.toHaveClass("md:w-auto");
    expect(tablist).not.toHaveClass("md:justify-center");

    // Mobile base behavior is untouched by the md-only override.
    expect(tablist).toHaveClass("w-full");
    expect(tablist).toHaveClass("justify-start");
    expect(tablist).toHaveClass("overflow-x-auto");
  });

  it("lets caller className override the mobile width via tailwind-merge (theme-showcase pattern)", () => {
    // theme-showcase.tsx passes w-fit; twMerge must drop the base w-full.
    const tablist = renderTabs("w-fit");

    expect(tablist).toHaveClass("w-fit");
    expect(tablist).not.toHaveClass("w-full");

    // md:w-auto is a different breakpoint, so it survives.
    expect(tablist).toHaveClass("md:w-auto");
    expect(tablist).toHaveClass("overflow-x-auto");
  });
});

// Radix TabsContent keeps every panel mounted (inactive ones get the hidden
// attribute and no children), so panels exist even before first activation.
// A hidden panel's accessible name doesn't resolve from aria-labelledby, so
// resolve the panel through the trigger's aria-controls wiring instead — the
// same accessibility contract the e2e specs pin.
function getPanel(tab: HTMLElement) {
  const panel = document.getElementById(tab.getAttribute("aria-controls")!);
  expect(panel).not.toBeNull();
  return panel!;
}

describe("TabsTrigger styling and content switching", () => {
  it("marks the active trigger with data-state=active and its styling classes", () => {
    renderTabs();
    const tabA = screen.getByRole("tab", { name: "Tab A" });
    const tabB = screen.getByRole("tab", { name: "Tab B" });

    // The data-[state=active]:* selectors only fire when the element's
    // data-state attribute matches — that attribute is the styling contract.
    expect(tabA).toHaveAttribute("data-state", "active");
    expect(tabA).toHaveClass("data-[state=active]:bg-white");
    expect(tabA).toHaveClass("data-[state=active]:text-gray-900");
    expect(tabA).toHaveClass("data-[state=active]:shadow-sm");
    expect(tabA).toHaveAttribute("aria-selected", "true");

    // The same styling classes are present on the inactive trigger, but its
    // data-state makes the selectors inert.
    expect(tabB).toHaveAttribute("data-state", "inactive");
    expect(tabB).toHaveAttribute("aria-selected", "false");
    expect(tabB).toHaveClass("data-[state=active]:bg-white");
    expect(tabB).toHaveClass("data-[state=active]:text-gray-900");
  });

  it("swaps the visible TabsContent panel when clicking the other trigger", () => {
    renderTabs();
    const tabA = screen.getByRole("tab", { name: "Tab A" });
    const tabB = screen.getByRole("tab", { name: "Tab B" });
    const panelA = getPanel(tabA);
    const panelB = getPanel(tabB);

    // Initial state: panel A visible, panel B hidden (Radix sets the hidden
    // attribute on inactive content).
    expect(panelA).toBeVisible();
    expect(panelB).not.toBeVisible();
    expect(panelB).toHaveAttribute("hidden");

    fireEvent.mouseDown(tabB);
    fireEvent.click(tabB);

    // B becomes the active trigger, A loses it.
    expect(tabB).toHaveAttribute("data-state", "active");
    expect(tabB).toHaveAttribute("aria-selected", "true");
    expect(tabA).toHaveAttribute("data-state", "inactive");
    expect(tabA).toHaveAttribute("aria-selected", "false");

    // The panels swap: B visible, A hidden.
    expect(panelB).toBeVisible();
    expect(panelB).toHaveAttribute("data-state", "active");
    expect(panelA).not.toBeVisible();
    expect(panelA).toHaveAttribute("hidden");
  });

  it("scrolls a focused tab into view (keyboard roving focus)", () => {
    // jsdom doesn't implement scrollIntoView — stub it and assert the list's
    // focus handler calls it with the minimal-scroll options.
    const scrollIntoView = vi.fn();
    const original = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = scrollIntoView;
    try {
      renderTabs();
      fireEvent.focusIn(screen.getByRole("tab", { name: "Tab B" }));
      expect(scrollIntoView).toHaveBeenCalledTimes(1);
      expect(scrollIntoView).toHaveBeenCalledWith({
        block: "nearest",
        inline: "nearest",
        behavior: "smooth",
      });
    } finally {
      Element.prototype.scrollIntoView = original;
    }
  });
});
