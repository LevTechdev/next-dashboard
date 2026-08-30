import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// The shared setup (setup.ts) replaces class-variance-authority with a stub
// whose variants are placeholder classes ("bg-white text-black" / "border
// rounded"). This file undoes that so the REAL cva runs: the point of these
// tests is pinning the badge's actual variant classes, which the stub cannot
// produce. cva is pure string building, so nothing DOM-dependent is involved.
vi.unmock("class-variance-authority");

import { Badge } from "../badge";

describe("Badge", () => {
  it("renders the default variant with the shared pill base styling", () => {
    render(<Badge aria-label="pill">New</Badge>);
    const el = screen.getByLabelText("pill");

    // The shared pill chrome…
    expect(el).toHaveClass(
      "inline-flex",
      "items-center",
      "rounded-full",
      "px-2.5",
      "py-0.5",
      "text-xs",
      "font-medium",
      "transition-colors",
    );
    // …and the default variant's colors.
    expect(el).toHaveClass(
      "bg-indigo-100",
      "text-indigo-800",
      "dark:bg-indigo-900/30",
      "dark:text-indigo-400",
    );
    expect(screen.getByText("New")).toBeInTheDocument();
  });

  it("applies variant colors and merges a caller className", () => {
    render(
      <Badge aria-label="pill" variant="outline" className="ml-2">
        Draft
      </Badge>,
    );
    const el = screen.getByLabelText("pill");

    // The outline variant swaps the color classes (the default's are gone).
    expect(el).toHaveClass("border", "border-gray-300", "dark:border-gray-600");
    expect(el).not.toHaveClass("bg-indigo-100");

    // The pill chrome and the caller className still apply.
    expect(el).toHaveClass("inline-flex", "rounded-full");
    expect(el).toHaveClass("ml-2");
  });
});
