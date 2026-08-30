import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// The shared setup (setup.ts) mocks BOTH class-variance-authority (variant
// classes become placeholders) and @/components/ui/button (the component
// itself is replaced by a bare <button>). This file undoes both so the REAL
// Button and its real buttonVariants run — the point is pinning the actual
// variant/size classes. cva is pure string building and Radix Slot renders
// fine in jsdom, so nothing DOM-dependent is involved.
vi.unmock("class-variance-authority");
vi.unmock("@/components/ui/button");

import { Button } from "../button";

describe("Button", () => {
  it("renders a button with the default variant and size classes", () => {
    render(<Button aria-label="save">Save</Button>);
    const el = screen.getByRole("button", { name: "save" });
    expect(el.tagName).toBe("BUTTON");

    // The shared button chrome…
    expect(el).toHaveClass(
      "inline-flex",
      "items-center",
      "justify-center",
      "rounded-lg",
      "text-sm",
      "font-medium",
    );
    // …the default variant's colors…
    expect(el).toHaveClass("bg-primary", "text-primary-foreground", "hover:bg-primary/90");
    // …and the default size.
    expect(el).toHaveClass("h-10", "px-4", "py-2");
    expect(screen.getByText("Save")).toBeInTheDocument();
  });

  it("applies variant and size classes and merges a caller className", () => {
    render(
      <Button aria-label="edit" variant="outline" size="sm" className="ml-2">
        Edit
      </Button>,
    );
    const el = screen.getByRole("button", { name: "edit" });

    // The outline variant replaces the default variant's classes…
    expect(el).toHaveClass("border", "border-gray-300", "dark:border-gray-600");
    expect(el).not.toHaveClass("bg-primary");
    // …and size sm replaces the default size.
    expect(el).toHaveClass("h-9", "rounded-md", "px-3", "text-xs");
    expect(el).not.toHaveClass("h-10");
    // The caller className merges alongside the base.
    expect(el).toHaveClass("ml-2");
  });

  it("forwards props to the underlying button element", () => {
    render(
      <Button aria-label="submit" type="submit" disabled>
        Go
      </Button>,
    );
    const el = screen.getByRole("button", { name: "submit" });
    expect(el).toHaveAttribute("type", "submit");
    expect(el).toBeDisabled();
  });

  it("renders the child element instead of a button when asChild is set", () => {
    // The href is incidental to the Slot composition (an external URL keeps
    // @next/next/no-html-link-for-pages happy in this src/ test file).
    render(
      <Button asChild>
        <a href="https://example.com/orders">Go to orders</a>
      </Button>,
    );

    // Radix Slot composes the child: the anchor keeps its role and href…
    const link = screen.getByRole("link", { name: "Go to orders" });
    expect(link).toHaveAttribute("href", "https://example.com/orders");
    // …and no <button> is rendered at all.
    expect(screen.queryByRole("button")).not.toBeInTheDocument();

    // The button's classes land on the child through the Slot merge.
    expect(link).toHaveClass("inline-flex", "items-center");
    expect(link).toHaveClass("bg-primary", "text-primary-foreground");
  });
});
