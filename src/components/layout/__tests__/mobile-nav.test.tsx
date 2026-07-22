import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MobileNav } from "../mobile-nav";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: () => "/en/dashboard",
  useParams: () => ({ locale: "en" }),
}));

describe("MobileNav", () => {
  it("renders all navigation items", () => {
    render(<MobileNav />);
    expect(screen.getByText("Home")).toBeInTheDocument();
    expect(screen.getByText("Orders")).toBeInTheDocument();
    expect(screen.getByText("Customers")).toBeInTheDocument();
    expect(screen.getByText("Products")).toBeInTheDocument();
    expect(screen.getByText("EN")).toBeInTheDocument();
  });

  it("renders navigation links with correct hrefs", () => {
    render(<MobileNav />);
    const homeLink = screen.getByText("Home").closest("a");
    expect(homeLink).toHaveAttribute("href", "/en/dashboard");

    const ordersLink = screen.getByText("Orders").closest("a");
    expect(ordersLink).toHaveAttribute("href", "/en/orders");
  });

  it("highlights the active route", () => {
    render(<MobileNav />);
    const homeLink = screen.getByText("Home").closest("a");
    expect(homeLink?.className).toContain("text-indigo");
  });

  it("renders icons for each navigation item", () => {
    const { container } = render(<MobileNav />);
    // Should have 5 SVG icons (4 nav items + 1 globe)
    const icons = container.querySelectorAll("svg");
    expect(icons.length).toBe(5);
  });
});
