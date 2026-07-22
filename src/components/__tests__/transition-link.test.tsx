import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TransitionLink } from "../transition-link";

// Mock next/link
vi.mock("next/link", () => ({
  __esModule: true,
  default: vi.fn(
    ({
      children,
      href,
      ...props
    }: {
      children: React.ReactNode;
      href: string;
      [key: string]: any;
    }) => (
      <a href={href} {...props}>
        {children}
      </a>
    )
  ),
}));

describe("TransitionLink", () => {
  it("renders children inside an anchor element", () => {
    render(
      <TransitionLink href="/test">
        <span data-testid="child">Click me</span>
      </TransitionLink>
    );

    expect(screen.getByTestId("child")).toBeInTheDocument();
    expect(screen.getByText("Click me")).toBeInTheDocument();
  });

  it("passes href to the underlying link", () => {
    render(<TransitionLink href="/target-page">Link</TransitionLink>);

    const link = screen.getByText("Link");
    expect(link).toHaveAttribute("href", "/target-page");
  });

  it("applies viewTransitionName as data attribute", () => {
    render(
      <TransitionLink href="/page" viewTransitionName="my-transition">
        Animated Link
      </TransitionLink>
    );

    const link = screen.getByText("Animated Link");
    expect(link).toHaveAttribute("data-view-transition-name", "my-transition");
  });

  it("does NOT set data attribute when viewTransitionName is omitted", () => {
    render(<TransitionLink href="/page">Plain Link</TransitionLink>);

    const link = screen.getByText("Plain Link");
    expect(link).not.toHaveAttribute("data-view-transition-name");
  });

  it("forwards additional props to the link", () => {
    render(
      <TransitionLink
        href="/page"
        className="custom-class"
        aria-label="Custom label"
      >
        Styled Link
      </TransitionLink>
    );

    const link = screen.getByText("Styled Link");
    expect(link).toHaveAttribute("class", "custom-class");
    expect(link).toHaveAttribute("aria-label", "Custom label");
  });

  it("renders with custom ref and accessible name", () => {
    const ref = { current: null };
    render(
      <TransitionLink
        ref={ref as any}
        href="/ref-test"
        aria-label="Ref link"
      >
        Ref Link
      </TransitionLink>
    );

    const link = screen.getByText("Ref Link");
    expect(link).toHaveAttribute("href", "/ref-test");
  });

  it("handles className prop from parent", () => {
    render(
      <TransitionLink href="/styled" className="text-blue-500 font-bold">
        Styled
      </TransitionLink>
    );

    const link = screen.getByText("Styled");
    expect(link).toHaveAttribute("class", "text-blue-500 font-bold");
  });

  it("sets displayName for debugging", () => {
    expect(TransitionLink.displayName).toBe("TransitionLink");
  });
});
