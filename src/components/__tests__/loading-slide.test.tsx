import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";

import { Slide } from "loading-dev";

/**
 * loading-dev's Slide spinner, adopted as the dashboard's route-change
 * indicator. The library ships its own server-safe RSC component (no hooks,
 * no state), so loading.tsx boundaries stay server components. These tests
 * pin the contract the dashboard relies on: the root class, the token-driven
 * color, and the size override.
 */
describe("Slide (loading-dev)", () => {
  it("renders the ld-slide root with its animated dots", () => {
    const { container } = render(<Slide />);
    const root = container.querySelector(".ld-slide");
    expect(root).toBeTruthy();
    // The moving dot is the visual signature of the slide animation.
    expect(container.querySelector(".ld-slide-dot")).toBeTruthy();
  });

  it("applies className and custom size", () => {
    const { container } = render(<Slide className="text-primary" size={28} />);
    const root = container.querySelector(".ld-slide") as HTMLElement;
    expect(root?.className).toContain("text-primary");
    expect(root?.getAttribute("style")).toContain("--ld-size");
  });
});
