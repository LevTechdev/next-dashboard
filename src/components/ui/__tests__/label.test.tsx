import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Label } from "../label";

describe("Label", () => {
  it("renders a label with the shared form-label styling", () => {
    render(<Label htmlFor="email">Email address</Label>);
    const el = screen.getByText("Email address");

    expect(el.tagName).toBe("LABEL");
    expect(el).toHaveClass("text-sm", "font-medium", "text-zinc-700", "dark:text-zinc-300");
    expect(el).toHaveAttribute("for", "email");
  });

  it("merges caller classes and overrides the color via className", () => {
    render(
      <Label htmlFor="password" className="text-lime-700 block mb-1.5">
        Password
      </Label>,
    );
    const el = screen.getByText("Password");

    // The auth pages' lime light-mode accent and layout classes join the base
    // (in production cn/twMerge drops the base text-zinc-700 for the caller's
    // text-lime-700 — the test setup's plain-join cn keeps both).
    expect(el).toHaveClass("block", "mb-1.5");
    expect(el).toHaveClass("text-lime-700");
    expect(el).toHaveClass("text-sm", "font-medium");
  });
});
